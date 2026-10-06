/**
 * PDF to Text (/pdf/pdf-to-text/) and PDF to Word (/pdf/pdf-to-word/),
 * proved against PDFs whose text we wrote.
 *
 *   node build/tests/pdf-to-text-word.js [--root <site>] [--port 8853] [--out <dir>] [--no-browser] [--verbose]
 *
 * Fixtures are made here, each run (nothing binary is committed):
 *
 *   reportlab   newsletter.pdf  page 1: a running header, a title spanning two
 *                               columns, section headings, a bold body-size
 *                               subheading, a bulleted list, a hyphenated line
 *                               end, a paragraph running from column 1 into
 *                               column 2, £, é, – and curly quotes, a page
 *                               number; page 2: one column, a numbered list.
 *                               Info Title set.
 *               report.pdf      three pages, one column: a running header,
 *                               "Page n of 3" footers, a paragraph that runs
 *                               across the page 2 / page 3 break
 *               sidebar.pdf     a main column, a narrow sidebar, a footnote
 *                               set apart at the foot, a page number
 *               scrambled.pdf   two justified columns drawn word by word in a
 *                               shuffled order (stream order != reading order)
 *               code.pdf        Courier code lines with comments lined up on
 *                               the right
 *   PyMuPDF     secret.pdf      report.pdf with AES-256 and an open password
 *               scan.pdf        two pages that are pictures only
 *               mixed.pdf       report.pdf's page 1, then a picture page
 *               form.pdf        a filled-in text field
 *               long.pdf        200 pages (cancelling); huge.pdf 320 pages
 *
 * Node: each spec's mainRun is driven with a stand-in for the page's api
 * (pdf.js from engine/vendor/pdfjs in Node, pdfcore.bundle.js for the page
 * ranges). Chrome: the real pages on 127.0.0.1:<port>, with the password
 * box, the report box, Copy, Cancel, remembered settings and 390 px.
 *
 * Every check compares with the text put into the generator, or with
 * python-docx, zipfile and xml.etree reading the .docx, never with the
 * tool's own earlier output. Every request host is recorded; anything but
 * 127.0.0.1 fails. Exit code 2 when an assertion fails, 1 when the run breaks.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-pdf-to-text-word')));
const PORT = Number(arg('--port', 8853));
const BASE = 'http://127.0.0.1:' + PORT;
const BROWSER = !process.argv.includes('--no-browser');
const VERBOSE = process.argv.includes('--verbose');
const PY = process.env.PYTHON || 'python';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const failures = [];
function check(ok, what, detail) {
  if (ok) { pass++; console.log('  ok    ' + what + (detail && VERBOSE ? '  (' + detail + ')' : '')); }
  else { fail++; failures.push(what + (detail ? '  (' + detail + ')' : '')); console.log('  FAIL  ' + what + (detail ? '  -> ' + detail : '')); }
}
const group = (t) => console.log('\n' + t);

/* ---------- prose: distinct sentences, so order can be checked one by one ---------- */
const SUBJ = ['The committee', 'A careful reader', 'Our survey team', 'The night editor', 'Each volunteer', 'The archive',
  'A local printer', 'The second draft', 'Every margin note', 'The final proof', 'A patient clerk', 'The new layout', 'The harbour office'];
const VERB = ['checked', 'moved', 'described', 'collected', 'rewrote', 'measured', 'printed', 'filed', 'compared', 'repaired', 'praised'];
const OBJ = ['the weekly ledger', 'three faded maps', 'every loose page', 'the parish records', 'a box of letters', 'the old timetable',
  'two hundred tickets', 'the river survey', 'a set of drawings', 'the shipping notes', 'four bound volumes'];
const TAIL = ['before the autumn fair', 'without any fuss', 'in the small back room', 'during the long winter', 'for the town council',
  'after the morning meeting', 'with great care', 'on a rainy Tuesday', 'beside the open window', 'in under an hour'];
let seed = 11;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
const sentence = () => SUBJ[rnd(SUBJ.length)] + ' ' + VERB[rnd(VERB.length)] + ' ' + OBJ[rnd(OBJ.length)] + ' ' + TAIL[rnd(TAIL.length)] + '.';
const prose = (n) => Array.from({ length: n }, sentence).join(' ');

/* ---------- the documents (ground truth) ---------- */
// flow kinds: h (heading), p (paragraph), li (list item, marker drawn apart),
// next (move to the next frame). In p text "exam-|ple" is a forced line break
// after the hyphen; " || " a forced move to the next frame.
const B = 'Helvetica', BB = 'Helvetica-Bold';
const NEWS_HEAD = 'Riverside Allotments \u00B7 Spring 2026';
const docs = [];

docs.push({
  file: 'newsletter.pdf', size: [595, 842], title: 'Riverside Allotments Newsletter, Spring 2026',
  pages: [
    {
      frames: [[50, 715, 237, 120], [308, 715, 237, 120]],
      before: [
        { text: NEWS_HEAD, font: B, size: 8, x: 50, y: 806, type: 'paragraph', furniture: true },
        { text: 'Riverside Allotments Newsletter', font: BB, size: 22, x: 50, y: 752, type: 'heading', level: 1 }
      ],
      flow: [
        { k: 'h', text: 'Spring planting', font: BB, size: 14, level: 2 },
        { k: 'p', text: 'Seed potatoes arrive on 14 March and cost \u00A312 a sack this year. ' + prose(3) },
        { k: 'h', text: 'Water butts', font: BB, size: 10, level: 3 },
        { k: 'p', text: prose(1) + ' This exam-|ple shows a broken word joined again. ' + prose(1) },
        { k: 'li', marker: '\u2022', text: 'check the tap washers before the first frost' },
        { k: 'li', marker: '\u2022', text: 'clear the gutters that feed the butts, and fit a lid so that nothing can fall in' },
        { k: 'li', marker: '\u2022', text: 'share spare water with the plots next door' },
        { k: 'h', text: 'Committee news', font: BB, size: 14, level: 2 },
        { k: 'p', text: 'The \u201Copen day\u201D raised \u00A3340 for the new shed \u2013 thank you, and the caf\u00E9 sold out by noon. ' + prose(2) },
        { k: 'p', text: prose(1) + ' The meeting moved || on to the question of plot rents and agreed them without a vote. ' + prose(3) },
        { k: 'p', text: prose(3) }
      ],
      after: [{ text: '1', font: B, size: 9, x: 297.5, y: 40, align: 'centre', type: 'paragraph', furniture: true }]
    },
    {
      frames: [[50, 760, 495, 80]],
      before: [{ text: NEWS_HEAD, font: B, size: 8, x: 50, y: 806, type: 'paragraph', furniture: true }],
      flow: [
        { k: 'h', text: 'Dates for the diary', font: BB, size: 14, level: 2 },
        { k: 'p', text: prose(3) },
        { k: 'li', marker: '1.', text: 'Saturday 18 April: seed swap in the hut.', numbered: true },
        { k: 'li', marker: '2.', text: 'Sunday 10 May: plant sale at the gate.', numbered: true },
        { k: 'li', marker: '3.', text: 'Saturday 6 June: open day and judging.', numbered: true },
        { k: 'h', text: 'From the treasurer', font: BB, size: 14, level: 2 },
        { k: 'p', text: prose(3) }
      ],
      after: [{ text: '2', font: B, size: 9, x: 297.5, y: 40, align: 'centre', type: 'paragraph', furniture: true }]
    }
  ]
});

const SPLIT_A = prose(2) + ' After a long debate the trustees agreed to';
const SPLIT_B = 'spend the reserve on the slipway, which had waited for repairs since the storm. ' + prose(1);
const reportPage = (n, flow) => ({
  frames: [[60, 750, 475, 90]],
  before: [{ text: 'Harbour Trust annual report', font: B, size: 9, x: 60, y: 800, type: 'paragraph', furniture: true }],
  flow,
  after: [{ text: 'Page ' + n + ' of 3', font: B, size: 9, x: 297.5, y: 40, align: 'centre', type: 'paragraph', furniture: true }]
});
docs.push({
  file: 'report.pdf', size: [595, 842], title: '',
  pages: [
    reportPage(1, [{ k: 'h', text: 'A Year on the Water', font: BB, size: 20, level: 1 }, { k: 'p', text: prose(3) }, { k: 'h', text: 'Moorings', font: BB, size: 14, level: 2 }, { k: 'p', text: prose(4) }]),
    reportPage(2, [{ k: 'h', text: 'Finance', font: BB, size: 14, level: 2 }, { k: 'p', text: prose(3) }, { k: 'p', text: SPLIT_A }]),
    reportPage(3, [{ k: 'p', text: SPLIT_B }, { k: 'h', text: 'Looking ahead', font: BB, size: 14, level: 2 }, { k: 'p', text: prose(3) }])
  ]
});

docs.push({
  file: 'sidebar.pdf', size: [595, 842],
  pages: [{
    frames: [[50, 770, 320, 300], [400, 770, 145, 300]],
    flow: [
      { k: 'h', text: 'The new slipway', font: BB, size: 16, level: 1 },
      { k: 'p', text: prose(6) },
      { k: 'p', text: prose(4) },
      { k: 'next' },
      { k: 'p', text: 'In brief: ' + prose(3) }
    ],
    after: [
      { text: '1 Figures are for the year to 31 March 2026.', font: B, size: 8, x: 50, y: 120, type: 'paragraph' },
      { text: '4', font: B, size: 9, x: 297.5, y: 40, align: 'centre', type: 'paragraph' }
    ]
  }]
});

docs.push({
  file: 'scrambled.pdf', size: [595, 842], shuffle: 4242, words: true, justify: true,
  pages: [{
    frames: [[50, 735, 237, 300], [308, 735, 237, 300]],
    before: [{ text: 'Shuffled Stream', font: BB, size: 20, x: 50, y: 775, type: 'heading', level: 1 }],
    flow: [
      { k: 'p', text: prose(5) },
      { k: 'h', text: 'Out of order', font: BB, size: 14, level: 2 },
      { k: 'p', text: prose(3) + ' The left column stops in the middle of a thought and the || right column finishes it calmly. ' + prose(3) },
      { k: 'p', text: prose(4) }
    ]
  }]
});

const CODE = [
  ['total = 0', '# start the count'],
  ['for row in rows:', '# every line read'],
  ['    total += row.n', '# add this row'],
  ['    seen.add(row.id)', '# remember the id'],
  ['print(total, n)', '# show the result'],
  ['save(seen, path)', '# keep it on disk']
];
docs.push({
  file: 'code.pdf', size: [595, 842],
  pages: [{
    frames: [[72, 780, 450, 600]],
    flow: [],
    /* drawn row by row, as an editor prints it: code, then its comment */
    before: [].concat(...CODE.map((c, i) => [
      { text: c[0], font: 'Courier', size: 9, x: 72, y: 760 - i * 11, type: 'code' },
      { text: c[1], font: 'Courier', size: 9, x: 200, y: 760 - i * 11, type: 'comment' }]))
  }]
});

/* a price table (three columns, five rows) under a heading, and an address set as short separate lines */
const TABLE = [['Item', 'Quantity', 'Price'], ['Seed potatoes', '2 sacks', '£24.00'], ['Onion sets', '500 g', '£3.80'],
  ['Netting', '10 m', '£12.50'], ['Water butt', '1', '£39.99']];
const ADDRESS = ['Plot 14', 'Riverside Allotments', 'Mill Lane', 'Kendal LA9 4QT'];
docs.push({
  file: 'table.pdf', size: [595, 842],
  pages: [{
    frames: [[72, 780, 450, 600]],
    flow: [],
    before: [{ text: 'Spring order', font: BB, size: 16, x: 72, y: 760, type: 'heading', level: 1 }]
      .concat(...TABLE.map((row, i) => row.map((c, k) => ({ text: c, font: i ? B : BB, size: 10, x: 72 + k * 170, y: 720 - i * 16, type: 'cell' }))))
      .concat(ADDRESS.map((l, i) => ({ text: l, font: B, size: 10, x: 72, y: 560 - i * 13, type: 'address' })))
  }]
});
docs.push({
  file: 'landscape.pdf', size: [842, 595],
  pages: [{
    frames: [[60, 540, 720, 60]],
    flow: [{ k: 'h', text: 'Plot map notes', font: BB, size: 16, level: 1 }, { k: 'p', text: prose(3) }]
  }]
});

function truthText(t) { return t.replace(/\s*\|\|\s*/g, ' ').replace(/-\|(?=\p{Ll})/gu, '').replace(/\|/g, ''); }
function expected(page) {
  const out = [];
  for (const a of page.before || []) out.push({ type: a.type, level: a.level, text: a.text, furniture: !!a.furniture });
  for (const el of page.flow) {
    if (el.k === 'h') out.push({ type: 'heading', level: el.level, text: el.text });
    else if (el.k === 'p') out.push({ type: 'paragraph', text: truthText(el.text) });
    else if (el.k === 'li') out.push({ type: 'list-item', text: el.marker + ' ' + el.text, bullet: !el.numbered, body: el.text });
  }
  for (const a of page.after || []) out.push({ type: a.type, level: a.level, text: a.text, furniture: !!a.furniture });
  return out;
}
const docOf = (f) => docs.find((d) => d.file === f);

/* ---------- the generators ---------- */
const GEN = String.raw`
import json, sys, random
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.utils import simpleSplit

spec = json.load(open(sys.argv[1], encoding='utf-8'))
for doc in spec['docs']:
    c = canvas.Canvas(doc['path'], pagesize=tuple(doc['size']))
    if doc.get('title'): c.setTitle(doc['title'])
    for page in doc['pages']:
        ops = []
        def op(font, size, x, y, text, align='left'):
            if align == 'centre': x = x - stringWidth(text, font, size) / 2
            ops.append((font, size, x, y, text))
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
            op(a['font'], a['size'], a['x'], a['y'], a['text'], a.get('align', 'left'))
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
            if k == 'next':
                next_frame()
            elif k == 'h':
                f, b = place(size, lead, before=size * 0.8)
                line(font, size, f[0], b, el['text'])
                st['pending'] = el.get('after', 4)
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
                    for piece in seg.split('|'):
                        pl = simpleSplit(piece, font, size, frames[st['fi']][2])
                        for li, ln in enumerate(pl):
                            f, b = place(size, lead)
                            line(font, size, f[0], b, ln, f[2] if doc.get('justify') else None, li == len(pl) - 1)
                st['pending'] = el.get('after', 6)
        for a in page.get('after', []):
            op(a['font'], a['size'], a['x'], a['y'], a['text'], a.get('align', 'left'))
        if doc.get('shuffle'): random.Random(doc['shuffle']).shuffle(ops)
        for font, size, x, y, text in ops:
            c.setFont(font, size)
            c.drawString(x, y, text)
        c.showPage()
    c.save()
print('ok')
`;

const MUPDF = String.raw`
import pymupdf, sys, os
out = sys.argv[1]
rep = pymupdf.open(os.path.join(out, 'report.pdf'))
rep.save(os.path.join(out, 'secret.pdf'), encryption=pymupdf.PDF_ENCRYPT_AES_256, owner_pw='owner-2026', user_pw='Harbour-2026',
         permissions=pymupdf.PDF_PERM_PRINT | pymupdf.PDF_PERM_ACCESSIBILITY)
# pictures of pages: page 1 of the report drawn at 100 dpi, twice
pix = rep[0].get_pixmap(dpi=100)
scan = pymupdf.open()
for i in range(2):
    p = scan.new_page(width=595, height=842)
    p.insert_image(p.rect, pixmap=pix)
scan.save(os.path.join(out, 'scan.pdf'))
mixed = pymupdf.open()
mixed.insert_pdf(rep, from_page=0, to_page=0)
p = mixed.new_page(width=595, height=842)
p.insert_image(p.rect, pixmap=pix)
mixed.save(os.path.join(out, 'mixed.pdf'))
# a filled-in form field
form = pymupdf.open()
p = form.new_page(width=595, height=842)
p.insert_text((72, 100), 'Applicant name:', fontname='helv', fontsize=12)
w = pymupdf.Widget()
w.field_type = pymupdf.PDF_WIDGET_TYPE_TEXT
w.field_name = 'fullname'
w.field_value = 'Jane Doe'
w.rect = pymupdf.Rect(180, 85, 400, 105)
w.text_fontsize = 12
p.add_widget(w)
form.save(os.path.join(out, 'form.pdf'))
def many(n, name):
    d = pymupdf.open()
    for i in range(n):
        p = d.new_page(width=595, height=842)
        p.insert_text((72, 130), 'Long document page ' + str(i + 1), fontname='hebo', fontsize=16)
        y = 160
        for k in range(30):
            p.insert_text((72, y), 'Line ' + str(k + 1) + ' of page ' + str(i + 1) + ': the quick brown fox jumps over the lazy dog again.', fontname='helv', fontsize=10)
            y += 14
    d.save(os.path.join(out, name))
many(200, 'long.pdf')
many(320, 'huge.pdf')
print('ok')
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
out['uncovered'] = [n for n in names if n != '[Content_Types].xml' and ('/' + n) not in overrides and n.rsplit('.', 1)[-1].lower() not in defaults]
import docx
d = docx.Document(path)
out['paras'] = [[p.style.name, p.text] for p in d.paragraphs]
out['numbered'] = [p._p.pPr is not None and p._p.pPr.numPr is not None for p in d.paragraphs]
doc = z.read('word/document.xml').decode('utf-8')
out['pagebreaks'] = len(re.findall(r'<w:br w:type="page"/>', doc))
out['pgSz'] = re.findall(r'<w:pgSz w:w="(\d+)" w:h="(\d+)"', doc)
out['pgMar'] = re.findall(r'<w:pgMar w:top="(\d+)" w:right="(\d+)" w:bottom="(\d+)" w:left="(\d+)"', doc)
sty = z.read('word/styles.xml').decode('utf-8')
out['font'] = re.findall(r'<w:rFonts w:ascii="([^"]+)"', sty)[:1]
out['size'] = re.findall(r'<w:rPrDefault><w:rPr>.*?<w:sz w:val="(\d+)"', sty)[:1]
out['title'] = d.core_properties.title
out['author'] = d.core_properties.author
out['nav'] = [p.text for p in d.paragraphs if p.style.name.startswith('Heading')]
print(json.dumps(out))
`;

function py(code, args) {
  const f = path.join(OUT, 'probe-' + Math.random().toString(36).slice(2) + '.py');
  fs.writeFileSync(f, code);
  const r = spawnSync(PY, [f].concat(args || []), { encoding: 'utf8', maxBuffer: 64 << 20 });
  fs.unlinkSync(f);
  return r;
}
function docxProbe(bytes, name) {
  const f = path.join(OUT, name);
  fs.writeFileSync(f, bytes);
  const r = py(DOCX_PROBE, [f]);
  try { return JSON.parse(r.stdout); } catch (e) { return { error: (r.stderr || r.stdout || '').slice(-500) }; }
}

/* ---------- comparing ---------- */
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
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
/** The .txt the tool should write for these pages (real numbers), from the ground truth. */
function truthTxt(doc, pageNos, opts) {
  const o = opts || {};
  const parts = [];
  pageNos.forEach((n, i) => {
    const body = expected(doc.pages[n - 1]).filter((b) => !(o.drop && b.furniture)).map((b) => b.text).join('\n\n');
    if (i > 0) parts.push(o.sep === 'formfeed' ? '\n\f' : o.sep === 'none' ? '\n\n' : '\n\n--- Page ' + n + ' ---\n\n');
    parts.push(body);
  });
  return parts.join('') + '\n';
}
function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return i >= Math.max(a.length, b.length) ? '' : '@' + i + ' expected ' + JSON.stringify(a.slice(i, i + 50)) + ' got ' + JSON.stringify(b.slice(i, i + 50));
}
const stat = (res, k) => { const r = ((res && res.stats) || []).find((x) => x[0] === k); return r ? r[1] : undefined; };

/* ---------- the engine in Node ---------- */
let pdfjsLib = null;
async function pdfjs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import(pathToFileURL(path.join(ROOT, 'engine/vendor/pdfjs/pdf.min.mjs')).href);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(ROOT, 'engine/vendor/pdfjs/pdf.worker.min.mjs')).href;
  return pdfjsLib;
}
let coreLib = null;
function core() {
  if (!coreLib) {
    /* the pages' own bundle; if it does not load, say so and go on with the package engine it is built from */
    try { const w = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'engine/pdfcore.bundle.js'), 'utf8'))(w); coreLib = w.MVRPdfCore; check(true, 'engine/pdfcore.bundle.js loads'); }
    catch (e) { check(false, 'engine/pdfcore.bundle.js loads', e.message); coreLib = require(path.join(ROOT, 'build/pdf-package/engine/pdfcore.js')); }
  }
  return coreLib;
}
const TL = require(path.join(ROOT, 'engine/pdf-textlayout.js'));
function loadSpec(id) {
  const w = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'engine/pdf-' + id + '.js'), 'utf8'))(w);
  return { spec: w.PDF_TOOLS[id], win: w };
}
/** mainRun with a stand-in for the page's api. hooks.cancelAt: cancel once this many progress calls have been made. */
async function runMain(id, file, opts, hooks) {
  const h = hooks || {};
  const { spec, win } = loadSpec(id);
  const lib = await pdfjs();
  const o = {};
  (spec.controls || []).forEach((c) => { o[c.key] = c.default; });
  Object.assign(o, opts || {});
  const bytes = file.bytes || new Uint8Array(fs.readFileSync(path.join(OUT, file.name)));
  const entry = { name: file.name, bytes, password: file.password || '', pages: 0 };
  const labels = [];
  let docRef = null;
  const api = {
    spec, core: core(), entries: [entry], opts: o,
    loadScript: async (f) => { if (f !== 'pdf-textlayout.js') throw new Error('unexpected script ' + f); win.MVRTextLayout = TL; },
    pdfjs: async () => lib,
    openPdf: async (e) => {
      const copy = new Uint8Array(e.bytes.length); copy.set(e.bytes);
      docRef = await lib.getDocument({ data: copy, password: e.password || undefined, standardFontDataUrl: path.join(ROOT, 'engine/vendor/pdfjs/standard_fonts/').replace(/\\/g, '/') + '/', verbosity: 0 }).promise;
      return docRef;
    },
    progress: (d, t, l) => { labels.push(l); },
    signal: { aborted: false },
    cancelled: () => h.cancelAt !== undefined && labels.length >= h.cancelAt
  };
  let res, err = null;
  try { res = await spec.mainRun(api); } catch (e) { err = e; }
  if (docRef) await docRef.destroy();
  return { res: res || {}, err, labels };
}

/* ================================================================== */

async function nodePart() {
  group('fixtures (reportlab, PyMuPDF)');
  const spec = { docs: docs.map((d) => Object.assign({}, d, { path: path.join(OUT, d.file) })) };
  fs.writeFileSync(path.join(OUT, 'spec.json'), JSON.stringify(spec));
  const g = py(GEN, [path.join(OUT, 'spec.json')]);
  check(g.status === 0, 'reportlab wrote ' + docs.length + ' PDFs', (g.stderr || '').slice(-400));
  if (g.status !== 0) throw new Error('fixtures failed');
  const m = py(MUPDF, [OUT]);
  check(m.status === 0, 'PyMuPDF wrote secret, scan, mixed, form, long and huge', (m.stderr || '').slice(-400));
  if (m.status !== 0) throw new Error('fixtures failed');

  group('PDF to Text: reading order against the text put in');
  const news = docOf('newsletter.pdf');
  let r = await runMain('pdf-to-text', { name: 'newsletter.pdf' }, {});
  const txt = r.res.files ? new TextDecoder('utf-8', { fatal: true }).decode(r.res.files[0].bytes) : '';
  const want = truthTxt(news, [1, 2]);
  check(!r.err && txt === want, 'newsletter: the .txt is the source text, block by block, in reading order, with "--- Page 2 ---"', r.err ? r.err.message : firstDiff(want, txt));
  check(r.res.files && r.res.files[0].name === 'newsletter.txt' && r.res.files[0].type === 'text/plain; charset=utf-8', 'named newsletter.txt, type text/plain; charset=utf-8', r.res.files && r.res.files[0].name + ' ' + r.res.files[0].type);
  const b0 = r.res.files ? r.res.files[0].bytes : new Uint8Array(0);
  check(!(b0[0] === 0xEF && b0[1] === 0xBB && b0[2] === 0xBF) && Buffer.from(b0).toString('utf8') === want, 'UTF-8 with no byte-order mark: \u00A3, \u00E9, \u2013 and curly quotes come back exactly');
  check(/Seed potatoes arrive on 14 March and cost \u00A312 a sack/.test(txt) && /\u201Copen day\u201D raised \u00A3340 for the new shed \u2013 thank you, and the caf\u00E9 sold out/.test(txt), 'non-ASCII text survives the round trip');
  check(/This example shows/.test(txt) && !/exam-/.test(txt), '"exam-" / "ple" joined as "example"');
  check(/The meeting moved on to the question of plot rents/.test(txt), 'the paragraph broken by the column break is one paragraph again');
  check(r.res.report === txt && r.res.fullText === txt, 'a short text is shown whole in the report box, and Copy gets the same');
  const truthWords = words(news.pages.map((p) => expected(p).map((b) => b.text).join(' ')).join(' ')).length;
  check(stat(r.res, 'Words') === truthWords.toLocaleString('en-GB'), 'stats: words = the words put in (' + truthWords + ')', stat(r.res, 'Words'));
  check(stat(r.res, 'Headings') === '6', 'stats: six headings (title, 4 section headings, the bold subheading)', stat(r.res, 'Headings'));
  check(stat(r.res, 'Columns found') === '2 columns: page 1; 1 column: page 2', 'stats: columns per page summarised', stat(r.res, 'Columns found'));
  check(stat(r.res, 'Running headers and footers') === 'Kept: 4 blocks', 'stats: the two headers and two page numbers found and kept', stat(r.res, 'Running headers and footers'));
  check(stat(r.res, 'Pages read') === '2' && /KB|B$/.test(stat(r.res, 'Output size') || ''), 'stats: pages read and output size', stat(r.res, 'Pages read') + ' / ' + stat(r.res, 'Output size'));
  check(r.labels.includes('Reading page 1 of 2') && r.labels.includes('Reading page 2 of 2'), 'progress says "Reading page n of N"', r.labels.join(' | '));
  if (VERBOSE) console.log(JSON.stringify(r.res.stats));

  r = await runMain('pdf-to-text', { name: 'newsletter.pdf' }, { furniture: 'drop' });
  let t2 = r.res.files ? Buffer.from(r.res.files[0].bytes).toString('utf8') : '';
  check(t2 === truthTxt(news, [1, 2], { drop: true }), 'furniture "drop": the running header and page numbers are left out, nothing else', firstDiff(truthTxt(news, [1, 2], { drop: true }), t2));
  check(stat(r.res, 'Running headers and footers') === 'Left out: 4 blocks', 'and the stats say so', stat(r.res, 'Running headers and footers'));

  r = await runMain('pdf-to-text', { name: 'newsletter.pdf' }, { separator: 'formfeed' });
  t2 = r.res.files ? Buffer.from(r.res.files[0].bytes).toString('utf8') : '';
  check(t2 === truthTxt(news, [1, 2], { sep: 'formfeed' }) && (t2.match(/\f/g) || []).length === 1, 'separator "form feed": one \\f between the pages', firstDiff(truthTxt(news, [1, 2], { sep: 'formfeed' }), t2));
  r = await runMain('pdf-to-text', { name: 'newsletter.pdf' }, { separator: 'none' });
  t2 = r.res.files ? Buffer.from(r.res.files[0].bytes).toString('utf8') : '';
  check(t2 === truthTxt(news, [1, 2], { sep: 'none' }) && !/--- Page|\f/.test(t2), 'separator "none": a blank line only', firstDiff(truthTxt(news, [1, 2], { sep: 'none' }), t2));

  const rep = docOf('report.pdf');
  r = await runMain('pdf-to-text', { name: 'report.pdf' }, { pages: '2-3' });
  t2 = r.res.files ? Buffer.from(r.res.files[0].bytes).toString('utf8') : '';
  check(t2 === truthTxt(rep, [2, 3]) && /\n--- Page 3 ---\n/.test(t2) && !/Page 1 of 3/.test(t2), 'pages "2-3": only those pages, the separator gives the real page number (3)', firstDiff(truthTxt(rep, [2, 3]), t2));
  check(stat(r.res, 'Pages read') === '2 of 3 (pages 2\u20133)', 'stats: "2 of 3 (pages 2–3)"', stat(r.res, 'Pages read'));
  r = await runMain('pdf-to-text', { name: 'report.pdf' }, { pages: '3, 1' });
  t2 = r.res.files ? Buffer.from(r.res.files[0].bytes).toString('utf8') : '';
  check(t2 === truthTxt(rep, [3, 1]), 'pages "3, 1": in the order typed', firstDiff(truthTxt(rep, [3, 1]), t2));
  r = await runMain('pdf-to-text', { name: 'report.pdf' }, { pages: '9' });
  check(r.res.error && /matches no pages/.test(r.res.error) && !r.res.files, 'a selection with no pages in the file is refused', r.res.error);
  r = await runMain('pdf-to-text', { name: 'report.pdf' }, {});
  t2 = r.res.files ? Buffer.from(r.res.files[0].bytes).toString('utf8') : '';
  check(t2 === truthTxt(rep, [1, 2, 3]), 'report: three pages, every block in order', firstDiff(truthTxt(rep, [1, 2, 3]), t2));
  check(t2.indexOf(SPLIT_A + '\n\nPage 2 of 3\n\n--- Page 3 ---\n\nHarbour Trust annual report\n\n' + SPLIT_B) >= 0,
    'a page that starts mid-sentence under a running header: the header stays its own block (not joined to the sentence)');
  check(stat(r.res, 'Running headers and footers') === 'Kept: 6 blocks', 'report: 3 headers + 3 "Page n of 3" found', stat(r.res, 'Running headers and footers'));
  r = await runMain('pdf-to-text', { name: 'report.pdf' }, { furniture: 'drop' });
  t2 = r.res.files ? Buffer.from(r.res.files[0].bytes).toString('utf8') : '';
  check(t2.indexOf(SPLIT_A + '\n\n--- Page 3 ---\n\n' + SPLIT_B + '\n\n') >= 0 && stat(r.res, 'Running headers and footers') === 'Left out: 6 blocks',
    'a paragraph split by a page break stays two paragraphs, either side of the separator (headers left out: 6)', stat(r.res, 'Running headers and footers'));

  group('PDF to Text: stream order, sidebars, footnotes, code');
  const scr = docOf('scrambled.pdf');
  const rs = await runMain('pdf-to-text', { name: 'scrambled.pdf' }, { order: 'reading' });
  const st = await runMain('pdf-to-text', { name: 'scrambled.pdf' }, { order: 'stream' });
  const tr = Buffer.from(rs.res.files[0].bytes).toString('utf8'), ts = Buffer.from(st.res.files[0].bytes).toString('utf8');
  const et = expected(scr.pages[0]).map((b) => b.text).join(' ');
  check(norm(tr) === norm(et), 'scrambled: reading order rebuilds the text put in', firstDiff(norm(et), norm(tr)));
  check(norm(ts) !== norm(et) && !sentencesInOrder(et, ts).ok, 'scrambled: "as stored" gives the shuffled order, which differs');
  const md = multisetDiff(et, ts);
  check(!md.missing.length && !md.extra.length, '"as stored" still loses and doubles no word', md.missing.slice(0, 5).join(' ') + ' | ' + md.extra.slice(0, 5).join(' '));
  check(stat(st.res, 'Order') === 'As stored in the file' && stat(rs.res, 'Order') === 'Reading order (columns rebuilt)', 'the Order row names the choice');

  const sb = await runMain('pdf-to-text', { name: 'sidebar.pdf' }, {});
  const tsb = sb.res.files ? Buffer.from(sb.res.files[0].bytes).toString('utf8') : '';
  check(tsb === truthTxt(docOf('sidebar.pdf'), [1]), 'sidebar: main column, then the sidebar as a column of its own, then the footnote, then the page number', firstDiff(truthTxt(docOf('sidebar.pdf'), [1]), tsb));
  check(stat(sb.res, 'Columns found') === '2 columns', 'sidebar: 2 columns', stat(sb.res, 'Columns found'));

  const cd = await runMain('pdf-to-text', { name: 'code.pdf' }, {});
  const tcd = cd.res.files ? norm(Buffer.from(cd.res.files[0].bytes).toString('utf8')) : '';
  const lastCode = tcd.indexOf(CODE[CODE.length - 1][0]), firstComment = tcd.indexOf(CODE[0][1]);
  check(lastCode >= 0 && firstComment > lastCode, 'code with comments lined up on the right: read as two columns, code first, comments after', tcd.slice(0, 160));
  const cds = await runMain('pdf-to-text', { name: 'code.pdf' }, { order: 'stream' });
  const tcds = cds.res.files ? Buffer.from(cds.res.files[0].bytes).toString('utf8') : '';
  const rowByRow = (() => { let at = 0; for (const c of CODE) { const i = tcds.indexOf(c[1], at); const j = tcds.indexOf(c[0].trim(), at); if (j < 0 || i < j) return false; at = i; } return true; })();
  check(rowByRow, 'code "as stored": each line\'s comment follows its code', JSON.stringify(tcds.slice(0, 200)));

  const tb = await runMain('pdf-to-text', { name: 'table.pdf' }, {});
  const ttb = tb.res.files ? Buffer.from(tb.res.files[0].bytes).toString('utf8') : '';
  const rowWise = (() => { let at = 0; for (const c of [].concat(...TABLE)) { const i = ttb.indexOf(c, at); if (i < 0) return false; at = i + c.length; } return true; })();
  check(rowWise, 'a table: its cells come out row by row, as plain text without the grid', JSON.stringify(ttb));
  check(ttb.indexOf(ADDRESS.join('\n')) >= 0, 'an address set as short lines keeps its line breaks', JSON.stringify(ttb.slice(-90)));
  if (VERBOSE) console.log(JSON.stringify(ttb));

  group('PDF to Text: scans, form fields, passwords, long files');
  r = await runMain('pdf-to-text', { name: 'scan.pdf' }, {});
  check(!r.res.files && /no text to take out/.test(r.res.warn || '') && /OCR PDF \(\/pdf\/ocr-pdf\/\)/.test(r.res.warn || ''), 'a scan: no file, a warning that points to OCR PDF (/pdf/ocr-pdf/)', r.res.warn);
  r = await runMain('pdf-to-text', { name: 'mixed.pdf' }, {});
  t2 = r.res.files ? Buffer.from(r.res.files[0].bytes).toString('utf8') : '';
  check(r.res.files && /A Year on the Water/.test(t2) && /No text on page 2/.test(r.res.warn || '') && stat(r.res, 'Pages with no text') === '2', 'text page + picture page: the text is kept, page 2 is named as having no text', (r.res.warn || '') + ' / ' + stat(r.res, 'Pages with no text'));
  r = await runMain('pdf-to-text', { name: 'form.pdf' }, {});
  t2 = r.res.files ? Buffer.from(r.res.files[0].bytes).toString('utf8') : '';
  check(/Applicant name:/.test(t2) && !/Jane Doe/.test(t2), 'a filled-in form field\'s answer is not in the text', JSON.stringify(t2));
  const formBytes = new Uint8Array(fs.readFileSync(path.join(OUT, 'form.pdf')));
  let flat = null;
  try { flat = (await core().flattenDocument(await core().PDFDocument.load(formBytes), { forms: true, comments: true })).bytes; } catch (e) { flat = null; }
  if (flat) {
    r = await runMain('pdf-to-text', { name: 'form-flattened.pdf', bytes: flat }, {});
    t2 = r.res.files ? Buffer.from(r.res.files[0].bytes).toString('utf8') : '';
    check(/Applicant name:/.test(t2) && /Jane Doe/.test(t2), 'flattened first (pdfcore flattenDocument, as Flatten PDF does), the answer is read', JSON.stringify(t2));
  } else check(false, 'flattenDocument is in pdfcore.bundle.js');
  r = await runMain('pdf-to-text', { name: 'secret.pdf', password: 'Harbour-2026' }, {});
  t2 = r.res.files ? Buffer.from(r.res.files[0].bytes).toString('utf8') : '';
  check(t2 === truthTxt(rep, [1, 2, 3]), 'AES-256 file opened with its password: the same text as the plain file', r.res.error || firstDiff(truthTxt(rep, [1, 2, 3]), t2));
  r = await runMain('pdf-to-text', { name: 'long.pdf' }, {}, { cancelAt: 6 });
  check(r.err && r.err.name === 'AbortError' && !r.res.files, 'cancelled after 5 of 200 pages: an AbortError, no file', r.err ? r.err.name + ' after "' + r.labels[r.labels.length - 1] + '"' : 'finished');
  r = await runMain('pdf-to-text', { name: 'long.pdf' }, {});
  t2 = r.res.files ? Buffer.from(r.res.files[0].bytes).toString('utf8') : '';
  check((t2.match(/^--- Page \d+ ---$/gm) || []).length === 199 && /Line 30 of page 200:/.test(t2), '200 pages: 199 separators, the last line of page 200 present');
  check(!stat(r.res, 'Bold fonts'), '200 pages: bold fonts read (no "Bold fonts" row)');
  check(r.res.report.length < r.res.fullText.length && /\[The first 20,000 of [\d,]+ characters are shown here\. The download and Copy the text hold all of it\.\]$/.test(r.res.report) && r.res.fullText === t2,
    'a long text: the report box shows the first 20,000 characters and says so; Copy gets all of it', r.res.report.slice(-120));
  const t0 = Date.now();
  r = await runMain('pdf-to-text', { name: 'huge.pdf' }, {});
  check(/^Not read: over 300 pages/.test(stat(r.res, 'Bold fonts') || '') && r.res.files, '320 pages: the font names are not read, and the stats say so (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)', stat(r.res, 'Bold fonts'));
  const t320 = r.res.files ? Buffer.from(r.res.files[0].bytes).toString('utf8') : '';
  /* the page heading is 16 pt (larger than the 10 pt body): still a heading without the font names */
  check(/Long document page 320\n\nLine 1 of page 320/.test(t320) && stat(r.res, 'Headings') === '320', 'and headings are still found by size (320)', stat(r.res, 'Headings'));

  group('PDF to Word: python-docx, zipfile, xml.etree');
  r = await runMain('pdf-to-word', { name: 'newsletter.pdf' }, {});
  const f = r.res.files && r.res.files[0];
  check(f && f.name === 'newsletter.docx' && f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && f.bytes[0] === 0x50 && f.bytes[1] === 0x4B,
    'named newsletter.docx, the Word type, a zip', f && f.name + ' ' + f.type);
  const j = f ? docxProbe(f.bytes, 'newsletter.docx') : { error: 'no file' };
  check(!j.error, 'python-docx opens it', j.error);
  if (!j.error) {
    check(j.testzip === null && !j.badxml.length && !j.uncovered.length, 'zip CRCs good, every XML part well formed, every part has a content type', j.badxml.concat(j.uncovered).join('; '));
    const exp = [];
    news.pages.forEach((p, i) => {
      if (i > 0) exp.push(['Normal', '']);
      for (const b of expected(p)) {
        if (b.type === 'heading') exp.push(['Heading ' + b.level, b.text]);
        else if (b.type === 'list-item') exp.push(['List Paragraph', b.bullet ? b.body : b.text]);
        else exp.push(['Normal', b.text]);
      }
    });
    let bad = '';
    for (let i = 0; i < Math.max(exp.length, j.paras.length) && !bad; i++) {
      const g2 = j.paras[i];
      if (!g2 || g2[0] !== exp[i][0] || norm(g2[1]) !== norm(exp[i][1])) bad = '#' + i + ' expected ' + JSON.stringify(exp[i]) + ' got ' + JSON.stringify(g2);
    }
    check(!bad, 'every paragraph\'s style and text match the source (' + exp.length + ' paragraphs)', bad);
    check(j.nav.join('|') === 'Riverside Allotments Newsletter|Spring planting|Water butts|Committee news|Dates for the diary|From the treasurer', 'Heading 1–3 paragraphs, as the Navigation pane lists them', j.nav.join('|'));
    const lv = j.paras.filter((p) => /^Heading/.test(p[0])).map((p) => p[0].slice(-1)).join('');
    check(lv === '123222', 'levels: title Heading 1, sections Heading 2, the bold body-size subheading Heading 3', lv);
    const bullets = j.paras.filter((p, i) => p[0] === 'List Paragraph' && j.numbered[i]).length;
    const numbered = j.paras.filter((p, i) => p[0] === 'List Paragraph' && !j.numbered[i]).map((p) => p[1].slice(0, 2)).join(',');
    check(bullets === 3 && numbered === '1.,2.,3.', 'three bulleted List Paragraphs; the numbered items keep "1." "2." "3." as text', bullets + ' / ' + numbered);
    check(j.pagebreaks === 1, 'one page break between the two PDF pages', j.pagebreaks);
    check(j.title === news.title, 'the document title is the PDF\'s Info Title', j.title);
    check(!j.author, 'no author is written', j.author);
    check(JSON.stringify(j.pgSz) === '[["11900","16840"]]' && JSON.stringify(j.pgMar) === '[["1440","1440","1440","1440"]]', 'paper size from the PDF (595 × 842 pt = 11900 × 16840 twips), 1440-twip (2.54 cm) margins', JSON.stringify(j.pgSz) + JSON.stringify(j.pgMar));
    check(j.font[0] === 'Calibri' && j.size[0] === '22', 'Calibri at 11 pt (22 half-points) by default', j.font + ' ' + j.size);
  }
  check(stat(r.res, 'Headings') === '6 (1 Heading 1, 4 Heading 2, 1 Heading 3)' && stat(r.res, 'List items') === '6' && stat(r.res, 'Page breaks') === '1' && stat(r.res, 'Document title') === news.title,
    'stats: headings by Word style, list items, page breaks, title', ['Headings', 'Paragraphs', 'List items', 'Page breaks', 'Document title'].map((k) => k + '=' + stat(r.res, k)).join('; '));
  check(/Pictures, the grid of a table, fonts, colours and positions are not carried over/.test(r.res.note || ''), 'a note says what is not carried over', r.res.note);
  if (VERBOSE) console.log(JSON.stringify(r.res.stats));

  r = await runMain('pdf-to-word', { name: 'report.pdf' }, { furniture: 'drop', pages: '1, 3' });
  const j2 = r.res.files ? docxProbe(r.res.files[0].bytes, 'report-13.docx') : { error: r.res.error };
  const exp2 = [];
  [1, 3].forEach((n, i) => {
    if (i > 0) exp2.push('Normal|');
    for (const b of expected(rep.pages[n - 1])) if (!b.furniture) exp2.push((b.type === 'heading' ? 'Heading ' + b.level : 'Normal') + '|' + b.text);
  });
  const got2 = j2.paras ? j2.paras.map((p) => p[0] + '|' + p[1]) : [];
  check(!j2.error && got2.join('\n') === exp2.join('\n'), 'report pages "1, 3", furniture left out: just those pages, headers and footers gone', j2.error || firstDiff(exp2.join('\n'), got2.join('\n')));
  check(!j2.error && !j2.title && stat(r.res, 'Document title') === 'None in the PDF', 'reportlab\'s stand-in title "untitled" is not taken as a title: "None in the PDF"', j2.title + ' / ' + stat(r.res, 'Document title'));
  r = await runMain('pdf-to-word', { name: 'form.pdf' }, {});
  const j3 = r.res.files ? docxProbe(r.res.files[0].bytes, 'form.docx') : { error: r.res.error };
  check(!j3.error && !j3.title && stat(r.res, 'Document title') === 'None in the PDF', 'a PDF with no title at all: a Word file with none, and the stats say so', j3.error || j3.title);

  r = await runMain('pdf-to-word', { name: 'table.pdf' }, {});
  const j4 = r.res.files ? docxProbe(r.res.files[0].bytes, 'table.docx') : { error: r.res.error };
  check(!j4.error && j4.paras.some((x) => x[0] === 'Normal' && x[1] === ADDRESS.join('\n')), 'Word: the address is one paragraph with its lines kept apart (line breaks)', j4.error || JSON.stringify(j4.paras));
  const tbl = j4.paras ? j4.paras.map((x) => x[1]).join('\n') : '';
  check(!j4.error && !/<w:tbl>/.test(tbl) && (() => { let at = 0; for (const c of [].concat(...TABLE)) { const i = tbl.indexOf(c, at); if (i < 0) return false; at = i + c.length; } return true; })(), 'Word: the table\'s cells come out as text, row by row', tbl.slice(0, 200));
  r = await runMain('pdf-to-word', { name: 'landscape.pdf' }, {});
  const j5 = r.res.files ? docxProbe(r.res.files[0].bytes, 'landscape.docx') : { error: r.res.error };
  const docXml = r.res.files ? Buffer.from(r.res.files[0].bytes).toString('latin1') : '';
  check(!j5.error && JSON.stringify(j5.pgSz) === '[["16840","11900"]]' && /w:orient="landscape"/.test(docXml), 'Word: a landscape PDF gives a landscape page (16840 × 11900 twips)', JSON.stringify(j5.pgSz));

  r = await runMain('pdf-to-word', { name: 'scan.pdf' }, {});
  check(!r.res.files && /OCR PDF \(\/pdf\/ocr-pdf\/\)/.test(r.res.warn || '') && /a Word file here/.test(r.res.warn || ''), 'Word: a scan gives the OCR warning, no file', r.res.warn);
  r = await runMain('pdf-to-word', { name: 'secret.pdf', password: 'Harbour-2026' }, {});
  check(r.res.files && docxProbe(r.res.files[0].bytes, 'secret.docx').nav.join('|') === 'A Year on the Water|Moorings|Finance|Looking ahead', 'Word: the password-protected report converts, headings intact');
  r = await runMain('pdf-to-word', { name: 'long.pdf' }, {}, { cancelAt: 4 });
  check(r.err && r.err.name === 'AbortError', 'Word: cancelling stops between pages', r.err ? r.err.name : 'finished');

  /* the two specs read PDFs with the same code */
  const a = fs.readFileSync(path.join(ROOT, 'engine/pdf-pdf-to-text.js'), 'utf8'), bw = fs.readFileSync(path.join(ROOT, 'engine/pdf-pdf-to-word.js'), 'utf8');
  const block = (s) => s.slice(s.indexOf('/* ---------- reading a PDF'), s.indexOf('var SHOW = 20000;') >= 0 ? s.indexOf('var SHOW = 20000;') : s.indexOf('window.PDF_TOOLS = window.PDF_TOOLS'));
  check(block(a).length > 1000 && block(a) === block(bw), 'both specs carry the same PDF reading code');
}

/* ================================================================== */
/* the browser part                                                    */

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), 'E:/projects/1234Tools/node_modules/puppeteer-core', 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found');
}
function hook() {
  try { localStorage.setItem('1234tools-consent', 'denied'); } catch (e) { /* */ }
  const blobs = [];
  const orig = URL.createObjectURL;
  URL.createObjectURL = function (o) { const u = orig.call(URL, o); try { if (o && typeof o.size === 'number') blobs.push(o); } catch (e) { /* */ } return u; };
  window.__names = [];
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__names.push(this.download); return; } return click.call(this); };
  window.__h = {
    blobs,
    b64: (i) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blobs[i]); }),
    set(el, v) {
      if (!el) return false;
      if (el.type === 'checkbox') el.checked = v === true || v === 'true';
      else if (el.tagName === 'SELECT') el.value = String(v);
      else { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, String(v)); }
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  };
}
let browser, server;
const requests = new Set();
async function open(tool, width) {
  const page = await browser.newPage();
  page.on('request', (r) => { try { const u = new URL(r.url()); if (/^(https?|wss?):$/.test(u.protocol)) requests.add(u.host); } catch (e) { /* */ } });
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(String(e && e.message || e)));
  await page.setViewport({ width: width || 1400, height: 1000 });
  await page.evaluateOnNewDocument(hook);
  await page.goto(BASE + tool, { waitUntil: 'load', timeout: 120000 });
  await page.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
  await page.waitForSelector('.pdf-run .btn-primary', { timeout: 30000 });
  return page;
}
async function setControls(page, c) {
  const missing = await page.evaluate((c) => Object.keys(c).filter((k) => !window.__h.set(document.getElementById('pc-' + k), c[k])), c);
  if (missing.length) throw new Error('controls not found: ' + missing.join(', '));
}
async function upload(page, files) {
  const input = await page.$('.tool-io .dropzone input[type=file]');
  for (const f of files) {
    const n = await page.$$eval('.file-list .file-row', (l) => l.length);
    await input.uploadFile(f);
    await page.waitForFunction((k) => document.querySelectorAll('.file-list .file-row').length >= Math.max(1, k), { timeout: 30000 }, n);
  }
  await page.waitForFunction(() => !document.querySelector('.file-list .file-row.is-loading'), { timeout: 60000 });
}
async function press(page) {
  await page.evaluate(() => { const s = document.querySelector('.pdf-summary'); if (s) s.hidden = true; const m = document.querySelector('.tool-io > .io-msg'); if (m) m.className = 'io-msg'; });
  await page.click('.pdf-run .btn-primary');
  await page.waitForFunction(() => { const s = document.querySelector('.pdf-summary'); const m = document.querySelector('.tool-io > .io-msg'); return !document.querySelector('.pdf-run .btn-primary').disabled && ((s && !s.hidden) || (m && /is-(error|warn|note)/.test(m.className))); }, { timeout: 180000 });
  return page.evaluate(() => { const m = document.querySelector('.tool-io > .io-msg'); return { cls: m.className, msg: m.textContent, summary: !document.querySelector('.pdf-summary').hidden }; });
}
async function download(page) {
  const n0 = await page.evaluate(() => window.__h.blobs.length);
  await page.$eval('.pdf-summary-actions .btn-primary', (b) => b.click());
  await page.waitForFunction((n) => window.__h.blobs.length > n, { timeout: 30000 }, n0);
  const info = await page.evaluate((n) => ({ type: window.__h.blobs[n].type, name: window.__names[window.__names.length - 1] }), n0);
  return Object.assign(info, { bytes: new Uint8Array(Buffer.from(await page.evaluate((n) => window.__h.b64(n), n0), 'base64')) });
}
const statsOf = (page) => page.$$eval('.stat-row', (l) => Object.fromEntries(l.map((r) => [r.querySelector('.stat-key').textContent, r.querySelector('.stat-val').textContent])));
const noSideScroll = (page) => page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, win: window.innerWidth }));

async function browserPart() {
  const puppeteer = loadPuppeteer();
  const { serve } = require('./serve.js');
  server = await serve(ROOT, PORT);
  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], protocolTimeout: 180000 });
  const news = docOf('newsletter.pdf'), rep = docOf('report.pdf');

  group('Chrome  PDF to Text on its page');
  const p = await open('/pdf/pdf-to-text/');
  await upload(p, [path.join(OUT, 'newsletter.pdf')]);
  let r = await press(p);
  const d = await download(p);
  const txt = Buffer.from(d.bytes).toString('utf8');
  check(r.summary && txt === truthTxt(news, [1, 2]), 'newsletter: the downloaded .txt is the source text in reading order', firstDiff(truthTxt(news, [1, 2]), txt));
  check(d.name === 'newsletter.txt' && /^text\/plain/.test(d.type), 'saved as newsletter.txt (' + d.type + ')', d.name + ' ' + d.type);
  const rep1 = await p.evaluate(() => { const r = document.querySelector('.tool-io > pre.code-out'); return { hidden: r.hidden, text: r.textContent, copy: [...document.querySelectorAll('.pdf-actions button')].map((b) => b.textContent) }; });
  check(!rep1.hidden && rep1.text === txt && rep1.copy.includes('Copy the text'), 'the text is shown in the report box, with a "Copy the text" button', JSON.stringify(rep1.copy));
  let s = await statsOf(p);
  check(s.Headings === '6' && s['Columns found'] === '2 columns: page 1; 1 column: page 2', 'bold-font heading found in the page too (6 headings); columns summarised', JSON.stringify(s));
  if (VERBOSE) console.log(JSON.stringify(s));
  /* copy: the clipboard gets the whole text */
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions(BASE, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']).catch(() => {});
  await p.evaluate(() => { const b = [...document.querySelectorAll('.pdf-actions button')].find((x) => x.textContent === 'Copy the text'); b.click(); });
  await p.waitForFunction(() => [...document.querySelectorAll('.pdf-actions button')].some((x) => /Copied|Selected/.test(x.textContent)), { timeout: 5000 }).catch(() => {});
  const clip = (await p.evaluate(() => navigator.clipboard.readText().catch((e) => 'ERR ' + e.message))).replace(/\r\n/g, '\n');
  if (VERBOSE) console.log(JSON.stringify(firstDiff(txt, clip)));
  check(clip === txt,'Copy the text puts the whole text on the clipboard', clip.slice(0, 80));

  await setControls(p, { order: 'stream', furniture: 'drop', separator: 'formfeed', pages: '2' });
  await upload(p, [path.join(OUT, 'scrambled.pdf')]);
  await setControls(p, { pages: 'all' });
  r = await press(p);
  const ds = Buffer.from((await download(p)).bytes).toString('utf8');
  const et = expected(docOf('scrambled.pdf').pages[0]).map((b) => b.text).join(' ');
  check(norm(ds) !== norm(et) && !multisetDiff(et, ds).missing.length, 'scrambled, "as stored": the shuffled order, every word present');
  await setControls(p, { order: 'reading' });
  r = await press(p);
  const dr = Buffer.from((await download(p)).bytes).toString('utf8');
  check(norm(dr) === norm(et), 'scrambled, reading order: the text put in', firstDiff(norm(et), norm(dr)));
  await setControls(p, { order: 'stream' });
  await new Promise((res) => setTimeout(res, 700));       /* settings are saved 300 ms after the last change */
  if (VERBOSE) console.log(await p.evaluate(() => localStorage.getItem('1234tools-pdf-pdf-to-text-v1')));
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('.pdf-run .btn-primary');
  const kept = await p.evaluate(() => ['order', 'furniture', 'separator', 'pages'].map((k) => document.getElementById('pc-' + k).value));
  check(kept.join() === 'stream,drop,formfeed,all', 'order, headers and footers and separator are remembered on this device; the page range is not', kept.join());
  await p.evaluate(() => { const b = [...document.querySelectorAll('.pdf-remembered button')][0]; if (b) b.click(); });

  /* the password box */
  await upload(p, [path.join(OUT, 'secret.pdf')]);
  const asked = await p.evaluate(() => { const f = document.querySelector('.file-pass'); return f ? f.textContent : ''; });
  check(/needs its password to open/.test(asked), 'secret.pdf: the shell asks for its password', asked);
  await p.type('.file-pass input', 'Harbour-2026');
  await p.click('.file-pass .btn-primary');
  await p.waitForFunction(() => !document.querySelector('.file-pass') && /opened with its password/.test(document.querySelector('.file-list').textContent), { timeout: 20000 });
  await setControls(p, { order: 'reading', furniture: 'keep', separator: 'marker' });
  r = await press(p);
  const dp = Buffer.from((await download(p)).bytes).toString('utf8');
  check(dp === truthTxt(rep, [1, 2, 3]), 'opened with its password, the protected report gives its text', firstDiff(truthTxt(rep, [1, 2, 3]), dp));

  /* a scan */
  await upload(p, [path.join(OUT, 'scan.pdf')]);
  r = await press(p);
  check(/is-warn/.test(r.cls) && /OCR PDF \(\/pdf\/ocr-pdf\/\)/.test(r.msg) && !r.summary, 'a scan: a warning naming OCR PDF, nothing to download', r.msg);

  /* cancelling a long file */
  await upload(p, [path.join(OUT, 'long.pdf')]);
  await p.click('.pdf-run .btn-primary');
  await p.waitForFunction(() => { const g = document.querySelector('.pdf-progress'); return g && !g.hidden && /Reading page \d+ of 200/.test(g.textContent); }, { timeout: 30000 });
  const label = await p.$eval('.pdf-progress-label', (e) => e.textContent);
  await p.click('.pdf-progress-cancel');
  await p.waitForFunction(() => /Cancelled/.test(document.querySelector('.tool-io > .io-msg').textContent) && !document.querySelector('.pdf-run .btn-primary').disabled, { timeout: 30000 });
  const after = await p.evaluate(() => ({ summary: !document.querySelector('.pdf-summary').hidden, msg: document.querySelector('.tool-io > .io-msg').textContent }));
  check(/^Reading page \d+ of 200$/.test(label) && !after.summary, 'a 200-page file: the bar says "' + label + '", Cancel stops it and nothing is offered', after.msg);
  r = await press(p);
  const dl = Buffer.from((await download(p)).bytes).toString('utf8');
  check((dl.match(/^--- Page \d+ ---$/gm) || []).length === 199, 'run again after cancelling: all 200 pages');
  const longReport = await p.evaluate(() => document.querySelector('.tool-io > pre.code-out').textContent);
  check(/\[The first 20,000 of [\d,]+ characters are shown here/.test(longReport), 'the report box shows the first 20,000 characters of a long text');

  /* 1400 px, then 390 px, with and without the CSS asked for in the hand-back */
  let w = await noSideScroll(p);
  check(w.doc <= w.win && w.body <= w.win, '1400 px after a run: no horizontal scroll', JSON.stringify(w));
  await p.setViewport({ width: 390, height: 844 });
  await new Promise((res) => setTimeout(res, 400));
  w = await noSideScroll(p);
  check(w.doc <= 390 && w.body <= 390, '390 px after a run, long text in the report box: no horizontal scroll', JSON.stringify(w));
  await p.addStyleTag({ content: 'article.tool[data-tool="pdf-to-text"] .code-out { white-space: pre-wrap; overflow-wrap: anywhere; }' });
  w = await noSideScroll(p);
  const wrapOk = await p.$eval('.tool-io > pre.code-out', (e) => e.scrollWidth <= e.clientWidth + 1);
  check(w.doc <= 390 && wrapOk, 'with the wrapping rule: still no scroll, and the text wraps inside the box', JSON.stringify(w));
  check(!p.__errors.length, 'no script errors on the page', p.__errors.join(' | '));
  await p.close();

  group('Chrome  PDF to Word on its page');
  const q = await open('/pdf/pdf-to-word/', 390);
  await upload(q, [path.join(OUT, 'newsletter.pdf')]);
  r = await press(q);
  const dw = await download(q);
  check(dw.name === 'newsletter.docx' && dw.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'saved as newsletter.docx with the Word type', dw.name + ' ' + dw.type);
  const j = docxProbe(dw.bytes, 'browser-newsletter.docx');
  check(!j.error && j.nav.join('|') === 'Riverside Allotments Newsletter|Spring planting|Water butts|Committee news|Dates for the diary|From the treasurer' && j.title === news.title && j.pagebreaks === 1,
    'python-docx: the headings (the bold subheading too), the title and one page break', j.error || j.nav.join('|'));
  check(!j.error && j.paras.filter((x, i) => x[0] === 'List Paragraph' && j.numbered[i]).length === 3, 'three bulleted list items');
  const vq = await q.evaluate(() => ({ viewer: !document.querySelector('.pdf-view') || document.querySelector('.pdf-view').hidden, msg: document.querySelector('.tool-io > .io-msg').textContent }));
  check(vq.viewer && /not carried over/.test(vq.msg), 'no PDF viewer opens; the note says what is not carried over', vq.msg);
  s = await statsOf(q);
  check(s.Headings === '6 (1 Heading 1, 4 Heading 2, 1 Heading 3)' && s['Document title'] === news.title, 'stats in the page', JSON.stringify(s));
  if (VERBOSE) console.log(JSON.stringify(s));
  w = await noSideScroll(q);
  check(w.doc <= 390 && w.body <= 390, '390 px: no horizontal scroll', JSON.stringify(w));
  await q.setViewport({ width: 1400, height: 1000 });
  await upload(q, [path.join(OUT, 'mixed.pdf')]);
  r = await press(q);
  check(r.summary && /is-warn/.test(r.cls) && /No text on page 2/.test(r.msg), 'a text page and a scanned page: the file is made, page 2 is named', r.msg);
  check(!q.__errors.length, 'no script errors on the page', q.__errors.join(' | '));
  await q.close();

  const foreign = [...requests].filter((h) => !/^127\.0\.0\.1(:\d+)?$/.test(h));
  check(!foreign.length && requests.size > 0, 'no request left 127.0.0.1 (' + requests.size + ' host' + (requests.size === 1 ? '' : 's') + ' seen)', foreign.join(', '));
}

(async () => {
  console.log('pdf-to-text-word: ' + ROOT + (BROWSER ? ' on ' + BASE : ' (node only)'));
  try {
    await nodePart();
    if (BROWSER) await browserPart();
  } catch (e) {
    console.error('\nthe run broke: ' + (e && e.stack || e));
    if (browser) await browser.close();
    if (server) server.close();
    process.exit(1);
  }
  if (browser) await browser.close();
  if (server) server.close();
  console.log('\n' + (pass + fail) + ' assertions   ' + pass + ' passed   ' + fail + ' failed');
  if (fail) { console.log('\nFailures:\n  ' + failures.join('\n  ')); process.exit(2); }
})();
