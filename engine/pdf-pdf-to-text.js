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

var SHOW = 20000;

window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["pdf-to-text"] = {
"title": "PDF to Text",
"kind": "transform",
"action": "Get the text",
"multiple": false,
"description": "Get the text out of a PDF as a plain .txt file, in reading order with columns and headings kept apart, or in the order it is stored. Nothing you add is uploaded.",
"keywords": ["pdf to text","extract text from pdf","pdf to txt","copy text from pdf","pdf text extractor"],
"glyph": "i-pdf-to-text",
"glyphSvg": "<symbol id=\"i-pdf-to-text\" viewBox=\"0 0 24 24\">\n  <path d=\"M6 2.8h7.6L18.6 8v13.2H6z\"/>\n  <path d=\"M13.6 2.8V8h5\" class=\"thin\"/>\n  <path d=\"M8.6 11.4h6.8M8.6 14.2h6.8M8.6 17h4.4\" class=\"thin\"/>\n</symbol>",
"needsRenderer": true,
"noPreview": true,
"copyReport": true,
"progressLabel": "Reading the PDF",
"controls": [
  {"key":"pages","label":"Pages","type":"text","default":"all","hint":"all, or e.g. 1-3, 5"},
  {"key":"order","label":"Order","type":"select","default":"reading","options":[{"value":"reading","label":"Reading order (columns rebuilt)"},{"value":"stream","label":"As stored in the file"}]},
  {"key":"furniture","label":"Running headers, footers and page numbers","type":"select","default":"keep","options":[{"value":"keep","label":"Keep them"},{"value":"drop","label":"Leave them out"}]},
  {"key":"separator","label":"Between pages","type":"select","default":"marker","options":[{"value":"marker","label":"A line: --- Page 2 ---"},{"value":"formfeed","label":"A form feed (page break character)"},{"value":"none","label":"Nothing, just a blank line"}]}
],
"mainRun": async (api) => {
      var o = api.opts || {};
      var r = await readText(api);
      if (r.error) return { error: r.error };
      var stats = commonStats(r, o);
      if (r.empty.length === r.numbers.length) return { warn: noTextMessage(r, 'text'), stats: stats };
      var sep = o.separator === 'formfeed' ? 'formfeed' : o.separator === 'none' ? 'none' : 'marker';
      var text = r.TL.toText(r.result, { pageBreaks: sep !== 'none', pageBreak: sep === 'formfeed' ? 'formfeed' : 'marker' });
      /* UTF-8 with no byte-order mark: every current editor reads it, and a
         BOM would reach scripts, diff and pasted text as a stray character */
      var bytes = new TextEncoder().encode(text);
      var chars = Array.from(text).length;
      stats.push(['Characters', fmtN(chars)]);
      stats.push(['Output size', fmtBytes(bytes.length)]);
      var shown = text;
      if (chars > SHOW) {
        shown = Array.from(text).slice(0, SHOW).join('') + '\n\n[The first ' + fmtN(SHOW) + ' of ' + fmtN(chars) +
          ' characters are shown here. The download and Copy the text hold all of it.]';
      }
      var base = String(r.entry.name || 'document').replace(/\.pdf$/i, '') || 'document';
      return {
        files: [{ name: base + '.txt', bytes: bytes, type: 'text/plain; charset=utf-8' }],
        stats: stats,
        report: shown,
        fullText: text,
        warn: r.empty.length ? noTextMessage(r, 'text') : undefined
      };
    },
"tips": [
  "Reading order rebuilds columns: a two-column article comes out as the whole left column, then the right, with a title that spans both first. “As stored in the file” gives the text in the order the PDF draws it, which some programs scramble.",
  "Headings, paragraphs and list items are separated by a blank line, and each paragraph is one line of text. A word broken with a hyphen at a line end is joined again when the next line starts in lower case, so “exam-” and “ple” become “example”; a real “well-known” broken there loses its hyphen too.",
  "Running headers and footers are blocks in the top or bottom tenth of the page that repeat on at least half the pages, and page numbers such as “7”, “Page 7” or “7 of 12”. Choose “Leave them out” to drop them.",
  "Between pages you can have a “--- Page 2 ---” line, a form feed (the character printers and some text tools treat as a new page) or just a blank line. With a page selection, the line gives the page’s real number.",
  "The file is UTF-8 with no byte-order mark and plain line feeds, so current editors open it as it is and scripts see no stray character at the start.",
  "A scanned PDF holds pictures of pages, not text. Run it through OCR PDF first, then bring the result here.",
  "Limits: tables come out row by row as plain lines, without their grid; pictures, charts, fonts, colours and positions are not kept; right-to-left scripts such as Arabic and Hebrew have not been tested."
],
"faq": [
  {"q":"Why did a block of code come out as two columns?","a":"When a clear vertical gap runs the full height of the text, the two sides are read as columns. Code with its comments lined up on the right can look like that, so the code is read first and the comments after. Choose “As stored in the file” for pages like that."},
  {"q":"Where do footnotes and sidebars go?","a":"Where their position puts them. A sidebar beside the main text is read as a column of its own; footnotes at the foot of a page come after that page’s text, before the page number."},
  {"q":"Is a paragraph split across two pages joined again?","a":"No, it stays two paragraphs, one ending its page and one starting the next. A paragraph that runs from one column into the next on the same page is joined into one."},
  {"q":"Is the text typed into a form included?","a":"No. Answers in form fields and comments are not part of the page’s own text, so they are left out. Flatten PDF draws them into the page first; the flattened copy’s answers are then read like any other text."},
  {"q":"Why are some pages listed as having no text?","a":"Nothing is written on them as text: they are blank, or a picture of a page, as in a scan. The other pages are still converted, and OCR PDF can add text to the scanned ones."}
]
};
})();
