/**
 * engine/pdf-textlayout.js, proved against PDFs whose text we wrote.
 *
 *   node build/tests/pdf-textlayout.js [--root <site>] [--out <dir>] [--word]
 *
 * The fixtures are made here, each run, with reportlab (a Python generator
 * written to --out as make-fixtures.py and run as a child process; nothing
 * binary is committed):
 *
 *   1  article.pdf   page 1: a large title over two columns, section headings,
 *                    a bold body-size subheading, a bulleted list (bullets
 *                    drawn as their own items), a hyphenated line end that
 *                    must be mended ("exam-" / "ple") and one that must keep
 *                    its hyphen ("Anglo-" / "Saxon"), a paragraph that runs
 *                    from column 1 into column 2 mid-sentence, a page number;
 *                    page 2: one column, a numbered list, a numbered heading
 *                    that wraps under its text, a page number and a line of
 *                    text turned 90 degrees in the margin
 *   2  three.pdf     a title over three columns, two column breaks
 *                    mid-sentence, a heading inside the middle column, a
 *                    centred footer that sits inside the middle column; drawn
 *                    word by word, justified
 *   3  letter.pdf    a right-aligned sender's address, a date, the
 *                    recipient's address, a bold "Re:" line, the body
 *   4  scrambled.pdf two justified columns drawn word by word in a shuffled
 *                    order, so content-stream order and reading order differ
 *   5  turned.pdf    a page carrying /Rotate 90
 *
 * Synthetic inputs (no PDF) cover kerning against word gaps, hyphen rules,
 * superscripts, running headers and page numbers, heading-level ranking,
 * XML-hostile text, toText's options, CRC-32, loading as a classic script
 * (no module object, as in a worker) and 19,200 items on one page.
 *
 * Each is read with the site's own pdf.js (engine/vendor/pdfjs) in Node and
 * fed to the module. Every check compares with the text put into the
 * generator (the ground truth), never with the module's earlier output:
 * the whole text in order, sentence by sentence, the word multiset, block
 * types and heading levels, column counts. The .docx is opened with
 * python-docx (styles and paragraph texts), unzipped with Python's zipfile
 * and every XML part parsed with xml.etree; [Content_Types].xml must cover
 * every part. LibreOffice, when installed, converts it to text as well.
 * --word (Windows with Microsoft Word) also opens each .docx in Word over
 * COM, invisibly and read-only, and checks the styles, texts, bullets and
 * page count Word reports.
 *
 * Needs: python with reportlab and python-docx (pip install --user
 * python-docx). Exit code 2 when an assertion fails, 1 when the run breaks.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-pdf-textlayout')));
const PY = process.env.PYTHON || 'python';
const WORD = process.argv.includes('--word');
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const failures = [];
function check(ok, what, detail) {
  if (ok) { pass++; console.log('  ok    ' + what); }
  else { fail++; failures.push(what + (detail ? '  (' + detail + ')' : '')); console.log('  FAIL  ' + what + (detail ? '  -> ' + detail : '')); }
}
const group = (t) => console.log('\n' + t);

const TL = require(path.join(ROOT, 'engine/pdf-textlayout.js'));

/* ---------- prose: distinct sentences, so order can be checked one by one ---------- */

const SUBJ = ['The committee', 'A careful reader', 'Our survey team', 'The night editor', 'Each volunteer', 'The archive',
  'A local printer', 'The second draft', 'Every margin note', 'The final proof', 'A patient clerk', 'The new layout', 'The harbour office'];
const VERB = ['checked', 'moved', 'described', 'collected', 'rewrote', 'measured', 'printed', 'filed', 'compared', 'repaired', 'praised'];
const OBJ = ['the weekly ledger', 'three faded maps', 'every loose page', 'the parish records', 'a box of letters', 'the old timetable',
  'two hundred tickets', 'the river survey', 'a set of drawings', 'the shipping notes', 'four bound volumes'];
const TAIL = ['before the autumn fair', 'without any fuss', 'in the small back room', 'during the long winter', 'for the town council',
  'after the morning meeting', 'with great care', 'on a rainy Tuesday', 'beside the open window', 'in under an hour'];
let seed = 7;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
const sentence = () => SUBJ[rnd(SUBJ.length)] + ' ' + VERB[rnd(VERB.length)] + ' ' + OBJ[rnd(OBJ.length)] + ' ' + TAIL[rnd(TAIL.length)] + '.';
const prose = (n) => Array.from({ length: n }, sentence).join(' ');

/* ---------- the documents (ground truth) ---------- */

// flow element kinds: h (heading), p (paragraph), li (list item: marker drawn apart),
// lines (lines kept apart, optionally right-aligned). In p text, "exam-|ple" is a
// forced line break after the hyphen; " || " is a forced move to the next frame.
const B = 'Helvetica', BB = 'Helvetica-Bold';
const docs = [];

docs.push({
  file: 'article.pdf', size: [595, 842],
  pages: [
    {
      frames: [[50, 735, 237, 300], [308, 735, 237, 300]],
      before: [{ text: 'Reading Order in Practice', font: BB, size: 22, x: 50, y: 775, type: 'heading', level: 1 }],
      flow: [
        { k: 'h', text: 'Why columns matter', font: BB, size: 14, level: 2 },
        { k: 'p', text: prose(3) },
        { k: 'p', text: prose(2) },
        { k: 'h', text: 'A closer look', font: BB, size: 10, level: 3 },
        { k: 'p', text: prose(1) + ' This exam-|ple shows a broken word joined again. ' + prose(1) },
        { k: 'li', marker: '\u2022', text: 'keep the gutter clear of stray marks' },
        { k: 'li', marker: '\u2022', text: 'set the footer apart from the last line of text, with enough space for it to read as a footer' },
        { k: 'li', marker: '\u2022', text: 'use one font size for the body' },
        { k: 'h', text: 'Joining the pieces', font: BB, size: 14, level: 2 },
        { k: 'p', text: 'The Anglo-|Saxon charters were copied twice. ' + prose(2) },
        { k: 'p', text: prose(1) + ' At this point the reader moves || on to the next column and keeps reading the same sentence. ' + prose(3) },
        { k: 'p', text: prose(4) }
      ],
      after: [{ text: '1', font: B, size: 9, x: 297.5, y: 40, align: 'centre', type: 'paragraph' }]
    },
    {
      frames: [[50, 790, 495, 80]],
      flow: [
        { k: 'h', text: 'Second page', font: BB, size: 14, level: 2 },
        { k: 'p', text: prose(5) },
        { k: 'li', marker: '1.', text: 'Open the file in the reader.', numbered: true },
        { k: 'li', marker: '2.', text: 'Choose the pages that matter.', numbered: true },
        { k: 'li', marker: '3.', text: 'Save the text as a new document.', numbered: true },
        { k: 'h', number: '2.1', text: 'A numbered heading long enough to wrap onto a second line, hanging under its text', font: BB, size: 14, level: 2 },
        { k: 'p', text: prose(4) }
      ],
      after: [
        { text: '2', font: B, size: 9, x: 297.5, y: 40, align: 'centre', type: 'paragraph' },
        { text: 'Draft for review only', font: B, size: 8, x: 25, y: 300, angle: 90, type: 'paragraph', rotated: true }
      ]
    }
  ]
});

docs.push({
  file: 'three.pdf', size: [595, 842], words: true, justify: true,
  pages: [{
    frames: [[50, 740, 155, 330], [220, 740, 155, 330], [390, 740, 155, 330]],
    before: [{ text: 'Notes From Three Columns', font: BB, size: 20, x: 297.5, y: 780, align: 'centre', type: 'heading', level: 1 }],
    flow: [
      { k: 'p', text: prose(4) },
      { k: 'p', text: prose(3) + ' The first column ends here and the text || carries on in the second column without a pause. ' + prose(2) },
      { k: 'h', text: 'Middle matters', font: BB, size: 13, level: 2 },
      { k: 'p', text: prose(4) + ' The second column ends and the sentence || goes on in the third column as before. ' + prose(2) },
      { k: 'p', text: prose(4) }
    ],
    after: [{ text: 'Page 1', font: B, size: 9, x: 297.5, y: 40, align: 'centre', type: 'paragraph' }]
  }]
});

docs.push({
  file: 'letter.pdf', size: [595, 842],
  pages: [{
    frames: [[60, 790, 475, 60]],
    flow: [
      { k: 'lines', font: 'Times-Roman', size: 11, lead: 14, align: 'right', after: 18,
        lines: ['14 Mill Lane', 'Kendal', 'Cumbria LA9 4QT'] },
      { k: 'lines', font: 'Times-Roman', size: 11, lead: 14, align: 'right', after: 18, lines: ['6 October 2026'] },
      { k: 'lines', font: 'Times-Roman', size: 11, lead: 14, after: 18,
        lines: ['Ms Priya Patel', 'Harbour Supplies Ltd', '2 Quay Street', 'Whitby YO21 3PU'] },
      { k: 'h', text: 'Re: Invoice 4471', font: 'Times-Bold', size: 11, lead: 14, level: 1, after: 10 },
      { k: 'p', text: 'Dear Ms Patel,', font: 'Times-Roman', size: 11, lead: 14, after: 10 },
      { k: 'p', text: 'Thank you for your letter of 28 September. ' + prose(4), font: 'Times-Roman', size: 11, lead: 14, after: 10 },
      { k: 'p', text: prose(3) + ' I would be grateful for a reply by the end of the month.', font: 'Times-Roman', size: 11, lead: 14, after: 10 },
      { k: 'p', text: 'Yours sincerely,', font: 'Times-Roman', size: 11, lead: 14, after: 36 },
      { k: 'p', text: 'Arun Mehta', font: 'Times-Roman', size: 11, lead: 14 }
    ]
  }]
});

docs.push({
  file: 'scrambled.pdf', size: [595, 842], shuffle: 4242, words: true, justify: true,
  pages: [{
    frames: [[50, 735, 237, 420], [308, 735, 237, 420]],
    before: [{ text: 'Shuffled Stream', font: BB, size: 20, x: 50, y: 775, type: 'heading', level: 1 }],
    flow: [
      { k: 'p', text: prose(5) },
      { k: 'h', text: 'Out of order', font: BB, size: 14, level: 2 },
      { k: 'p', text: prose(4) + ' The left column stops in the middle of a thought and the || right column finishes it calmly. ' + prose(3) },
      { k: 'p', text: prose(5) }
    ],
    after: [{ text: '7', font: B, size: 9, x: 297.5, y: 40, align: 'centre', type: 'paragraph' }]
  }]
});

// a page carrying /Rotate 90: pdf.js's viewport turns it, so the text runs down the device page
// (reportlab swaps the MediaBox to 842 x 595 for a turned page, so the text keeps below y = 560)
docs.push({
  file: 'turned.pdf', size: [595, 842], rotate: 90,
  pages: [{
    frames: [[50, 560, 495, 60]],
    flow: [
      { k: 'h', text: 'A page turned on its side', font: BB, size: 16, level: 1 },
      { k: 'p', text: prose(4) },
      { k: 'li', marker: '\u2022', text: 'the viewport transform does the turning' },
      { k: 'li', marker: '\u2022', text: 'the text keeps its order' },
      { k: 'p', text: prose(3) }
    ]
  }]
});

// Expected blocks of a page, in reading order.
function truthText(t) {
  return t.replace(/\s*\|\|\s*/g, ' ').replace(/-\|(?=\p{Ll})/gu, '').replace(/\|/g, '');
}
function expected(page) {
  const out = [];
  for (const a of page.before || []) out.push({ type: a.type, level: a.level, text: a.text });
  for (const el of page.flow) {
    if (el.k === 'h') out.push({ type: 'heading', level: el.level, text: (el.number ? el.number + ' ' : '') + el.text });
    else if (el.k === 'p') out.push({ type: 'paragraph', text: truthText(el.text) });
    else if (el.k === 'li') out.push({ type: 'list-item', text: el.marker + ' ' + el.text, bullet: !el.numbered, body: el.text });
    else if (el.k === 'lines') out.push({ type: 'paragraph', text: el.lines.join('\n'), lineBreaks: el.lines.length > 1 });
  }
  for (const a of page.after || []) out.push({ type: a.type, level: a.level, text: a.text, rotated: a.rotated });
  return out;
}

/* ---------- the generator ---------- */

const GEN = String.raw`
import json, sys, random
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.utils import simpleSplit

spec = json.load(open(sys.argv[1], encoding='utf-8'))
report = {}
for doc in spec['docs']:
    c = canvas.Canvas(doc['path'], pagesize=tuple(doc['size']))
    pages_out = []
    for page in doc['pages']:
        if doc.get('rotate'): c.setPageRotation(doc['rotate'])
        ops = []
        def op(font, size, x, y, text, align='left', angle=0):
            if align == 'centre': x = x - stringWidth(text, font, size) / 2
            elif align == 'right': x = x - stringWidth(text, font, size)
            ops.append((font, size, x, y, text, angle))
        def line(font, size, x, y, text, width=None, last=True):
            if not doc.get('words'):
                op(font, size, x, y, text); return
            ws = text.split(' ')
            total = sum(stringWidth(w, font, size) for w in ws)
            gap = stringWidth(' ', font, size)
            if width and not last and len(ws) > 1: gap = (width - total) / (len(ws) - 1)
            for w in ws:
                op(font, size, x, y, w)
                x += stringWidth(w, font, size) + gap
        for a in page.get('before', []):
            op(a['font'], a['size'], a['x'], a['y'], a['text'], a.get('align', 'left'), a.get('angle', 0))
        frames = page['frames']
        st = {'fi': 0, 'base': None, 'pending': 0}
        def place(size, lead, before=0):
            f = frames[st['fi']]
            if st['base'] is None: b = f[1] - size
            else: b = st['base'] - lead - max(before, st['pending'])
            if b < f[3]:
                st['fi'] += 1
                if st['fi'] >= len(frames): raise SystemExit('out of frames on ' + doc['file'])
                f = frames[st['fi']]
                b = f[1] - size
            st['base'] = b; st['pending'] = 0
            return f, b
        def next_frame():
            st['fi'] += 1
            if st['fi'] >= len(frames): raise SystemExit('out of frames (forced) on ' + doc['file'])
            st['base'] = None
        for el in page['flow']:
            font = el.get('font', 'Helvetica'); size = el.get('size', 10); lead = el.get('lead', size * 1.2)
            k = el['k']
            if k == 'h' and el.get('number'):
                ind = 30
                hl = simpleSplit(el['text'], font, size, frames[st['fi']][2] - ind)
                for i, ln in enumerate(hl):
                    f, b = place(size, lead, before=size * 0.8 if i == 0 else 0)
                    if i == 0: op(font, size, f[0], b, el['number'])
                    line(font, size, f[0] + ind, b, ln)
                st['pending'] = el.get('after', 4)
            elif k == 'h':
                f, b = place(size, lead, before=size * 0.8)
                line(font, size, f[0], b, el['text'])
                st['pending'] = el.get('after', 4)
            elif k == 'lines':
                for ln in el['lines']:
                    f, b = place(size, lead)
                    if el.get('align') == 'right': op(font, size, f[0] + f[2], b, ln, 'right')
                    else: op(font, size, f[0], b, ln)
                st['pending'] = el.get('after', 6)
            elif k == 'li':
                ind = 14
                lines = simpleSplit(el['text'], font, size, frames[st['fi']][2] - ind)
                for i, ln in enumerate(lines):
                    f, b = place(size, lead)
                    if i == 0: op(font, size, f[0], b, el['marker'])
                    line(font, size, f[0] + ind, b, ln)
                st['pending'] = el.get('after', 3)
            else:
                segs = el['text'].split(' || ')
                for si, seg in enumerate(segs):
                    if si > 0: next_frame()
                    pieces = seg.split('|')
                    for piece in pieces:
                        pl = simpleSplit(piece, font, size, frames[st['fi']][2])
                        for li, ln in enumerate(pl):
                            f, b = place(size, lead)
                            line(font, size, f[0], b, ln, f[2] if doc.get('justify') else None, li == len(pl) - 1)
                st['pending'] = el.get('after', 6)
        for a in page.get('after', []):
            op(a['font'], a['size'], a['x'], a['y'], a['text'], a.get('align', 'left'), a.get('angle', 0))
        drawn = [{'text': o[4], 'x': round(o[2], 2), 'y': round(o[3], 2), 'size': o[1], 'marker': o[4] in ('\u2022', '1.', '2.', '3.', '2.1')} for o in ops]
        if doc.get('shuffle'): random.Random(doc['shuffle']).shuffle(ops)
        for font, size, x, y, text, angle in ops:
            c.setFont(font, size)
            if angle:
                c.saveState(); c.translate(x, y); c.rotate(angle); c.drawString(0, 0, text); c.restoreState()
            else:
                c.drawString(x, y, text)
        c.showPage()
        pages_out.append(drawn)
    c.save()
    report[doc['file']] = pages_out
json.dump(report, open(sys.argv[2], 'w', encoding='utf-8'), indent=1)
`;

const DOCX_PROBE = String.raw`
import json, sys, zipfile, re
import xml.etree.ElementTree as ET
out = {}
path = sys.argv[1]
z = zipfile.ZipFile(path)
out['testzip'] = z.testzip()
names = z.namelist()
out['names'] = names
bad = []
for n in names:
    if n.endswith('.xml') or n.endswith('.rels'):
        try: ET.fromstring(z.read(n))
        except Exception as e: bad.append(n + ': ' + str(e))
out['badxml'] = bad
ct = ET.fromstring(z.read('[Content_Types].xml'))
ns = '{http://schemas.openxmlformats.org/package/2006/content-types}'
defaults = {d.get('Extension').lower(): d.get('ContentType') for d in ct.findall(ns + 'Default')}
overrides = {o.get('PartName'): o.get('ContentType') for o in ct.findall(ns + 'Override')}
uncovered = [n for n in names if n != '[Content_Types].xml' and ('/' + n) not in overrides and n.rsplit('.', 1)[-1].lower() not in defaults]
out['uncovered'] = uncovered
out['dangling'] = [p for p in overrides if p.lstrip('/') not in names]
out['overrides'] = overrides
import docx
d = docx.Document(path)
out['paras'] = [[p.style.name, p.text] for p in d.paragraphs]
out['numbered'] = [p._p.pPr is not None and p._p.pPr.numPr is not None for p in d.paragraphs]
out['pagebreaks'] = len(re.findall(r'<w:br w:type="page"/>', z.read('word/document.xml').decode('utf-8')))
out['title'] = d.core_properties.title
out['author'] = d.core_properties.author
out['nav'] = [p.text for p in d.paragraphs if p.style.name.startswith('Heading')]
print(json.dumps(out))
`;

// Word over COM: paragraphs as [style name, text, list type (2 = bullet)], and the page count.
const WORD_PROBE = String.raw`
param([string]$Path)
$ErrorActionPreference = 'Stop'
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  $d = $w.Documents.Open($Path, $false, $true, $false)
  $n = $d.Paragraphs.Count
  $paras = @()
  for ($i = 1; $i -le $n; $i++) {
    $p = $d.Paragraphs.Item($i)
    $st = $p.Format.Style
    $name = if ($st) { $st.NameLocal } else { '' }
    $paras += ,@($name, $p.Range.Text, $p.Range.ListFormat.ListType)
  }
  $d.Repaginate()
  $res = [ordered]@{ ok = $true; pages = $d.Content.Information(4); paras = $paras }
  $d.Close(0)
  $res | ConvertTo-Json -Compress -Depth 4
} catch {
  [ordered]@{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
} finally {
  $w.Quit(0)
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($w)
}
`;

/* ---------- pdf.js ---------- */

let pdfjs = null;
async function readPdf(file) {
  if (!pdfjs) {
    pdfjs = await import(pathToFileURL(path.join(ROOT, 'engine/vendor/pdfjs/pdf.min.mjs')).href);
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(ROOT, 'engine/vendor/pdfjs/pdf.worker.min.mjs')).href;
  }
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data, standardFontDataUrl: path.join(ROOT, 'engine/vendor/pdfjs/standard_fonts/').replace(/\\/g, '/') + '/' }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    await page.getOperatorList();
    const fonts = {};
    for (const k of Object.keys(tc.styles)) if (page.commonObjs.has(k)) fonts[k] = page.commonObjs.get(k).name;
    pages.push({ width: vp.width, height: vp.height, transform: vp.transform, items: tc.items, styles: tc.styles, fonts });
  }
  await doc.destroy();
  return { pages };
}

/* ---------- comparing ---------- */

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const words = (s) => norm(s).split(' ').filter(Boolean);
function multisetDiff(exp, act) {
  const m = new Map();
  for (const w of words(exp)) m.set(w, (m.get(w) || 0) + 1);
  for (const w of words(act)) m.set(w, (m.get(w) || 0) - 1);
  const missing = [], extra = [];
  for (const [w, n] of m) { if (n > 0) missing.push(w + '\u00D7' + n); if (n < 0) extra.push(w + '\u00D7' + -n); }
  return { missing, extra };
}
function sentencesInOrder(exp, act) {
  const ss = norm(exp).split(/(?<=[.!?])\s+/);
  let at = 0;
  const a = norm(act);
  for (const s of ss) {
    const i = a.indexOf(s, at);
    if (i < 0) return { ok: false, at: s };
    at = i + s.length;
  }
  return { ok: true, n: ss.length };
}
const pageText = (pg) => pg.blocks.map((b) => b.text).join(' ');
const sig = (b) => b.type + (b.type === 'heading' ? b.level : '') + ': ' + norm(b.text).slice(0, 60);
function firstDiff(exp, act) {
  for (let i = 0; i < Math.max(exp.length, act.length); i++) {
    const e = exp[i] ? sig(exp[i]) : '(none)', a = act[i] ? sig(act[i]) : '(none)';
    if (e !== a) return '#' + i + ' expected [' + e + '] got [' + a + ']';
  }
  return '';
}

function py(code, args) {
  const f = path.join(OUT, 'probe-' + Math.random().toString(36).slice(2) + '.py');
  fs.writeFileSync(f, code);
  const r = spawnSync(PY, [f].concat(args), { encoding: 'utf8', maxBuffer: 64 << 20 });
  fs.unlinkSync(f);
  return r;
}

/* ---------- run ---------- */

(async function main() {
  group('fixtures (reportlab)');
  const spec = { docs: docs.map((d) => Object.assign({}, d, { path: path.join(OUT, d.file) })) };
  fs.writeFileSync(path.join(OUT, 'spec.json'), JSON.stringify(spec));
  const gen = path.join(OUT, 'make-fixtures.py');
  fs.writeFileSync(gen, GEN);
  const g = spawnSync(PY, [gen, path.join(OUT, 'spec.json'), path.join(OUT, 'drawn.json')], { encoding: 'utf8' });
  check(g.status === 0, 'the generator wrote the five PDFs', (g.stderr || '').slice(-400));
  if (g.status !== 0) return finish();
  const drawn = JSON.parse(fs.readFileSync(path.join(OUT, 'drawn.json'), 'utf8'));
  // preconditions on the fixtures themselves
  const art = drawn['article.pdf'][0];
  const col2 = art.filter((l) => l.x === 308).sort((a, b) => b.y - a.y);
  check(col2.length && col2[0].text.startsWith('on to the next column'), 'fixture: column 2 of the article begins mid-sentence', col2[0] && col2[0].text);
  check(art.some((l) => /exam-$/.test(l.text)) && art.some((l) => /^ple shows/.test(l.text)), 'fixture: "exam-" ends a line, "ple" starts the next');
  check(art.some((l) => /Anglo-$/.test(l.text)) && art.some((l) => /^Saxon/.test(l.text)), 'fixture: "Anglo-" ends a line, "Saxon" starts the next');
  check(art.some((l) => l.text === '\u2022'), 'fixture: bullets are drawn as items of their own');
  check(drawn['three.pdf'][0].length > 200 && drawn['three.pdf'][0].concat(drawn['scrambled.pdf'][0]).filter((l) => l.size === 10).every((l) => !/ /.test(l.text)),
    'fixture: three.pdf and scrambled.pdf are drawn word by word, justified', drawn['three.pdf'][0].length + ' items');

  const results = {};
  for (const d of docs) {
    const file = path.join(OUT, d.file);
    const input = await readPdf(file);
    results[d.file] = { input, reading: TL.layout(input, { order: 'reading' }), stream: TL.layout(input, { order: 'stream' }) };
  }

  for (const d of docs) {
    const R = results[d.file];
    group(d.file + ' \u2014 reading order');
    d.pages.forEach((p, i) => {
      const exp = expected(p), pg = R.reading.pages[i];
      const et = exp.map((b) => b.text).join(' '), at = pageText(pg);
      check(norm(et) === norm(at), 'p' + (i + 1) + ': the whole text, in order', firstDiff(exp, pg.blocks));
      const so = sentencesInOrder(et, at);
      check(so.ok, 'p' + (i + 1) + ': every sentence, in order' + (so.ok ? ' (' + so.n + ')' : ''), so.at);
      const md = multisetDiff(et, at);
      check(!md.missing.length && !md.extra.length, 'p' + (i + 1) + ': no missing or doubled words',
        'missing ' + md.missing.slice(0, 8).join(' ') + ' | extra ' + md.extra.slice(0, 8).join(' '));
      check(exp.length === pg.blocks.length && exp.every((e, k) => sig(e) === sig(pg.blocks[k])),
        'p' + (i + 1) + ': blocks, types and heading levels (' + exp.length + ')', firstDiff(exp, pg.blocks));
    });
  }

  group('article.pdf \u2014 details');
  {
    const r = results['article.pdf'].reading, p1 = r.pages[0], p2 = r.pages[1];
    const h = p1.blocks.filter((b) => b.type === 'heading').map((b) => b.level + ':' + b.text);
    check(h.join('|') === '1:Reading Order in Practice|2:Why columns matter|3:A closer look|2:Joining the pieces',
      'title level 1, section headings level 2, bold body-size subheading level 3', h.join('|'));
    const li = p1.blocks.filter((b) => b.type === 'list-item');
    check(li.length === 3 && li.every((b) => b.bullet && b.marker === '\u2022'), 'three bulleted list items', li.map((b) => b.marker).join());
    const long = li[1];
    check(long && long.lines.length >= 2 && long.text === '\u2022 set the footer apart from the last line of text, with enough space for it to read as a footer',
      'a list item\'s wrapped line stays in the item', long && long.lines.length + ' lines');
    check(/This example shows/.test(pageText(p1)) && !/exam-/.test(pageText(p1)), 'exam- / ple joined as "example"');
    check(/The Anglo-Saxon charters/.test(pageText(p1)), 'Anglo- / Saxon keeps its hyphen');
    check(/reader moves on to the next column/.test(pageText(p1)) &&
      p1.blocks.filter((b) => /reader moves on to the next column/.test(b.text)).length === 1,
      'the paragraph broken by the column is one paragraph again');
    check(p1.blocks[p1.blocks.length - 1].text === '1' && p1.blocks[p1.blocks.length - 1].furniture === true, 'the page number comes last, marked as page furniture');
    check(p1.blocks.concat(p2.blocks).filter((b) => b.furniture).map((b) => b.text).join() === '1,2', 'nothing else is furniture');
    const dropped = TL.layout(results['article.pdf'].input, { furniture: 'drop' });
    check(dropped.pages[0].blocks.length === p1.blocks.length - 1 && dropped.pages[1].blocks.length === p2.blocks.length - 1 &&
      !dropped.pages.some((pg) => pg.blocks.some((b) => b.text === '1' || b.text === '2')), 'furniture: "drop" leaves out the page numbers, nothing else');
    const nh = p2.blocks.find((b) => /^2\.1 /.test(b.text));
    check(nh && nh.type === 'heading' && nh.level === 2 && nh.lines.length === 2 &&
      nh.text === '2.1 A numbered heading long enough to wrap onto a second line, hanging under its text',
      'a numbered heading that wraps, hanging under its text, stays one heading', nh && JSON.stringify(nh.lines));
    check(p1.columns === 2 && p2.columns === 1, 'columns: 2 on page 1, 1 on page 2', p1.columns + ',' + p2.columns);
    const num = p2.blocks.filter((b) => b.type === 'list-item');
    check(num.length === 3 && num.every((b) => !b.bullet) && num.map((b) => b.marker).join() === '1.,2.,3.', 'numbered list items on page 2', num.map((b) => b.marker).join());
    const last = p2.blocks[p2.blocks.length - 1];
    check(last.text === 'Draft for review only' && last.rotated === true, 'the rotated margin line is kept, at the end of its page', last.text);
    check(r.stats.pages === 2 && r.stats.columns.join() === '2,1', 'stats: pages and columns', JSON.stringify(r.stats));
    const allExp = d0().pages.map((p) => expected(p).map((b) => b.text).join(' ')).join(' ');
    check(r.stats.words === words(allExp).length, 'stats: word count matches the source', r.stats.words + ' vs ' + words(allExp).length);
    check(r.stats.headings === 6, 'stats: six headings', r.stats.headings);
    const drawnLines = drawn['article.pdf'].reduce((n, pg) => n + pg.filter((l) => !l.marker).length, 0);
    check(r.stats.lines === drawnLines, 'stats: line count matches the lines drawn', r.stats.lines + ' vs ' + drawnLines);
    // stream order: this file is drawn in reading order, so stream must agree
    const s = results['article.pdf'].stream;
    check(norm(pageText(s.pages[0])) === norm(pageText(p1)), 'stream order agrees where the file was drawn in reading order');
  }

  group('three.pdf, letter.pdf \u2014 details');
  {
    const t = results['three.pdf'].reading.pages[0];
    check(t.columns === 3, 'three columns found', t.columns);
    check(t.blocks[t.blocks.length - 1].text === 'Page 1', 'the centred footer inside the middle column comes last, not mid-text');
    const l = results['letter.pdf'].reading.pages[0];
    check(l.columns === 1, 'the letter is one column', l.columns);
    check(l.blocks[0].lineBreaks === true && l.blocks[0].text === '14 Mill Lane\nKendal\nCumbria LA9 4QT', 'the right-aligned address keeps its line breaks', JSON.stringify(l.blocks[0].text));
    check(l.blocks[2].text === 'Ms Priya Patel\nHarbour Supplies Ltd\n2 Quay Street\nWhitby YO21 3PU', 'the recipient\'s address keeps its line breaks', JSON.stringify(l.blocks[2].text));
    check(l.blocks[3].type === 'heading' && l.blocks[3].level === 1, 'the bold "Re:" line is a heading (level 1: no larger text in the letter)');
  }

  group('scrambled.pdf \u2014 stream versus reading');
  {
    const R = results['scrambled.pdf'], exp = expected(docs[3].pages[0]);
    const et = exp.map((b) => b.text).join(' ');
    const st = pageText(R.stream.pages[0]), rt = pageText(R.reading.pages[0]);
    check(norm(rt) === norm(et), 'reading order rebuilds the text');
    check(norm(st) !== norm(et), 'stream order differs from the truth (the shuffle is real)');
    check(!sentencesInOrder(et, st).ok, 'stream order breaks the sentence order');
    const md = multisetDiff(et, st);
    check(!md.missing.length && !md.extra.length, 'stream order still loses or doubles no word',
      'missing ' + md.missing.slice(0, 8).join(' ') + ' | extra ' + md.extra.slice(0, 8).join(' '));
    check(R.reading.stats.columns[0] === 2 && R.stream.stats.columns[0] === 2, 'two columns in both modes');
  }

  group('the module as a classic script');
  {
    const vm = require('vm');
    const sandbox = { self: {} };
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'engine/pdf-textlayout.js'), 'utf8'), sandbox);
    const api = sandbox.self.MVRTextLayout;
    check(api && typeof api.layout === 'function' && typeof api.toText === 'function' && typeof api.toDocx === 'function',
      'loaded with no module object, it attaches MVRTextLayout to self (as in a worker)');
    const a = api.layout(results['article.pdf'].input), b = TL.layout(results['article.pdf'].input);
    check(JSON.stringify(a) === JSON.stringify(b), 'and gives the same result as under Node');
  }

  group('size and speed');
  {
    // 120 lines of 80 one-character items each, in two columns: 19,200 items on one page
    const items = [];
    for (let c = 0; c < 2; c++) for (let l = 0; l < 60; l++) for (let k = 0; k < 80; k++) {
      items.push({ str: k % 6 === 5 ? ' ' : 'abcdefghij'[(k + l) % 10], dir: 'ltr', transform: [8, 0, 0, 8, 40 + c * 280 + k * 3.1, 800 - l * 12.5], width: 3.1, height: 8, fontName: 'f', hasEOL: false });
    }
    const t0 = Date.now();
    const r = TL.layout({ pages: [{ width: 595, height: 842, items, styles: {} }] });
    const ms = Date.now() - t0;
    check(ms < 5000, '19,200 items on one page laid out in ' + ms + ' ms (limit 5 s)');
    check(r.pages[0].columns === 2 && r.stats.lines === 120, 'and read as two columns of 60 lines', r.pages[0].columns + ' / ' + r.stats.lines);
  }

  group('synthetic input (no PDF)');
  {
    const it = (str, x, y, size, extra) => Object.assign({ str, dir: 'ltr', transform: [size, 0, 0, size, x, y], width: str.length * size * 0.5, height: size, fontName: 'f1', hasEOL: false }, extra || {});
    const pg = (items) => ({ pages: [{ width: 595, height: 842, items, styles: { f1: { fontFamily: 'sans-serif' } } }] });
    // kerning gap: no space; word gap: a space
    let r = TL.layout(pg([it('Kern', 50, 700, 10), it('ing', 50 + 20 + 0.6, 700, 10), it('works', 50 + 35 + 2.6, 700, 10)]));
    check(r.pages[0].blocks[0].text === 'Kerning works', 'a kerning gap joins, a word gap spaces', r.pages[0].blocks[0].text);
    // hyphen rules
    r = TL.layout(pg([it('a well-', 50, 700, 10), it('known case and an exam-', 50, 688, 10), it('ple of it', 50, 676, 10)]));
    check(r.pages[0].blocks[0].text === 'a wellknown case and an example of it', 'line-end hyphens before lower case are mended (a known limit: "well-known" too)', r.pages[0].blocks[0].text);
    // superscript stays on its line
    r = TL.layout(pg([it('Footnoted', 50, 700, 10), it('1', 95, 703.5, 6), it('text goes on', 50, 688, 10)]));
    check(r.pages[0].blocks.length === 1 && r.pages[0].blocks[0].text === 'Footnoted1 text goes on', 'a superscript stays on its line', JSON.stringify(r.pages[0].blocks.map((b) => b.text)));
    // empty page
    r = TL.layout({ pages: [{ width: 595, height: 842, items: [], styles: {} }] });
    check(r.pages[0].blocks.length === 0 && r.stats.columns[0] === 0 && r.stats.words === 0, 'an empty page gives no blocks');
    // XML-hostile text
    r = TL.layout(pg([it('Tom & Jerry <b> "q" \u0001bad\u0007 \uD800x \uFFFF', 50, 700, 10)]));
    const dx = TL.toDocx(r, { title: 'A <title> & more', author: 'O\'Brien & Co', date: new Date(Date.UTC(2026, 9, 6)) });
    fs.writeFileSync(path.join(OUT, 'hostile.docx'), dx);
    const hp = py(DOCX_PROBE, [path.join(OUT, 'hostile.docx')]);
    let hj = null; try { hj = JSON.parse(hp.stdout); } catch (e) { /* reported below */ }
    check(hj && !hj.badxml.length && hj.paras[0][1] === 'Tom & Jerry <b> "q" bad x' && hj.title === 'A <title> & more' && hj.author === 'O\'Brien & Co',
      'XML-hostile text: escaped, illegal characters stripped, still opens', hj ? JSON.stringify(hj.paras[0]) + ' ' + hj.badxml.join(';') : (hp.stderr || '').slice(-300));
    // toText options
    const two = { pages: [{ number: 1, blocks: [{ text: 'A' }, { text: 'B' }] }, { number: 2, blocks: [{ text: 'C' }] }] };
    check(TL.toText(two) === 'A\n\nB\n\n--- Page 2 ---\n\nC\n', 'toText: blank lines between blocks, a page marker', JSON.stringify(TL.toText(two)));
    check(TL.toText(two, { pageBreak: 'formfeed' }) === 'A\n\nB\n\fC\n', 'toText: form feed between pages', JSON.stringify(TL.toText(two, { pageBreak: 'formfeed' })));
    check(TL.toText(two, { pageBreaks: false }) === 'A\n\nB\n\nC\n', 'toText: no page breaks');
    check(TL._crc32(new Uint8Array([0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39])) === 0xCBF43926, 'CRC-32 check value');
    // a bold running header on three pages: furniture, not a heading
    const bold = { f1: { fontFamily: 'sans-serif' }, f2: { fontFamily: 'sans-serif' } };
    const hp3 = (n) => ({ width: 595, height: 842, styles: bold, fonts: { f1: 'Helvetica', f2: 'Helvetica-Bold' }, items: [
      it('Annual Report 2026', 50, 810, 10, { fontName: 'f2' }), it('Section ' + n, 50, 700, 10, { fontName: 'f2' }),
      it('Body text on page ' + n + ' runs on here.', 50, 680, 10), it('Page ' + n + ' of 3', 280, 30, 9)] });
    r = TL.layout({ pages: [hp3(1), hp3(2), hp3(3)] });
    check(r.pages.every((pg) => pg.blocks[0].type === 'paragraph' && pg.blocks[0].furniture && pg.blocks[1].type === 'heading' && pg.blocks[3].furniture),
      'a repeated bold running header is furniture, not a heading; "Page N of 3" is furniture', JSON.stringify(r.pages[0].blocks.map((b) => [b.type, b.furniture])));
    // heading levels: a one-off large label must not push the section headings down
    const lv = [it('Big Title', 50, 800, 24), it('Figure label', 50, 760, 18)];
    for (let k = 0; k < 3; k++) {
      lv.push(it('Section ' + k, 50, 700 - k * 200, 14), it('Body text that goes on for a while here.', 50, 680 - k * 200, 10));
      lv.push(it('Subsection ' + k, 50, 650 - k * 200, 12), it('More body text that goes on for a while.', 50, 630 - k * 200, 10));
    }
    r = TL.layout(pg(lv));
    const lvl = r.pages[0].blocks.filter((b) => b.type === 'heading').map((b) => b.text.split(' ')[0] + b.level);
    check(lvl.join() === 'Big1,Figure2,Section2,Subsection3,Section2,Subsection3,Section2,Subsection3', 'heading levels rank the most-used sizes', lvl.join());
  }

  group('toText on the article');
  {
    const txt = TL.toText(results['article.pdf'].reading);
    fs.writeFileSync(path.join(OUT, 'article.txt'), txt);
    check(/\n\n--- Page 2 ---\n\nSecond page\n\n/.test(txt), 'page 2 starts after its marker');
    check(txt.startsWith('Reading Order in Practice\n\nWhy columns matter\n\n'), 'title and first heading open the text');
  }

  group('toDocx (python-docx, zipfile, xml.etree)');
  for (const name of ['article.pdf', 'letter.pdf']) {
    const res = results[name].reading;
    const bytes = TL.toDocx(res, { title: name.replace('.pdf', ''), author: '1234Tools test', date: new Date(Date.UTC(2026, 9, 6, 12)) });
    check(bytes instanceof Uint8Array && bytes[0] === 0x50 && bytes[1] === 0x4B, name + ': a zip (Uint8Array, PK)');
    const f = path.join(OUT, name.replace('.pdf', '.docx'));
    fs.writeFileSync(f, bytes);
    const r = py(DOCX_PROBE, [f]);
    let j = null;
    try { j = JSON.parse(r.stdout); } catch (e) { /* below */ }
    check(!!j, name + ': python-docx opens it', (r.stderr || '').slice(-500));
    if (!j) continue;
    check(j.testzip === null, name + ': zip CRCs check out');
    check(!j.badxml.length, name + ': every XML part is well formed', j.badxml.join('; '));
    const want = ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/_rels/document.xml.rels', 'docProps/core.xml', 'docProps/app.xml'];
    check(want.every((n) => j.names.includes(n)) && j.names.length === want.length, name + ': the eight parts', j.names.join());
    check(!j.uncovered.length && !j.dangling.length, name + ': [Content_Types].xml covers every part, names no missing one', j.uncovered.concat(j.dangling).join());
    // expected paragraphs from the ground truth
    const src = docs.find((d) => d.file === name);
    const exp = [];
    src.pages.forEach((p, i) => {
      if (i > 0) exp.push(['Normal', '']);
      for (const b of expected(p)) {
        if (b.type === 'heading') exp.push(['Heading ' + b.level, b.text]);
        else if (b.type === 'list-item') exp.push(['List Paragraph', b.bullet ? b.body : b.text]);
        else exp.push(['Normal', b.text]);
      }
    });
    const got = j.paras.map((p) => [p[0], norm(p[1].replace(/\n/g, '\u21B5'))]);
    const expN = exp.map((p) => [p[0], norm(p[1].replace(/\n/g, '\u21B5'))]);
    let bad = '';
    for (let i = 0; i < Math.max(got.length, expN.length) && !bad; i++) {
      if (!got[i] || !expN[i] || got[i][0] !== expN[i][0] || got[i][1] !== expN[i][1]) bad = '#' + i + ' expected ' + JSON.stringify(expN[i]) + ' got ' + JSON.stringify(got[i]);
    }
    check(!bad, name + ': paragraph styles and texts match the source (' + expN.length + ')', bad);
    check(j.pagebreaks === src.pages.length - 1, name + ': a page break between PDF pages', j.pagebreaks);
    const bullets = j.paras.map((p, i) => p[0] === 'List Paragraph' && j.numbered[i]).filter(Boolean).length;
    if (name === 'article.pdf') {
      check(bullets === 3, 'article: the three bullets carry the bullet numbering, the numbered items do not', bullets);
      check(j.nav.join('|') === 'Reading Order in Practice|Why columns matter|A closer look|Joining the pieces|Second page|2.1 A numbered heading long enough to wrap onto a second line, hanging under its text', 'article: the navigation pane headings', j.nav.join('|'));
    }
    check(j.title === name.replace('.pdf', '') && j.author === '1234Tools test', name + ': title and author in core.xml');

    // Microsoft Word itself (Windows, --word): opened invisibly and read-only over COM
    if (WORD) {
      const ps = path.join(OUT, 'word-probe.ps1');
      fs.writeFileSync(ps, WORD_PROBE);
      const wr = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps, '-Path', f], { encoding: 'utf8', timeout: 180000 });
      let wj = null;
      try { wj = JSON.parse(wr.stdout); } catch (e) { /* below */ }
      check(wj && wj.ok, name + ': Word opens it', wj ? wj.error : (wr.stderr || wr.stdout || '').slice(-300));
      if (wj && wj.ok) {
        const wg = wj.paras.map((p) => [p[0], norm(String(p[1]).replace(/\r$/, '').replace(/\f/g, '').replace(/\u000b/g, '\u21B5'))]);
        let wbad = '';
        for (let i = 0; i < Math.max(wg.length, expN.length) && !wbad; i++) {
          if (!wg[i] || !expN[i] || wg[i][0] !== expN[i][0] || wg[i][1] !== expN[i][1]) wbad = '#' + i + ' expected ' + JSON.stringify(expN[i]) + ' got ' + JSON.stringify(wg[i]);
        }
        check(!wbad, name + ': Word sees the same styles and texts', wbad);
        check(wj.pages === src.pages.length || (name === 'article.pdf' && wj.pages >= 2), name + ': Word lays out at least one page per PDF page', wj.pages);
        if (name === 'article.pdf') check(wj.paras.filter((p) => p[2] === 2).length === 3, 'article: Word shows three bulleted paragraphs');
      }
    }
  }

  group('LibreOffice (when installed)');
  {
    const cands = [process.env.SOFFICE, 'C:/Program Files/LibreOffice/program/soffice.exe', 'C:/Program Files (x86)/LibreOffice/program/soffice.exe', '/usr/bin/soffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice'].filter(Boolean);
    const so = cands.find((c) => fs.existsSync(c));
    if (!so) console.log('  skip  LibreOffice not installed');
    else {
      const lo = path.join(OUT, 'lo');
      fs.mkdirSync(lo, { recursive: true });
      const r = spawnSync(so, ['--headless', '--convert-to', 'txt:Text', '--outdir', lo, path.join(OUT, 'article.docx')], { encoding: 'utf8', timeout: 120000 });
      const t = path.join(lo, 'article.txt');
      const txt = fs.existsSync(t) ? fs.readFileSync(t, 'utf8') : '';
      check(r.status === 0 && /The Anglo-Saxon charters/.test(txt) && /Second page/.test(txt), 'LibreOffice opens the .docx and reads its text', (r.stderr || '').slice(-300));
    }
  }

  finish();
})().catch((e) => { console.error(e); process.exit(1); });

function d0() { return docs[0]; }

function finish() {
  console.log('\n' + (pass + fail) + ' assertions   ' + pass + ' passed   ' + fail + ' failed');
  if (fail) { console.log('\nFailures:\n  ' + failures.join('\n  ')); process.exit(2); }
}
