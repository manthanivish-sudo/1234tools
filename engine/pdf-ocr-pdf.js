(function(){
/* ---------- shared helpers ---------- */

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

/*
 * OCR PDF: every chosen page is drawn by pdf.js at 200 or 300 DPI, read by
 * Tesseract (engine/pdf-ocr-engine.js, in its own Web Worker) and given an
 * invisible text layer: each recognised word written in text render mode 3
 * (no fill, no stroke) at the place the word's box says, stretched with Tz
 * so its width matches the box. Viewers then search, select and copy the
 * scan as if it were typed, and the page looks exactly as it did.
 *
 * Coordinates: Tesseract's boxes are pixels of the canvas pdf.js drew, which
 * is the page as a reader sees it (its /Rotate applied, cropped to the
 * CropBox). The overlay is assembled with upright: true, so it is written in
 * that same frame — points, origin bottom left — and pdfcore's pageFrame
 * matrix turns it onto the page's own coordinates. One pixel is
 * width / canvas.width points across and height / canvas.height down.
 *
 * Text WinAnsi can hold goes in Helvetica (/MVRocr, nothing embedded). Hindi,
 * and anything else outside WinAnsi, goes through pdfcore's TextFonts: shaped
 * by HarfBuzz, drawn in a subset of Noto Sans Devanagari with a ToUnicode map,
 * so pdf.js and MuPDF read the logical text back.
 *
 * Why the writing happens on the page and not in the PDF worker: the words
 * are here already (Tesseract hands them to the page), the fonts and the
 * shaper load once for the run, and the assemble is short next to the
 * recognition. The worker would need every page's words copied to it.
 */

const LANGS = { eng: ['eng'], hin: ['hin'], both: ['eng', 'hin'] };
const LANG_LABEL = { eng: 'English', hin: 'Hindi', both: 'English and Hindi' };
const MAX_PIXELS = 16000000;            /* about 16 MP a page, below every browser's canvas ceiling */
const MARK = '%MVR-OCR text layer';

const n3 = (v) => String(Number(Number(v).toFixed(3)));
const abortError = () => { const e = new Error('Cancelled'); e.name = 'AbortError'; return e; };

/* The text pdf.js finds on a page: how a page that already has text is told
   apart from a scan. */
async function pageText(page) {
  const tc = await page.getTextContent();
  return tc.items.map((t) => t.str || '').join('').replace(/\s+/g, '');
}

/* One page's invisible text layer, as content-stream operators. */
function layerFor(lines, frame, core, tf) {
  const { sx, sy, H } = frame;
  let ops = MARK + '\nBT\n3 Tr\n';
  let words = 0;
  for (const line of lines) {
    const ws = (line.words || []).filter((w) => w.bbox && String(w.text || '').trim());
    if (!ws.length) continue;
    const lb = line.bbox || ws[0].bbox;
    const sizePx = line.fontSize > 0 ? line.fontSize : Math.max(1, lb.y1 - lb.y0);
    const size = Math.max(1, sizePx * sy);
    /* the line's slope, from Tesseract's baseline; a scan tilted by more than
       a few degrees is written flat rather than guessed at */
    let ang = 0;
    const b = line.baseline;
    if (b && b.x1 > b.x0) {
      ang = Math.atan2(-(b.y1 - b.y0) * sy, (b.x1 - b.x0) * sx);
      if (Math.abs(ang) > 0.2) ang = 0;
    }
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const space = core.textWidth(' ', 'Helvetica', size);
    for (let k = 0; k < ws.length; k++) {
      const w = ws[k];
      const text = String(w.text).trim();
      const x0 = w.bbox.x0 * sx, x1 = w.bbox.x1 * sx;
      const basePx = w.baseline ? w.baseline.y0 : (b ? b.y0 + (b.y1 - b.y0) * (w.bbox.x0 - b.x0) / Math.max(1, b.x1 - b.x0) : w.bbox.y1);
      const y = H - basePx * sy;
      const uni = !!(tf && tf.has(text, false));
      const natural = uni ? tf.widthSync(text, size, false) : core.textWidth(text, 'Helvetica', size);
      const tz = natural > 0 ? Math.max(1, Math.min(1000, ((x1 - x0) / cos) / natural * 100)) : 100;
      ops += [cos, sin, -sin, cos, x0, y].map(n3).join(' ') + ' Tm\n' + n3(tz) + ' Tz\n';
      if (uni) ops += tf.show(text, size, false).ops;
      else ops += '/MVRocr ' + n3(size) + ' Tf\n(' + core.contentEscape(text) + ') Tj\n';
      words++;
      /* a real space between words, stretched over the gap, so the pen ends
         where the next word starts and extractors read one line of words */
      if (k < ws.length - 1) {
        const gap = (ws[k + 1].bbox.x0 * sx - x1) / cos;
        const tzs = Math.max(1, Math.min(1000, gap / space * 100));
        ops += '/MVRocr ' + n3(size) + ' Tf\n' + n3(tzs) + ' Tz\n( ) Tj\n';
      }
    }
  }
  ops += 'ET\n';
  return { ops, words };
}

window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["ocr-pdf"] = {
"title": "OCR PDF (Make a Scan Searchable)",
"kind": "transform",
"action": "Make it searchable",
"multiple": false,
"description": "Recognise the text in a scanned PDF, in English or Hindi, and add it as an invisible layer so the file can be searched and copied from. It runs on your device; nothing you add is uploaded.",
"keywords": ["ocr pdf","searchable pdf","scanned pdf to text","make pdf searchable","hindi ocr pdf"],
"glyph": "i-ocr-pdf",
"glyphSvg": "<symbol id=\"i-ocr-pdf\" viewBox=\"0 0 24 24\">\n  <path d=\"M6 2.8h7.6L18.6 8v13.2H6z\"/>\n  <path d=\"M13.6 2.8V8h5\" class=\"thin\"/>\n  <circle cx=\"11.6\" cy=\"14.2\" r=\"2.8\" class=\"thin\"/>\n  <path d=\"M13.6 16.2l2.4 2.4\" class=\"thin\"/>\n</symbol>",
"needsRenderer": true,
"copyReport": true,
"progressLabel": "Loading the OCR engine",
"privacy": "Your file never leaves your device. The first time you use this tool it downloads the OCR engine and its language data from this site (about 5 MB for English, then cached); the recognition runs in your browser and nothing you add is uploaded.",
"controls": [
  {"key":"lang","label":"Language","type":"select","default":"eng","options":[{"value":"eng","label":"English"},{"value":"hin","label":"Hindi"},{"value":"both","label":"English and Hindi"}]},
  {"key":"pages","label":"Pages","type":"text","default":"all","hint":"all, or a list such as 1-3, 7"},
  {"key":"existing","label":"Pages that already have text","type":"select","default":"skip","options":[{"value":"skip","label":"Skip them"},{"value":"ocr","label":"Recognise them too"}]},
  {"key":"dpi","label":"Resolution","type":"select","default":"300","options":[{"value":"300","label":"300 DPI: small print, most accurate"},{"value":"200","label":"200 DPI: faster"}]}
],
"tips": [
  "Each page you choose is drawn at the resolution you pick, read by Tesseract in your browser, and given an invisible layer of the words it found, each placed over the word in the picture. The page looks exactly as it did; search, select and copy now work on it.",
  "The first run downloads the OCR engine (about 3 MB) and the language data (English 1.9 MB, Hindi 0.9 MB) from this site. Your browser keeps them, so later runs download nothing.",
  "Pages that already have text, such as a typed page in a mostly scanned file, are skipped by default and copied unchanged. Choose \"Recognise them too\" to read every page you picked.",
  "300 DPI suits small print and is the default; 200 DPI reads faster. An A4 page is drawn at 2480 × 3508 pixels at 300 DPI and 1654 × 2339 at 200.",
  "Choose English and Hindi for a page that mixes the two. Hindi words are written into the file in an embedded Noto Sans Devanagari subset, so they copy and search as Hindi text.",
  "The recognised text is shown under the result: copy it, or save it as a .txt file."
],
"faq": [
  {"q":"Will the PDF look different afterwards?","a":"No. The words are added in text render mode 3, which draws nothing, so every page prints and displays exactly as before. Only search, selection and copying change."},
  {"q":"Which languages can it read?","a":"English and Hindi (Devanagari), separately or together on the same page."},
  {"q":"How accurate is it?","a":"On a clean scan at 300 DPI, printed English comes back word for word, and the mean confidence Tesseract reports is shown with the result. Handwriting, very small print, heavy shadows and photographs of curved pages read much less well."},
  {"q":"Is my scan uploaded?","a":"No. The page is drawn and read in your browser; only the engine and the language data are downloaded, from this site, the first time."}
],
"mainRun": async (api) => {
  const entry = api.entries[0];
  if (!entry) return { error: 'Choose a scanned PDF first.' };
  const o = api.opts;
  const core = api.core;
  const langKey = LANGS[o.lang] ? o.lang : 'eng';
  const dpi = String(o.dpi) === '200' ? 200 : 300;
  const skipText = o.existing !== 'ocr';
  const t0 = performance.now();
  const check = () => { if (api.cancelled() || (api.signal && api.signal.aborted)) throw abortError(); };

  api.progress(0, 0, 'Opening the PDF');
  const pdf = await api.openPdf(entry);
  const total = pdf.numPages;
  let want;
  try { want = core.parsePageRange(o.pages || 'all', total); }
  catch (e) { return { error: e.message }; }
  want = [...new Set(want)].sort((a, b) => a - b);
  check();

  /* which of the chosen pages already have text */
  const skipped = [];
  const todo = [];
  for (const i of want) {
    if (skipText) {
      api.progress(0, 0, 'Checking page ' + (i + 1) + ' for text');
      const page = await pdf.getPage(i + 1);
      if ((await pageText(page)).length) { skipped.push(i); continue; }
    }
    todo.push(i);
  }
  check();
  if (!todo.length) {
    return { note: (skipped.length === 1 ? 'Page ' + (skipped[0] + 1) + ' already has' : 'All ' + skipped.length + ' pages you chose already have') + ' text, so there was nothing to recognise. Choose "Recognise them too" under "Pages that already have text" to read ' + (skipped.length === 1 ? 'it' : 'them') + ' anyway.' };
  }

  await api.loadScript('pdf-ocr-engine.js');
  const langs = LANGS[langKey];
  const ocr = await window.MVROcr.create({
    langs, signal: api.signal,
    onProgress: (f, label) => api.progress(f, 1, label)
  });

  const pages = new Map();        /* pageIndex -> { lines, frame, text, words, conf } */
  let clamped = 0;
  try {
    for (let n = 0; n < todo.length; n++) {
      check();
      const i = todo[n];
      const label = 'Reading page ' + (i + 1) + (todo.length > 1 ? ' (' + (n + 1) + ' of ' + todo.length + ')' : '');
      api.progress(n / todo.length, 1, label);
      const page = await pdf.getPage(i + 1);
      const base = page.getViewport({ scale: 1 });
      let scale = dpi / 72;
      let fit = Math.round;
      if (base.width * base.height * scale * scale > MAX_PIXELS) {
        scale = Math.sqrt(MAX_PIXELS / (base.width * base.height));
        fit = Math.floor;       /* rounding up could tip it over the cap */
        clamped++;
      }
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, fit(vp.width));
      canvas.height = Math.max(1, fit(vp.height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      check();
      const r = await ocr.recognize(canvas, {
        dpi: Math.round(scale * 72), signal: api.signal,
        onProgress: (f) => api.progress((n + Math.max(0, Math.min(1, f))) / todo.length, 1, label)
      });
      const frame = { W: base.width, H: base.height, sx: base.width / canvas.width, sy: base.height / canvas.height };
      canvas.width = canvas.height = 0;
      const words = r.words.filter((w) => String(w.text || '').trim());
      pages.set(i, { lines: r.lines, frame, text: String(r.text || '').replace(/\s+$/, ''), words: words.length, confSum: words.reduce((s, w) => s + (Number(w.confidence) || 0), 0) });
    }
  } finally {
    ocr.terminate();
  }
  check();

  const wordsAll = [...pages.values()].reduce((s, p) => s + p.words, 0);
  const confAll = wordsAll ? [...pages.values()].reduce((s, p) => s + p.confSum, 0) / wordsAll : 0;
  if (!wordsAll) {
    return { warn: 'No text was found on ' + (todo.length === 1 ? 'page ' + (todo[0] + 1) : 'the ' + todo.length + ' pages read') + ', so nothing was added. A blank page, a photograph, or a scan much smaller than the page can read as no text.' };
  }

  /* the invisible text layer, in WinAnsi where it can be and in an embedded
     Noto subset where it cannot (Hindi) */
  api.progress(0, 0, 'Writing the searchable PDF');
  const tf = core.textRun();
  const needsUni = [];
  for (const p of pages.values()) for (const l of p.lines) for (const w of l.words || []) {
    const t = String(w.text || '').trim();
    if (t && core.TextFonts.needs(t)) needsUni.push(t);
  }
  if (needsUni.length) {
    await api.loadScript('pdf-shaper.js');
    for (const t of new Set(needsUni)) {
      check();
      try { await tf.prepare(t, false); } catch (e) { /* drawn in Helvetica instead; the text reads as "?" */ }
    }
  }
  const doc = await core.PDFDocument.load(entry.bytes, { password: entry.password || '' });
  const count = await doc.pageCount();
  const items = [];
  const overlays = [];
  for (let i = 0; i < count; i++) {
    const p = pages.get(i);
    if (!p || !p.words) { items.push({ doc, pageIndex: i }); continue; }
    const layer = layerFor(p.lines, p.frame, core, tf);
    const overlay = { content: layer.ops, fontKey: 'MVRocr', fontName: 'Helvetica', upright: true };
    overlays.push(overlay);
    items.push({ doc, pageIndex: i, overlay });
  }
  const fonts = tf.overlayFonts();
  if (Object.keys(fonts).length) for (const ov of overlays) ov.fonts = fonts;
  check();
  const bytes = await core.assemble(items, {
    finish: async (writer) => {
      tf.finish(writer);
      /* the text layers are long runs of operators: deflate them */
      for (let k = 1; k < writer.objects.length; k++) {
        const v = writer.objects[k];
        if (!(v instanceof core.PDFStream) || !v.raw || typeof v.raw.subarray !== 'function' || v.dict.Filter !== undefined) continue;
        const head = String.fromCharCode.apply(null, v.raw.subarray(0, 160));
        if (head.indexOf(MARK) < 0) continue;
        try { v.raw = await core.deflate(v.raw); v.dict.Filter = new core.Name('FlateDecode'); } catch (e) { /* left uncompressed */ }
      }
    }
  });
  check();

  const stem = String(entry.name || 'document').replace(/\.pdf$/i, '');
  const read = [...pages.keys()].sort((a, b) => a - b);
  const textOut = read.map((i) => (read.length > 1 || total > 1 ? '--- Page ' + (i + 1) + ' ---\n' : '') + (pages.get(i).text || '(no text found)')).join('\n\n') + '\n';

  const save = api.btn('Save the text (.txt)', 'btn-ghost');
  save.addEventListener('click', () => api.download(new TextEncoder().encode(textOut), stem + '-ocr.txt', 'text/plain'));
  api.actions.appendChild(save);

  const secs = (performance.now() - t0) / 1000;
  const rangeList = (list) => list.map((i) => i + 1).join(', ');
  const stats = [
    ['Pages recognised', read.length + ' of ' + total],
    ['Pages skipped (already text)', skipped.length ? skipped.length + ' (page' + (skipped.length > 1 ? 's ' : ' ') + rangeList(skipped) + ')' : '0'],
    ['Words', wordsAll.toLocaleString('en-GB')],
    ['Mean confidence', Math.round(confAll) + '%'],
    ['Language', LANG_LABEL[langKey]],
    ['Resolution', dpi + ' DPI'],
    ['Time', secs < 60 ? secs.toFixed(1) + ' s' : Math.floor(secs / 60) + ' min ' + Math.round(secs % 60) + ' s']
  ];
  const empty = read.filter((i) => !pages.get(i).words);
  const warns = [];
  if (empty.length) warns.push('No text was found on page' + (empty.length > 1 ? 's ' : ' ') + rangeList(empty) + '; ' + (empty.length > 1 ? 'they are' : 'it is') + ' copied unchanged.');
  if (clamped) warns.push(clamped + ' page' + (clamped > 1 ? 's were' : ' was') + ' too large to draw at ' + dpi + ' DPI and ' + (clamped > 1 ? 'were' : 'was') + ' read at about 16 megapixels instead.');
  return {
    files: [{ name: stem + '-ocr.pdf', bytes, type: 'application/pdf' }],
    stats,
    report: textOut,
    fullText: textOut,
    warn: warns.join(' ') || undefined
  };
}
};
})();
