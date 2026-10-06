(function(){
/* ---------- shared helpers ---------- */

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

/* ---------- reading a PDF's text with pdf.js (the same in PDF to Word) ---------- */

/* Above this many pages the real font names are not read: getOperatorList
   costs about as much as drawing the page, so a long file would take minutes. */
var FONT_PAGES = 300;
var OCR_URL = '/pdf/ocr-pdf/';

function abortError() {
  var e = new Error('Cancelled');
  e.name = 'AbortError';
  return e;
}
var fmtN = function (n) { return Number(n).toLocaleString('en-GB'); };
var plural = function (n, one, many) { return fmtN(n) + ' ' + (n === 1 ? one : (many || one + 's')); };

/** Page numbers as a reader writes them: "4", "1–3, 7"; a long list is counted. */
function pagesText(list) {
  if (list.length > 8) return plural(list.length, 'page');
  var s = list.slice().sort(function (a, b) { return a - b; }), out = [];
  for (var i = 0; i < s.length;) {
    var j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(j > i ? s[i] + '–' + s[j] : String(s[i]));
    i = j + 1;
  }
  return (s.length === 1 ? 'page ' : 'pages ') + out.join(', ');
}

/** "2 columns: page 1; 1 column: pages 2–3" from the per-page counts. */
function columnSummary(cols, numbers) {
  var groups = {}, keys = [];
  cols.forEach(function (c, i) {
    if (!groups[c]) { groups[c] = []; keys.push(c); }
    groups[c].push(numbers[i]);
  });
  keys.sort(function (a, b) { return b - a; });
  var name = function (k) { return k === 0 ? 'no text' : plural(k, 'column'); };
  if (keys.length === 1) return keys[0] === 0 ? 'No text on any page' : name(keys[0]) + (cols.length > 1 ? ' on every page' : '');
  return keys.map(function (k) { return name(k) + ': ' + pagesText(groups[k]); }).join('; ');
}

/**
 * Open the file, read the chosen pages' text with pdf.js and lay it out with
 * MVRTextLayout. Returns { error } or { TL, pdf, result, numbers, empty,
 * fonts, furniture, total, entry }.
 */
async function readText(api) {
  var entry = api.entries[0];
  if (!entry) return { error: 'Choose a PDF first.' };
  var o = api.opts || {};
  var TL;
  try { await api.loadScript('pdf-textlayout.js'); TL = window.MVRTextLayout; } catch (e) { TL = null; }
  if (!TL) return { error: 'The text reader could not be loaded. Check the connection, reload the page and try again.' };
  var pdf;
  try {
    api.progress(0, 0, 'Opening ' + entry.name);
    pdf = await api.openPdf(entry);
  } catch (e) {
    return { error: entry.name + ' could not be opened for reading: ' + ((e && e.message) || 'unknown error') + '.' };
  }
  var total = pdf.numPages;
  var idx;
  try {
    var seen = {};
    idx = api.core.parsePageRange(o.pages || 'all', total).filter(function (i) { return seen[i] ? false : (seen[i] = true); });
  } catch (e) { return { error: e.message }; }

  var fonts = idx.length <= FONT_PAGES;
  var input = { pages: [] }, numbers = [], empty = [];
  for (var n = 0; n < idx.length; n++) {
    if (api.cancelled() || (api.signal && api.signal.aborted)) throw abortError();
    var num = idx[n] + 1;
    api.progress(n / idx.length, 1, idx.length === total ? 'Reading page ' + num + ' of ' + total
      : 'Reading page ' + num + ' (' + (n + 1) + ' of ' + idx.length + ')');
    var page = await pdf.getPage(num);
    var vp = page.getViewport({ scale: 1 });
    var tc = await page.getTextContent();
    var pg = { width: vp.width, height: vp.height, transform: vp.transform, items: tc.items, styles: tc.styles };
    var hasText = tc.items.some(function (it) { return typeof it.str === 'string' && it.str.trim(); });
    if (!hasText) empty.push(num);
    else if (fonts) {
      /* the fonts' real names (Helvetica-Bold, ABCDEF+Calibri-Bold) are
         known only once the page's drawing instructions have been read */
      try {
        await page.getOperatorList();
        pg.fonts = {};
        Object.keys(tc.styles || {}).forEach(function (k) {
          if (page.commonObjs.has(k)) { var f = page.commonObjs.get(k); if (f && f.name) pg.fonts[k] = f.name; }
        });
      } catch (e) { /* a page whose fonts cannot be read is still laid out by size */ }
    }
    input.pages.push(pg);
    numbers.push(num);
    try { page.cleanup(); } catch (e) { /* */ }
  }
  if (api.cancelled() || (api.signal && api.signal.aborted)) throw abortError();
  api.progress(1, 1, 'Putting ' + plural(idx.length, 'page') + ' in reading order');
  await new Promise(function (r) { setTimeout(r, 0); });   /* let the label paint */

  var result = TL.layout(input, { order: o.order === 'stream' ? 'stream' : 'reading', furniture: 'keep' });
  /* the page numbers of the file, not of the selection */
  result.pages.forEach(function (p, i) { p.number = numbers[i]; });
  var furniture = 0;
  result.pages.forEach(function (p) { p.blocks.forEach(function (b) { if (b.furniture) furniture++; }); });
  if (o.furniture === 'drop') result.pages.forEach(function (p) { p.blocks = p.blocks.filter(function (b) { return !b.furniture; }); });
  /* the counts of what is kept */
  var st = { words: 0, lines: 0, headings: 0, levels: [0, 0, 0], lists: 0, paragraphs: 0 };
  result.pages.forEach(function (p) {
    p.blocks.forEach(function (b) {
      var w = String(b.text).match(/\S+/g);
      st.words += w ? w.length : 0;
      st.lines += b.lines.length;
      if (b.type === 'heading') { st.headings++; st.levels[Math.min(3, Math.max(1, b.level || 1)) - 1]++; }
      else if (b.type === 'list-item') st.lists++;
      else st.paragraphs++;
    });
  });
  return { TL: TL, pdf: pdf, entry: entry, result: result, numbers: numbers, empty: empty, fonts: fonts, furniture: furniture, total: total, counts: st, drop: o.furniture === 'drop' };
}

/** The message for pages that gave no text: a scan, or blank. */
function noTextMessage(r, what) {
  if (r.empty.length === r.numbers.length) {
    return (r.numbers.length === 1 ? 'That page has' : r.numbers.length === r.total ? 'This PDF has' : 'Those pages have') +
      ' no text to take out: no words are stored on ' + (r.numbers.length === 1 ? 'it' : 'them') +
      ', only pictures of pages, as in a scan (or the pages are blank). Run the file through OCR PDF (' + OCR_URL +
      ') first: it recognises the words and adds them as text, and the result can then be turned into ' + what + ' here.';
  }
  return 'No text on ' + pagesText(r.empty) + ': ' + (r.empty.length === 1 ? 'it is' : 'they are') +
    ' blank, or a picture of a page, as in a scan. OCR PDF (' + OCR_URL + ') can add text to scanned pages first.';
}

/** The rows both tools share. */
function commonStats(r, o) {
  var rows = [];
  rows.push(['Pages read', r.numbers.length === r.total ? fmtN(r.total) : fmtN(r.numbers.length) + ' of ' + fmtN(r.total) + ' (' + pagesText(r.numbers) + ')']);
  rows.push(['Words', fmtN(r.counts.words)]);
  rows.push(['Lines', fmtN(r.counts.lines)]);
  rows.push(['Headings', fmtN(r.counts.headings)]);
  rows.push(['Columns found', columnSummary(r.result.stats.columns, r.numbers)]);
  rows.push(['Order', o.order === 'stream' ? 'As stored in the file' : 'Reading order (columns rebuilt)']);
  rows.push(['Running headers and footers', !r.furniture ? 'None found' : (r.drop ? 'Left out: ' : 'Kept: ') + plural(r.furniture, 'block')]);
  if (!r.fonts) rows.push(['Bold fonts', 'Not read: over ' + FONT_PAGES + ' pages, so only larger text marks a heading']);
  if (r.empty.length && r.empty.length < r.numbers.length) rows.push(['Pages with no text', pagesText(r.empty).replace(/^pages? /, '')]);
  return rows;
}

window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["pdf-to-word"] = {
"title": "PDF to Word",
"kind": "transform",
"action": "Make the Word file",
"multiple": false,
"description": "Turn a PDF’s text into an editable Word document (.docx) with its headings, paragraphs and lists, in your browser. The layout and pictures are not kept, and the page says so.",
"keywords": ["pdf to word","pdf to docx","convert pdf to word","pdf to editable word","pdf to doc"],
"glyph": "i-pdf-to-word",
"glyphSvg": "<symbol id=\"i-pdf-to-word\" viewBox=\"0 0 24 24\">\n  <path d=\"M6 2.8h7.6L18.6 8v13.2H6z\"/>\n  <path d=\"M13.6 2.8V8h5\" class=\"thin\"/>\n  <path d=\"M8.4 11.6l1.2 5.2 1.6-4 1.6 4 1.2-5.2\" class=\"thin\"/>\n</symbol>",
"needsRenderer": true,
"noPreview": true,
"progressLabel": "Reading the PDF",
"controls": [
  {"key":"pages","label":"Pages","type":"text","default":"all","hint":"all, or e.g. 1-3, 5"},
  {"key":"order","label":"Order","type":"select","default":"reading","options":[{"value":"reading","label":"Reading order (columns rebuilt)"},{"value":"stream","label":"As stored in the file"}]},
  {"key":"furniture","label":"Running headers, footers and page numbers","type":"select","default":"keep","options":[{"value":"keep","label":"Keep them"},{"value":"drop","label":"Leave them out"}]}
],
"mainRun": async (api) => {
      var o = api.opts || {};
      var r = await readText(api);
      if (r.error) return { error: r.error };
      var stats = commonStats(r, o);
      if (r.empty.length === r.numbers.length) return { warn: noTextMessage(r, 'a Word file'), stats: stats };
      var title = '';
      try {
        var meta = await r.pdf.getMetadata();
        title = meta && meta.info && typeof meta.info.Title === 'string' ? meta.info.Title.replace(/\s+/g, ' ').trim() : '';
      } catch (e) { title = ''; }
      /* what some programs write when nobody gave a title */
      if (/^untitled( document)?$/i.test(title)) title = '';
      var bytes = r.TL.toDocx(r.result, { title: title, date: new Date() });
      var c = r.counts;
      /* the headings row says which Word styles they took */
      var lv = c.levels.map(function (n, i) { return n ? fmtN(n) + ' Heading ' + (i + 1) : ''; }).filter(Boolean).join(', ');
      stats.splice(3, 1, ['Headings', c.headings ? fmtN(c.headings) + ' (' + lv + ')' : '0']);
      stats.splice(4, 0, ['Paragraphs', fmtN(c.paragraphs)], ['List items', fmtN(c.lists)]);
      stats.push(['Page breaks', fmtN(Math.max(0, r.numbers.length - 1))]);
      stats.push(['Document title', title ? title : 'None in the PDF']);
      stats.push(['Output size', fmtBytes(bytes.length)]);
      var base = String(r.entry.name || 'document').replace(/\.pdf$/i, '') || 'document';
      return {
        files: [{ name: base + '.docx', bytes: bytes, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }],
        stats: stats,
        warn: r.empty.length ? noTextMessage(r, 'a Word file') : undefined,
        note: r.empty.length ? undefined : 'The Word file holds the text, headings and lists. Pictures, the grid of a table, fonts, colours and positions are not carried over.'
      };
    },
"tips": [
  "Headings take Word’s Heading 1, 2 and 3 styles, so they show in the Navigation pane and a table of contents can be built from them. Larger text makes a heading; a short line set wholly in a bold font at the body size makes the next level down.",
  "Bulleted lines become bulleted items in the List Paragraph style. Numbered lines keep their numbers (“1.”, “a)”) as typed text, in the same style.",
  "Each PDF page starts a new page in Word. The paper size comes from the PDF’s first page, with 2.54 cm margins, and the text is set in Calibri 11 pt.",
  "When the PDF has a title in its document properties, the Word file gets the same title.",
  "This is the text, not the look: pictures, charts, fonts, colours and exact positions are not kept, and a table comes out as plain lines, one row after another.",
  "A scanned PDF holds pictures of pages, not text. Run it through OCR PDF first, then bring the result here.",
  "Right-to-left scripts such as Arabic and Hebrew have not been tested."
],
"faq": [
  {"q":"Will the Word file look like the PDF?","a":"No. It holds the words in reading order, with headings, paragraphs and lists marked as Word understands them, ready to edit. Columns become one flowing column, and the pictures, fonts and positions of the original are left behind."},
  {"q":"Can I leave out the page numbers and running headers?","a":"Yes: choose “Leave them out”. A block in the top or bottom tenth of the page that repeats on at least half the pages, or a page number such as “Page 7”, is then dropped."},
  {"q":"Why is one paragraph split in two?","a":"It ran across a page break in the PDF. Each PDF page starts a new Word page, so the two halves stay apart; join them in Word. A paragraph that only moves on to the next column is joined for you."},
  {"q":"Can I convert only some of the pages?","a":"Yes. Type them in Pages, such as 2-4 or 1, 6; the Word file then holds just those pages, in that order, each starting a new page."}
]
};
})();
