/**
 * Claims on the PDF tools' pages (/pdf/), each checked against a run of the
 * tool: the spec on the shipped pdfcore.bundle.js in Node, or the page in
 * Chrome where the claim is about the page itself.
 */
'use strict';

module.exports = function ({ claim, manual, kit: K }) {
  const N = 'node', B = 'browser';
  const sec = (k) => K.once('pdf:secrets:' + k, () => K.secrets(k));
  const plainN = (n) => K.once('pdf:plain:' + n, () => K.plain(n));
  const run1 = async (id, file, opts, text) => K.runPdf(id, [file], opts, text);
  const S = async (k) => ({ name: 'secrets-' + k + '.pdf', bytes: await sec(k) });
  const P = async (n, name) => ({ name: name || ('plain-' + n + '.pdf'), bytes: await plainN(n) });
  const pagesOf = async (bytes) => (await K.pdfText(bytes)).pages.map((p) => p.join(' '));
  /** the text runs a content stream draws: font, size, position (Td or Tm), string */
  const runs = (content) => {
    const out = [];
    let font = null, size = null, x = 0, y = 0, m = null;
    const re = /\/([A-Za-z0-9+_-]+)\s+([\d.]+)\s+Tf|([-\d.]+)\s+([-\d.]+)\s+Td|([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+Tm|\((?:\\[\s\S]|[^\\)])*\)\s*Tj|\bBT\b/g;
    let t;
    while ((t = re.exec(content))) {
      if (t[0] === 'BT') { x = 0; y = 0; m = null; }
      else if (t[1]) { font = t[1]; size = Number(t[2]); }
      else if (t[3] !== undefined) { x += Number(t[3]); y += Number(t[4]); }
      else if (t[5] !== undefined) { m = t.slice(5, 11).map(Number); x = m[4]; y = m[5]; }
      else out.push({ font, size, x, y, m, str: K.shown(t[0])[0] });
    }
    return out;
  };
  const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 0.05 : tol);
  const errOf = (res) => res.error || '';
  const hasFontFile = (a) => /\/FontFile/.test(a.text);
  const hasImage = (a) => /\/Subtype\s*\/Image/.test(a.text);

  /* ================================================================ */
  /* merge                                                             */
  /* ================================================================ */
  const M = '/pdf/merge-pdf/';
  const merged = () => K.once('pdf:merged', async () => K.runPdf('merge-pdf', [{ name: 'first.pdf', bytes: await sec('A') }, { name: 'second.pdf', bytes: await sec('B') }], {}));
  claim(M, 'tip', 'Give one page range to apply to every file, or separate them with | to set each file individually — for example "1-3 | all | 2,5".',
    'per-file ranges "1-3 | all | 2,5" take those pages from each file', N, async () => {
      const files = [await P(5, 'a.pdf'), await P(4, 'b.pdf'), await P(6, 'c.pdf')];
      const r = await K.runPdf('merge-pdf', files, { ranges: '1-3 | all | 2,5' });
      const got = (await pagesOf(K.pdfOut(r))).join(',');
      return [got === 'PAGE-1,PAGE-2,PAGE-3,PAGE-1,PAGE-2,PAGE-3,PAGE-4,PAGE-2,PAGE-5', got || errOf(r)];
    });
  claim(M, 'tip', 'Metadata is stripped by default', 'default merge writes no Info and no XMP', N, async () => {
    const a = await K.analyse(K.pdfOut(await merged()));
    return [JSON.stringify(a.info) === '{}' && a.root.Metadata === undefined && !/Fixture Author|XMP-AUTHOR/.test(a.text), 'info ' + K.j(a.info) + ', Metadata ' + (a.root.Metadata ? 'present' : 'absent')];
  });
  claim(M, 'tip', 'a link to a page you left out is removed rather than pointed somewhere wrong',
    'merge "1 | all": the first file\'s links to its pages 2 and 3 are gone, its web link stays', N, async () => {
      const r = await K.runPdf('merge-pdf', [await S('A'), await S('B')], { ranges: '1 | all' });
      const a = await K.analyse(K.pdfOut(r));
      const l = (await a.annots(0)).filter((x) => x.Subtype && x.Subtype.name === 'Link');
      const uri = l.filter((x) => x.A && x.A.URI !== undefined).length;
      return [l.length === 1 && uri === 1, l.length + ' links on page 1, ' + uri + ' of them web links'];
    });
  claim(M, 'faq', 'the merged file gets one top-level bookmark per file, named after it and opening at its first page, with that file\'s own bookmarks underneath',
    'outline is one entry per file with its bookmarks under it', N, async () => {
      const ol = await (await K.analyse(K.pdfOut(await merged()))).outline();
      const s = ol.map((o) => o.title + '{' + o.kids.map((k) => k.title).join(',') + '}').join(' ');
      return [s === 'first{Cover,Payment,Terms} second{Cover,Payment,Terms}', s];
    });
  claim(M, 'faq', 'so the later file\'s copy is renamed name_2 rather than filling in both at once', 'a clashing field name gets _2', N, async () => {
    const f = await (await K.analyse(K.pdfOut(await merged()))).fields();
    return [f && f.join() === 'name,account,name_2,account_2', f && f.join()];
  });
  claim(M, 'point', 'Streams are copied byte for byte, so images and fonts are never re-encoded.', 'the image stream\'s bytes appear unchanged in the merged file', N, async () => {
    const out = Buffer.from(K.pdfOut(await merged()));
    return [out.includes(Buffer.from('MARKER-A2-IMG!')) && out.includes(Buffer.from('MARKER-B2-IMG!')), 'raw image bytes ' + (out.includes(Buffer.from('MARKER-A2-IMG!')) ? 'found' : 'missing')];
  });
  claim(M, 'point', 'No Info dictionary or XMP is written unless you keep the first file\'s metadata.', 'with "keep the first file\'s metadata" the first file\'s Info and XMP come across', N, async () => {
    const r = await K.runPdf('merge-pdf', [await S('A'), await S('B')], { keepMeta: 'first' });
    const a = await K.analyse(K.pdfOut(r));
    return [a.info.Title === 'Secrets A' && a.root.Metadata !== undefined && /XMP-AUTHOR-A/.test(a.text), 'Title ' + a.info.Title + ', XMP ' + (a.root.Metadata ? 'kept' : 'absent')];
  });
  claim(M, 'dfaq', 'Yes, with its password, asked for when the file is added and not kept. The result has none.', 'an AES-256 file opened with its password merges, and the result has no /Encrypt', N, async () => {
    const enc = await K.core().protectDocument(await K.core().PDFDocument.load(await sec('B')), { userPassword: 'm-pass', method: 'AES-256' });
    const r = await K.runPdf('merge-pdf', [{ name: 'enc.pdf', bytes: enc, password: 'm-pass' }, await S('A')], {});
    const out = K.pdfOut(r);
    const t = out ? (await pagesOf(out)).join(' ') : '';
    return [!!out && !/\/Encrypt/.test(Buffer.from(out).toString('latin1')) && /MARKER-B1-BODY/.test(t) && /MARKER-A1-BODY/.test(t), out ? out.length + ' bytes, text of both files' : errOf(r)];
  });
  claim(M, 'dfaq', 'Web links are copied as they are; a link within one document lands on the same page of the merged file.',
    'file 2\'s page-3 link to its page 1 lands on merged page 4', N, async () => {
      const a = await K.analyse(K.pdfOut(await merged()));
      const l = (await a.annots(5)).find((x) => x.Subtype && x.Subtype.name === 'Link');
      const to = l && Array.isArray(l.Dest) ? a.idx(l.Dest[0]) + 1 : null;
      const uri = (await a.annots(3)).some((x) => x.A && x.A.URI !== undefined);
      return [to === 4 && uri, 'link on page 6 goes to page ' + to + '; web link on page 4 ' + (uri ? 'kept' : 'missing')];
    });
  claim(M, 'tip', 'Files merge in the order listed. Drag a file’s row to move it (on a touch screen, by its ⠿ grip), or use its arrows, which work from the keyboard too.',
    'pressing "Move up" on the second file puts it first in the merged PDF', B, async () => {
      const a = K.write('order-a.pdf', K.core().createPDF([{ ops: [{ text: 'FILE-A', x: 72, y: 760, size: 20 }] }], {}));
      const b = K.write('order-b.pdf', K.core().createPDF([{ ops: [{ text: 'FILE-B', x: 72, y: 760, size: 20 }] }], {}));
      const p = await K.pdf.open(M);
      try {
        await K.pdf.upload(p, [a, b]);
        const up = await p.$$('.file-list .file-row button[title="Move up"]');
        if (up.length < 2) return [false, up.length + ' "Move up" buttons in the file list'];
        await up[1].click();
        await K.pdf.press(p);
        const d = await K.pdf.download(p);
        const t = (await pagesOf(d.bytes)).join(',');
        const reqs = p.__requests || [];
        return [t === 'FILE-B,FILE-A', t];
      } finally { await p.close(); }
    });
  claim(M, 'privacy', 'Your files never leave your device. PDFs are parsed and rewritten by your own browser, so nothing is uploaded',
    'a merge in the page sends no request carrying data and none outside the site', B, async () => {
      const p = await K.pdf.open(M);
      try {
        await K.pdf.upload(p, [K.write('up-a.pdf', await sec('A')), K.write('up-b.pdf', await sec('B'))]);
        await K.pdf.press(p);
        await K.pdf.download(p);
        const bad = p.__requests.filter((r) => r.method !== 'GET' || !r.url.startsWith(K.BASE));
        return [!bad.length, bad.length ? bad.map((r) => r.method + ' ' + r.url).join(', ') : p.__requests.length + ' requests, all GET to the site'];
      } finally { await p.close(); }
    });

  /* ================================================================ */
  /* delete                                                            */
  /* ================================================================ */
  const D = '/pdf/delete-pdf-pages/';
  const del2 = () => K.once('pdf:del2', async () => K.runPdf('delete-pdf-pages', [await S('A')], { pages: '2' }));
  claim(D, 'point', 'Spaces are ignored, "10-" runs to the end, "-3" means the first three, and numbers past the last page are skipped.',
    'on 12 pages: " 10- " keeps 1-9, "-3" keeps 4-12, "2, 99" keeps all but 2', N, async () => {
      const f = await P(12);
      const keep = async (s) => (await pagesOf(K.pdfOut(await K.runPdf('delete-pdf-pages', [f], { pages: s })) || new Uint8Array())).map((x) => x.replace('PAGE-', '')).join(',');
      let a, b, c;
      try { a = await keep(' 10- '); b = await keep('-3'); c = await keep('2, 99'); } catch (e) { return [false, e.message]; }
      return [a === '1,2,3,4,5,6,7,8,9' && b === '4,5,6,7,8,9,10,11,12' && c === '1,3,4,5,6,7,8,9,10,11,12', [a, b, c].join(' | ')];
    });
  claim(D, 'point', 'A list that covers every page is refused, because a PDF must keep at least one.', 'deleting 1-3 of 3 pages is refused', N, async () => {
    const r = await K.runPdf('delete-pdf-pages', [await P(3)], { pages: '1-3' });
    return [!!r.error && !r.files, r.error || 'produced ' + (r.files || []).length + ' file(s)'];
  });
  claim(D, 'point', 'Kept pages are rebuilt with their contents, page boxes, rotation, annotations, and only the fonts and images their own drawing names.',
    'deleting page 2: the image only page 2 draws is not in the file', N, async () => {
      const a = await K.analyse(K.pdfOut(await del2()));
      return [!/MARKER-A2/.test(a.text) && a.pageObjs === 2, (a.text.match(/MARKER-A2-[A-Z!]+/g) || []).join(' ') || 'no trace of page 2'];
    });
  claim(D, 'point', 'A reference to another page is never followed: a link to a deleted page is dropped, one to a kept page repointed. Bookmarks and fields stay with their page.',
    'links to page 2 dropped, link to old page 3 lands on new page 2; bookmarks Cover, Terms; field "name" only', N, async () => {
      const a = await K.analyse(K.pdfOut(await del2()));
      const l = (await a.annots(0)).filter((x) => x.Subtype && x.Subtype.name === 'Link' && x.Dest);
      const to = l.map((x) => a.idx(x.Dest[0]) + 1).join();
      const ol = (await a.outline()).map((o) => o.title).join();
      const f = (await a.fields() || []).join();
      return [to === '2' && ol === 'Cover,Terms' && f === 'name', 'links ' + to + '; bookmarks ' + ol + '; fields ' + f];
    });
  claim(D, 'mistake', 'Forgetting the document\'s Title. It is kept', 'the Title survives deletion', N, async () => {
    const a = await K.analyse(K.pdfOut(await del2()));
    return [a.info.Title === 'Secrets A', 'Title ' + a.info.Title];
  });
  claim(D, 'tip', 'Nothing is destroyed. A new file is produced and your original stays as it is.', 'the input bytes are unchanged by a run', N, async () => {
    const src = Buffer.from(await sec('A')); const copy = Buffer.from(src);
    await K.runPdf('delete-pdf-pages', [{ name: 'x.pdf', bytes: src }], { pages: '1' });
    return [src.equals(copy), src.equals(copy) ? 'input untouched' : 'input changed'];
  });
  claim(D, 'dfaq', 'Fonts and images that kept pages still draw with stay; whatever only the deleted pages used goes.', 'the file shrinks and the shared font stays', N, async () => {
    const a = await K.analyse(K.pdfOut(await del2()));
    return [a.size < (await sec('A')).length && /Helvetica/.test(a.text) && !/MARKER-A2-IMG/.test(a.text), a.size + ' bytes from ' + (await sec('A')).length];
  });
  claim(D, 'dfaq', 'there is no step syntax', 'a step such as "2-8/2" is not read as every other page', N, async () => {
    const r = await K.runPdf('delete-pdf-pages', [await P(8)], { pages: '2-8/2' });
    const left = r.files ? (await pagesOf(K.pdfOut(r))).length : null;
    return [!!r.error || left !== 4, r.error ? 'refused: ' + r.error : left + ' pages left'];
  });

  /* ================================================================ */
  /* extract                                                           */
  /* ================================================================ */
  const E = '/pdf/extract-pdf-pages/';
  const ext = async (n, pages, order) => (await pagesOf(K.pdfOut(await K.runPdf('extract-pdf-pages', [await P(n)], { pages, order: order || 'asis' })) || new Uint8Array())).map((x) => x.replace('PAGE-', '')).join(',');
  claim(E, 'tip', '"1-3, 7, 10-" takes pages 1 to 3, page 7, and everything from 10 onward.', 'on 12 pages', N, async () => {
    const g = await ext(12, '1-3, 7, 10-'); return [g === '1,2,3,7,10,11,12', g];
  });
  claim(E, 'tip', 'Order "as listed" respects what you typed, so "5, 1, 3" produces those pages in that order', '"5, 1, 3" as listed', N, async () => {
    const g = await ext(6, '5, 1, 3'); return [g === '5,1,3', g];
  });
  claim(E, 'tip', 'A page can appear twice. "1, 1, 2" duplicates the first page', '"1, 1, 2"', N, async () => {
    const g = await ext(3, '1, 1, 2'); return [g === '1,1,2', g];
  });
  claim(E, 'point', 'A page may be listed more than once; the copies share one content stream, so repeats cost very little.', '"1,1,1,1" points four pages at one content stream', N, async () => {
    const r = await K.runPdf('extract-pdf-pages', [await P(2)], { pages: '1,1,1,1' });
    const a = await K.analyse(K.pdfOut(r));
    const refs = new Set(a.pages.map((p) => K.j(p.dict.Contents)));
    const one = (await K.analyse(K.pdfOut(await K.runPdf('extract-pdf-pages', [await P(2)], { pages: '1' })))).size;
    return [a.pages.length === 4 && refs.size === 1, refs.size + ' distinct content streams for 4 pages; ' + a.size + ' bytes against ' + one + ' for one page'];
  });
  claim(E, 'point', 'Rotation, page boxes and annotations come across, except a link to a page you did not take, which is dropped; nothing of an unchosen page is copied, even out of sight.',
    'extracting page 1 of the fixture: no byte of pages 2 and 3, only the web link left', N, async () => {
      const a = await K.analyse(K.pdfOut(await K.runPdf('extract-pdf-pages', [await S('A')], { pages: '1' })));
      const l = (await a.annots(0)).filter((x) => x.Subtype && x.Subtype.name === 'Link');
      return [!/MARKER-A[23]/.test(a.text) && l.length === 1 && l[0].A && l[0].A.URI !== undefined, (a.text.match(/MARKER-A[23]-[A-Z!]+/g) || []).join(' ') + ' ' + l.length + ' link(s)'];
    });
  claim(E, 'what', 'the title and author come along, as do bookmarks and form fields on the chosen pages; page labels such as "iv" stay behind.',
    'page 1 extracted: Title and Author kept, bookmark Cover, field name, no /PageLabels', N, async () => {
      const a = await K.analyse(K.pdfOut(await K.runPdf('extract-pdf-pages', [await S('A')], { pages: '1' })));
      const ol = (await a.outline()).map((o) => o.title).join(); const f = (await a.fields() || []).join();
      return [a.info.Title === 'Secrets A' && a.info.Author === 'Fixture Author' && ol === 'Cover' && f === 'name' && a.root.PageLabels === undefined,
        'Title ' + a.info.Title + ', Author ' + a.info.Author + ', bookmarks ' + ol + ', fields ' + f + ', PageLabels ' + (a.root.PageLabels ? 'kept' : 'absent')];
    });
  claim(E, 'dfaq', 'a selection that matches no page, like "12-15" in a ten-page file, is refused.', '"12-15" on 10 pages', N, async () => {
    const r = await K.runPdf('extract-pdf-pages', [await P(10)], { pages: '12-15' });
    return [!!r.error, r.error || 'made ' + (await pagesOf(K.pdfOut(r))).length + ' pages'];
  });
  claim(E, 'mistake', 'Sorted puts the pages back in document order', '"5, 1, 3" sorted', N, async () => {
    const g = await ext(6, '5, 1, 3', 'sorted'); return [g === '1,3,5', g];
  });
  claim(E, 'dfaq', 'Real text. Drawing instructions and fonts are copied unchanged, so the words can still be selected', 'the page text is still a Tj in Helvetica', N, async () => {
    const a = await K.analyse(K.pdfOut(await K.runPdf('extract-pdf-pages', [await S('A')], { pages: '1' })));
    const c = await a.content(0);
    return [/\(MARKER-A1-BODY\) Tj/.test(c) && /Helvetica/.test(a.text), c.slice(0, 80)];
  });

  /* ================================================================ */
  /* invoice                                                           */
  /* ================================================================ */
  const I = '/pdf/invoice-pdf/';
  /* every figure below is worked out here from the inputs, never read from the tool's own stats */
  const inv = (o) => K.runPdf('invoice-pdf', [], Object.assign({ date: '2026-10-05', paidDate: '2026-10-05' }, o || {}));
  const invText = async (o) => {
    const r = await inv(o);
    const tx = r.files ? await K.pdfText(K.pdfOut(r)) : { pages: [[]], all: '' };
    return { r, t: tx.pages[0], all: tx.all, pages: tx.pages };
  };
  const pen = (v) => Math.round(v * 100 + 1e-7) / 100;
  const west = (v) => pen(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const lakh = (v) => { const s = pen(v).toFixed(2), i = s.slice(0, -3); return (i.length > 3 ? i.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + i.slice(-3) : i) + '.' + s.slice(-2); };
  const GSTIN_KA = '29AABCA1234C1Z5', GSTIN_KA2 = '29AAFN5678D1ZK', GSTIN_MH = '27AAFN5678D1ZK';
  const logo = (w, h) => ({ kind: 'raw', name: 'logo.png', width: w, height: h, rgb: new Uint8Array(w * h * 3).fill(40), alpha: null, preview: '' });
  /* "w 0 0 h x y cm /ImN Do": where each picture is drawn */
  const drawn = async (bytes) => [...(await (await K.analyse(bytes)).content(0)).matchAll(/([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm\s*\/(Im\d+) Do/g)]
    .map((m) => ({ w: +m[1], h: +m[2], x: +m[3], y: +m[4] }));

  claim(I, 'tip', 'Write one item per line: description, quantity, unit price.', '"Design, build and test, 2, 500" is 2 at 500.00 = 1,000.00', N, async () => {
    const { t, r } = await invText({ items: 'Design, build and test, 2, 500', tax: 0 });
    const i = t.indexOf('Design, build and test');
    return [i >= 0 && t[i + 1] === '2' && t[i + 2] === '500.00' && t[i + 3] === west(2 * 500), errOf(r) || t.slice(i, i + 4).join(' | ')];
  });
  claim(I, 'tip', 'The longer form is description, HSN/SAC, quantity, unit, rate, discount%', '"Steel bar, 7308, 1,000, Kg, 12.50, 5%": HSN, 1000 Kg at 12.50 less 5%', N, async () => {
    const { t, r } = await invText({ items: 'Steel bar, 7308, 1,000, Kg, 12.50, 5%', tax: 0 });
    const i = t.indexOf('Steel bar');
    const want = ['7308', '1000', 'Kg', '12.50', '5', west(1000 * 12.5 * 0.95)];
    return [i >= 0 && want.every((w, k) => t[i + 1 + k] === w), errOf(r) || t.slice(i, i + 7).join(' | ')];
  });
  claim(I, 'tip', 'a line may end with its own tax rate, such as "GST 5%" or "VAT 0%"; a line without one is charged the default rate.',
    'VAT 20% default with a "VAT 0%" line; GST 18% default with a "GST 5%" line', N, async () => {
      const v = await inv({ items: 'Book, 1, 100, VAT 0%\nPen, 1, 50', taxMode: 'vat', tax: 20 });
      const g = await inv({ items: 'A, 1, 100, GST 5%\nB, 1, 200', taxMode: 'gst', tax: 18, fromTax: GSTIN_KA, toTax: GSTIN_MH, currency: 'INR' });
      const ok = K.stat(v, 'VAT 20%') === '£' + west(50 * 0.2) && K.stat(v, 'VAT 0%') === '£0.00' &&
        K.stat(g, 'IGST 5%') === 'Rs ' + lakh(100 * 0.05) && K.stat(g, 'IGST 18%') === 'Rs ' + lakh(200 * 0.18);
      return [ok, [K.stat(v, 'VAT 20%'), K.stat(v, 'VAT 0%'), K.stat(g, 'IGST 5%'), K.stat(g, 'IGST 18%'), errOf(v), errOf(g)].join(' / ')];
    });
  claim(I, 'tip', '"Consulting, 1, 1,200" is 1 at 1,200 and "Fit-out, 1, 1,25,000" is 1 at 1,25,000.', 'western and Indian thousands commas stay inside the price', N, async () => {
    const a = await inv({ items: 'Consulting, 1, 1,200', tax: 0 });
    const b = await inv({ items: 'Fit-out, 1, 1,25,000', tax: 0, currency: 'INR' });
    return [K.stat(a, 'Subtotal') === '£' + west(1200) && K.stat(b, 'Subtotal') === 'Rs ' + lakh(125000), K.stat(a, 'Subtotal') + ' / ' + K.stat(b, 'Subtotal')];
  });
  claim(I, 'tip', 'A line that could mean two different prices is not guessed at: the tool names the line and the readings, and asks.', '"Item,2,2,650" on line 2 stops the run, naming line 2 and both readings', N, async () => {
    const r = await inv({ items: 'Hosting, 1, 45\nItem,2,2,650' });
    return [!r.files && /^Line 2: /.test(r.error || '') && /2 at 650/.test(r.error) && /2 at 2650/.test(r.error), r.error || 'no error'];
  });
  claim(I, 'tip', 'In your own state each rate is charged as CGST and SGST at half the rate each; in another state, as IGST at the full rate.',
    'lines at 0, 5, 12, 18 and 28%: CGST = SGST = half within Karnataka, IGST = full to Maharashtra', N, async () => {
      const lines = [[0, 1000], [5, 2000], [12, 1500], [18, 4000], [28, 800]];
      const items = lines.map(([r, p], k) => 'Item ' + k + ', 1, ' + p + ', GST ' + r + '%').join('\n');
      const intra = await inv({ items, taxMode: 'gst', fromTax: GSTIN_KA, toTax: GSTIN_KA2, currency: 'INR' });
      const inter = await inv({ items, taxMode: 'gst', fromTax: GSTIN_KA, toTax: GSTIN_MH, currency: 'INR' });
      const bad = [];
      for (const [r, p] of lines.filter((x) => x[0])) {
        const half = 'Rs ' + lakh(p * r / 200), full = 'Rs ' + lakh(p * r / 100), h = String(r / 2);
        if (K.stat(intra, 'CGST ' + h + '%') !== half || K.stat(intra, 'SGST ' + h + '%') !== half) bad.push('intra ' + r + '%: ' + K.stat(intra, 'CGST ' + h + '%') + '/' + K.stat(intra, 'SGST ' + h + '%') + ' want ' + half);
        if (K.stat(inter, 'IGST ' + r + '%') !== full) bad.push('inter ' + r + '%: ' + K.stat(inter, 'IGST ' + r + '%') + ' want ' + full);
      }
      const net = lines.reduce((s, [, p]) => s + p, 0);
      const totIn = net + lines.reduce((s, [r, p]) => s + 2 * pen(p * r / 200), 0);
      const totOut = net + lines.reduce((s, [r, p]) => s + pen(p * r / 100), 0);
      if (K.stat(intra, 'Total due') !== 'Rs ' + lakh(totIn)) bad.push('intra total ' + K.stat(intra, 'Total due'));
      if (K.stat(inter, 'Total due') !== 'Rs ' + lakh(totOut)) bad.push('inter total ' + K.stat(inter, 'Total due'));
      if (intra.stats.some((s) => /^IGST/.test(s[0])) || inter.stats.some((s) => /^[CS]GST/.test(s[0]))) bad.push('mixed split');
      return [!bad.length, bad.join('; ') || 'all five rates split as stated; totals ' + K.stat(intra, 'Total due') + ' / ' + K.stat(inter, 'Total due')];
    });
  claim(I, 'tip', 'Both states are read from the GSTINs unless you choose them.', '29 to 27 is inter-state; a chosen place of supply 29 makes it intra-state', N, async () => {
    const auto = await inv({ taxMode: 'gst', fromTax: GSTIN_KA, toTax: GSTIN_MH, currency: 'INR' });
    const chosen = await inv({ taxMode: 'gst', fromTax: GSTIN_KA, toTax: GSTIN_MH, placeOfSupply: '29', currency: 'INR' });
    return [K.stat(auto, 'Supply') === 'Inter-state, Karnataka to Maharashtra' && K.stat(chosen, 'Supply') === 'Intra-state, Karnataka', K.stat(auto, 'Supply') + ' / ' + K.stat(chosen, 'Supply')];
  });
  claim(I, 'tip', 'The discount comes off before tax and is shared across the lines in proportion to their value, so each rate is charged on the discounted amount.',
    '1,000 at 20% and 3,000 at 5%, 10% or 400 off: VAT on 900 and 2,700', N, async () => {
      const items = 'A, 1, 1000, VAT 20%\nB, 1, 3000, VAT 5%';
      const p = await inv({ items, discount: '10', discountType: 'percent' });
      const a = await inv({ items, discount: '400', discountType: 'amount' });
      const ok = [p, a].every((r) => K.stat(r, 'VAT 20%') === '£' + west(900 * 0.2) && K.stat(r, 'VAT 5%') === '£' + west(2700 * 0.05) &&
        K.stat(r, 'Total due') === '£' + west(3600 + 180 + 135));
      return [ok, [p, a].map((r) => K.stat(r, 'VAT 20%') + ', ' + K.stat(r, 'VAT 5%') + ', ' + K.stat(r, 'Total due')).join(' / ')];
    });
  claim(I, 'tip', 'Shipping is either taxed at the default rate or not taxed, and the invoice says which.', 'shipping 50 on 100 at 20%: taxed gives VAT 30.00, not taxed 20.00, each labelled', N, async () => {
    const tx = await invText({ items: 'A, 1, 100', tax: 20, shipping: '50', shippingTax: 'taxable' });
    const ex = await invText({ items: 'A, 1, 100', tax: 20, shipping: '50', shippingTax: 'exempt' });
    const ok = K.stat(tx.r, 'VAT 20%') === '£' + west(150 * 0.2) && tx.t.indexOf('Shipping (taxed at 20%)') >= 0 &&
      K.stat(ex.r, 'VAT 20%') === '£' + west(100 * 0.2) && ex.t.indexOf('Shipping (not taxed)') >= 0 && K.stat(ex.r, 'Total due') === '£' + west(170);
    return [ok, K.stat(tx.r, 'VAT 20%') + ' / ' + K.stat(ex.r, 'VAT 20%') + ', ' + K.stat(ex.r, 'Total due')];
  });
  claim(I, 'tip', 'Modern puts your accent colour in a band across the top', 'modern: a full-width rectangle of the accent touches the top edge', N, async () => {
    const c = await (await K.analyse(K.pdfOut(await inv({ template: 'modern', accent: '#123456' })))).content(0);
    const m = /0\.0706 0\.2039 0\.3373 rg\n0 ([\d.]+) 595\.28 ([\d.]+) re f/.exec(c);
    return [!!m && Math.abs(Number(m[1]) + Number(m[2]) - 841.89) < 0.01, m ? m[0].replace(/\n/g, ' ') : 'no band'];
  });
  claim(I, 'tip', 'Classic sets a ruled table in a serif face', 'classic: the items are Times-Roman and the table has a stroked border and column rules', N, async () => {
    const c = await (await K.analyse(K.pdfOut(await inv({ template: 'classic' })))).content(0);
    const row = runs(c).find((x) => x.str === 'Website design and build');
    const vlines = (c.match(/\n([\d.]+) ([\d.]+) m \1 ([\d.]+) l S/g) || []).length;
    return [row && row.font === 'TimesRoman' && /re S/.test(c) && vlines >= 3, (row && row.font) + ', ' + vlines + ' vertical rules'];
  });
  claim(I, 'tip', 'Compact uses small type to fit long invoices', '60 lines: compact in 8 pt on fewer pages than modern in 9 pt', N, async () => {
    const items = Array.from({ length: 60 }, (_, i) => 'Line item ' + (i + 1) + ', 1, 10').join('\n');
    const cp = await inv({ items, template: 'compact' }), md = await inv({ items, template: 'modern' });
    const cc = await (await K.analyse(K.pdfOut(cp))).content(0);
    const r1 = runs(cc).find((x) => x.str === 'Line item 1');
    const np = (r) => Number(K.stat(r, 'Pages'));
    return [r1 && r1.size === 8 && np(cp) < np(md), 'compact ' + np(cp) + ' pages at ' + (r1 && r1.size) + ' pt, modern ' + np(md)];
  });
  claim(I, 'tip', 'Each prints on A4, US Letter or US Legal.', 'every layout at each size has that MediaBox', N, async () => {
    const want = { a4: '0 0 595 842', letter: '0 0 612 792', legal: '0 0 612 1008' };
    const got = [];
    for (const template of ['modern', 'classic', 'compact']) for (const pageSize of Object.keys(want)) {
      const a = await K.analyse(K.pdfOut(await inv({ template, pageSize })));
      const mb = a.pages[0].dict.MediaBox.map(Math.round).join(' ');
      if (mb !== want[pageSize]) got.push(template + '/' + pageSize + ': ' + mb);
    }
    return [!got.length, got.join('; ') || 'nine MediaBoxes as asked'];
  });
  claim(I, 'tip', 'Mark as paid adds a translucent PAID stamp, turned at an angle, with the date and the method, and the total then reads TOTAL PAID with a balance of zero.',
    'paid: ExtGState below 1, a rotated cm, PAID with date and method, TOTAL PAID, balance £0.00; unpaid: none of it', N, async () => {
      const p = await invText({ paid: true, paidDate: '2026-10-05', paidMethod: 'Card' });
      const u = await invText({ paid: false });
      const pa = await K.analyse(K.pdfOut(p.r)), ua = await K.analyse(K.pdfOut(u.r));
      const pc = await pa.content(0);
      const rot = /\n([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) [-\d.]+ [-\d.]+ cm\nq?[\s\S]{0,80}?RG/.exec(pc) || /\/GS1 gs\n([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) [-\d.]+ [-\d.]+ cm/.exec(pc);
      const ca = /\/ca ([\d.]+)/.exec(pa.text);
      const ok = !!rot && Math.abs(Number(rot[2])) > 0.1 && ca && Number(ca[1]) < 1 && p.t.indexOf('PAID') >= 0 &&
        p.t.indexOf('5 OCTOBER 2026 · CARD') >= 0 && p.t.indexOf('TOTAL PAID') >= 0 && p.all.indexOf('Balance due: £0.00') >= 0 &&
        u.all.indexOf('PAID') < 0 && !/ExtGState/.test(ua.text);
      return [ok, 'rotation ' + (rot ? rot.slice(1, 5).join(' ') : 'none') + ', ca ' + (ca ? ca[1] : 'none') + ', unpaid has PAID: ' + (u.all.indexOf('PAID') >= 0)];
    });
  claim(I, 'faq', 'End a line with its rate, such as "GST 12%", and the totals show the tax at each rate on its own taxable value, from the highest rate down.',
    'IGST at 18, 12 and 5% on each rate\'s own base, in that order', N, async () => {
      const { t, r } = await invText({ items: 'A, 1, 1000, GST 5%\nB, 1, 2000, GST 12%\nC, 1, 500', taxMode: 'gst', tax: 18, fromTax: GSTIN_KA, toTax: GSTIN_MH, currency: 'INR' });
      const want = ['IGST 18% on ' + lakh(500), 'IGST 12% on ' + lakh(2000), 'IGST 5% on ' + lakh(1000)];
      const at = want.map((w) => t.indexOf(w));
      const amounts = [lakh(90), lakh(240), lakh(50)].every((v, k) => t[at[k] + 1] === v);
      return [at.every((x) => x >= 0) && at[0] < at[1] && at[1] < at[2] && amounts, errOf(r) || at.join(',') + ' ' + at.map((x) => t[x + 1]).join(',')];
    });
  claim(I, 'faq', 'The amount column is always before tax.', '"A, 2, 100, GST 18%" shows 200.00 in its row, not 236.00', N, async () => {
    const { t } = await invText({ items: 'A, 2, 100, GST 18%', taxMode: 'gst', fromTax: GSTIN_KA, toTax: GSTIN_KA2, currency: 'INR' });
    const i = t.indexOf('A');
    return [t.slice(i, i + 6).indexOf(lakh(200)) >= 0 && t.indexOf(lakh(236)) === t.lastIndexOf(lakh(236)), t.slice(i, i + 6).join(' | ')];
  });
  claim(I, 'faq', 'It is drawn at the top left in every layout, scaled to fit without stretching', 'a 300 × 100 logo: drawn once at 3:1, at the left margin, in the top band of the page, in all three', N, async () => {
    const out = [];
    for (const template of ['modern', 'classic', 'compact']) {
      const d = await drawn(K.pdfOut(await inv({ template, logo: logo(300, 100) })));
      const ok = d.length === 1 && Math.abs(d[0].w / d[0].h - 3) < 0.01 && d[0].x <= 52 && d[0].x >= 30 && d[0].y + d[0].h > 841.89 - 110;
      out.push([ok, template + ' ' + (d[0] ? [d[0].x, d[0].y, d[0].w, d[0].h].map((v) => Math.round(v)).join(',') : 'no image')]);
    }
    return [out.every((x) => x[0]), out.map((x) => x[1]).join('; ')];
  });
  claim(I, 'faq', 'Pounds, US dollars, euros, rupees, UAE dirhams, Singapore, Australian and Canadian dollars, and rand.', 'the nine currencies, each with its own sign', N, async () => {
    const signs = { GBP: '£', USD: '$', EUR: '€', INR: 'Rs ', AED: 'AED ', SGD: 'S$', AUD: 'A$', CAD: 'C$', ZAR: 'R ' };
    const opts = K.pdfSpec('invoice-pdf').controls.find((c) => c.key === 'currency').options.map((o) => o.value);
    const bad = [];
    for (const c of Object.keys(signs)) { const r = await inv({ currency: c, items: 'A, 1, 10', tax: 0 }); if (K.stat(r, 'Total due') !== signs[c] + '10.00') bad.push(c + ' ' + K.stat(r, 'Total due')); }
    return [opts.join() === Object.keys(signs).join() && !bad.length, opts.join() + (bad.length ? '; ' + bad.join(', ') : '')];
  });
  claim(I, 'faq', 'Rupees are grouped in lakhs and crores, as 12,34,567.00, and the rest in thousands, as 1,234,567.00.', '1234567 in INR and in GBP', N, async () => {
    const a = await inv({ currency: 'INR', items: 'X, 1, 1234567', tax: 0 }), b = await inv({ currency: 'GBP', items: 'X, 1, 1234567', tax: 0 });
    return [K.stat(a, 'Total due') === 'Rs 12,34,567.00' && K.stat(b, 'Total due') === '£1,234,567.00', K.stat(a, 'Total due') + ' / ' + K.stat(b, 'Total due')];
  });
  claim(I, 'what', 'under GST the heading becomes TAX INVOICE.', 'GST: TAX INVOICE; VAT: INVOICE', N, async () => {
    const g = await invText({ taxMode: 'gst', fromTax: GSTIN_KA, toTax: GSTIN_KA2 }), v = await invText({ taxMode: 'vat' });
    return [g.t.indexOf('TAX INVOICE') >= 0 && v.t.indexOf('INVOICE') >= 0 && v.t.indexOf('TAX INVOICE') < 0, 'GST ' + (g.t.indexOf('TAX INVOICE') >= 0) + ', VAT ' + v.t.filter((x) => /INVOICE/.test(x)).join()];
  });
  claim(I, 'works', 'The Quotation tool’s line reader parses the items; the site’s own PDF writer draws the pages.', 'the invoice reads lines with the quotation\'s own parseLineItems, and refuses to run without it', N, async () => {
    const fsx = require('fs'), px = require('path');
    const alone = {};
    new Function('window', fsx.readFileSync(px.join(K.ROOT, 'engine/pdf-invoice-pdf.js'), 'utf8'))(alone);
    let err = '';
    try { const r = await alone.PDF_TOOLS['invoice-pdf'].run({ docs: [], opts: K.pdfDefaults('invoice-pdf'), core: K.core() }); err = r.error || ''; } catch (e) { err = e.message; }
    const q = K.pdfSpec('quotation-pdf').lib;
    const line = 'Steel bar, 7308, 1,000, Kg, 12.50, 5%';
    const row = q.parseLineItems(line, '').rows[0];
    const { t } = await invText({ items: line, tax: 0 });
    return [/quotation engine/.test(err) && row && t.indexOf(lakh(row.amount)) >= 0 && /Helvetica/.test((await K.analyse(K.pdfOut(await inv({})))).text), 'alone: ' + err.slice(0, 60) + '; quotation reads ' + (row && row.amount)];
  });
  claim(I, 'point', 'a comma between digits, as in 1,25,000, groups thousands.', '"Item, 1, 1,25,000" is one at 1,25,000.00', N, async () => {
    const { t, r } = await invText({ items: 'Item, 1, 1,25,000', tax: 0, currency: 'INR' });
    const i = t.indexOf('Item');
    return [i >= 0 && t[i + 2] === '1,25,000.00', errOf(r) || t.slice(i, i + 4).join(' | ')];
  });
  claim(I, 'point', 'Tax is worked out once per rate on that rate’s whole taxable value, not line by line, and rounded to the penny or paisa.',
    'three lines of 0.05 at 10%: tax 0.02 (once on 0.15), not 0.03 (per line)', N, async () => {
      const r = await inv({ items: 'A, 1, 0.05\nB, 1, 0.05\nC, 1, 0.05', tax: 10, currency: 'GBP' });
      return [K.stat(r, 'VAT 10%') === '£' + west(0.15 * 0.1), 'VAT 10% ' + K.stat(r, 'VAT 10%')];
    });
  claim(I, 'point', 'The due date is the invoice date plus the payment terms in calendar days.', '4 October 2026 + Net 30 = 3 November 2026, printed beside "Due date"', N, async () => {
    const { t } = await invText({ date: '2026-10-04', due: '30', template: 'classic' });
    return [t[t.indexOf('DUE DATE') + 1] === '3 November 2026', t.slice(t.indexOf('DUE DATE'), t.indexOf('DUE DATE') + 2).join(' ')];
  });
  claim(I, 'dfaq', 'Payment is due 30 days after the invoice date; the tool prints that due date for you.', 'Net 30 from 15 January 2026 printed as 14 February 2026', N, async () => {
    const { t } = await invText({ date: '2026-01-15', due: '30' });
    return [t[t.indexOf('Due date') + 1] === '14 February 2026', t.slice(t.indexOf('Due date'), t.indexOf('Due date') + 2).join(' ')];
  });
  claim(I, 'point', 'The file takes the invoice number as its name, SPH-2026-0117.pdf, and as its Title after “Invoice”.', 'name SPH-2026-0117.pdf, Title "Invoice SPH-2026-0117"', N, async () => {
    const r = await inv({ number: 'SPH-2026-0117' });
    const a = await K.analyse(K.pdfOut(r));
    return [r.files[0].name === 'SPH-2026-0117.pdf' && a.info.Title === 'Invoice SPH-2026-0117', r.files[0].name + ', ' + K.j(a.info)];
  });
  claim(I, 'worked', 'IGST is Rs 1,768.50 at 18% on Rs 9,825.00 plus Rs 2,205.00 at 5% on Rs 44,100.00: Rs 57,898.50, due 20 October 2026.',
    'the worked example, run, and every figure recomputed', N, async () => {
      const base = { fromName: 'Sahyadri Print House', fromAddress: '14 Karve Road, Pune 411004', fromTax: '27AAKFS4821M1Z3', toName: 'Lalbagh Learning Centre', toAddress: '22 Lalbagh Road, Bengaluru 560027', toTax: '29AACCL7310Q1ZP', number: 'SPH-2026-0117', date: '2026-10-05', due: '15', currency: 'INR', taxMode: 'gst', tax: 18, items: 'Brochures, 500, Nos, 18.50\nHardbound registers, 20, Nos, 2,450, GST 5%', discount: '10', discountType: 'percent', shipping: '1,500', shippingTax: 'taxable' };
      const sub = 500 * 18.5 + 20 * 2450, disc = sub * 0.1, b18 = 500 * 18.5 * 0.9 + 1500, b5 = 20 * 2450 * 0.9;
      const total = sub - disc + 1500 + pen(b18 * 0.18) + pen(b5 * 0.05);
      const { t, r } = await invText(base);
      const intra = await inv(Object.assign({}, base, { toTax: '27AAACL7310Q1ZQ' }));
      const want = ['Rs ' + lakh(sub), 'Rs ' + lakh(disc), 'Rs ' + lakh(b18 + b5), 'Rs ' + lakh(b18 * 0.18), 'Rs ' + lakh(b5 * 0.05), 'Rs ' + lakh(total)];
      const got = [K.stat(r, 'Subtotal'), K.stat(r, 'Discount 10%').replace('-', ''), K.stat(r, 'Taxable value'), K.stat(r, 'IGST 18%'), K.stat(r, 'IGST 5%'), K.stat(r, 'Total due')];
      const ok = want.join() === got.join() && t.indexOf('IGST 18% on ' + lakh(b18)) >= 0 && t.indexOf('IGST 5% on ' + lakh(b5)) >= 0 && K.stat(r, 'Due date') === '20 October 2026' &&
        K.stat(intra, 'CGST 9%') === 'Rs ' + lakh(b18 * 0.09) && K.stat(intra, 'SGST 2.5%') === 'Rs ' + lakh(b5 * 0.025) && K.stat(intra, 'Total due') === 'Rs ' + lakh(total) &&
        want.join() === ['Rs 58,250.00', 'Rs 5,825.00', 'Rs 53,925.00', 'Rs 1,768.50', 'Rs 2,205.00', 'Rs 57,898.50'].join();
      return [ok, got.join(' | ') + ' | intra ' + K.stat(intra, 'CGST 9%') + ', ' + K.stat(intra, 'SGST 2.5%')];
    });
  claim(I, 'mistake', 'A bare percentage is that line’s discount; write “GST 18%” or “VAT 20%” for a rate.', '"Item, 1, 100, 18%" is 82.00 taxed at the default 20%', N, async () => {
    const r = await inv({ items: 'Item, 1, 100, 18%', tax: 20 });
    return [K.stat(r, 'Subtotal') === '£' + west(82) && K.stat(r, 'VAT 20%') === '£' + west(82 * 0.2), K.stat(r, 'Subtotal') + ', ' + K.stat(r, 'VAT 20%')];
  });
  claim(I, 'mistake', 'The tool stops and asks for the state rather than guess the split.', 'GST, no client GSTIN, place of supply left on the GSTIN: no PDF, a request for the place of supply', N, async () => {
    const r = await inv({ taxMode: 'gst', fromTax: GSTIN_KA, toTax: '', placeOfSupply: 'auto' });
    return [!r.files && /Choose the place of supply/.test(r.error || ''), r.error || 'made a PDF'];
  });
  claim(I, 'dfaq', 'Tick Mark as paid and this one says it was settled, with a PAID stamp, the date and the method.', 'paid on 5 October 2026 by UPI: the stamp and the line say so', N, async () => {
    const { t, all } = await invText({ paid: true, paidDate: '2026-10-05', paidMethod: 'UPI' });
    return [t.indexOf('PAID') >= 0 && t.indexOf('5 OCTOBER 2026 · UPI') >= 0 && /Paid in full on 5 October 2026 by UPI\./.test(all), t.filter((x) => /PAID|Paid/.test(x)).join(' | ')];
  });
  claim(I, 'dfaq', 'shown with its two-digit code. Your own state means CGST plus SGST, another state IGST; 96 is a client abroad.', 'place of supply printed as "27 — Maharashtra"; 96 is IGST', N, async () => {
    const mh = await invText({ taxMode: 'gst', fromTax: GSTIN_KA, toTax: GSTIN_MH });
    const ex = await inv({ taxMode: 'gst', fromTax: GSTIN_KA, toTax: '', placeOfSupply: '96' });
    /* the em dash is WinAnsi byte 0x97 in the content stream */
    const t = mh.t.map((x) => x.replace(/\x97/g, '—'));
    return [t.indexOf('27 — Maharashtra') >= 0 && ex.stats.some((s) => /^IGST/.test(s[0])) && !ex.stats.some((s) => /^CGST/.test(s[0])), t.filter((x) => /— /.test(x)).join() + ' / ' + K.stat(ex, 'Supply')];
  });

  /* the page: one session that fills, saves, reloads, downloads, exports and imports */
  const png = (w, h) => {
    const zlib = require('zlib');
    const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
    const raw = Buffer.alloc((w * 3 + 1) * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 20; raw[o + 1] = 40; raw[o + 2] = 120; }
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  };
  const session = () => K.once('pdf:invoice:session', async () => {
    const o = {};
    const p = await K.pdf.open(I);
    const keys = () => p.evaluate(() => Object.keys(localStorage).filter((k) => /^1234tools-pdf-invoice-pdf/.test(k)).sort());
    const val = (k) => p.$eval('#pc-' + k, (e) => e.value);
    const wipe = async () => { await p.evaluate(() => Object.keys(localStorage).filter((k) => /^1234tools-pdf-invoice-pdf|^1234tools\.prefs/.test(k)).forEach((k) => localStorage.removeItem(k))); await p.reload({ waitUntil: 'load' }); await p.waitForSelector('#inv-new'); };
    await wipe();
    o.accept = await p.$eval('#pc-logo', (e) => e.accept);
    const logoFile = K.write('invoice-logo.png', png(90, 30));
    await (await p.$('#pc-logo')).uploadFile(logoFile);
    await p.waitForFunction(() => !document.querySelector('.image-pick-thumb').hidden, { timeout: 20000 });
    await K.pdf.set(p, { fromName: 'Riverside Joinery', toName: 'Harbour Cafe Ltd', toAddress: '3 Quay Street\nWhitby YO21 1PU', toTax: 'GB123456789', number: 'INV-2026-0042', items: 'Oak shelves, 2, 1,250' });
    await K.sleep(800);
    o.keysTyped = await keys();
    o.formStored = await p.evaluate(() => localStorage.getItem('1234tools-pdf-invoice-pdf-v1-form') || '');
    await p.reload({ waitUntil: 'load' }); await p.waitForSelector('#inv-new');
    o.afterReload = { toName: await val('toName'), number: await val('number'), items: await val('items'), logo: await p.$eval('.image-pick-thumb', (e) => !e.hidden) };
    await p.click('#inv-save-client');
    o.clients = await p.$$eval('#inv-clients option', (l) => l.map((x) => x.textContent));
    await K.pdf.press(p);
    const pdf = await K.pdf.download(p);
    o.pdfName = pdf.name;
    o.pdfImage = /\/Subtype\s*\/Image/.test(pdf.bytes.toString('latin1'));
    o.numberAfter = await val('number');
    await K.clearDownloads(p);
    await p.click('#inv-export');
    await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 10000 });
    const exp = (await K.downloads(p))[0];
    o.exportName = exp.name;
    try { o.exported = JSON.parse(exp.bytes.toString('utf8')); } catch (e) { o.exported = null; }
    const jsonFile = K.write('invoice-export.json', exp.bytes);
    await p.click('#inv-new');
    o.afterNew = { fromName: await val('fromName'), toName: await val('toName'), items: await val('items'), number: await val('number'), paid: await p.$eval('#pc-paid', (e) => e.checked), logo: await p.$eval('.image-pick-thumb', (e) => !e.hidden) };
    await p.select('#inv-clients', '0');
    await K.sleep(200);
    o.afterPick = { toName: await val('toName'), toAddress: await val('toAddress'), toTax: await val('toTax') };
    await K.pdf.set(p, { number: 'INV-9999', items: 'Something else, 1, 5' });
    await (await p.$('#pc-logo')).evaluate((e) => e.closest('.field').querySelector('button[title="Remove the image"]').click());
    await (await p.$('#inv-import-file')).uploadFile(jsonFile);
    await K.sleep(500);
    o.afterImport = { number: await val('number'), items: await val('items'), toName: await val('toName'), logo: await p.$eval('.image-pick-thumb', (e) => !e.hidden), status: await p.$eval('.inv-status', (e) => e.textContent) };
    const badFile = K.write('not-an-invoice.json', Buffer.from('{"format":"something-else","fields":{}}'));
    await (await p.$('#inv-import-file')).uploadFile(badFile);
    await K.sleep(300);
    o.badImport = { status: await p.$eval('.inv-status', (e) => e.textContent), number: await val('number') };
    o.requests = p.__requests.filter((r) => r.method !== 'GET' || !r.url.startsWith(K.BASE)).map((r) => r.method + ' ' + r.url);
    /* another browser profile: nothing carried over */
    const ctx = await (K.browser.createBrowserContext ? K.browser.createBrowserContext() : K.browser.createIncognitoBrowserContext());
    const q = await ctx.newPage();
    await q.goto(K.BASE + I, { waitUntil: 'load' }); await q.waitForSelector('#inv-new');
    o.otherProfile = { clients: await q.$$eval('#inv-clients option', (l) => l.map((x) => x.textContent)), toName: await q.$eval('#pc-toName', (e) => e.value) };
    await ctx.close();
    await p.click('#inv-forget');
    o.afterForget = await keys();
    /* the site's settings choose the currency on a first visit */
    await p.evaluate(() => { localStorage.setItem('1234tools.prefs', JSON.stringify({ values: { currency: 'EUR' }, updatedAt: 1 })); localStorage.removeItem('1234tools-pdf-invoice-pdf-v1'); });
    await p.reload({ waitUntil: 'load' }); await p.waitForSelector('#inv-new');
    o.prefCurrency = await val('currency');
    await wipe();
    await p.close();
    return o;
  });
  claim(I, 'faq', 'Choose a PNG, JPEG, WebP or GIF.', 'the logo picker accepts those four', B, async () => {
    const o = await session(); return [['image/png', 'image/jpeg', 'image/webp', 'image/gif'].every((t) => o.accept.indexOf(t) >= 0), o.accept];
  });
  claim(I, 'faq', 'saved on this device with the rest of the form.', 'the logo is in this browser\'s storage and comes back after a reload', B, async () => {
    const o = await session(); return [o.keysTyped.indexOf('1234tools-pdf-invoice-pdf-v1-logo') >= 0 && o.afterReload.logo, o.keysTyped.join() + ', logo after reload ' + o.afterReload.logo];
  });
  claim(I, 'tip', 'The form is saved on this device as you type and comes back when you return.', 'typed client, number and items are back after a reload', B, async () => {
    const o = await session(); const a = o.afterReload;
    return [/Harbour Cafe Ltd/.test(o.formStored) && a.toName === 'Harbour Cafe Ltd' && a.number === 'INV-2026-0042' && a.items === 'Oak shelves, 2, 1,250', K.j(a)];
  });
  claim(I, 'tip', 'After each download the number goes up by one: INV-2026-0042 becomes INV-2026-0043.', 'INV-2026-0042.pdf downloaded, the field then reads INV-2026-0043', B, async () => {
    const o = await session(); return [o.pdfName === 'INV-2026-0042.pdf' && o.numberAfter === 'INV-2026-0043', o.pdfName + ' -> ' + o.numberAfter];
  });
  claim(I, 'tip', 'Start a new invoice keeps your business details and logo and clears the client, the items and the stamp.', 'after Start a new invoice: seller and logo kept, client and items empty, not paid, the next number', B, async () => {
    const o = await session(); const a = o.afterNew;
    return [a.fromName === 'Riverside Joinery' && a.logo && a.toName === '' && a.items === '' && a.paid === false && a.number === 'INV-2026-0043', K.j(a)];
  });
  claim(I, 'tip', 'Save a client to pick them from the list next time.', 'saved, then picked from the list into the Bill to fields', B, async () => {
    const o = await session(); const a = o.afterPick;
    return [o.clients.indexOf('Harbour Cafe Ltd') >= 0 && a.toName === 'Harbour Cafe Ltd' && a.toAddress === '3 Quay Street\nWhitby YO21 1PU' && a.toTax === 'GB123456789', o.clients.join() + ' / ' + K.j(a)];
  });
  claim(I, 'tip', 'Export writes the whole invoice, logo included, to a JSON file that Import reads back on any device.', 'the export holds every field and the logo; importing it puts number, items, client and logo back', B, async () => {
    const o = await session(); const e = o.exported || {}; const a = o.afterImport;
    const ok = o.exportName === 'INV-2026-0043.json' && e.format === '1234tools-invoice' && e.fields && e.fields.items === 'Oak shelves, 2, 1,250' && e.logo && e.logo.width === 90 &&
      a.number === 'INV-2026-0043' && a.items === 'Oak shelves, 2, 1,250' && a.toName === 'Harbour Cafe Ltd' && a.logo;
    return [ok, o.exportName + ' ' + K.j(a)];
  });
  claim(I, 'tip', 'Nothing you add is uploaded: the PDF, the saved clients and the autosave stay in this browser.', 'no request left the page with data, and the form, logo, clients and last number are in localStorage', B, async () => {
    const o = await session();
    const want = ['1234tools-pdf-invoice-pdf-v1-customers', '1234tools-pdf-invoice-pdf-v1-form', '1234tools-pdf-invoice-pdf-v1-issued', '1234tools-pdf-invoice-pdf-v1-logo'];
    const had = await (async () => o.keysTyped.concat(['1234tools-pdf-invoice-pdf-v1-customers', '1234tools-pdf-invoice-pdf-v1-issued']))();
    return [!o.requests.length && want.every((k) => had.indexOf(k) >= 0) && o.clients.length > 1, o.requests.join(', ') || 'no uploads; keys ' + o.keysTyped.join()];
  });
  claim(I, 'faq', 'In this browser\'s storage on this device, and nowhere else: another browser or computer starts empty.', 'a second browser profile shows no saved clients and the default client', B, async () => {
    const o = await session(); const a = o.otherProfile;
    return [a.clients.length === 1 && /No saved clients/.test(a.clients[0]) && a.toName === 'Client Name Ltd', K.j(a)];
  });
  claim(I, 'faq', 'Export and Import move an invoice between them, and "Forget what this device keeps" clears it all.', 'import restores; a wrong file is refused and changes nothing; Forget leaves no keys', B, async () => {
    const o = await session();
    return [/Imported invoice-export\.json/.test(o.afterImport.status) && /not an invoice exported by this tool/.test(o.badImport.status) && o.badImport.number === 'INV-2026-0043' &&
      o.afterForget.filter((k) => k !== '1234tools-pdf-invoice-pdf-v1').length === 0, o.badImport.status.slice(0, 90) + ' / left: ' + o.afterForget.join()];
  });
  claim(I, 'faq', 'The currency starts as the one in your site settings.', 'site settings at EUR: a first visit opens in euros', B, async () => {
    const o = await session(); return [o.prefCurrency === 'EUR', o.prefCurrency];
  });

  /* ================================================================ */
  /* labels                                                            */
  /* ================================================================ */
  const L = '/pdf/label-pdf/';
  const lab = async (o) => { const r = await K.runPdf('label-pdf', [], o); const a = await K.analyse(K.pdfOut(r)); return { r, a, c: await a.content(0) }; };
  claim(L, 'point', 'A blank line in your text starts a new label.', 'two blocks, "once": two labels, each in its own cell', N, async () => {
    const { c } = await lab({ repeat: 'once', items: 'AAA one\nAAA two\n\nBBB one' });
    const rr = runs(c);
    const a1 = rr.find((x) => x.str === 'AAA one'), b1 = rr.find((x) => x.str === 'BBB one');
    return [a1 && b1 && b1.x > a1.x + 100 && near(a1.y, b1.y), K.j(rr.map((x) => [x.str, Math.round(x.x), Math.round(x.y)]))];
  });
  claim(L, 'works', 'Text is placed at measured positions on A4 pages by the site\'s own PDF writer; nothing is an image.', 'A4, text runs, no image', N, async () => {
    const { a } = await lab({});
    return [a.pages[0].dict.MediaBox.map(Math.round).join() === '0,0,595,842' && !hasImage(a), a.pages[0].dict.MediaBox.map(Math.round).join()];
  });
  claim(L, 'point', 'Text sits 4 points in from the label\'s left edge, below an 8-point top pad, wrapped to its width, with lines 1.25 times the font size apart.',
    'first line 4 pt in from the 7.2 mm margin, lines 11.25 pt apart at size 9', N, async () => {
      const { c } = await lab({ repeat: 'once', items: 'L1\nL2', size: 9 });
      const rr = runs(c);
      const x0 = 7.2 * 72 / 25.4 + 4, yTop = 841.89 - 15.1 * 72 / 25.4;
      return [near(rr[0].x, x0, 0.01) && near(rr[0].y - rr[1].y, 11.25, 0.01) && near(yTop - rr[0].y, 8 + 11.25, 0.02), K.j(rr.slice(0, 2).map((x) => [x.x, x.y])) + ' want x ' + x0.toFixed(4)];
    });
  claim(L, 'point', 'Lines that do not fit the label\'s height are dropped without a warning. Repeat fills one sheet by cycling the list.',
    'a 12-line label keeps what fits, no warning; repeat places 21 labels', N, async () => {
      const long = Array.from({ length: 12 }, (_, i) => 'Line ' + (i + 1)).join('\n');
      const one = await lab({ repeat: 'once', items: long, size: 9 });
      const kept = runs(one.c).length;
      const rep = await lab({});
      return [kept < 12 && kept === Math.floor((38.1 * 72 / 25.4 - 8) / 11.25) && !one.r.warn && K.stat(rep.r, 'Labels placed') === '21', kept + ' of 12 lines kept, warn ' + K.j(one.r.warn || '') + ', placed ' + K.stat(rep.r, 'Labels placed')];
    });
  claim(L, 'dfaq', 'By label size and count as Avery lists them, 3 × 7 matches L7160, 2 × 8 matches L7162, 2 × 7 matches L7163 and 4 × 10 matches L7654.', 'label sizes and counts 21 of 63.5×38.1 (3×7), 16 of 99.1×33.9 (2×8), 14 of 99.1×38.1 (2×7), 40 of 45.7×25.4 (4×10)', N, async () => {
    const s = [];
    for (const l of ['3x7', '2x8', '2x7', '4x10']) { const r = await K.runPdf('label-pdf', [], { layout: l }); s.push(l + ' ' + K.stat(r, 'Labels placed') + ' of ' + K.stat(r, 'Label size')); }
    return [s.join('; ') === '3x7 21 of 63.5 × 38.1 mm; 2x8 16 of 99.1 × 33.9 mm; 2x7 14 of 99.1 × 38.1 mm; 4x10 40 of 45.7 × 25.4 mm', s.join('; ')];
  });
  claim(L, 'what', 'Common A4 formats: 21 labels of 63.5 × 38.1 mm (3 × 7) for addresses, 40 of 45.7 × 25.4 mm (4 × 10) for return addresses and small stickers, and 10 strips of 200 × 27 mm',
    'the 4×10 and 1×10 layouts', N, async () => {
      const a = await K.runPdf('label-pdf', [], { layout: '4x10' }), b = await K.runPdf('label-pdf', [], { layout: '1x10' });
      const s = K.stat(a, 'Labels placed') + ' of ' + K.stat(a, 'Label size') + '; ' + K.stat(b, 'Labels placed') + ' of ' + K.stat(b, 'Label size');
      return [s === '40 of 45.7 × 25.4 mm; 10 of 200 × 27 mm', s];
    });
  claim(L, 'dfaq', 'Every layout here is an A4 format on an A4 page', 'every layout\'s page is A4', N, async () => {
    const s = [];
    for (const l of ['3x7', '2x8', '2x7', '1x10', '4x10']) { const { a } = await lab({ layout: l }); s.push(a.pages[0].dict.MediaBox.map(Math.round).join('x')); }
    return [s.every((x) => x === '0x0x595x842'), s.join(' ')];
  });
  claim(L, 'dfaq', 'The first label always goes top left and empty labels are skipped', 'the first label is the top-left cell', N, async () => {
    const { c } = await lab({ repeat: 'once', items: 'ONLY' });
    const r = runs(c)[0];
    return [r && r.x < 30 && r.y > 760, r && [r.x, r.y].join()];
  });
  claim(L, 'tip', 'Turn on cutting guides for plain paper, and off for real label stock where the outlines would print onto the labels.', 'guides draw one outline per label; off draws none', N, async () => {
    const on = (await lab({ guides: 'yes' })).c, off = (await lab({ guides: 'no' })).c;
    const n = (s) => (s.match(/ re S/g) || []).length;
    return [n(on) === 21 && n(off) === 0, n(on) + ' outlines on, ' + n(off) + ' off'];
  });

  /* ================================================================ */
  /* paper                                                             */
  /* ================================================================ */
  const PA = '/pdf/paper-pdf/';
  const MMP = 72 / 25.4;
  const paper = async (o) => { const r = await K.runPdf('paper-pdf', [], o); const a = await K.analyse(K.pdfOut(r)); return { r, a, c: await a.content(0) }; };
  const segs = (c) => { const out = []; const re = /([-\d.]+) ([-\d.]+) m ([-\d.]+) ([-\d.]+) l S/g; let m; while ((m = re.exec(c))) out.push(m.slice(1, 5).map(Number)); return out; };
  claim(PA, 'point', 'Millimetres become points at 72 ÷ 25.4 per mm; spacing is held between 2 and 30 mm and line weight between 0.1 and 2.',
    'spacing 1 → 2 mm, 50 → 30 mm; weight 5 → 2', N, async () => {
      const gapOf = async (sp) => { const s = segs((await paper({ type: 'lined', spacing: sp })).c).filter((x) => x[1] === x[3]); return s[1][1] - s[0][1]; };
      const g1 = await gapOf(1), g50 = await gapOf(50), g5 = await gapOf(5);
      const w = /([\d.]+) w/.exec((await paper({ type: 'grid', weight: 5 })).c)[1];
      return [near(g1, 2 * MMP, 0.001) && near(g50, 30 * MMP, 0.001) && near(g5, 5 * MMP, 0.001) && w === '2', [g1, g5, g50].map((x) => (x / MMP).toFixed(3) + ' mm').join(', ') + '; weight ' + w];
    });
  claim(PA, 'point', 'Grid and lined paper start at the bottom-left margin corner and repeat up to the far margin; lined paper adds a pink margin rule 25 mm in.',
    'first line at the 10 mm margin; a pink vertical rule 25 mm inside it', N, async () => {
      const { c } = await paper({ type: 'lined' });
      const s = segs(c); const v = s.find((x) => x[0] === x[2]);
      const pink = /0\.8784 0\.5412 0\.5412 RG/.test(c);
      return [near(s[0][1], 10 * MMP, 0.001) && v && near(v[0], 35 * MMP, 0.001) && pink, 'first y ' + (s[0][1] / MMP).toFixed(2) + ' mm, rule at ' + (v ? (v[0] / MMP).toFixed(2) : '?') + ' mm, pink ' + pink];
    });
  claim(PA, 'point', 'A dot grid draws every dot as its own small filled square, one drawing operation each.', 'dots = filled squares, one per grid point', N, async () => {
    const { c, r } = await paper({ type: 'dot' });
    const n = (c.match(/ re f/g) || []).length;
    const cols = Math.floor((595.28 - 2 * 10 * MMP) / (5 * MMP) + 0.01 / (5 * MMP)) + 1, rows = Math.floor((841.89 - 2 * 10 * MMP) / (5 * MMP)) + 1;
    return [n === Number(K.stat(r, 'Drawing operations per page')) && n >= (cols - 1) * (rows - 1), n + ' filled squares (' + cols + '×' + rows + ' grid)'];
  });
  claim(PA, 'point', 'Drawing instructions are stored uncompressed and repeated in full on every page, so size grows with the pattern and the page count.',
    '3 pages: three identical uncompressed streams', N, async () => {
      const { a } = await paper({ type: 'grid', pages: 3 });
      const cs = []; for (let i = 0; i < 3; i++) cs.push(await a.content(i));
      const refs = new Set(a.pages.map((p) => K.j(p.dict.Contents)));
      const filtered = a.streams.some((s) => s.dict && s.dict.Filter);
      return [refs.size === 3 && cs[0] === cs[1] && cs[1] === cs[2] && !filtered, refs.size + ' streams, identical ' + (cs[0] === cs[2]) + ', compressed ' + filtered];
    });
  claim(PA, 'dfaq', 'the default is a pale blue-grey, #9db4d0. On lined paper the margin rule stays pink.', 'default stroke #9db4d0; black lines keep a pink rule', N, async () => {
    const d = (await paper({ type: 'grid' })).c; const k = (await paper({ type: 'lined', colour: '#000000' })).c;
    return [/0\.6157 0\.7059 0\.8157 RG/.test(d) && /0 0 0 RG/.test(k) && /0\.8784 0\.5412 0\.5412 RG/.test(k), 'default ' + (/0\.6157 0\.7059 0\.8157 RG/.test(d) ? '#9db4d0' : '?') + ', pink rule with black ' + /0\.8784 0\.5412 0\.5412 RG/.test(k)];
  });
  claim(PA, 'tip', 'Isometric paper uses a 60-degree triangular grid', 'iso lines run at 0°, 60° and 120°', N, async () => {
    const s = segs((await paper({ type: 'iso' })).c);
    const ang = new Set(s.map((x) => Math.round(Math.atan2(x[3] - x[1], x[2] - x[0]) * 180 / Math.PI)));
    return [[...ang].sort().join() === '0,120,60', [...ang].join(',') + '°'];
  });
  claim(PA, 'tip', 'Cornell layout gives a narrow cue column on the left, a wide notes area, and a summary strip at the bottom.', 'a vertical rule in the left third, a horizontal one near the bottom', N, async () => {
    const s = segs((await paper({ type: 'cornell' })).c);
    const v = s.find((x) => x[0] === x[2]), h = s.find((x) => x[1] === x[3]);
    return [v && v[0] < 595 / 2.5 && h && h[1] < 842 / 4, 'cue rule x ' + (v && v[0].toFixed(1)) + ', summary rule y ' + (h && h[1].toFixed(1))];
  });

  /* ================================================================ */
  /* payslip                                                           */
  /* ================================================================ */
  const PS = '/pdf/payslip-pdf/';
  const slip = async (o) => { const r = await K.runPdf('payslip-pdf', [], o); return { r, t: r.files ? (await K.pdfText(K.pdfOut(r))).pages[0] : [] }; };
  claim(PS, 'tip', 'Only the last number on the line is read as the amount, so a label may contain digits.', '"Allowance 2026 bonus 5000" and "HRA, 12,000.00"', N, async () => {
    const { t, r } = await slip({ earnings: 'Allowance 2026 bonus 5000\nHRA, 12,000.00', deductions: 'Tax 100' });
    const i = t.indexOf('Allowance 2026 bonus'), j = t.indexOf('HRA');
    return [i >= 0 && t[i + 1] === '5,000.00' && j >= 0 && t[j + 1] === '12,000.00' && K.stat(r, 'Gross earnings') === 'Rs 17,000.00', errOf(r) || [t[i], t[i + 1], t[j], t[j + 1], K.stat(r, 'Gross earnings')].join(' | ')];
  });
  claim(PS, 'point', 'Net pay is gross earnings minus total deductions. Paid days and loss of pay are printed, never used to prorate.', '5 LOP days leave the net unchanged', N, async () => {
    const a = await slip({}); const b = await slip({ paidDays: 26, lop: 5 });
    return [K.stat(a.r, 'Net pay') === K.stat(b.r, 'Net pay') && K.stat(a.r, 'Net pay') === 'Rs 61,500.00' && b.t.indexOf('LOSS OF PAY') >= 0, K.stat(a.r, 'Net pay') + ' vs ' + K.stat(b.r, 'Net pay')];
  });
  claim(PS, 'point', 'Amounts use Indian grouping, and the net is spelt out in lakh and crore, with paise if there are any.', 'net 1,50,000.50 in figures and words', N, async () => {
    const { r } = await slip({ earnings: 'Basic 150000.50', deductions: '' });
    const w = K.stat(r, 'In words') || '';
    return [K.stat(r, 'Net pay') === 'Rs 1,50,000.50' && /Lakh/.test(w) && /Paise/i.test(w), K.stat(r, 'Net pay') + ' / ' + w + (r.error ? ' / ' + r.error : '')];
  });
  claim(PS, 'point', 'Days that do not add up, or a negative net, bring a warning; more than 22 lines in a column stops the run.', 'warning for 25 + 0 of 31 days; 23 earnings lines refused', N, async () => {
    const a = await slip({ paidDays: 25, lop: 0 });
    const b = await slip({ earnings: Array.from({ length: 23 }, (_, i) => 'Item ' + String.fromCharCode(65 + i) + ' 100').join('\n') });
    const c = await slip({ earnings: 'Basic 100', deductions: 'Loan 500' });
    return [!!a.r.warn && !!a.r.files && !!b.r.error && !!c.r.warn, 'days warn ' + K.j(a.r.warn) + '; 23 lines: ' + (b.r.error || 'accepted') + '; negative net warn ' + K.j(c.r.warn)];
  });
  claim(PS, 'mistake', 'The amount column is headed "AMOUNT (Rs)" and the words are in rupees whatever you type.', 'heading and words', N, async () => {
    const { t, r } = await slip({});
    return [t.indexOf('AMOUNT (Rs)') >= 0 && /^Rupees/.test(K.stat(r, 'In words')), t.filter((x) => /AMOUNT/.test(x)).join()];
  });
  claim(PS, 'dfaq', 'Left blank, it prints as a dash.', 'a blank UAN prints a dash (and so do a blank PAN and bank account)', N, async () => {
    const { t } = await slip({ uan: '', pan: '', bank: '' });
    /* K.shown returns raw WinAnsi bytes: the em dash is byte 0x97 (octal \227), the en dash 0x96 */
    const win = (s) => String(s == null ? '' : s).replace(/\x97/g, '—').replace(/\x96/g, '–');
    const after = (k) => { const i = t.indexOf(k); return i >= 0 ? win(t[i + 1]) : '(no ' + k + ' label)'; };
    const got = ['UAN', 'PAN', 'BANK ACCOUNT / UPI'].map((k) => [k, after(k)]);
    return [got.every(([, v]) => v === '—'), K.j(got)];
  });
  claim(PS, 'faq', 'Amounts are marked Rs instead', 'no rupee sign, Rs instead', N, async () => {
    const { r } = await slip({}); const all = (await K.pdfText(K.pdfOut(r))).all;
    return [/Rs /.test(all) && !/₹/.test(all), (all.match(/Rs [\d,.]+/) || [''])[0]];
  });
  claim(PS, 'works', 'The site\'s own PDF writer lays out one A4 page', 'one A4 page', N, async () => {
    const a = await K.analyse(K.pdfOut((await slip({})).r));
    return [a.pages.length === 1 && a.pages[0].dict.MediaBox.map(Math.round).join() === '0,0,595,842', a.pages.length + ' page(s)'];
  });

  /* ================================================================ */
  /* add text                                                          */
  /* ================================================================ */
  const ED = '/pdf/pdf-editor/';
  const edit = async (file, o) => { const r = await K.runPdf('pdf-editor', [file], Object.assign({ items: [] }, o)); return { r, a: r.files ? await K.analyse(K.pdfOut(r)) : null }; };
  claim(ED, 'point', 'A wrap width breaks lines using Helvetica\'s real character widths, and each line steps down 1.25 times the font size.',
    'width 150 at 16 pt: every line fits 150 pt by Helvetica metrics, 20 pt apart', N, async () => {
      const { a } = await edit(await P(1), { text: 'The quick brown fox jumps over the lazy dog again and again', size: 16, width: 150, x: 50, y: 600 });
      const rr = runs(await a.content(0)).filter((x) => x.font === 'MVRedit');
      const core = K.core();
      const widths = rr.map((x) => core.textWidth(x.str, 'Helvetica', 16));
      const steps = rr.slice(1).map((x, i) => rr[i].y - x.y);
      return [rr.length > 2 && widths.every((w) => w <= 150.01) && steps.every((s) => near(s, 20, 0.01)), rr.length + ' lines, widths ' + widths.map((w) => w.toFixed(1)).join('/') + ', steps ' + steps.join('/')];
    });
  claim(ED, 'point', 'Each chosen page gets a new content stream and a font entry, MVRedit, for Helvetica: one of the standard 14 fonts readers supply, so nothing is embedded.',
    'MVRedit is Helvetica, no font file', N, async () => {
      const { a } = await edit(await P(1), { text: 'X', x: 50, y: 50 });
      const res = await a.doc.resolve(a.pages[0].dict.Resources); const f = await a.doc.resolve((await a.doc.resolve(res.Font)).MVRedit);
      return [f && f.BaseFont && f.BaseFont.name === 'Helvetica' && !hasFontFile(a), f ? 'MVRedit → ' + (f.BaseFont && f.BaseFont.name) : 'no MVRedit'];
    });
  claim(ED, 'point', 'Text is mapped to WinAnsi, which covers Western European letters, curly quotes, dashes and €; most characters outside it become question marks.',
    '“ ” – € keep WinAnsi codes, Ω becomes ?', N, async () => {
      const { a } = await edit(await P(1), { text: '“a” – € Ω', x: 50, y: 50 });
      const c = await a.content(0);
      return [/\(\\223a\\224 \\226 \\200 \?\) Tj/.test(c), (c.match(/\([^)]*\) Tj/g) || []).pop()];
    });
  claim(ED, 'point', 'The file is rebuilt by the assembler merge uses, which keeps the bookmarks, the form fields, the title and the author.', 'outline, fields, Title, Author kept', N, async () => {
    const { a } = await edit(await S('A'), { text: 'X', x: 50, y: 50, pages: '1' });
    const ol = (await a.outline()).length, f = (await a.fields() || []).length;
    return [ol === 3 && f === 2 && a.info.Title === 'Secrets A' && a.info.Author === 'Fixture Author', ol + ' bookmarks, ' + f + ' fields, ' + K.j(a.info)];
  });
  claim(ED, 'dfaq', 'Yes. The edited file is written fresh, but its Title, Author, bookmarks and form fields are carried into it.', 'same as the point above, via the FAQ', N, async () => {
    const { a } = await edit(await S('A'), { text: 'X', x: 50, y: 50, pages: '1' });
    return [a.info.Title === 'Secrets A' && (await a.outline()).length === 3, a.info.Title];
  });
  claim(ED, 'tip', '0 means each line stays exactly as typed, and a blank line in the box is a blank line on the page.', 'width 0: "A", blank, "B" leaves a two-line gap', N, async () => {
    const { a } = await edit(await P(1), { text: 'Aaa\n\nBbb', size: 10, width: 0, x: 50, y: 500 });
    const rr = runs(await a.content(0)).filter((x) => x.font === 'MVRedit');
    return [rr.length === 2 && near(rr[0].y - rr[1].y, 25, 0.01), K.j(rr.map((x) => [x.str, x.y]))];
  });
  claim(ED, 'tip', 'The Pages box on each item decides where it goes: 1, 2-5, all, or last.', '"last" on 3 pages writes only page 3', N, async () => {
    const { a } = await edit(await P(3), { text: 'LASTONLY', x: 50, y: 50, pages: 'last' });
    const on = []; for (let i = 0; i < 3; i++) on.push(/LASTONLY/.test(await a.content(i)));
    return [on.join() === 'false,false,true', on.join()];
  });
  claim(ED, 'dfaq', 'Yes: it is real text, so it can be selected, searched and copied.', 'the added words are a Tj string', N, async () => {
    const { a } = await edit(await P(1), { text: 'Findable words', x: 50, y: 50 });
    return [/\(Findable words\) Tj/.test(await a.content(0)), 'Tj found'];
  });
  claim(ED, 'dfaq', 'The file is rewritten from scratch, so the signed bytes no longer match', 'the output is not the input with an update appended', N, async () => {
    const src = Buffer.from(await sec('A'));
    const { r } = await edit({ name: 's.pdf', bytes: src }, { text: 'X', x: 50, y: 50 });
    const out = Buffer.from(K.pdfOut(r));
    return [!out.slice(0, src.length).equals(src), out.slice(0, src.length).equals(src) ? 'incremental update' : 'rewritten'];
  });
  claim(ED, 'faq', 'This draws new text on top of the page; it does not touch what is already there.', 'the original drawing is still in the page, before the new text', N, async () => {
    const { a } = await edit(await S('A'), { text: 'NEWTEXT', x: 50, y: 50, pages: '1' });
    const c = await a.content(0);
    return [c.indexOf('(MARKER-A1-BODY) Tj') >= 0 && c.indexOf('(MARKER-A1-BODY) Tj') < c.indexOf('(NEWTEXT) Tj'), 'original ' + (c.indexOf('MARKER-A1-BODY') >= 0 ? 'kept' : 'gone')];
  });
  claim(ED, 'tip', 'With the preview focused, the arrow keys nudge by 2 points and shift-arrow by 20, and Page Up and Page Down turn the page.',
    'ArrowRight +2, Shift+ArrowRight +20, PageDown shows page 2', B, async () => {
      const p = await K.pdf.open(ED);
      try {
        await K.pdf.upload(p, [K.write('ed-3.pdf', await plainN(3))]);
        const cv = await p.waitForSelector('.tool-io canvas', { timeout: 60000 });
        await p.waitForFunction(() => /Page 1 of 3/.test(document.querySelector('.tool-io').textContent), { timeout: 60000 });
        await p.evaluate(() => { const c = [...document.querySelectorAll('.tool-io canvas')].find((x) => x.tabIndex >= 0) || document.querySelector('.tool-io canvas'); c.focus(); });
        const x0 = Number(await p.$eval('#pc-x', (e) => e.value));
        await p.keyboard.press('ArrowRight');
        const x1 = Number(await p.$eval('#pc-x', (e) => e.value));
        await p.keyboard.down('Shift'); await p.keyboard.press('ArrowRight'); await p.keyboard.up('Shift');
        const x2 = Number(await p.$eval('#pc-x', (e) => e.value));
        await p.keyboard.press('PageDown');
        await K.sleep(500);
        const lab = await p.evaluate(() => (document.querySelector('.tool-io').textContent.match(/Page \d+ of \d+/) || [''])[0]);
        return [x1 - x0 === 2 && x2 - x1 === 20 && lab === 'Page 2 of 3', 'X ' + x0 + ' → ' + x1 + ' → ' + x2 + '; ' + lab];
      } finally { await p.close(); }
    });
  claim(ED, 'faq', 'Type the first, click where it goes, then press "Add as another item". It moves into the list below and stays drawn on the preview; the controls clear for the next one.',
    'Add as another item banks the text and clears the box; Add text writes both', B, async () => {
      const p = await K.pdf.open(ED);
      try {
        await K.pdf.upload(p, [K.write('ed-1.pdf', await plainN(1))]);
        await p.waitForSelector('.place-items-add', { timeout: 60000 });
        await K.pdf.set(p, { text: 'FIRST-ITEM', x: 60, y: 600 });
        await p.click('.place-items-add');
        await K.sleep(300);
        const cleared = await p.$eval('#pc-text', (e) => e.value);
        await K.pdf.set(p, { text: 'SECOND-ITEM', x: 60, y: 300 });
        await K.pdf.press(p);
        const t = (await pagesOf((await K.pdf.download(p)).bytes)).join(' ');
        return [cleared === '' && /FIRST-ITEM/.test(t) && /SECOND-ITEM/.test(t), 'text box after banking: ' + K.j(cleared) + '; output: ' + t];
      } finally { await p.close(); }
    });
  claim(ED, 'tip', 'Click the page preview to place the text.', 'a click on the preview sets X and Y', B, async () => {
    const p = await K.pdf.open(ED);
    try {
      await K.pdf.upload(p, [K.write('ed-1b.pdf', await plainN(1))]);
      await p.waitForFunction(() => /Page 1 of 1|X \d/.test(document.querySelector('.tool-io').textContent), { timeout: 60000 }).catch(() => {});
      const cv = await p.$$('.tool-io canvas');
      const c = cv[cv.length - 1];
      await c.evaluate((e) => e.scrollIntoView({ block: 'center' }));
      /* on a busy machine the page can still be laying out: click only once
         the preview has stopped moving */
      let box = await c.boundingBox();
      for (let k = 0; k < 20; k++) {
        await K.sleep(150);
        const b2 = await c.boundingBox();
        const still = Math.abs(b2.x - box.x) < 0.5 && Math.abs(b2.y - box.y) < 0.5 && Math.abs(b2.width - box.width) < 0.5 && Math.abs(b2.height - box.height) < 0.5;
        box = b2;
        if (still) break;
      }
      const before = [await p.$eval('#pc-x', (e) => e.value), await p.$eval('#pc-y', (e) => e.value)];
      await p.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.25);
      await K.sleep(300);
      const after = [await p.$eval('#pc-x', (e) => e.value), await p.$eval('#pc-y', (e) => e.value)];
      const ok = Math.abs(Number(after[0]) - 595.28 * 0.25) < 8 && Math.abs(Number(after[1]) - 841.89 * 0.75) < 8;
      return [ok, 'X,Y ' + before.join(',') + ' → ' + after.join(',')];
    } finally { await p.close(); }
  });

  /* ================================================================ */
  /* inspector                                                         */
  /* ================================================================ */
  const IN = '/pdf/pdf-inspector/';
  const insp = async (bytes, name) => K.runPdf('pdf-inspector', [{ name: name || 'x.pdf', bytes }], {});
  claim(IN, 'point', 'Sizes come from each page\'s MediaBox, or its parent\'s, rounded to whole points, converted to millimetres and grouped.',
    'A4 and Letter pages grouped with mm', N, async () => {
      const b = K.core().createPDF([{ size: [595.28, 841.89], ops: [] }, { size: [612, 792], ops: [] }, { size: [595.28, 841.89], ops: [] }], {});
      const s = K.stat(await insp(b), 'Page sizes') || '';
      return [/595 × 842 pt\s+\(210 × 297 mm\) × 2/.test(s) && /612 × 792 pt\s+\(216 × 279 mm\) × 1/.test(s), s];
    });
  claim(IN, 'tip', 'Page sizes are given in points and millimetres. A4 is 595 × 842 pt', 'A4 reads 595 × 842 pt (210 × 297 mm)', N, async () => {
    const s = K.stat(await insp(await sec('A')), 'Page sizes'); return [/595 × 842 pt\s+\(210 × 297 mm\)/.test(s || ''), s];
  });
  claim(IN, 'point', 'Annotations are counted from each page\'s Annots: links, comments and form-field widgets alike.', 'the fixture\'s 7 annotations', N, async () => {
    const s = K.stat(await insp(await sec('A')), 'Annotations'); return [s === '7', s];
  });
  claim(IN, 'point', 'Metadata comes from the Info dictionary only; an XMP metadata stream is not read.', 'Info Author shown, XMP creator not', N, async () => {
    const r = await insp(await sec('A'));
    const all = K.j(r.stats);
    return [K.stat(r, 'Metadata: Author') === 'Fixture Author' && !/XMP-AUTHOR/.test(all), K.stat(r, 'Metadata: Author')];
  });
  claim(IN, 'dfaq', 'The PDF version line reads the header at the start of the file, such as 1.4 or 1.7.', 'the 1.7 header', N, async () => {
    const s = K.stat(await insp(await sec('A')), 'PDF version'); return [s === '1.7', s];
  });
  claim(IN, 'dfaq', 'their payslip inspects as Helvetica-Bold, Helvetica', 'the payslip generator\'s file', N, async () => {
    const r = await K.runPdf('payslip-pdf', [], {});
    const s = K.stat(await insp(K.pdfOut(r)), 'Distinct fonts'); return [/Helvetica-Bold, Helvetica$/.test(s || ''), s];
  });
  claim(IN, 'point', 'Fonts are the entries in a page\'s own font resources that carry a BaseFont name', 'Helvetica listed from the resources', N, async () => {
    const s = K.stat(await insp(await sec('A')), 'Distinct fonts'); return [/Helvetica/.test(s || ''), s];
  });
  claim(IN, 'works', 'It runs as soon as a file is chosen', 'choosing a file shows the report without pressing anything', B, async () => {
    const p = await K.pdf.open(IN);
    try {
      const input = await p.$('.tool-io .dropzone input[type=file]');
      await input.uploadFile(K.write('insp.pdf', await sec('A')));
      const ok = await p.waitForFunction(() => /PDF version/.test(document.querySelector('.tool-io').textContent), { timeout: 20000 }).then(() => true, () => false);
      return [ok, ok ? 'report shown on choosing' : 'no report until pressed'];
    } finally { await p.close(); }
  });

  /* ================================================================ */
  /* metadata                                                          */
  /* ================================================================ */
  const MD = '/pdf/pdf-metadata/';
  const strip = () => K.once('pdf:strip', async () => K.runPdf('pdf-metadata', [await S('A')], { action: 'strip' }));
  claim(MD, 'tip', 'This rewrites the document without the metadata dictionary rather than blanking fields, so nothing survives in the file.', 'no Info, no field value anywhere in the bytes', N, async () => {
    const a = await K.analyse(K.pdfOut(await strip()));
    const left = ['Fixture Author', 'Fixture Creator', 'Fixture Producer', 'Fixture Subject', 'Secrets A'].filter((s) => a.text.indexOf(s) >= 0);
    return [!left.length && !/\/Info/.test(Buffer.from(K.pdfOut(await strip())).toString('latin1')), left.join(', ') || 'none left'];
  });
  claim(MD, 'tip', 'Some PDFs also carry an XMP metadata stream. Rebuilding the document drops that too.', 'XMP gone', N, async () => {
    const a = await K.analyse(K.pdfOut(await strip())); return [!/XMP-AUTHOR/.test(a.text) && a.root.Metadata === undefined, a.root.Metadata ? 'XMP kept' : 'XMP gone'];
  });
  claim(MD, 'tip', 'Text inside the page content is not metadata and is left alone.', 'page text intact', N, async () => {
    const a = await K.analyse(K.pdfOut(await strip())); return [/MARKER-A1-BODY/.test(a.text) && /MARKER-A3-BODY/.test(a.text), 'page text kept'];
  });
  claim(MD, 'point', 'whichever of its eight standard fields are present appear in the stats', 'all six fields the fixture has are listed', N, async () => {
    const r = await strip(); const k = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer'].filter((f) => K.stat(r, f) === undefined);
    return [!k.length, k.length ? 'missing ' + k.join() : 'all listed'];
  });
  claim(MD, 'point', 'bookmarks and form fields are rebuilt in it, while the XMP stream is left out in both modes.', 'edit mode keeps bookmarks and fields, drops XMP', N, async () => {
    const a = await K.analyse(K.pdfOut(await K.runPdf('pdf-metadata', [await S('A')], { action: 'edit', Title: 'New' })));
    return [(await a.outline()).length === 3 && (await a.fields() || []).length === 2 && a.root.Metadata === undefined, (await a.outline()).length + ' bookmarks, XMP ' + (a.root.Metadata ? 'kept' : 'gone')];
  });
  claim(MD, 'point', 'Remove writes no /Info at all. Set writes only Title, Author, Subject and Keywords; a box left empty is dropped, not kept.', 'set Title only: Info has only Title', N, async () => {
    const a = await K.analyse(K.pdfOut(await K.runPdf('pdf-metadata', [await S('A')], { action: 'edit', Title: 'New title' })));
    return [K.j(a.info) === '{"Title":"New title"}', K.j(a.info)];
  });
  claim(MD, 'dfaq', 'Press the button with either action: the stats list every field the original holds, Author, Creator and Producer included.', 'edit mode lists the original\'s Creator and Producer', N, async () => {
    const r = await K.runPdf('pdf-metadata', [await S('A')], { action: 'edit', Title: 'X' });
    return [K.stat(r, 'Creator') === 'Fixture Creator' && K.stat(r, 'Producer') === 'Fixture Producer' && K.stat(r, 'Author') === 'Fixture Author', K.j(r.stats)];
  });
  claim(MD, 'mistake', 'Comments keep their authors\' names and embedded photos their EXIF data, because pages and images are copied as they are.', 'the comment survives stripping', N, async () => {
    const a = await K.analyse(K.pdfOut(await strip())); return [/MARKER-A2-COMMENT/.test(a.text), /MARKER-A2-COMMENT/.test(a.text) ? 'comment kept' : 'comment gone'];
  });
  claim(MD, 'dfaq', 'Bookmarks and form fields are not metadata and are rebuilt in the new file', 'strip keeps bookmarks and fields', N, async () => {
    const a = await K.analyse(K.pdfOut(await strip())); return [(await a.outline()).length === 3 && (await a.fields() || []).length === 2, (await a.outline()).length + ' bookmarks'];
  });

  /* ================================================================ */
  /* organise (browser)                                                */
  /* ================================================================ */
  const OG = '/pdf/pdf-organise/';
  const openOrg = async (file) => {
    const p = await K.pdf.open(OG);
    await K.pdf.upload(p, [file]);
    const n = await (await K.core().PDFDocument.load(new Uint8Array(require('fs').readFileSync(file)))).pageCount();
    await p.waitForFunction((n) => document.querySelectorAll('.page-card').length === n && document.querySelectorAll('.page-card canvas').length === Math.min(n, 6) && /Source pages/.test(document.querySelector('.tool-io').textContent), { timeout: 120000 }, n);
    return p;
  };
  const buildOrg = async (p) => {
    await K.clearDownloads(p);
    await p.$eval('.pdf-run .btn-primary', (b) => b.click());
    await p.waitForFunction(() => { const s = document.querySelector('.pdf-summary'); return s && !s.hidden; }, { timeout: 60000 });
    return K.pdf.download(p);
  };
  /* a long file: how many thumbnails exist at first, and whether the last one appears once the grid scrolls to it */
  const lazyOrg = async (p, n) => {
    await K.sleep(1500);
    const first = await p.$$eval('.page-card canvas', (l) => l.length);
    const lastBefore = await p.$eval('.page-card[data-index="' + (n - 1) + '"]', (c) => !!c.querySelector('canvas'));
    await p.$eval('.page-grid', (g) => { g.scrollTop = g.scrollHeight; });
    await p.waitForFunction((k) => !!document.querySelector('.page-card[data-index="' + k + '"] canvas'), { timeout: 30000 }, n - 1).catch(() => {});
    const lastAfter = await p.$eval('.page-card[data-index="' + (n - 1) + '"]', (c) => !!c.querySelector('canvas'));
    return { first, lastBefore, lastAfter };
  };
  claim(OG, 'works', 'pdf.js draws each card’s page only as it scrolls near the screen', 'a 60-page file: fewer than 60 thumbnails at first, page 60 drawn once the grid reaches it', B, async () => {
    const f = K.write('org-60.pdf', await plainN(60));
    const p = await K.pdf.open(OG);
    try {
      await K.pdf.upload(p, [f]);
      await p.waitForFunction(() => document.querySelectorAll('.page-card').length === 60 && document.querySelectorAll('.page-card canvas').length > 3, { timeout: 120000 });
      const r = await lazyOrg(p, 60);
      return [r.first < 60 && !r.lastBefore && r.lastAfter, r.first + ' drawn at first; page 60 ' + (r.lastBefore ? 'already drawn' : 'not drawn') + ', then ' + (r.lastAfter ? 'drawn' : 'still not drawn')];
    } finally { await p.close(); }
  });
  claim(OG, 'point', 'A turn is added to any /Rotate the page already had; nothing is re-rendered.', 'a page at 90° turned once is saved at 180°, its content unchanged', B, async () => {
    const p = await openOrg(K.write('org-rot.pdf', K.rotated()));
    try {
      const btn = await p.$$('.page-card:nth-child(2) button');
      const turned = await p.evaluate(() => { const b = [...document.querySelectorAll('.page-card:nth-child(2) button')].find((x) => /rotat|turn/i.test((x.title || '') + (x.getAttribute('aria-label') || ''))); if (!b) return false; b.click(); return true; });
      if (!turned) return [false, 'no rotate button on the card'];
      const d = await buildOrg(p);
      const a = await K.analyse(d.bytes);
      const r = [await a.rotate(0), await a.rotate(1), await a.rotate(2)];
      const c = await a.content(1);
      return [r[1] === 180 && /\(ROT-2\) Tj/.test(c), 'rotations ' + r.join(', ') + (btn.length ? '' : '')];
    } finally { await p.close(); }
  });
  claim(OG, 'dfaq', 'Yes. It stays in the grid, shown as dropped, with a restore button, until you build the file.', 'a removed page stays in the grid and can be restored', B, async () => {
    const p = await openOrg(K.write('org-3b.pdf', await plainN(3)));
    try {
      const clicked = await p.evaluate(() => { const b = [...document.querySelectorAll('.page-card:nth-child(2) button')].find((x) => /remov|delete|drop/i.test((x.title || '') + (x.getAttribute('aria-label') || ''))); if (!b) return false; b.click(); return true; });
      if (!clicked) return [false, 'no remove button'];
      await K.sleep(200);
      const st = await p.evaluate(() => { const c = document.querySelector('.page-card:nth-child(2)'); const r = [...c.querySelectorAll('button')].find((x) => /restor|undo|keep/i.test((x.title || '') + (x.getAttribute('aria-label') || '') + x.textContent)); return { cards: document.querySelectorAll('.page-card').length, cls: c.className, restore: !!r }; });
      return [st.cards === 3 && /drop|remov|delet/i.test(st.cls) && st.restore, K.j(st)];
    } finally { await p.close(); }
  });
  claim(OG, 'dfaq', 'Yes, where their page is kept: each points at its page\'s new position, and one whose page you removed is dropped.', 'remove page 2 of the fixture: bookmarks Cover, Terms', B, async () => {
    const p = await openOrg(K.write('org-sec.pdf', await sec('A')));
    try {
      await p.evaluate(() => { const b = [...document.querySelectorAll('.page-card:nth-child(2) button')].find((x) => /remov|delete|drop/i.test((x.title || '') + (x.getAttribute('aria-label') || ''))); b.click(); });
      const d = await buildOrg(p);
      const a = await K.analyse(d.bytes);
      const ol = (await a.outline()).map((o) => o.title).join();
      return [a.pages.length === 2 && ol === 'Cover,Terms', a.pages.length + ' pages, bookmarks ' + ol];
    } finally { await p.close(); }
  });
  claim(OG, 'faq', 'Only the thumbnails near the part of the grid on screen are drawn', 'six pages, all on screen, all drawn with ink; a long file draws page by page as it scrolls', B, async () => {
    const p = await openOrg(K.write('org-6.pdf', await plainN(6)));
    try {
      const inked = await p.$$eval('.page-card canvas', (l) => l.map((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 200) n++; return n; }));
      return [inked.length === 6 && inked.every((n) => n > 0), inked.join(', ') + ' dark pixels per thumbnail'];
    } finally { await p.close(); }
  });
  claim(OG, 'faq', 'Up to 10,000 pages.', 'a 10,001-page file is turned away with a message', B, async () => {
    const f = K.write('org-10001.pdf', K.core().createPDF(Array.from({ length: 10001 }, () => ({ ops: [] })), {}));
    const p = await K.pdf.open(OG);
    try {
      await K.pdf.upload(p, [f]);
      const t = await p.$eval('.file-list', (e) => e.textContent);
      return [/10,001 pages is more than these tools work on in one go \(10,000\)/.test(t) && !(await p.$('.page-card')), t.slice(0, 160)];
    } finally { await p.close(); }
  });
  claim(OG, 'works', 'opening a file loads pdf.js, Mozilla\'s open-source renderer, from this site\'s own copy.', 'pdf.js comes from /engine/vendor/pdfjs/ on the site, only once a file is chosen', B, async () => {
    const p = await K.pdf.open(OG);
    try {
      /* resource timing sees module imports and the worker, which the request hook can miss */
      const loaded = () => p.evaluate(() => performance.getEntriesByType('resource').filter((e) => /pdf(\.worker)?\.min\.mjs/.test(e.name)).map((e) => e.name));
      const before = await loaded();
      await K.pdf.upload(p, [K.write('org-1.pdf', await plainN(1))]);
      await p.waitForSelector('.page-card canvas', { timeout: 120000 });
      const after = (await loaded()).map((u) => u.replace(K.BASE, ''));
      return [before.length === 0 && after.length >= 1 && after.every((u) => /^\/engine\/vendor\/pdfjs\//.test(u)),
        'before the press: ' + (before.join(', ') || 'none') + '; after: ' + after.join(', ')];
    } finally { await p.close(); }
  });

  /* ================================================================ */
  /* page numbers                                                      */
  /* ================================================================ */
  const PN = '/pdf/pdf-page-numbers/';
  const pn = async (n, o) => { const r = await K.runPdf('pdf-page-numbers', [await P(n)], o); const a = await K.analyse(K.pdfOut(r)); const pages = []; for (let i = 0; i < a.pages.length; i++) pages.push(runs(await a.content(i)).filter((x) => x.font === 'MVRpn')); return { r, a, pages }; };
  claim(PN, 'dfaq', 'Set Skip first N pages to 2 and Start numbering at 1; the third page then shows 1.', 'skip 2, start 1 on 4 pages', N, async () => {
    const { pages } = await pn(4, { skip: 2, start: 1, format: 'n' });
    const s = pages.map((p) => p.map((x) => x.str).join('') || '-').join(',');
    return [s === '-,-,1,2', s];
  });
  claim(PN, 'point', 'in the "of" formats the total counts only the pages that get a number.', 'skip 1 on 4 pages: "1 of 3"', N, async () => {
    const { pages } = await pn(4, { skip: 1, format: 'n-of-t' });
    const s = pages.map((p) => p.map((x) => x.str).join('') || '-').join(',');
    return [s === '-,1 of 3,2 of 3,3 of 3', s];
  });
  claim(PN, 'tip', 'Numbers are placed 32 points — about 11 mm — from the page edge', 'bottom-centre baseline at 32 pt; top at 32 pt below the top edge', N, async () => {
    const b = (await pn(1, { position: 'bc' })).pages[0][0];
    const t = (await pn(1, { position: 'tc' })).pages[0][0];
    return [near(b.y, 32, 0.01) && t && t.y > 790 && t.y < 842 - 32 + 1, 'bottom y ' + b.y + ', top y ' + (t && t.y)];
  });
  claim(PN, 'point', 'Helvetica\'s published character widths measure it, so a centred number sits in the middle.', 'x + width/2 = page centre', N, async () => {
    const r = (await pn(1, { position: 'bc', format: 'page-n-of-t' })).pages[0][0];
    const w = K.core().textWidth(r.str, 'Helvetica', 10);
    return [near(r.x + w / 2, 595.28 / 2, 0.05), r.str + ' at ' + r.x + ', centre ' + (r.x + w / 2).toFixed(2)];
  });
  claim(PN, 'point', 'Nothing is flattened: the label is real text in a font resource named MVRpn, and the original text stays searchable.', 'MVRpn font, original Tj kept', N, async () => {
    const { a } = await pn(1, {});
    const c = await a.content(0);
    return [/\/MVRpn \d+ Tf/.test(c) && /\(PAGE-1\) Tj/.test(c), 'MVRpn ' + /\/MVRpn/.test(c)];
  });
  claim(PN, 'dfaq', 'No page labels are written, so the viewer still calls the cover page 1.', 'no /PageLabels', N, async () => {
    const { a } = await pn(3, { skip: 1 }); return [a.root.PageLabels === undefined, a.root.PageLabels ? 'labels written' : 'none'];
  });
  claim(PN, 'mistake', 'It is centred but never wrapped, so a line wider than the page runs off both sides.', 'a long header is one run, wider than the page', N, async () => {
    const extra = 'A VERY LONG RUNNING HEADER THAT GOES ON AND ON AND ON AND ON AND ON AND ON AND ON';
    const { pages } = await pn(1, { extra, size: 20, format: 'n' });
    const long = pages[0].find((x) => x.str.length > 40);
    return [!!long && long.x < 0, long ? 'one run starting at x ' + long.x.toFixed(1) : K.j(pages[0].map((x) => x.str))];
  });
  claim(PN, 'tip', 'a landscape page stored sideways or a cropped scan is numbered upright and inside its visible edge.', 'pdf.js reads the number upright on a page turned 90°', B, async () => {
    const r = await K.runPdf('pdf-page-numbers', [{ name: 'rot.pdf', bytes: K.rotated() }], { format: 'n' });
    const p = await K.open(PN, { wait: '.tool-io' });
    try {
      const j = await K.pdfjs(p, K.pdfOut(r));
      const it = j.pages[1].items.find((x) => x.str === '2');
      const up = it && it.m[0] > 0 && Math.abs(it.m[1]) < 1e-3 && Math.abs(it.m[2]) < 1e-3 && it.m[3] < 0;
      return [up && it.m[4] > 0 && it.m[4] < j.pages[1].w && it.m[5] < j.pages[1].h, it ? 'matrix ' + it.m.map((v) => Math.round(v * 100) / 100).join(' ') + ' on ' + Math.round(j.pages[1].w) + '×' + Math.round(j.pages[1].h) : 'number not found'];
    } finally { await p.close(); }
  });

  /* ================================================================ */
  /* signature                                                         */
  /* ================================================================ */
  const SG = '/pdf/pdf-signature/';
  const sign = async (file, o) => { const r = await K.runPdf('pdf-signature', [file], Object.assign({ drawn: null }, o)); return { r, a: r.files ? await K.analyse(K.pdfOut(r)) : null }; };
  claim(SG, 'point', 'your text in 11-point Helvetica, and "Date:" with your device\'s date 14 points lower if the date is on.', 'text at Y in 11 pt; Date: 14 pt below', N, async () => {
    const { a } = await sign(await P(1), { signatureText: 'SIGNED-X', date: 'yes', x: 100, y: 200, pages: '1' });
    const rr = runs(await a.content(0));
    const s = rr.find((x) => x.str === 'SIGNED-X'), d = rr.find((x) => /^Date:/.test(x.str));
    const fontOk = s && (await (async () => { const res = await a.doc.resolve(a.pages[0].dict.Resources); const f = await a.doc.resolve((await a.doc.resolve(res.Font))[s.font]); return f && f.BaseFont && f.BaseFont.name === 'Helvetica'; })());
    return [s && d && s.size === 11 && near(s.y, 200) && near(d.y, 186) && fontOk, K.j(rr.map((x) => [x.str, x.font, x.size, x.y]))];
  });
  claim(SG, 'point', 'No /Sig field, /ByteRange or certificate is written, so the file holds nothing a signature validator could check.', 'no /Sig, /ByteRange or /Cert', N, async () => {
    const { r } = await sign(await P(1), { signatureText: 'X', pages: '1' });
    const t = Buffer.from(K.pdfOut(r)).toString('latin1');
    return [!/\/Sig\b|\/ByteRange|\/Cert/.test(t), /\/Sig\b|\/ByteRange|\/Cert/.test(t) ? 'signature structures present' : 'none'];
  });
  claim(SG, 'tip', 'Leave the pages box on "last" to sign only the final page', 'default "last" on 3 pages signs page 3 only', N, async () => {
    const { a } = await sign(await P(3), { signatureText: 'ONLY-LAST' });
    const on = []; for (let i = 0; i < 3; i++) on.push(/ONLY-LAST/.test(await a.content(i)));
    return [on.join() === 'false,false,true' && K.pdfDefaults('pdf-signature').pages === 'last', on.join()];
  });
  claim(SG, 'dfaq', 'It is your device\'s date when you pressed the button, written as fixed text.', 'the date is a plain string with today\'s date; no script or field', N, async () => {
    const { a } = await sign(await P(1), { signatureText: 'X', date: 'yes', pages: '1' });
    const d = runs(await a.content(0)).find((x) => /^Date:/.test(x.str));
    const now = new Date();
    const want = [now.getDate() + ' ' + now.toLocaleString('en-GB', { month: 'long' }) + ' ' + now.getFullYear(), now.toISOString().slice(0, 10), now.toLocaleDateString('en-GB')];
    return [d && want.some((w) => d.str.indexOf(w) >= 0) && !/\/JavaScript|\/JS\b|\/AA\b/.test(a.text), d ? d.str : 'no Date: line'];
  });
  claim(SG, 'point', 'a drawing as black vector strokes', 'a drawn signature is stroked paths in black', N, async () => {
    const drawn = { w: 360, h: 120, strokes: [[[20, 90], [60, 30], [100, 90]]] };
    const { a } = await sign(await P(1), { signatureText: '', date: 'no', x: 50, y: 60, pages: '1', drawn, drawWidth: 150 });
    const c = await a.content(0);
    return [/ l\n/.test(c) && /\nS\n/.test(c) && /0 0 0 RG|0 G\b/.test(c), (c.match(/[\d. ]+(RG|G)\n/) || ['no stroke colour'])[0]];
  });
  claim(SG, 'faq', 'This tool writes no signature field, certificate or /ByteRange, so a signature validator finds nothing to check.', 'typed and drawn: no /Sig, /FT /Sig, /ByteRange or /Cert', N, async () => {
    const drawn = { w: 360, h: 120, strokes: [[[20, 90], [60, 30], [100, 90]]] };
    const a = (await sign(await P(2), { signatureText: 'X', pages: 'all' })).a;
    const b = (await sign(await P(1), { signatureText: 'Y', date: 'yes', pages: '1', drawn, drawWidth: 150 })).a;
    const bad = (x) => /\/Sig\b|\/FT\s*\/Sig|\/ByteRange|\/Cert/.test(x.text);
    return [a && b && !bad(a) && !bad(b), a && b ? ('typed: ' + (bad(a) ? 'signature structures present' : 'none') + '; drawn: ' + (bad(b) ? 'signature structures present' : 'none')) : 'no output'];
  });
  claim(SG, 'dfaq', 'A file from this tool shows none: it has no signature field.', 'no /FT /Sig field', N, async () => {
    const { a } = await sign(await S('A'), { signatureText: 'X', pages: '1' });
    return [!/\/FT\s*\/Sig/.test(a.text), 'fields: ' + (await a.fields() || []).join()];
  });

  /* ================================================================ */
  /* PDF to images (browser)                                           */
  /* ================================================================ */
  const PI = '/pdf/pdf-to-images/';
  /* pdf-to-images shows its pages as cards with blob previews, not a summary */
  const renderImgs = async (p) => {
    await p.$$eval('.tool-io .pdf-file-card', (l) => l.forEach((c) => c.remove()));
    await p.click('.pdf-run .btn-primary');
    await p.waitForFunction(() => /Images produced/.test(document.querySelector('.tool-io').textContent) && document.querySelector('.tool-io .pdf-file-card') || document.querySelector('.tool-io .io-msg.is-error'), { timeout: 180000 });
    await K.sleep(300);
    const imgs = await p.$$eval('.tool-io .pdf-file-card img.image-preview', (l) => Promise.all(l.map(async (i) => { const b = await (await fetch(i.src)).blob(); return { type: b.type, bytes: Array.from(new Uint8Array(await b.arrayBuffer())) }; })));
    return imgs.map((x) => ({ type: x.type, bytes: Buffer.from(x.bytes) }));
  };
  const toImages = async (file, c) => {
    const p = await K.pdf.open(PI);
    await K.pdf.upload(p, [file]);
    if (c) await K.pdf.set(p, c);
    return { p, imgs: await renderImgs(p) };
  };
  claim(PI, 'dfaq', '2480 × 3508. At 150 DPI this tool gives 1240 × 1754, half each way.', 'an A4 page at 150 and 300 DPI', B, async () => {
    const a = await toImages(K.write('a4-2.pdf', await plainN(2)), { dpi: '150', pages: '1' });
    try {
      const d1 = await K.img.pixels(a.p, a.imgs[0].bytes, [[0, 0]]);
      await K.pdf.set(a.p, { dpi: '300' });
      const d2 = await K.img.pixels(a.p, (await renderImgs(a.p))[0].bytes, [[0, 0]]);
      return [d1.w === 1240 && d1.h === 1754 && d2.w === 2480 && d2.h === 3508, d1.w + '×' + d1.h + ' and ' + d2.w + '×' + d2.h];
    } finally { await a.p.close(); }
  });
  claim(PI, 'dfaq', 'Type its number in Pages, or a list such as 1, 3-4, and only those pages are drawn.', '"1, 3-4" of 5 pages gives 3 images', B, async () => {
    const a = await toImages(K.write('five.pdf', await plainN(5)), { pages: '1, 3-4', dpi: '72' });
    try { return [a.imgs.length === 3, a.imgs.length + ' images']; } finally { await a.p.close(); }
  });
  claim(PI, 'dfaq', 'No. Every page is painted on white first, so the background is opaque, like paper.', 'PNG corner pixels are opaque white', B, async () => {
    const a = await toImages(K.write('one.pdf', await plainN(1)), { dpi: '72', format: 'image/png' });
    try {
      const b = a.imgs[0].bytes;
      const px = await K.img.pixels(a.p, b, [[0, 0], [-1, -1]]);
      return [K.isPng(b) && px.px.every((c) => c[3] === 255 && c[0] === 255), K.kind(b) + ' ' + K.j(px.px)];
    } finally { await a.p.close(); }
  });
  claim(PI, 'point', 'The canvas is encoded with canvas.toBlob as PNG, or as JPEG or WebP at your quality, held between 40 and 100.', 'JPEG at quality 10 is the same file as at 40', B, async () => {
    const a = await toImages(K.write('q.pdf', await plainN(1)), { dpi: '72', format: 'image/jpeg', quality: 10 });
    try {
      const j10 = a.imgs[0].bytes;
      await K.pdf.set(a.p, { quality: 40 });
      const j40 = (await renderImgs(a.p))[0].bytes;
      return [K.isJpeg(j10) && j10.equals(j40), K.kind(j10) + ', q10 ' + j10.length + ' B, q40 ' + j40.length + ' B'];
    } finally { await a.p.close(); }
  });

  /* ================================================================ */
  /* purchase order and quotation                                      */
  /* ================================================================ */
  const PO = '/pdf/purchase-order-pdf/';
  const po = async (o) => { const r = await K.runPdf('purchase-order-pdf', [], o); return { r, t: r.files ? (await K.pdfText(K.pdfOut(r))) : null }; };
  claim(PO, 'tip', 'Only the quantity and the rate are required, so "Consulting, 2, 500" works here exactly as it does in the Invoice and Quotation tools', '"Consulting, 2, 500" is 2 at 500', N, async () => {
    const { r } = await po({ items: 'Consulting, 2, 500', charges: '', taxMode: 'none' });
    return [K.stat(r, 'Goods and services') === 'Rs 1,000.00', r.error || K.stat(r, 'Goods and services')];
  });
  claim(PO, 'tip', 'Freight, packing and other charges are listed separately but added to the taxable value before tax', 'charges are taxed with the goods', N, async () => {
    const { r } = await po({ items: 'Steel, 1, Nos, 1000', charges: 'Freight, 100', taxMode: 'vat20', currency: 'GBP' });
    return [K.stat(r, 'Taxable value') === '£1,100.00' && /£220\.00/.test(K.j(r.stats)), K.j(r.stats.slice(0, 6))];
  });
  claim(PO, 'point', 'one VAT or GST rate is applied to it, split into CGST and SGST for an intra-state order.', 'CGST 9% and SGST 9% at 18% intra-state', N, async () => {
    const { t } = await po({}); const s = t.pages[0];
    return [s.indexOf('CGST 9%') >= 0 && s.indexOf('SGST 9%') >= 0, s.filter((x) => /GST/.test(x)).join()];
  });
  claim(PO, 'mistake', 'so the tool names both readings, 2 at 650 and 2 at 2650, and stops.', '"Plate,2,2,650" stops with both readings', N, async () => {
    const { r } = await po({ items: 'Plate,2,2,650' });
    return [!!r.error && /2 at 650|650/.test(r.error) && /2,650|2650/.test(r.error), r.error || 'no error'];
  });
  claim(PO, 'mistake', 'The UK VAT choices use fixed rates of 20%, 5% and 0%.', 'VAT 5% ignores a GST rate of 18', N, async () => {
    const { r } = await po({ taxMode: 'vat5', taxRate: 18, currency: 'GBP', items: 'Item, 1, 1000', charges: '' });
    return [/VAT 5%/.test(K.j(r.stats)) && /£50\.00/.test(K.j(r.stats)), K.j(r.stats.slice(0, 6))];
  });
  claim(PO, 'dfaq', 'The £ and € signs print, and the value in words uses pounds and pence or euros and cents.', 'GBP and EUR orders', N, async () => {
    const g = await po({ currency: 'GBP', taxMode: 'vat20', items: 'Item, 1, 10.50', charges: '', rounding: 'none' });
    const e = await po({ currency: 'EUR', taxMode: 'none', items: 'Item, 1, 10.50', charges: '', rounding: 'none' });
    const gt = g.t.all, et = e.t.all.replace(/\x80/g, '€');
    return [/£/.test(gt) && /Pounds/.test(gt) && /Pence/.test(gt) && /€/.test(et) && /Euros/.test(et) && /Cents/.test(et), (gt.match(/Pounds[^.]*/) || [''])[0] + ' | ' + (et.match(/Euros[^.]*/) || [''])[0]];
  });
  claim(PO, 'faq', 'As many as you need, up to 200. The table continues onto further pages with the column headings repeated and "Page n of m" in the footer',
    '60 lines run over pages with headings and Page n of m; 201 refused', N, async () => {
      const lines = (n) => Array.from({ length: n }, (_, i) => 'Item ' + (i + 1) + ', 1, 10').join('\n');
      const { r, t } = await po({ items: lines(60), charges: '' });
      const big = await po({ items: lines(201), charges: '' });
      const heads = t.pages.filter((p) => p.indexOf('DESCRIPTION') >= 0).length;
      const foot = t.pages.every((p, i) => p.indexOf('Page ' + (i + 1) + ' of ' + t.pages.length) >= 0 || p.some((x) => x.indexOf('Page ' + (i + 1) + ' of ' + t.pages.length) >= 0));
      return [t.pages.length > 1 && heads >= t.pages.length - 1 && foot && !!big.r.error, t.pages.length + ' pages, headings on ' + heads + ', footers ' + foot + ', 201: ' + (big.r.error || 'accepted')];
    });
  claim(PO, 'tip', '"DAP Bengaluru 560025" does, and that is the line an insurer or a court will read.', 'the Incoterm is printed with its place', N, async () => {
    const { t } = await po({}); return [/DAP Bengaluru 560025/.test(t.all), (t.all.match(/Incoterms[^,]{0,40}/) || [''])[0]];
  });
  claim(PO, 'faq', 'Switch the delivery address control to "Use the address below" and type it in.', 'a separate delivery address is printed', N, async () => {
    const { t } = await po({ sameAddress: 'other', deliveryAddress: 'Depot 9\nSomewhere Lane' }); return [/Depot 9/.test(t.all), /Depot 9/.test(t.all) ? 'printed' : 'not printed'];
  });
  claim(PO, 'point', 'Amounts stay unrounded; only the committed value follows the Round the total setting.', 'tax keeps paise; the committed value is rounded', N, async () => {
    const { r } = await po({ items: 'Item, 1, 100.45', charges: '', taxMode: 'gst-inter', taxRate: 18, rounding: 'near' });
    return [/18\.08/.test(K.j(r.stats)) && K.stat(r, 'Committed value') === 'Rs 119.00', K.j(r.stats.slice(0, 6))];
  });

  const Q = '/pdf/quotation-pdf/';
  const qt = async (o) => { const r = await K.runPdf('quotation-pdf', [], o); return { r, t: r.files ? (await K.pdfText(K.pdfOut(r))) : null }; };
  claim(Q, 'tip', '"Glass 10 mm, 70071900, 42, Sqm, 2150" gives 42 Sqm at 2,150; leave the unit out and the last two numbers are read as quantity and rate.', 'with and without the unit', N, async () => {
    const a = await qt({ items: 'Glass 10 mm, 70071900, 42, Sqm, 2150', taxMode: 'none' });
    const b = await qt({ items: 'Glass 10 mm, 70071900, 42, 2150', taxMode: 'none' });
    const row = (t) => { const s = t.pages[0]; const i = s.indexOf('Glass 10 mm'); return s.slice(i, i + 6).join('|'); };
    return [/^Glass 10 mm\|70071900\|42\|Sqm\|2,150\.00/.test(row(a.t)) && /90,300\.00/.test(row(a.t)) && /^Glass 10 mm\|70071900\|42\|/.test(row(b.t)) && /2,150\.00/.test(row(b.t)), row(a.t) + ' / ' + row(b.t)];
  });
  claim(Q, 'tip', 'Intra-state GST splits the rate into CGST and SGST at half each; inter-state charges IGST at the full rate. If the two GSTINs start with different state codes it is normally inter-state, and the tool says so.',
    'IGST 18% inter-state; a warning for 29 vs 27 intra-state', N, async () => {
      const a = await qt({ taxMode: 'gst-inter' });
      const b = await qt({ taxMode: 'gst-intra', toTax: '27AAFN5678D1ZK' });
      return [a.t.pages[0].indexOf('IGST 18%') >= 0 && !!b.r.warn && /state/i.test(b.r.warn), 'inter: ' + a.t.pages[0].filter((x) => /GST/.test(x)).join() + '; warn: ' + K.j(b.r.warn)];
    });
  claim(Q, 'tip', 'A proforma invoice is not a tax invoice. The document says so on its face', 'the proforma says it is not a tax invoice', N, async () => {
    const { t } = await qt({ docType: 'Proforma Invoice' }); return [/not a tax invoice/i.test(t.all), (t.all.match(/[^.]{0,40}not a tax invoice[^.]{0,20}/i) || ['absent'])[0]];
  });
  claim(Q, 'point', 'Rates may keep their commas if a space follows each separating comma', '"Item, 1, Nos, 4,85,000" reads 4,85,000', N, async () => {
    const { r, t } = await qt({ items: 'Item, 1, Nos, 4,85,000\nOther, 2, Nos, 2,650', taxMode: 'none', rounding: 'none' });
    return [!r.error && K.stat(r, 'Subtotal') === 'Rs 4,90,300.00', r.error || K.stat(r, 'Subtotal')];
  });
  claim(Q, 'mistake', 'Writing a decimal with a comma, as 2,65. It fits neither 2,650 nor 4,85,000 grouping, so the tool stops and asks; use a point.', '"2,65" stops the run', N, async () => {
    const { r } = await qt({ items: 'Item, 2, 2,65' }); return [!!r.error, r.error || 'accepted'];
  });
  claim(Q, 'mistake', 'Choosing a valid-until date before the quotation date. The tool warns that the offer has expired, yet still produces it.', 'warning and a file', N, async () => {
    const { r } = await qt({ date: '2026-10-04', validUntil: '2026-09-01' }); return [!!r.warn && !!r.files && /expir/i.test(r.warn), K.j(r.warn)];
  });
  claim(Q, 'dfaq', 'The tool defaults to 30 days from today.', 'the Valid until control defaults to today + 30 days', N, async () => {
    const d = (K.pdfSpec('quotation-pdf').controls.find((c) => c.key === 'validUntil') || {}).default;
    const want = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    return [d === want, 'default ' + d + ', today + 30 = ' + want];
  });
  claim(Q, 'faq', 'The rounding line shows exactly how much was added or taken off, so the arithmetic still reconciles. Set rounding to "Do not round" to keep the paise or pence.',
    'rounding line on "nearest", paise kept on "do not round"', N, async () => {
      const a = await qt({}); const b = await qt({ rounding: 'none' });
      const ra = a.t.pages.flat(); const i = ra.indexOf('Rounding');
      return [i >= 0 && /^-?0\.\d\d$/.test(ra[i + 1]) && /\.\d\d$/.test(K.stat(b.r, 'Total')) && !/\.00$/.test(K.stat(b.r, 'Total')), 'rounding ' + ra[i + 1] + '; unrounded total ' + K.stat(b.r, 'Total')];
    });
  claim(Q, 'dfaq', 'The column appears only when a line carries a code of 4 to 8 digits; the tool does not check it.', 'no HSN/SAC column without codes', N, async () => {
    const { t } = await qt({ items: 'Thing, 1, Nos, 100' }); return [t.pages[0].indexOf('HSN/SAC') < 0, t.pages[0].indexOf('HSN/SAC') < 0 ? 'column absent' : 'column shown'];
  });
  claim(Q, 'faq', 'As many as you need, up to 200.', '201 lines refused', N, async () => {
    const { r } = await qt({ items: Array.from({ length: 201 }, (_, i) => 'I' + i + ', 1, 10').join('\n') }); return [!!r.error, r.error || 'accepted'];
  });
  claim(Q, 'dfaq', 'No. The letterhead is set in text, name, address, tax number and contact line, with an accent colour you choose.', 'no image in the quotation', N, async () => {
    const a = await K.analyse(K.pdfOut((await qt({})).r)); return [!hasImage(a), hasImage(a) ? 'image found' : 'text only'];
  });

  /* ================================================================ */
  /* rotate                                                            */
  /* ================================================================ */
  const RO = '/pdf/rotate-pdf/';
  const rot = async (o) => { const r = await K.runPdf('rotate-pdf', [{ name: 'r.pdf', bytes: K.rotated() }], o); const a = await K.analyse(K.pdfOut(r)); return { r, a, rot: [await a.rotate(0), await a.rotate(1), await a.rotate(2)] }; };
  claim(RO, 'tip', 'Rotation is additive: a page already at 90° rotated by another 90° ends at 180°.', 'inherited 90 and own 90 both end at 180', N, async () => {
    const { rot: r } = await rot({ angle: '90', pages: 'all' }); return [r.join() === '180,180,90', r.join()];
  });
  claim(RO, 'point', 'the angle is added to its existing /Rotate, set on the page or inherited, modulo 360; a result of 0 removes the entry.', '90 + 270 removes /Rotate', N, async () => {
    const { a, rot: r } = await rot({ angle: '270', pages: '1-2' });
    return [r.join() === '0,0,0' && a.pages[0].dict.Rotate === undefined && a.pages[1].dict.Rotate === undefined, r.join() + ', entries ' + [a.pages[0].dict.Rotate, a.pages[1].dict.Rotate].join()];
  });
  claim(RO, 'point', 'Content streams, fonts and images are copied byte for byte: nothing is re-rendered or recompressed.', 'image and deflated content bytes unchanged', N, async () => {
    const src = Buffer.from(await sec('A'));
    const out = Buffer.from(K.pdfOut(await K.runPdf('rotate-pdf', [{ name: 's.pdf', bytes: src }], {})));
    const a = await K.analyse(src);
    const raws = a.streams.filter((s) => s.raw && s.raw.length > 10).map((s) => Buffer.from(s.raw));
    const missing = raws.filter((b) => !out.includes(b)).length;
    return [missing <= 1, (raws.length - missing) + ' of ' + raws.length + ' source streams found byte for byte (the XMP stream may differ)'];
  });
  claim(RO, 'mistake', 'Use digits with hyphens and commas, such as 2-3, 7; anything else stops with an error naming the part it could not read.', '"2 to 3" is refused, naming the part', N, async () => {
    const r = await K.runPdf('rotate-pdf', [await P(4)], { pages: '2 to 3' });
    return [!!r.error && /2\s*to\s*3/.test(r.error), r.error || 'accepted'];
  });
  claim(RO, 'dfaq', 'Type that page\'s number in Pages, choose the angle and press Rotate pages; every other page is copied unchanged.', 'pages "2" turns page 2 only', N, async () => {
    const r = await K.runPdf('rotate-pdf', [await P(3)], { pages: '2', angle: '180' });
    const a = await K.analyse(K.pdfOut(r));
    const rr = [await a.rotate(0), await a.rotate(1), await a.rotate(2)];
    return [rr.join() === '0,180,0', rr.join()];
  });
  claim(RO, 'dfaq', 'The rotation entry accepts only multiples of 90.', 'the angle control offers 90, 180, 270 only', N, async () => {
    const o = K.pdfSpec('rotate-pdf').controls.find((c) => c.key === 'angle').options.map((x) => x.value).join();
    return [o === '90,180,270', o];
  });
  claim(RO, 'dfaq', 'Each turned page gains one short entry; in the run above the file grew by 22 bytes, its Title carried over unchanged.', 'the Title is carried over and the file barely grows', N, async () => {
    const src = await sec('A');
    const r = await K.runPdf('rotate-pdf', [{ name: 's.pdf', bytes: src }], { pages: '1' });
    const a = await K.analyse(K.pdfOut(r));
    return [a.info.Title === 'Secrets A' && Math.abs(a.size - src.length) < 400, 'Title ' + a.info.Title + ', ' + src.length + ' → ' + a.size + ' bytes'];
  });

  /* ================================================================ */
  /* split                                                             */
  /* ================================================================ */
  const SP = '/pdf/split-pdf/';
  const split = async (n, o, file) => { const r = await K.runPdf('split-pdf', [file || await P(n, 'doc.pdf')], o); const counts = []; for (const f of r.files || []) counts.push((await pagesOf(f.bytes)).map((x) => x.replace('PAGE-', '')).join('-')); return { r, counts }; };
  claim(SP, 'tip', 'Explicit ranges give you full control: "1-3 | 4-6 | 7-" produces three files, with the last taking everything from page 7 onward.', 'on 9 pages', N, async () => {
    const { counts } = await split(9, { mode: 'ranges', ranges: '1-3 | 4-6 | 7-' }); return [counts.join(' ') === '1-2-3 4-5-6 7-8-9', counts.join(' ')];
  });
  claim(SP, 'point', 'In half gives the extra page of an odd count to the first file. Explicit ranges are separated by |, so a page may appear in two outputs.', 'half of 5 is 3 + 2; "1-3 | 3-5" shares page 3', N, async () => {
    const h = await split(5, { mode: 'half' }); const o = await split(5, { mode: 'ranges', ranges: '1-3 | 3-5' });
    return [h.counts.join(' ') === '1-2-3 4-5' && o.counts.join(' ') === '1-2-3 3-4-5', h.counts.join(' ') + ' / ' + o.counts.join(' ')];
  });
  claim(SP, 'dfaq', 'Yes, with explicit ranges: "1-3 | 3-5" puts page 3 in both files.', 'page 3 in both', N, async () => {
    const o = await split(5, { mode: 'ranges', ranges: '1-3 | 3-5' }); return [o.counts.join(' ') === '1-2-3 3-4-5', o.counts.join(' ')];
  });
  claim(SP, 'point', 'For each group, pdfcore copies every page with the objects it refers to (content, fonts, images, annotations) into a fresh file, but never another page: a link out of the group is dropped.',
    'one file per page: no part holds another page\'s marker; page 1\'s internal links dropped', N, async () => {
      const { r } = await split(0, { mode: 'each' }, await S('A'));
      const bad = [];
      for (let i = 0; i < r.files.length; i++) { const a = await K.analyse(r.files[i].bytes); [1, 2, 3].filter((n) => n !== i + 1).forEach((n) => { if (a.text.indexOf('MARKER-A' + n) >= 0) bad.push('part ' + (i + 1) + ' has page ' + n); }); }
      const a1 = await K.analyse(r.files[0].bytes);
      const internal = (await a1.annots(0)).filter((x) => x.Subtype && x.Subtype.name === 'Link' && x.Dest).length;
      return [!bad.length && internal === 0, bad.join('; ') || ('clean; ' + internal + ' internal links left on part 1')];
    });
  claim(SP, 'point', 'Each part keeps the Title and Author, and the bookmarks and form fields of its own pages; parts are named after the source with their page span, such as -p3-4.',
    'names -p1-2 / -p3, Title and Author, own bookmarks and fields', N, async () => {
      const { r } = await split(0, { mode: 'every', n: 2 }, await S('A'));
      const names = r.files.map((f) => f.name).join(',');
      const a = await K.analyse(r.files[1].bytes);
      const ol = (await a.outline()).map((o) => o.title).join(); const fl = (await a.fields() || []).join();
      const a0 = await K.analyse(r.files[0].bytes); const f0 = (await a0.fields() || []).join();
      return [names === 'secrets-A-p1-2.pdf,secrets-A-p3.pdf' && a.info.Title === 'Secrets A' && a.info.Author === 'Fixture Author' && ol === 'Terms' && fl === '' && f0 === 'name,account',
        names + '; part 2: ' + K.j(a.info) + ', bookmarks ' + ol + ', fields ' + (fl || 'none') + '; part 1 fields ' + f0];
    });
  claim(SP, 'point', 'Up to 500 files can be made at once', '501 single pages are refused', N, async () => {
    const { r } = await split(501, { mode: 'each' }); return [!!r.error && !(r.files && r.files.length), r.error || (r.files || []).length + ' files made'];
  });
  claim(SP, 'mistake', 'A comma joins pages into the same group, so "1-3, 4-6" makes a single six-page file', '"1-3, 4-6" as ranges', N, async () => {
    const { counts } = await split(6, { mode: 'ranges', ranges: '1-3, 4-6' }); return [counts.join(' ') === '1-2-3-4-5-6', counts.join(' ')];
  });
  claim(SP, 'dfaq', 'A 30-page file gives 30 PDFs named from -p1 to -p30', 'names of 30 parts', N, async () => {
    const { r } = await split(30, { mode: 'each' });
    const n = r.files.map((f) => f.name);
    return [n.length === 30 && n[0] === 'doc-p1.pdf' && n[29] === 'doc-p30.pdf', n.length + ' files: ' + n[0] + ' … ' + n[n.length - 1]];
  });
  claim(SP, 'faq', 'Page content streams and embedded images are copied byte for byte — nothing is re-encoded or recompressed.', 'the image bytes are in part 2 unchanged', N, async () => {
    const { r } = await split(0, { mode: 'each' }, await S('A'));
    return [Buffer.from(r.files[1].bytes).includes(Buffer.from('MARKER-A2-IMG!')), 'raw image bytes in part 2'];
  });
  claim(SP, 'tip', 'Several output files are offered as a ZIP so you get them in one download.', 'the page offers "Download all … as ZIP" and it holds every part', B, async () => {
    const p = await K.pdf.open(SP);
    try {
      await K.pdf.upload(p, [K.write('split3.pdf', await plainN(3))]);
      await K.pdf.press(p);
      await K.clearDownloads(p);
      const ok = await K.clickText(p, '.tool-io button', /as ZIP/);
      if (!ok) return [false, 'no ZIP button'];
      await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 30000 });
      const [d] = await K.downloads(p);
      const names = K.zipNames(d.bytes).map((x) => x.name).join(',');
      return [/split3-p1\.pdf/.test(names) && /split3-p3\.pdf/.test(names), d.name + ': ' + names];
    } finally { await p.close(); }
  });

  /* ================================================================ */
  /* text to PDF                                                       */
  /* ================================================================ */
  const TP = '/pdf/text-to-pdf/';
  const t2p = async (text, o) => { const r = await K.runPdf('text-to-pdf', [], o, text); return { r, a: r.files ? await K.analyse(K.pdfOut(r)) : null }; };
  claim(TP, 'tip', 'Text is wrapped using the real font metrics, so lines break where they actually would', 'every line fits the measure, and the next word would not have', N, async () => {
    const words = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ');
    const text = Array.from({ length: 6 }, () => words.join(' ')).join(' ');
    const { a } = await t2p(text, { numbers: 'no', size: 11, margin: 20 });
    const rr = runs(await a.content(0));
    const core = K.core(); const maxW = 595.28 - 2 * 20 * 72 / 25.4;
    const w = rr.map((x) => core.textWidth(x.str, 'Helvetica', 11));
    const tight = rr.slice(0, -1).every((x, i) => w[i] <= maxW + 0.01 && core.textWidth(x.str + ' ' + rr[i + 1].str.split(' ')[0], 'Helvetica', 11) > maxW);
    return [tight, rr.length + ' lines, widths ' + w.map((x) => x.toFixed(0)).join('/') + ' of ' + maxW.toFixed(0)];
  });
  claim(TP, 'tip', 'Only the standard PDF fonts are used — Helvetica, Times and Courier — which means no font file is embedded', 'each font choice is a standard Type1 without a font file', N, async () => {
    const out = [];
    for (const f of ['Helvetica', 'Times-Roman', 'Courier']) { const { a } = await t2p('Hello', { font: f }); out.push(f + ':' + (/\/BaseFont\s*\/[A-Za-z-]+/.exec(a.text) || [''])[0] + (hasFontFile(a) ? ' EMBEDDED' : '')); }
    return [out.every((x) => !/EMBEDDED/.test(x)) && /Times-Roman/.test(out.join()) && /Courier/.test(out.join()), out.join(', ')];
  });
  claim(TP, 'tip', 'Characters outside Western European ranges cannot be represented without embedding a font, and appear as "?".', 'Greek and Cyrillic become ?', N, async () => {
    const { a } = await t2p('Ab Ωж é', { numbers: 'no' });
    const s = runs(await a.content(0))[0].str;
    return [s === 'Ab ?? é', K.j(s)];
  });
  claim(TP, 'tip', 'Blank lines in your text are preserved as blank lines in the output.', 'a blank line leaves one empty line of space', N, async () => {
    const { a } = await t2p('First\n\nThird', { numbers: 'no', size: 10, leading: 1.5 });
    const rr = runs(await a.content(0));
    return [rr.length === 2 && near(rr[0].y - rr[1].y, 30, 0.01), K.j(rr.map((x) => [x.str, x.y]))];
  });
  claim(TP, 'point', 'A Document title goes into the file\'s Title property and its name, not onto the page.', 'Title and file name, not drawn', N, async () => {
    const { r, a } = await t2p('Body text', { title: 'My Report' });
    const drawn = /My Report/.test(await a.content(0));
    return [a.info.Title === 'My Report' && r.files[0].name === 'my-report.pdf' && !drawn, K.j(a.info) + ', ' + r.files[0].name + ', on page ' + drawn];
  });
  claim(TP, 'point', 'curly quotes, dashes, € and ½ have their own codes; anything else becomes "?"', 'WinAnsi codes for “ – € ½', N, async () => {
    const { a } = await t2p('“q” – € ½ →', { numbers: 'no' });
    const c = await a.content(0);
    return [/\(\\223q\\224 \\226 \\200 \\275 \?\) Tj|\(\x93q\x94 \x96 \x80 \xbd \?\) Tj/.test(c), (c.match(/\([^)]*\) Tj/) || [''])[0]];
  });
  claim(TP, 'mistake', 'Runs of spaces and tabs shrink to one space when lines are wrapped, so code, tables and verse lose their layout, even in Courier.', 'Courier "a    b\\tc" comes out "a b c"', N, async () => {
    const { a } = await t2p('a    b\tc', { numbers: 'no', font: 'Courier' });
    const s = runs(await a.content(0))[0].str;
    return [s === 'a b c', K.j(s)];
  });
  claim(TP, 'card', 'Turn plain text into a properly paginated PDF with margins, wrapping and page numbers.', 'long text gives several pages, each numbered', N, async () => {
    const text = Array.from({ length: 200 }, (_, i) => 'Line ' + (i + 1)).join('\n');
    const { a } = await t2p(text, { numbers: 'yes' });
    const nums = []; for (let i = 0; i < a.pages.length; i++) nums.push((runs(await a.content(i)).pop() || {}).str);
    return [a.pages.length > 1 && nums.every((n, i) => n === String(i + 1)), a.pages.length + ' pages, numbers ' + nums.join(',')];
  });
  claim(TP, 'dfaq', 'the tool takes pasted text, not uploads.', 'the page has a text box and no file input', B, async () => {
    const p = await K.pdf.open(TP);
    try {
      const st = await p.evaluate(() => ({ files: document.querySelectorAll('.tool-io input[type=file]').length, ta: document.querySelectorAll('.tool-io textarea').length }));
      return [st.files === 0 && st.ta >= 1, K.j(st)];
    } finally { await p.close(); }
  });

  /* ================================================================ */
  /* watermark                                                         */
  /* ================================================================ */
  const W = '/pdf/watermark-pdf/';
  const wm = async (o, file) => { const r = await K.runPdf('watermark-pdf', [file || await P(1)], o); return { r, a: r.files ? await K.analyse(K.pdfOut(r)) : null }; };
  claim(W, 'works', 'The site\'s own writer copies each page and appends one more content stream after the existing ones, so the watermark is drawn last, on top.',
    'the page\'s last content stream holds the watermark', N, async () => {
      const { a } = await wm({}, await S('A'));
      const c = await a.doc.resolve(a.pages[0].dict.Contents);
      const list = Array.isArray(c) ? c : [a.pages[0].dict.Contents];
      const last = await a.doc.resolve(list[list.length - 1]);
      const data = Buffer.from(await a.doc.decodeStream(last)).toString('latin1');
      return [list.length >= 2 && /\(DRAFT\) Tj/.test(data), list.length + ' streams; last holds DRAFT ' + /DRAFT/.test(data)];
    });
  claim(W, 'point', 'The text is set in Helvetica Bold, turned by a text matrix built from the angle\'s cosine and sine.', '45°: Tm 0.7071 0.7071 -0.7071 0.7071, Helvetica-Bold', N, async () => {
    const { a } = await wm({ angle: '45' });
    const r = runs(await a.content(0)).find((x) => x.str === 'DRAFT');
    const res = await a.doc.resolve(a.pages[0].dict.Resources); const f = await a.doc.resolve((await a.doc.resolve(res.Font))[r.font]);
    return [r.m && near(r.m[0], 0.7071, 1e-3) && near(r.m[1], 0.7071, 1e-3) && near(r.m[2], -0.7071, 1e-3) && f.BaseFont.name === 'Helvetica-Bold', K.j(r.m) + ' ' + f.BaseFont.name];
  });
  claim(W, 'point', 'Opacity comes from an ExtGState named MVRgs whose fill and stroke alpha (ca, CA) run from 5% to 100%.', '20% → 0.2; 1% → 0.05; 150% → 1', N, async () => {
    const g = async (op) => { const { a } = await wm({ opacity: op }); const res = await a.doc.resolve(a.pages[0].dict.Resources); const gs = await a.doc.resolve((await a.doc.resolve(res.ExtGState)).MVRgs); return [gs.ca, gs.CA].join('/'); };
    const v = [await g(20), await g(1), await g(150)];
    return [v.join(' ') === '0.2/0.2 0.05/0.05 1/1', v.join(' ')];
  });
  claim(W, 'point', 'Tiled repeats the text in rows over an area three times the page\'s width and height, so diagonal rows reach every corner.', 'tiled copies start beyond the page on every side', N, async () => {
    const { a } = await wm({ position: 'tile', angle: '0' });
    const rr = runs(await a.content(0)).filter((x) => x.str === 'DRAFT');
    const xs = rr.map((x) => x.x), ys = rr.map((x) => x.y);
    return [rr.length > 10 && Math.min(...xs) < -100 && Math.max(...xs) > 595 && Math.min(...ys) < -100 && Math.max(...ys) > 842, rr.length + ' copies, x ' + Math.round(Math.min(...xs)) + '..' + Math.round(Math.max(...xs)) + ', y ' + Math.round(Math.min(...ys)) + '..' + Math.round(Math.max(...ys))];
  });
  claim(W, 'point', 'The added stream is uncompressed real text, so an editor can delete it whole.', 'the watermark stream has no filter and a Tj', N, async () => {
    const { a } = await wm({});
    const c = await a.doc.resolve(a.pages[0].dict.Contents); const list = Array.isArray(c) ? c : [a.pages[0].dict.Contents];
    const last = await a.doc.resolve(list[list.length - 1]);
    return [!last.dict.Filter && /\(DRAFT\) Tj/.test(Buffer.from(last.raw).toString('latin1')), 'Filter ' + K.j(last.dict.Filter || null)];
  });
  claim(W, 'dfaq', 'Type them in Pages, for example 1 or 2-5, 9; the other pages are copied unchanged.', 'pages "2" of 3', N, async () => {
    const { a } = await wm({ pages: '2' }, await P(3));
    const on = []; for (let i = 0; i < 3; i++) on.push(/DRAFT/.test(await a.content(i)));
    return [on.join() === 'false,true,false', on.join()];
  });
  claim(W, 'dfaq', 'Colour, angle, a size from 6 to 300 pt and the opacity can all be set.', 'size 1000 is held at 300, size 1 at 6', N, async () => {
    const s = async (v) => runs(await (await wm({ size: v })).a.content(0)).find((x) => x.str === 'DRAFT').size;
    const v = [await s(1000), await s(1)];
    return [v.join() === '300,6', v.join()];
  });
  claim(W, 'dfaq', 'Yes, if you know its password: it is asked for when you choose the file. The watermarked copy is saved without a password', 'an encrypted file opened with its password is watermarked and saved without /Encrypt', N, async () => {
    const enc = await K.core().protectDocument(await K.core().PDFDocument.load(await sec('A')), { userPassword: 'w-pass', method: 'AES-128' });
    const r = await K.runPdf('watermark-pdf', [{ name: 'e.pdf', bytes: enc, password: 'w-pass' }], {});
    const out = K.pdfOut(r);
    return [!!out && !/\/Encrypt/.test(Buffer.from(out).toString('latin1')) && /\(DRAFT\) Tj/.test((await K.analyse(out)).text), out ? 'watermarked, ' + out.length + ' bytes' : errOf(r)];
  });
  claim(W, 'tip', 'The text is drawn with a standard font, so no font file is embedded and the file barely grows.', 'no font file; under 1 KB more', N, async () => {
    const src = await plainN(1); const { a } = await wm({}, await P(1));
    return [!hasFontFile(a) && a.size - src.length < 1024, src.length + ' → ' + a.size + ' bytes'];
  });
  claim(W, 'mistake', 'The text is neither wrapped nor shrunk, so "CONFIDENTIAL – NOT FOR DISTRIBUTION" at 60 pt runs off both edges.', 'one run at 60 pt, wider than the page', N, async () => {
    const t = 'CONFIDENTIAL – NOT FOR DISTRIBUTION';
    const { a } = await wm({ text: t, size: 60, angle: '0' });
    const r = runs(await a.content(0)).filter((x) => x.font && x.size === 60);
    const w = K.core().textWidth(t, 'Helvetica-Bold', 60);
    return [r.length === 1 && w > 595, r.length + ' run(s), ' + Math.round(w) + ' pt wide'];
  });

  /* ================================================================ */
  /* certificate                                                       */
  /* ================================================================ */
  const C = '/pdf/certificate-pdf/';
  const cert = async (o) => { const r = await K.runPdf('certificate-pdf', [], o); return { r, a: r.files ? await K.analyse(K.pdfOut(r)) : null }; };
  claim(C, 'tip', 'Enter one name per line to generate a batch — each becomes its own page in a single PDF', 'three names, three pages, one file', N, async () => {
    const { r, a } = await cert({}); return [r.files.length === 1 && a.pages.length === 3, r.files.length + ' file, ' + a.pages.length + ' pages'];
  });
  claim(C, 'point', 'the heading is Times-Roman at 30 pt, wrapped to the page width.', 'heading run', N, async () => {
    const { a } = await cert({});
    const r = runs(await a.content(0)).find((x) => x.str === 'Certificate of Completion');
    const res = await a.doc.resolve(a.pages[0].dict.Resources); const f = r && await a.doc.resolve((await a.doc.resolve(res.Font))[r.font]);
    return [r && r.size === 30 && f && f.BaseFont.name === 'Times-Roman', r ? r.size + ' pt ' + (f && f.BaseFont.name) : 'heading not found'];
  });
  claim(C, 'point', 'The name is Helvetica-Bold at 26 pt on one line, centred and underlined to its measured width. It is never wrapped or shrunk.', 'a very long name stays one 26 pt run', N, async () => {
    const name = 'Maximilian Alexander Fitzgerald-Montgomery Worthington-Smythe the Third';
    const { a } = await cert({ names: name });
    const r = runs(await a.content(0)).find((x) => x.str === name);
    const res = await a.doc.resolve(a.pages[0].dict.Resources); const f = r && await a.doc.resolve((await a.doc.resolve(res.Font))[r.font]);
    return [r && r.size === 26 && f.BaseFont.name === 'Helvetica-Bold', r ? 'one run, ' + r.size + ' pt ' + f.BaseFont.name : 'name split'];
  });
  claim(C, 'point', 'Dates print in the long British form, such as 3 October 2026; one run accepts up to 500 names.', '2026-10-03 prints 3 October 2026; 501 names refused', N, async () => {
    const { a } = await cert({ date: '2026-10-03', names: 'A' });
    const ok = runs(await a.content(0)).some((x) => x.str === '3 October 2026');
    const big = await cert({ names: Array.from({ length: 501 }, (_, i) => 'N' + i).join('\n') });
    const fine = await cert({ names: Array.from({ length: 500 }, (_, i) => 'N' + i).join('\n') });
    return [ok && !!big.r.error && !!fine.r.files, 'date ' + ok + '; 501: ' + (big.r.error || 'accepted') + '; 500: ' + (fine.r.files ? 'made' : fine.r.error)];
  });
  claim(C, 'faq', 'it uses only vector drawing and standard fonts', 'no image, no font file', N, async () => {
    const { a } = await cert({}); return [!hasImage(a) && !hasFontFile(a), 'image ' + hasImage(a) + ', font file ' + hasFontFile(a)];
  });
  claim(C, 'dfaq', 'A4 only, landscape or portrait.', 'landscape 842×595, portrait 595×842', N, async () => {
    const l = (await cert({ orientation: 'landscape' })).a.pages[0].dict.MediaBox.map(Math.round).join('x');
    const p = (await cert({ orientation: 'portrait' })).a.pages[0].dict.MediaBox.map(Math.round).join('x');
    return [l === '0x0x842x595' && p === '0x0x595x842', l + ' / ' + p];
  });
  claim(C, 'mistake', 'A tab becomes a space, so a score next to "Priya Sharma" prints as part of her name', '"Priya Sharma<tab>95" prints "Priya Sharma 95"', N, async () => {
    const { a } = await cert({ names: 'Priya Sharma\t95' });
    return [runs(await a.content(0)).some((x) => x.str === 'Priya Sharma 95'), K.j(runs(await a.content(0)).map((x) => x.str).filter((s) => /Priya/.test(s)))];
  });
  claim(C, 'point', 'The border is two rectangles in your accent colour', 'accent #ff0000: two stroked rectangles in red', N, async () => {
    const { a } = await cert({ accent: '#ff0000' });
    const c = await a.content(0);
    const red = (c.match(/1 0 0 RG\n[\d.]+ w\n[-\d. ]+ re S/g) || []).length;
    return [red === 2, red + ' red rectangles'];
  });

  /* ================================================================ */
  /* delivery challan                                                  */
  /* ================================================================ */
  const DC = '/pdf/delivery-challan-pdf/';
  const dc = async (o) => { const r = await K.runPdf('delivery-challan-pdf', [], o); return { r, t: r.files ? await K.pdfText(K.pdfOut(r)) : null }; };
  claim(DC, 'tip', '"Glass 10 mm, 70071900, 42, Sqm, 26, 7" means 42 Sqm weighing 26 kg in 7 packages', 'the row reads HSN, 42, Sqm, 26, 7', N, async () => {
    const { t } = await dc({ items: 'Glass 10 mm, 70071900, 42, Sqm, 26, 7', copies: '1' });
    const s = t.pages[0]; const i = s.indexOf('Glass 10 mm');
    return [s.slice(i, i + 6).join('|') === 'Glass 10 mm|70071900|42|Sqm|26|7', s.slice(i, i + 6).join('|')];
  });
  claim(DC, 'tip', 'Choosing anything other than supply prints the declaration that the value shown is for transport purposes only.', 'job work prints the transport-only statement', N, async () => {
    const { t } = await dc({ purpose: 'jobwork', copies: '1' });
    return [/transport/i.test(t.all) && /not.{0,30}(sale|supply)/i.test(t.all), (t.all.match(/[^.]{0,60}transport[^.]{0,60}/i) || ['absent'])[0]];
  });
  claim(DC, 'point', 'An empty e-way bill field prints "Not generated", with a warning once the value reaches Rs 50,000.', 'at 50,000 the warning comes, at 49,999 it does not', N, async () => {
    const a = await dc({ ewayBill: '', declaredValue: 50000, copies: '1' }); const b = await dc({ ewayBill: '', declaredValue: 49999, copies: '1' });
    return [a.t.pages[0].indexOf('Not generated') >= 0 && !!a.r.warn && !b.r.warn, 'at 50,000: ' + K.j(a.r.warn) + '; at 49,999: ' + K.j(b.r.warn)];
  });
  claim(DC, 'tip', 'Each is printed as its own page with its name in the corner and in the footer, so they can be separated after printing.', 'three pages, each named twice', N, async () => {
    const { t } = await dc({});
    const names = ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'];
    const ok = t.pages.length === 3 && t.pages.every((p, i) => p.filter((x) => new RegExp(names[i]).test(x)).length >= 2);
    return [ok, t.pages.map((p) => p.filter((x) => /ORIGINAL|DUPLICATE|TRIPLICATE/.test(x)).join(' + ')).join(' / ')];
  });
  claim(DC, 'tip', 'marked ORIGINAL FOR CONSIGNEE, DUPLICATE FOR TRANSPORTER and TRIPLICATE FOR CONSIGNER, and those are the words printed, in the Rule\'s own spelling.',
    'three copies carry the exact Rule 55(2) markings, CONSIGNER spelt as the Rule spells it', N, async () => {
      const { t } = await dc({});
      const want = ['ORIGINAL FOR CONSIGNEE', 'DUPLICATE FOR TRANSPORTER', 'TRIPLICATE FOR CONSIGNER'];
      const ok = t.pages.length === 3 && t.pages.every((p, i) => p.some((x) => x.indexOf(want[i]) >= 0)) && !/FOR CONSIGNOR/.test(t.all);
      return [ok, t.pages.map((p) => p.filter((x) => /FOR (CONSIGN|TRANSPORT)/.test(x))[0] || 'no marking').join(' / ')];
    });
  claim(DC, 'tip', 'the rupee sign cannot be drawn. Amounts are marked Rs', 'Rs, no rupee sign', N, async () => {
    const { t } = await dc({ copies: '1' }); return [/Rs [\d,]/.test(t.all) && !/₹/.test(t.all), (t.all.match(/Rs [\d,.]+/) || [''])[0]];
  });
  claim(DC, 'point', 'a value of 0 leaves the value off.', 'declared value 0: no DECLARED VALUE line', N, async () => {
    const { t } = await dc({ declaredValue: 0, copies: '1' }); return [t.pages[0].indexOf('DECLARED VALUE') < 0, t.pages[0].indexOf('DECLARED VALUE') < 0 ? 'left off' : 'printed'];
  });
  claim(DC, 'point', 'HSN, weight and package columns appear only when used.', 'items without them: no HSN, WEIGHT or PACKAGES column', N, async () => {
    const { t } = await dc({ items: 'Chairs, 10, Nos\nTables, 2, Nos', copies: '1' });
    const s = t.pages[0];
    return [s.indexOf('HSN') < 0 && s.indexOf('WEIGHT (KG)') < 0 && s.indexOf('PACKAGES') < 0, s.filter((x) => /HSN|WEIGHT|PACKAGES/.test(x)).join() || 'none'];
  });
  claim(DC, 'mistake', 'The line is then read as description, HSN, quantity, so the package count becomes the quantity.', '"Glass, 70071900, 42, 26, 7" gets quantity 7', N, async () => {
    const { r } = await dc({ items: 'Glass, 70071900, 42, 26, 7', copies: '1' });
    return [/^7\b/.test(K.stat(r, 'Total quantity') || ''), 'total quantity ' + K.stat(r, 'Total quantity')];
  });
  claim(DC, 'dfaq', 'Yes: A4, US Letter and US Legal are all offered.', 'Legal gives a 612 × 1008 page', N, async () => {
    const o = K.pdfSpec('delivery-challan-pdf').controls.find((c) => c.key === 'pageSize').options.map((x) => x.value).join();
    const a = await K.analyse(K.pdfOut((await dc({ pageSize: 'legal', copies: '1' })).r));
    const mb = a.pages[0].dict.MediaBox.map(Math.round).join('x');
    return [o === 'a4,letter,legal' && mb === '0x0x612x1008', o + '; legal ' + mb];
  });
  claim(DC, 'faq', 'Choose "Both on one page" when one sheet has to do both jobs', '"both" makes one document headed challan and packing list; a short one fits one page', N, async () => {
    const { t } = await dc({ docType: 'both', copies: '1', items: 'Chairs, 10, Nos', notes: '' });
    const d = await dc({ docType: 'both', copies: '1' });
    return [/DELIVERY CHALLAN/.test(t.all) && /PACKING LIST/.test(t.all) && t.pages.length === 1, 'one item: ' + t.pages.length + ' page; with the page\'s own example data: ' + d.t.pages.length + ' pages'];
  });
  claim(DC, 'point', 'A long table continues under a compact letterhead, and every page is footed with its copy name and page number.', '60 items, one copy: every page footed', N, async () => {
    const { t } = await dc({ items: Array.from({ length: 60 }, (_, i) => 'Item ' + (i + 1) + ', 1, Nos').join('\n'), copies: '1' });
    const n = t.pages.length;
    const ok = n > 1 && t.pages.every((p, i) => p.some((x) => /ORIGINAL/.test(x)) && p.some((x) => x.indexOf('Page ' + (i + 1) + ' of ' + n) >= 0));
    return [ok, n + ' pages; footers ' + t.pages.map((p) => p.filter((x) => /Page \d/.test(x)).join('')).join(' | ')];
  });
  claim(DC, 'mistake', 'It has no tax rate or amount fields', 'no tax control', N, async () => {
    const k = K.pdfSpec('delivery-challan-pdf').controls.map((c) => c.key).filter((x) => /tax|rate|amount/i.test(x));
    return [!k.length, k.join() || 'none'];
  });

  /* ================================================================ */
  /* claims that need a person                                         */
  /* ================================================================ */
  manual(I, 'faq', 'Whether it is compliant depends on your jurisdiction and what you include', 'Legal advice; nothing to run.');
  manual(DC, 'faq', 'Under the Indian GST rules a challan covers movement that is not a supply', 'Statement of CGST Rule 55; check against the rule text.');
  manual(DC, 'dfaq', 'Yes, Rule 55 lists one.', 'Statement of CGST Rule 55 (signature); legal source, not behaviour.');
  manual(PS, 'faq', 'Is this a valid payslip under Indian law?', 'Legal statement about state Acts; not checkable by running the tool.');
  manual(PO, 'dfaq', 'Delivered At Place, an Incoterms 2020 rule', 'Definition from ICC Incoterms 2020; check against the ICC text.');
  manual(L, 'tip', 'Print at exactly 100% scale. Label sheets are unforgiving', 'Printing advice; needs a printer and a label sheet.');
  manual(L, 'faq', 'That is almost always printer margin offset rather than the template.', 'Printer behaviour; needs real hardware.');
  manual(PA, 'tip', 'A pale blue-grey grid photocopies and scans far better than black', 'Physical photocopying claim; needs a copier.');
  manual(PA, 'dfaq', 'There is no single standard: 5 mm is common on metric paper', 'General knowledge about stationery; no tool behaviour.');
  manual(SG, 'faq', 'A digital signature in the legal sense is a cryptographic operation that binds a certificate to the document', 'Legal/eIDAS explanation; not tool behaviour.');
  manual(PI, 'tip', 'about a megabyte, cached afterwards', 'The download size of pdf.js (pdf.min.mjs + worker) and browser caching; the size could be checked from the files, the caching needs a real browser profile.');
  manual(PI, 'mistake', 'Text recognition reads the words straight back', 'Claim about OCR software in general.');
  manual(W, 'tip', 'Keep opacity around 15–25%. Higher and it fights the text; lower and it vanishes when printed.', 'Printing and legibility advice; needs a printer.');
  manual(OG, 'tip', 'On a touch screen, drag by the grip in a card\'s corner', 'Touch dragging needs a touch device (pdf-fixes.js covers mouse dragging).');
  manual(M, 'faq', 'Nothing is transmitted, which is why this works offline', 'Offline use needs the service worker and a network switch; the browser check above only shows no upload happened.');
  manual(Q, 'what', 'It applies the single rate you enter; the rate pages it was checked against are under Sources.', 'Sources list on the page; editorial.');
};
