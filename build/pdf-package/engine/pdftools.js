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
 */

const PDF_TOOLS = {

  /* ===================== MANIPULATE ===================== */

  'merge-pdf': {
    title: 'Merge PDF Files',
    kind: 'transform', multiple: true,
    description: 'Combine several PDFs into one, in any order, without uploading anything.',
    keywords: ['merge pdf', 'combine pdf', 'join pdf files', 'pdf merger', 'concatenate pdf'],
    controls: [
      { key: 'ranges', label: 'Pages to take from each file', type: 'text', default: 'all',
        hint: 'all, or per-file like: 1-3 | all | 2,5' },
      { key: 'keepMeta', label: 'Metadata', type: 'select', default: 'strip',
        options: [
          { value: 'strip', label: 'Strip all metadata' },
          { value: 'first', label: 'Keep metadata from the first file' }
        ]},
      { key: 'title', label: 'Document title (optional)', type: 'text', default: '' }
    ],
    run: async ({ docs, opts, core }) => {
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

      const bytes = await core.assemble(items, { info });
      return {
        files: [{ name: 'merged.pdf', bytes }],
        stats: [
          ['Files merged', String(docs.length)],
          ['Total pages', String(items.length)],
          ...perFile,
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
    tips: [
      'Files merge in the order listed. Use the arrows in the file list to reorder before merging.',
      'Give one page range to apply to every file, or separate them with | to set each file individually — for example "1-3 | all | 2,5".',
      'Metadata is stripped by default, since a merged document inheriting one source file\u2019s author and title is usually wrong.',
      'Bookmarks, form fields and annotations from the source files are not carried across. Page content, images and page geometry are.'
    ],
    faq: [
      { q: 'Are my files uploaded?', a: 'No. The PDFs are parsed and rewritten by your own browser. Nothing is transmitted, which is why this works offline and why it is safe for contracts and financial documents.' },
      { q: 'Why are my bookmarks missing?', a: 'Merging rebuilds the page tree from scratch, which is what makes the output reliably valid. Carrying outlines across from several documents with conflicting structures is where most mergers produce broken files, so this deliberately drops them.' }
    ]
  },

  'split-pdf': {
    title: 'Split PDF',
    kind: 'transform', multiple: false,
    description: 'Split one PDF into several files — by page count, by ranges, or one file per page.',
    keywords: ['split pdf', 'separate pdf pages', 'divide pdf', 'pdf splitter', 'break up pdf'],
    controls: [
      { key: 'mode', label: 'Split', type: 'select', default: 'each',
        options: [
          { value: 'each', label: 'One file per page' },
          { value: 'every', label: 'Every N pages' },
          { value: 'ranges', label: 'By explicit ranges' },
          { value: 'half', label: 'In half' }
        ]},
      { key: 'n', label: 'Pages per file', type: 'number', default: 2, min: 1, max: 500 },
      { key: 'ranges', label: 'Ranges, one output per group', type: 'text', default: '1-3 | 4-6 | 7-' }
    ],
    run: async ({ docs, opts, core }) => {
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
        const bytes = await core.assemble(groups[g].map(p => ({ doc, pageIndex: p })), {});
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
    tips: [
      'One file per page is the right choice for scanned batches where each page is a separate document.',
      'Explicit ranges give you full control: "1-3 | 4-6 | 7-" produces three files, with the last taking everything from page 7 onward.',
      'Several output files are offered as a ZIP so you get them in one download.'
    ],
    faq: [
      { q: 'Do the split files keep the original quality?', a: 'Yes. Page content streams and embedded images are copied byte for byte — nothing is re-encoded or recompressed.' }
    ]
  },

  'extract-pdf-pages': {
    title: 'Extract PDF Pages',
    kind: 'transform', multiple: false,
    description: 'Pull specific pages out of a PDF into a new document, keeping the order you specify.',
    keywords: ['extract pdf pages', 'select pdf pages', 'pdf page extractor', 'get pages from pdf', 'copy pdf pages'],
    controls: [
      { key: 'pages', label: 'Pages to keep', type: 'text', default: '1-3',
        hint: 'e.g. 1-3, 7, 10-' },
      { key: 'order', label: 'Order', type: 'select', default: 'asis',
        options: [
          { value: 'asis', label: 'As listed' },
          { value: 'sorted', label: 'Sorted by page number' },
          { value: 'reverse', label: 'Reversed' }
        ]}
    ],
    run: async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      let idx;
      try { idx = core.parsePageRange(opts.pages, total); }
      catch (e) { return { error: e.message }; }

      if (opts.order === 'sorted') idx = idx.slice().sort((a, b) => a - b);
      if (opts.order === 'reverse') idx = idx.slice().reverse();

      const bytes = await core.assemble(idx.map(p => ({ doc, pageIndex: p })), {});
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
    tips: [
      'Page selections accept ranges, single pages and open-ended forms: "1-3, 7, 10-" takes pages 1 to 3, page 7, and everything from 10 onward.',
      'Order "as listed" respects what you typed, so "5, 1, 3" produces those pages in that order — useful for reordering as you extract.',
      'A page can appear twice. "1, 1, 2" duplicates the first page, which is occasionally what you want for a cover sheet.'
    ],
    faq: [
      { q: 'What happens to pages I do not select?', a: 'They are simply not copied. The original file on your device is untouched — this always produces a new document.' }
    ]
  },

  'delete-pdf-pages': {
    title: 'Delete PDF Pages',
    kind: 'transform', multiple: false,
    description: 'Remove unwanted pages from a PDF — blank scans, cover sheets, or anything else.',
    keywords: ['delete pdf pages', 'remove pages from pdf', 'pdf page remover', 'erase pdf page'],
    controls: [
      { key: 'pages', label: 'Pages to remove', type: 'text', default: '1', hint: 'e.g. 1, 4-6, 10-' }
    ],
    run: async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      let drop;
      try { drop = new Set(core.parsePageRange(opts.pages, total)); }
      catch (e) { return { error: e.message }; }

      const keep = Array.from({ length: total }, (_, i) => i).filter(i => !drop.has(i));
      if (!keep.length) return { error: 'That would remove every page. Leave at least one.' };

      const bytes = await core.assemble(keep.map(p => ({ doc, pageIndex: p })), {});
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
    tips: [
      'Check the page numbers against the PDF\u2019s own numbering, not any printed numbers on the page — a document with a cover often has them offset by one.',
      'The inspector tool lists page count and sizes if you are unsure which page is which.',
      'Nothing is destroyed. A new file is produced and your original stays as it is.'
    ],
    faq: [
      { q: 'Can I get a deleted page back?', a: 'From the output, no. Keep the original file until you have checked the result — which is why this never overwrites anything.' }
    ]
  },

  'rotate-pdf': {
    title: 'Rotate PDF Pages',
    kind: 'transform', multiple: false,
    description: 'Rotate every page or selected pages by 90, 180 or 270 degrees, permanently.',
    keywords: ['rotate pdf', 'turn pdf pages', 'pdf orientation', 'fix sideways pdf', 'rotate pdf permanently'],
    controls: [
      { key: 'angle', label: 'Rotate by', type: 'select', default: '90',
        options: [
          { value: '90', label: '90° clockwise' },
          { value: '180', label: '180°' },
          { value: '270', label: '90° anticlockwise' }
        ]},
      { key: 'pages', label: 'Pages', type: 'text', default: 'all', hint: 'all, or 1-3, 7' }
    ],
    run: async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      let sel;
      try { sel = new Set(core.parsePageRange(opts.pages, total)); }
      catch (e) { return { error: e.message }; }

      const angle = Number(opts.angle) || 90;
      const items = Array.from({ length: total }, (_, i) => ({
        doc, pageIndex: i, rotate: sel.has(i) ? angle : 0
      }));
      const bytes = await core.assemble(items, {});
      const base = docs[0].name.replace(/\.pdf$/i, '');
      return {
        files: [{ name: `${base}-rotated.pdf`, bytes }],
        stats: [
          ['Pages', String(total)],
          ['Pages rotated', String(sel.size)],
          ['Rotation applied', angle + '°'],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
    tips: [
      'Rotation is written into the page itself, so every viewer shows it the same way. Rotating in a reader without saving only changes your own view.',
      'Rotation is additive: a page already at 90° rotated by another 90° ends at 180°.',
      'A scanned page that looks sideways but reports no rotation was scanned that way — rotating fixes it properly here.'
    ],
    faq: [
      { q: 'Does rotating reduce quality?', a: 'No. The page content is untouched; only a rotation flag changes. There is no re-rendering and no loss.' }
    ]
  },

  'pdf-metadata': {
    title: 'PDF Metadata Editor & Remover',
    kind: 'transform', multiple: false,
    description: 'View, change or completely strip the hidden metadata in a PDF — author, title, software.',
    keywords: ['pdf metadata', 'remove pdf metadata', 'edit pdf properties', 'pdf author remove', 'anonymise pdf'],
    controls: [
      { key: 'action', label: 'Action', type: 'select', default: 'strip',
        options: [
          { value: 'strip', label: 'Remove all metadata' },
          { value: 'edit', label: 'Set the fields below' }
        ]},
      { key: 'Title', label: 'Title', type: 'text', default: '' },
      { key: 'Author', label: 'Author', type: 'text', default: '' },
      { key: 'Subject', label: 'Subject', type: 'text', default: '' },
      { key: 'Keywords', label: 'Keywords', type: 'text', default: '' }
    ],
    run: async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const before = await doc.getInfo();
      const total = await doc.pageCount();

      const info = opts.action === 'edit'
        ? { Title: opts.Title, Author: opts.Author, Subject: opts.Subject, Keywords: opts.Keywords }
        : {};

      const items = Array.from({ length: total }, (_, i) => ({ doc, pageIndex: i }));
      const bytes = await core.assemble(items, { info });
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
    tips: [
      'PDFs routinely carry the author\u2019s name, their organisation, the software used and creation timestamps. It is a common and unintended disclosure when sending documents externally.',
      'This rewrites the document without the metadata dictionary rather than blanking fields, so nothing survives in the file.',
      'Some PDFs also carry an XMP metadata stream. Rebuilding the document drops that too.',
      'Text inside the page content is not metadata and is left alone. Redacting visible text needs a different approach.'
    ],
    faq: [
      { q: 'Is stripping metadata the same as redacting?', a: 'No, and the difference matters. This removes document properties. It does not remove text or images from the page, and it does not remove content hidden under a black box. For genuine redaction, the content itself must be deleted before the file is produced.' }
    ]
  },

  'pdf-inspector': {
    title: 'PDF Inspector',
    kind: 'inspect', multiple: false,
    description: 'Examine a PDF: page count, sizes, rotation, fonts, images, metadata and structure.',
    keywords: ['pdf inspector', 'pdf info', 'pdf properties', 'analyse pdf', 'pdf page size checker'],
    controls: [],
    run: async ({ docs, core }) => {
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
    tips: [
      'Page sizes are given in points and millimetres. A4 is 595 × 842 pt; US Letter is 612 × 792.',
      'Mixed page sizes in one document are a common cause of printing problems — this shows them grouped so a stray page stands out.',
      'Fonts listed with a prefix like ABCDEF+Arial are subsetted, meaning only the glyphs actually used are embedded.',
      'The metadata section is worth checking before sending a document externally. Author names and software versions are disclosed more often than people expect.'
    ],
    faq: [
      { q: 'Why does the object count differ from other tools?', a: 'Counting depends on whether objects inside compressed object streams are expanded and whether unreferenced objects are included. This expands object streams and counts everything it can reach.' }
    ]
  },

  'watermark-pdf': {
    title: 'Add Watermark to PDF',
    kind: 'transform', multiple: false,
    description: 'Stamp text across every page — DRAFT, CONFIDENTIAL, a name or a date — at any angle and opacity.',
    keywords: ['watermark pdf', 'add text to pdf', 'stamp pdf', 'draft watermark', 'confidential pdf'],
    controls: [
      { key: 'text', label: 'Watermark text', type: 'text', default: 'DRAFT' },
      { key: 'size', label: 'Font size', type: 'number', default: 60, min: 6, max: 300 },
      { key: 'angle', label: 'Angle', type: 'select', default: '45',
        options: [{ value: '0', label: 'Horizontal' }, { value: '45', label: '45° diagonal' },
                  { value: '90', label: 'Vertical' }, { value: '315', label: '−45° diagonal' }] },
      { key: 'colour', label: 'Colour', type: 'color', default: '#ff0000' },
      { key: 'opacity', label: 'Opacity %', type: 'number', default: 20, min: 5, max: 100 },
      { key: 'position', label: 'Position', type: 'select', default: 'center',
        options: [{ value: 'center', label: 'Centre' }, { value: 'tile', label: 'Tiled across the page' },
                  { value: 'bottom', label: 'Bottom of the page' }] },
      { key: 'pages', label: 'Pages', type: 'text', default: 'all' }
    ],
    run: async ({ docs, opts, core }) => {
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
        const box = (await doc.resolve(pages[i].dict.MediaBox || pages[i].inherited.MediaBox)) || [0, 0, 595.28, 841.89];
        const W = Math.abs(Number(box[2]) - Number(box[0]));
        const H = Math.abs(Number(box[3]) - Number(box[1]));
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
          content: ops, fontKey: 'MVRwm', fontName: 'Helvetica-Bold', needsGS: true, opacity
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
    tips: [
      'A watermark added this way sits on top of the page content and can be removed by anyone with a PDF editor. It signals status; it does not protect anything.',
      'Tiled watermarks are much harder to crop out than a single central one, which matters for documents that might be screenshotted.',
      'Keep opacity around 15–25%. Higher and it fights the text; lower and it vanishes when printed.',
      'The text is drawn with a standard font, so no font file is embedded and the file barely grows.'
    ],
    faq: [
      { q: 'Can the watermark be removed?', a: 'Yes, by anyone reasonably determined — it is a content layer, not a security feature. If a document genuinely must not be redistributed, watermarking is a deterrent and an audit aid, not a control.' }
    ]
  },

  'pdf-page-numbers': {
    title: 'Add Page Numbers to PDF',
    kind: 'transform', multiple: false,
    description: 'Stamp page numbers, headers or footers onto an existing PDF.',
    keywords: ['add page numbers to pdf', 'pdf page numbering', 'pdf header footer', 'number pdf pages'],
    controls: [
      { key: 'format', label: 'Format', type: 'select', default: 'n',
        options: [
          { value: 'n', label: '1' },
          { value: 'n-of-t', label: '1 of 10' },
          { value: 'page-n', label: 'Page 1' },
          { value: 'page-n-of-t', label: 'Page 1 of 10' },
          { value: 'dash', label: '– 1 –' }
        ]},
      { key: 'position', label: 'Position', type: 'select', default: 'bc',
        options: [
          { value: 'bl', label: 'Bottom left' }, { value: 'bc', label: 'Bottom centre' },
          { value: 'br', label: 'Bottom right' }, { value: 'tl', label: 'Top left' },
          { value: 'tc', label: 'Top centre' }, { value: 'tr', label: 'Top right' }
        ]},
      { key: 'start', label: 'Start numbering at', type: 'number', default: 1, min: 0 },
      { key: 'skip', label: 'Skip first N pages', type: 'number', default: 0, min: 0 },
      { key: 'size', label: 'Font size', type: 'number', default: 10, min: 5, max: 48 },
      { key: 'colour', label: 'Colour', type: 'color', default: '#333333' },
      { key: 'extra', label: 'Header or footer text (optional)', type: 'text', default: '' }
    ],
    run: async ({ docs, opts, core }) => {
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

        const box = (await doc.resolve(pages[i].dict.MediaBox || pages[i].inherited.MediaBox)) || [0, 0, 595.28, 841.89];
        const W = Math.abs(Number(box[2]) - Number(box[0]));
        const H = Math.abs(Number(box[3]) - Number(box[1]));
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
          content: ops, fontKey: 'MVRpn', fontName: 'Helvetica', needsGS: false, opacity: 1
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
    tips: [
      'Skip the first page when the document has a cover, and start numbering at 1 on the page after it.',
      'Numbers are placed 32 points — about 11 mm — from the page edge, inside the printable area of virtually every printer.',
      'If the document already has printed page numbers, these will sit alongside them. Check a page before committing to a long document.',
      'Mixed page sizes are handled: the position is computed per page from that page\u2019s own dimensions.'
    ],
    faq: [
      { q: 'Can I use Roman numerals for a preface?', a: 'Not in one pass. Split the document, number the preface separately with a different format, then merge — which is exactly what the split and merge tools are for.' }
    ]
  },

  /* ===================== CREATE ===================== */

  'text-to-pdf': {
    title: 'Text to PDF Converter',
    kind: 'create', multiple: false,
    description: 'Turn plain text into a properly paginated PDF with margins, wrapping and page numbers.',
    keywords: ['text to pdf', 'txt to pdf', 'create pdf from text', 'convert text to pdf', 'make a pdf'],
    inputLabel: 'Your text',
    controls: [
      { key: 'pageSize', label: 'Page size', type: 'select', default: 'a4',
        options: [{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' },
                  { value: 'a5', label: 'A5' }, { value: 'legal', label: 'Legal' }] },
      { key: 'font', label: 'Font', type: 'select', default: 'Helvetica',
        options: [{ value: 'Helvetica', label: 'Helvetica (sans)' },
                  { value: 'Times-Roman', label: 'Times (serif)' },
                  { value: 'Courier', label: 'Courier (monospace)' }] },
      { key: 'size', label: 'Font size', type: 'number', default: 11, min: 6, max: 36 },
      { key: 'leading', label: 'Line spacing', type: 'number', default: 1.4, min: 1, max: 3, step: 0.1 },
      { key: 'margin', label: 'Margin (mm)', type: 'number', default: 20, min: 5, max: 60 },
      { key: 'numbers', label: 'Page numbers', type: 'select', default: 'yes',
        options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      { key: 'title', label: 'Document title', type: 'text', default: '' }
    ],
    run: async ({ text, opts, core }) => {
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
    tips: [
      'Text is wrapped using the real font metrics, so lines break where they actually would rather than at a guessed character count.',
      'Only the standard PDF fonts are used — Helvetica, Times and Courier — which means no font file is embedded and the file stays tiny.',
      'Characters outside Western European ranges cannot be represented without embedding a font, and appear as "?". For other scripts, use a word processor.',
      'Blank lines in your text are preserved as blank lines in the output.'
    ],
    faq: [
      { q: 'Why do accented characters work but not Chinese or Arabic?', a: 'The standard PDF fonts cover WinAnsi encoding, which includes Western European accents. Other scripts need an embedded font with those glyphs, and embedding a CJK font would add several megabytes to every page of this site.' }
    ]
  },

  'invoice-pdf': {
    title: 'Invoice Generator (PDF)',
    kind: 'create', multiple: false,
    description: 'Create a clean, professional invoice PDF with line items, tax and totals calculated for you.',
    keywords: ['invoice generator', 'create invoice pdf', 'free invoice template', 'make an invoice', 'invoice maker'],
    controls: [
      { key: 'from', label: 'Your business (name, address)', type: 'textarea', default: 'MVR IT Services LTD\nReading, United Kingdom\nCompany No. 10251131' },
      { key: 'to', label: 'Bill to', type: 'textarea', default: 'Client Name Ltd\n1 Example Street\nLondon, EC1A 1AA' },
      { key: 'number', label: 'Invoice number', type: 'text', default: 'INV-0001' },
      { key: 'date', label: 'Invoice date', type: 'date', default: 'TODAY' },
      { key: 'due', label: 'Payment terms', type: 'select', default: '30',
        options: [{ value: '0', label: 'Due on receipt' }, { value: '7', label: 'Net 7' },
                  { value: '14', label: 'Net 14' }, { value: '30', label: 'Net 30' },
                  { value: '60', label: 'Net 60' }] },
      { key: 'items', label: 'Line items — description, qty, unit price (one per line)', type: 'textarea',
        default: 'Website design and build, 1, 4500\nHosting and support (12 months), 12, 45\nDomain registration, 1, 15' },
      { key: 'currency', label: 'Currency', type: 'select', default: 'GBP',
        options: [{ value: 'GBP', label: 'GBP £' }, { value: 'USD', label: 'USD $' },
                  { value: 'EUR', label: 'EUR €' }, { value: 'INR', label: 'INR Rs' }] },
      { key: 'tax', label: 'Tax rate %', type: 'number', default: 20, min: 0, max: 100, step: 0.5 },
      { key: 'taxLabel', label: 'Tax label', type: 'text', default: 'VAT' },
      { key: 'notes', label: 'Notes / payment details', type: 'textarea', default: 'Payment by bank transfer.\nThank you for your business.' },
      { key: 'accent', label: 'Accent colour', type: 'color', default: '#f7c948' }
    ],
    run: async ({ opts, core }) => {
      const SYM = { GBP: '\u00a3', USD: '$', EUR: '\u20ac', INR: 'Rs ' };
      const sym = SYM[opts.currency] || '';
      const rows = [];
      for (const line of String(opts.items || '').split('\n')) {
        if (!line.trim()) continue;
        const parts = line.split(',').map(s => s.trim());
        const price = parseFloat(parts[parts.length - 1]);
        const qty = parseFloat(parts[parts.length - 2]);
        if (!isFinite(price) || !isFinite(qty) || parts.length < 3) {
          return { error: `Could not read "${line.slice(0, 40)}". Use: description, quantity, unit price` };
        }
        rows.push({ desc: parts.slice(0, -2).join(', '), qty, price, total: qty * price });
      }
      if (!rows.length) return { error: 'Add at least one line item.' };

      const money = (v) => sym + v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const sub = rows.reduce((s, r) => s + r.total, 0);
      const taxRate = Math.max(0, Number(opts.tax) || 0);
      const taxAmt = sub * taxRate / 100;
      const grand = sub + taxAmt;

      const [W, H] = core.PAGE_SIZES.a4;
      const m = 48;
      const ops = [];

      ops.push({ rect: [0, H - 8, W, 8], fill: opts.accent });
      ops.push({ text: 'INVOICE', x: m, y: H - 70, size: 30, font: 'Helvetica-Bold' });
      ops.push({ text: opts.number || '', x: W - m, y: H - 70, size: 13, font: 'Helvetica-Bold', align: 'right' });

      const d0 = new Date(opts.date);
      const due = new Date(d0); due.setDate(due.getDate() + (Number(opts.due) || 0));
      const fmtD = (d) => isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      ops.push({ text: 'Date: ' + fmtD(d0), x: W - m, y: H - 90, size: 10, align: 'right', colour: '#555555' });
      ops.push({ text: 'Due: ' + fmtD(due), x: W - m, y: H - 105, size: 10, align: 'right', colour: '#555555' });

      let y = H - 140;
      ops.push({ text: 'FROM', x: m, y, size: 8, font: 'Helvetica-Bold', colour: '#888888' });
      ops.push({ text: 'BILL TO', x: W / 2, y, size: 8, font: 'Helvetica-Bold', colour: '#888888' });
      y -= 16;
      const fromLines = String(opts.from || '').split('\n');
      const toLines = String(opts.to || '').split('\n');
      const blockLines = Math.max(fromLines.length, toLines.length);
      for (let i = 0; i < blockLines; i++) {
        if (fromLines[i]) ops.push({ text: fromLines[i], x: m, y: y - i * 14, size: 10 });
        if (toLines[i]) ops.push({ text: toLines[i], x: W / 2, y: y - i * 14, size: 10 });
      }
      y -= blockLines * 14 + 26;

      ops.push({ rect: [m, y - 4, W - m * 2, 22], fill: '#f2f2f2' });
      ops.push({ text: 'DESCRIPTION', x: m + 8, y: y + 3, size: 8, font: 'Helvetica-Bold', colour: '#555555' });
      ops.push({ text: 'QTY', x: W - m - 190, y: y + 3, size: 8, font: 'Helvetica-Bold', colour: '#555555', align: 'right' });
      ops.push({ text: 'UNIT', x: W - m - 100, y: y + 3, size: 8, font: 'Helvetica-Bold', colour: '#555555', align: 'right' });
      ops.push({ text: 'AMOUNT', x: W - m - 8, y: y + 3, size: 8, font: 'Helvetica-Bold', colour: '#555555', align: 'right' });
      y -= 26;

      for (const r of rows) {
        const wrapped = core.wrapText(r.desc, 'Helvetica', 10, W - m * 2 - 210);
        wrapped.forEach((ln, k) => ops.push({ text: ln, x: m + 8, y: y - k * 13, size: 10 }));
        ops.push({ text: String(r.qty), x: W - m - 190, y, size: 10, align: 'right' });
        ops.push({ text: money(r.price), x: W - m - 100, y, size: 10, align: 'right' });
        ops.push({ text: money(r.total), x: W - m - 8, y, size: 10, align: 'right', font: 'Helvetica-Bold' });
        y -= Math.max(1, wrapped.length) * 13 + 8;
        ops.push({ line: [m, y + 6, W - m, y + 6], stroke: '#e8e8e8', lineWidth: 0.5 });
        y -= 6;
      }

      y -= 12;
      const totalRow = (label, val, bold, big) => {
        ops.push({ text: label, x: W - m - 110, y, size: big ? 12 : 10, align: 'right',
                   font: bold ? 'Helvetica-Bold' : 'Helvetica' });
        ops.push({ text: val, x: W - m - 8, y, size: big ? 12 : 10, align: 'right',
                   font: bold ? 'Helvetica-Bold' : 'Helvetica' });
        y -= big ? 22 : 16;
      };
      totalRow('Subtotal', money(sub));
      if (taxRate) totalRow(`${opts.taxLabel || 'Tax'} ${taxRate}%`, money(taxAmt));
      ops.push({ rect: [W - m - 220, y - 4, 220, 26], fill: opts.accent });
      totalRow('TOTAL DUE', money(grand), true, true);

      if (opts.notes) {
        y -= 20;
        ops.push({ text: 'NOTES', x: m, y, size: 8, font: 'Helvetica-Bold', colour: '#888888' });
        y -= 14;
        core.wrapText(opts.notes, 'Helvetica', 9, W - m * 2).forEach((ln, k) => {
          ops.push({ text: ln, x: m, y: y - k * 12, size: 9, colour: '#555555' });
        });
      }

      const bytes = core.createPDF([{ size: [W, H], ops }], {
        info: { Title: `Invoice ${opts.number || ''}`.trim(), Author: fromLines[0] || '' }
      });
      return {
        files: [{ name: `${slug(opts.number || 'invoice')}.pdf`, bytes }],
        stats: [
          ['Line items', String(rows.length)],
          ['Subtotal', money(sub)],
          [`${opts.taxLabel || 'Tax'} ${taxRate}%`, money(taxAmt)],
          ['Total due', money(grand)],
          ['Due date', fmtD(due)],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
    tips: [
      'Line items take the form "description, quantity, unit price". The description may contain commas — only the last two values are read as numbers.',
      'A UK VAT invoice must show your VAT number, the tax point date and the rate applied. Add your VAT number to the business details block.',
      'Invoice numbers should be sequential with no gaps. Tax authorities in most jurisdictions expect to see an unbroken series.',
      'Everything is generated on your device, so client names and amounts never leave it.'
    ],
    faq: [
      { q: 'Is this a legally compliant invoice?', a: 'It produces the layout. Whether it is compliant depends on your jurisdiction and what you include — VAT registration number, tax point, reverse charge wording where relevant. Check the requirements for your country, or ask your accountant, before issuing.' }
    ]
  },

  'paper-pdf': {
    title: 'Printable Paper Generator',
    kind: 'create', multiple: false,
    description: 'Generate graph, lined, dotted, isometric or music paper as a print-ready PDF.',
    keywords: ['graph paper pdf', 'printable lined paper', 'dot grid paper', 'isometric paper', 'music manuscript paper', 'squared paper'],
    controls: [
      { key: 'type', label: 'Paper type', type: 'select', default: 'grid',
        options: [
          { value: 'grid', label: 'Graph / squared' },
          { value: 'lined', label: 'Lined (ruled)' },
          { value: 'dot', label: 'Dot grid' },
          { value: 'iso', label: 'Isometric' },
          { value: 'music', label: 'Music manuscript' },
          { value: 'cornell', label: 'Cornell notes' },
          { value: 'blank', label: 'Blank with margin' }
        ]},
      { key: 'pageSize', label: 'Page size', type: 'select', default: 'a4',
        options: [{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' },
                  { value: 'a5', label: 'A5' }, { value: 'a3', label: 'A3' }] },
      { key: 'orientation', label: 'Orientation', type: 'select', default: 'portrait',
        options: [{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }] },
      { key: 'spacing', label: 'Spacing (mm)', type: 'number', default: 5, min: 2, max: 30, step: 0.5 },
      { key: 'colour', label: 'Line colour', type: 'color', default: '#9db4d0' },
      { key: 'weight', label: 'Line weight', type: 'number', default: 0.4, min: 0.1, max: 2, step: 0.1 },
      { key: 'margin', label: 'Margin (mm)', type: 'number', default: 10, min: 0, max: 40 },
      { key: 'pages', label: 'Number of pages', type: 'number', default: 1, min: 1, max: 100 }
    ],
    run: async ({ opts, core }) => {
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
    tips: [
      'Print at 100% scale with no "fit to page", or the spacing will not measure what it says. 5 mm graph paper printed at 96% is no longer 5 mm.',
      'A pale blue-grey grid photocopies and scans far better than black, and is easier to draw over.',
      'Isometric paper uses a 60-degree triangular grid, which is the standard for technical and orthographic sketching.',
      'Cornell layout gives a narrow cue column on the left, a wide notes area, and a summary strip at the bottom.'
    ],
    faq: [
      { q: 'Why does my printed grid measure slightly wrong?', a: 'Almost always print scaling. Check the print dialogue for "Actual size" or 100%, and turn off any margin fitting. Printers also have a small non-printable border, which is what the margin setting accounts for.' }
    ]
  },

  'label-pdf': {
    title: 'Label Sheet Generator',
    kind: 'create', multiple: false,
    description: 'Print address or product labels on standard sheet layouts, with data from a list.',
    keywords: ['label template pdf', 'address label generator', 'avery labels pdf', 'print labels', 'label sheet maker'],
    controls: [
      { key: 'layout', label: 'Label layout', type: 'select', default: '3x7',
        options: [
          { value: '3x7', label: 'A4 — 3 × 7 (63.5 × 38.1 mm, 21 per sheet)' },
          { value: '2x8', label: 'A4 — 2 × 8 (99.1 × 33.9 mm, 16 per sheet)' },
          { value: '2x7', label: 'A4 — 2 × 7 (99.1 × 38.1 mm, 14 per sheet)' },
          { value: '1x10', label: 'A4 — 1 × 10 (200 × 27 mm, 10 per sheet)' },
          { value: '4x10', label: 'A4 — 4 × 10 (45.7 × 25.4 mm, 40 per sheet)' }
        ]},
      { key: 'items', label: 'Label text — blank line between labels', type: 'textarea',
        default: 'MVR IT Services LTD\nReading\nUnited Kingdom\n\nSecond Label\nAnother Address\nSomewhere' },
      { key: 'repeat', label: 'If fewer labels than the sheet holds', type: 'select', default: 'repeat',
        options: [{ value: 'repeat', label: 'Repeat to fill the sheet' }, { value: 'once', label: 'Leave the rest blank' }] },
      { key: 'size', label: 'Font size', type: 'number', default: 9, min: 5, max: 18 },
      { key: 'align', label: 'Alignment', type: 'select', default: 'left',
        options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centred' }] },
      { key: 'guides', label: 'Cutting guides', type: 'select', default: 'no',
        options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Show outlines' }] }
    ],
    run: async ({ opts, core }) => {
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
    tips: [
      'Print at exactly 100% scale. Label sheets are unforgiving — even 2% scaling shifts text off the labels by the bottom of the page.',
      'Run one sheet on plain paper first and hold it against a real label sheet up to a window to check alignment.',
      'These dimensions match the common A4 label formats. Manufacturers vary slightly, so verify against your own sheets before printing a batch.',
      'Turn on cutting guides for plain paper, and off for real label stock where the outlines would print onto the labels.'
    ],
    faq: [
      { q: 'My labels are consistently a few millimetres off. What now?', a: 'That is almost always printer margin offset rather than the template. Most print drivers have a calibration or offset setting; alternatively adjust the margin in your printer dialogue by the amount you measured.' }
    ]
  },

  'certificate-pdf': {
    title: 'Certificate Generator',
    kind: 'create', multiple: false,
    description: 'Create certificates of completion, achievement or attendance — one, or a batch from a name list.',
    keywords: ['certificate generator', 'certificate of completion', 'award certificate pdf', 'diploma maker', 'certificate template'],
    controls: [
      { key: 'heading', label: 'Heading', type: 'text', default: 'Certificate of Completion' },
      { key: 'names', label: 'Recipient names (one per line)', type: 'textarea', default: 'Priya Sharma\nJames Okafor\nAnna Kowalski' },
      { key: 'body', label: 'Body text', type: 'textarea', default: 'has successfully completed the course\nAdvanced Web Development' },
      { key: 'date', label: 'Date', type: 'date', default: 'TODAY' },
      { key: 'signatory', label: 'Signatory name and title', type: 'text', default: 'A. Director\nManaging Director' },
      { key: 'org', label: 'Organisation', type: 'text', default: 'MVR IT Services LTD' },
      { key: 'accent', label: 'Accent colour', type: 'color', default: '#f7c948' },
      { key: 'orientation', label: 'Orientation', type: 'select', default: 'landscape',
        options: [{ value: 'landscape', label: 'Landscape' }, { value: 'portrait', label: 'Portrait' }] }
    ],
    run: async ({ opts, core }) => {
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
    tips: [
      'Enter one name per line to generate a batch — each becomes its own page in a single PDF, ready to print or split.',
      'Landscape is conventional for certificates and gives long names room to breathe.',
      'Very long names reduce automatically only if you lower the font size; check the longest name in your list before printing a batch.',
      'The signature line is left blank deliberately, for a real signature. A printed signature image offers no assurance to anyone.'
    ],
    faq: [
      { q: 'Can I add a logo?', a: 'Not in this tool — it uses only vector drawing and standard fonts, which is what keeps it dependency-free. To add a logo, generate the certificate here and overlay the image in a PDF editor, or print onto pre-printed letterhead.' }
    ]
  },

  /* ===================== RENDER (needs pdf.js) ===================== */

  'pdf-to-images': {
    title: 'PDF to Images',
    kind: 'render', multiple: false,
    description: 'Convert PDF pages to PNG or JPEG images at any resolution, entirely in your browser.',
    keywords: ['pdf to image', 'pdf to png', 'pdf to jpg', 'convert pdf to picture', 'extract pdf pages as images'],
    needsRenderer: true,
    controls: [
      { key: 'pages', label: 'Pages', type: 'text', default: 'all' },
      { key: 'dpi', label: 'Resolution', type: 'select', default: '150',
        options: [{ value: '72', label: '72 DPI — screen' }, { value: '150', label: '150 DPI — good' },
                  { value: '300', label: '300 DPI — print' }, { value: '600', label: '600 DPI — very large' }] },
      { key: 'format', label: 'Format', type: 'select', default: 'image/png',
        options: [{ value: 'image/png', label: 'PNG — lossless' }, { value: 'image/jpeg', label: 'JPEG — smaller' },
                  { value: 'image/webp', label: 'WebP — smallest' }] },
      { key: 'quality', label: 'Quality (JPEG/WebP)', type: 'number', default: 90, min: 40, max: 100 }
    ],
    tips: [
      'Rendering needs a PDF engine, so this page downloads one on first use — about a megabyte, cached afterwards, and only on this page.',
      '150 DPI suits screen use and most documents. 300 DPI matches print resolution and produces files roughly four times larger.',
      'PNG is lossless and right for text and diagrams. JPEG is smaller and better for pages that are mostly photographs.',
      'A 600 DPI A4 page is about 5000 × 7000 pixels. A long document at that resolution will use a great deal of memory.'
    ],
    faq: [
      { q: 'Why does this one need a download when the other PDF tools do not?', a: 'Merging, splitting and rotating only rearrange the file\u2019s structure, which needs no rendering. Turning a page into an image means interpreting fonts, vector paths and colour spaces — that is a full rendering engine, and it cannot be written small.' }
    ]
  },

  'pdf-organise': {
    title: 'Organise PDF Pages',
    kind: 'render', multiple: false,
    description: 'See page thumbnails and reorder, rotate or delete pages visually before saving.',
    keywords: ['organise pdf', 'reorder pdf pages', 'rearrange pdf', 'pdf page organizer', 'move pdf pages'],
    needsRenderer: true,
    controls: [],
    tips: [
      'Thumbnails need a rendering engine, downloaded once on first use and cached afterwards.',
      'Drag thumbnails to reorder, use the rotate button on each, and the cross to mark a page for removal.',
      'Nothing is changed until you save. The original file on your device is never modified.',
      'If you already know the page numbers you want, the extract, delete and rotate tools do the same job without any download.'
    ],
    faq: [
      { q: 'Is there a page limit?', a: 'Thumbnails are rendered on demand as you scroll, so long documents work — but a document of several hundred pages will use noticeable memory. For very large files, the numeric tools are lighter.' }
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PDF_TOOLS, fmtBytes, slug, rgbTriplet };
}
