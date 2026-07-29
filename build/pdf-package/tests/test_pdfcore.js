#!/usr/bin/env node
/**
 * Engine suite — pdfcore.js.
 *
 * Covers the byte helpers, lexer, both cross-reference forms, object streams,
 * damaged-xref recovery, the writer, page assembly and the WinAnsi mapping.
 *
 * Fixtures come from make-fixtures.py. Paths resolve relative to this file, so
 * it runs from any directory; set MVR_PDF_FIXTURES to override.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------- locating the engine and the fixtures ---------- */

function findFile(rels, what) {
  for (const rel of rels) {
    const p = path.join(__dirname, rel);
    if (fs.existsSync(p)) return p;
  }
  console.error(`Cannot find ${what}. Looked for:\n  ` +
    rels.map(r => path.join(__dirname, r)).join('\n  '));
  process.exit(2);
}

const core = require(findFile(
  ['../engine/pdfcore.js', './pdfcore.js', '../pdfcore.js', './engine/pdfcore.js'],
  'pdfcore.js'));

const FIXTURES = process.env.MVR_PDF_FIXTURES
  ? path.resolve(process.env.MVR_PDF_FIXTURES)
  : path.dirname(findFile(
      ['fixtures/classic5.pdf', '../tests/fixtures/classic5.pdf', '../fixtures/classic5.pdf'],
      'the fixtures (run: python3 tests/make-fixtures.py)'));

const fixture = (n) => new Uint8Array(fs.readFileSync(path.join(FIXTURES, n)));

const {
  PDFDocument, PDFWriter, Lexer, Name, Ref, PDFStream,
  assemble, parsePageRange, createPDF, textWidth, wrapText, contentEscape,
  PAGE_SIZES, FONTS, pdfString, decodePdfString, inflate, applyPredictor,
  ascii85Decode, latin1, bytesOf, isDict, isName, isRef
} = core;

/* ---------- assertions ---------- */

let pass = 0, fail = 0, group = '';
const failures = [];

function G(name) { group = name; console.log(`\n${name}`); }

function ok(cond, label, detail) {
  if (cond) { pass++; console.log(`  ok    ${label}`); }
  else {
    fail++; failures.push(`${group} → ${label}${detail ? '  (' + detail + ')' : ''}`);
    console.log(`  FAIL  ${label}${detail ? '  → ' + detail : ''}`);
  }
}
const eq = (a, b, label) =>
  ok(a === b, label, a === b ? '' : `got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
const near = (a, b, tol, label) =>
  ok(Math.abs(a - b) <= tol, label, `got ${a}, expected ${b} ±${tol}`);
const deep = (a, b, label) => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  ok(A === B, label, A === B ? '' : `got ${A}, expected ${B}`);
};
async function throwsAsync(fn, label, match) {
  try { await fn(); ok(false, label, 'no error thrown'); }
  catch (e) {
    ok(!match || match.test(e.message), label,
      match && !match.test(e.message) ? `message was "${e.message}"` : '');
  }
}
function throwsSync(fn, label, match) {
  try { fn(); ok(false, label, 'no error thrown'); }
  catch (e) {
    ok(!match || match.test(e.message), label,
      match && !match.test(e.message) ? `message was "${e.message}"` : '');
  }
}

/* small helpers used throughout */
const lexOf = (s) => new Lexer(bytesOf(s), 0);
const parseStr = (s) => lexOf(s).parse(0);
const strBytes = (v) => latin1(v.__string);

(async function main() {

  /* =====================================================================
     1. Byte helpers
     ===================================================================== */
  G('Byte helpers');

  eq(latin1(bytesOf('Hello')), 'Hello', 'latin1 round-trips ASCII');
  eq(latin1(bytesOf('café')), 'café', 'latin1 round-trips high Latin-1');
  eq(latin1(new Uint8Array([65, 66, 67, 68]), 1, 3), 'BC', 'latin1 honours from/to');
  eq(latin1(new Uint8Array([65, 66, 67]), 1), 'BC', 'latin1 with from only runs to the end');
  eq(latin1(new Uint8Array(0)), '', 'latin1 of an empty array is empty');
  eq(bytesOf('AB').length, 2, 'bytesOf length matches the string');
  eq(bytesOf('Ł')[0], 0x41, 'bytesOf masks code points above 255');
  eq(bytesOf('%PDF-')[0], 0x25, 'bytesOf encodes the PDF sigil');

  ok(isDict(Object.create(null)), 'isDict accepts a bare object');
  ok(isDict({ A: 1 }), 'isDict accepts a populated object');
  ok(!isDict([1, 2]), 'isDict rejects an array');
  ok(!isDict(new Name('X')), 'isDict rejects a Name');
  ok(!isDict(new Ref(1, 0)), 'isDict rejects a Ref');
  ok(!isDict(new PDFStream({}, new Uint8Array(0))), 'isDict rejects a PDFStream');
  ok(!isDict(new Uint8Array(2)), 'isDict rejects a byte array');
  ok(!isDict(null), 'isDict rejects null');
  ok(isName(new Name('Page')), 'isName accepts any Name');
  ok(isName(new Name('Page'), 'Page'), 'isName matches a specific name');
  ok(!isName(new Name('Page'), 'Pages'), 'isName rejects a different name');
  ok(!isName('Page'), 'isName rejects a plain string');
  ok(isRef(new Ref(3, 0)), 'isRef accepts a Ref');
  ok(!isRef({ num: 3 }), 'isRef rejects a look-alike object');
  eq(String(new Name('Type')), '/Type', 'Name stringifies with a slash');
  eq(String(new Ref(12, 0)), '12 0 R', 'Ref stringifies in PDF form');

  /* =====================================================================
     2. inflate and predictors
     ===================================================================== */
  G('Compression');

  const rawText = 'The quick brown fox jumps over the lazy dog. '.repeat(8);
  const zlibbed = new Uint8Array(zlib.deflateSync(Buffer.from(rawText)));
  const rawDeflated = new Uint8Array(zlib.deflateRawSync(Buffer.from(rawText)));

  ok(typeof DecompressionStream !== 'undefined', 'the runtime provides DecompressionStream');
  eq(latin1(await inflate(zlibbed)), rawText, 'inflate handles zlib-wrapped deflate');
  eq(latin1(await inflate(rawDeflated)), rawText, 'inflate falls back to raw deflate');
  await throwsAsync(() => inflate(bytesOf('not compressed at all')),
    'inflate reports undecodable data', /could not be decoded/i);

  const plain = new Uint8Array([1, 2, 3, 4]);
  eq(applyPredictor(plain, 0, 1, 8, 4), plain, 'predictor 0 returns the input untouched');
  eq(applyPredictor(plain, 1, 1, 8, 4), plain, 'predictor 1 returns the input untouched');
  eq(applyPredictor(plain, 2, 1, 8, 4), plain, 'predictor 2 (TIFF) is passed through');

  // PNG None (0) then Sub (1) then Up (2): 3 columns, 1 colour, 8 bpc
  const pngNone = applyPredictor(new Uint8Array([0, 10, 20, 30]), 12, 1, 8, 3);
  deep([...pngNone], [10, 20, 30], 'PNG filter 0 (None) copies the row');
  const pngSub = applyPredictor(new Uint8Array([1, 10, 5, 5]), 12, 1, 8, 3);
  deep([...pngSub], [10, 15, 20], 'PNG filter 1 (Sub) adds the byte to its left');
  const pngUp = applyPredictor(new Uint8Array([0, 10, 20, 30, 2, 1, 1, 1]), 12, 1, 8, 3);
  deep([...pngUp], [10, 20, 30, 11, 21, 31], 'PNG filter 2 (Up) adds the row above');
  /* Average: v = raw + ((left + up) >> 1), left running across the decoded row.
     Row 2 from [0,0,0] over [10,20,30] → 5, then (5+20)>>1 = 12, then (12+30)>>1 = 21. */
  const pngAvg = applyPredictor(new Uint8Array([0, 10, 20, 30, 3, 0, 0, 0]), 12, 1, 8, 3);
  deep([...pngAvg], [10, 20, 30, 5, 12, 21], 'PNG filter 3 (Average) uses left and up');
  const pngPaeth = applyPredictor(new Uint8Array([0, 10, 20, 30, 4, 0, 0, 0]), 12, 1, 8, 3);
  deep([...pngPaeth], [10, 20, 30, 10, 20, 30], 'PNG filter 4 (Paeth) predicts from three neighbours');
  eq(applyPredictor(new Uint8Array([0, 1, 2, 3]), 12, 1, 8, 3).length, 3,
    'the predictor strips the per-row filter byte');

  /* =====================================================================
     3. ASCII85
     ===================================================================== */
  G('ASCII85');

  /* "87cURD]i,\"Ebo80" is the canonical vector; cross-checked against
     Python's base64.a85decode, which returns b'Hello World!'. */
  eq(latin1(ascii85Decode(bytesOf('87cURD]i,"Ebo80'))), 'Hello World!',
    'ascii85 decodes a known string');
  deep([...ascii85Decode(bytesOf('z'))], [0, 0, 0, 0], 'ascii85 "z" is four zero bytes');
  eq(latin1(ascii85Decode(bytesOf('87cURD]i,"Ebo80~>'))), 'Hello World!',
    'ascii85 stops at the ~> terminator');
  eq(latin1(ascii85Decode(bytesOf('<~87cURD]i,"Ebo80~>'))), 'Hello World!',
    'ascii85 skips a leading <~');
  eq(latin1(ascii85Decode(bytesOf('87cUR\nD]i,\t"Ebo80'))), 'Hello World!',
    'ascii85 ignores embedded whitespace');
  eq(ascii85Decode(bytesOf('87cU')).length, 3, 'ascii85 handles a short final tuple');

  /* =====================================================================
     4. Lexer
     ===================================================================== */
  G('Lexer');

  ok(parseStr('/Type') instanceof Name, 'a slash token parses as a Name');
  eq(parseStr('/Type').name, 'Type', 'the Name carries its text');
  eq(parseStr('/A#20B').name, 'A B', 'hash escapes in names are decoded');
  eq(parseStr('42'), 42, 'integers parse');
  eq(parseStr('-17'), -17, 'negative integers parse');
  near(parseStr('3.25'), 3.25, 1e-9, 'reals parse');
  eq(parseStr('true'), true, 'true parses');
  eq(parseStr('false'), false, 'false parses');
  eq(parseStr('null'), null, 'null parses');

  const ref = parseStr('7 0 R');
  ok(ref instanceof Ref, 'a reference parses as a Ref');
  eq(ref.num, 7, 'the Ref keeps its object number');
  eq(ref.gen, 0, 'the Ref keeps its generation');
  eq(parseStr('7 0'), 7, 'two bare numbers do not become a reference');
  eq(parseStr('7 0 Q'), 7, 'a non-R third token does not become a reference');

  deep(parseStr('[1 2 3]'), [1, 2, 3], 'arrays parse');
  deep(parseStr('[1 [2 [3]]]'), [1, [2, [3]]], 'nested arrays parse');
  deep(parseStr('[]'), [], 'an empty array parses');

  const d1 = parseStr('<< /A 1 /B /Two >>');
  eq(d1.A, 1, 'dictionary numeric values parse');
  eq(d1.B.name, 'Two', 'dictionary name values parse');
  eq(parseStr('<< /Outer << /Inner 5 >> >>').Outer.Inner, 5, 'nested dictionaries parse');
  eq(Object.keys(parseStr('<<>>')).length, 0, 'an empty dictionary parses');

  eq(strBytes(parseStr('(plain)')), 'plain', 'literal strings parse');
  eq(strBytes(parseStr('(a\\(b\\)c)')), 'a(b)c', 'escaped parentheses are kept');
  eq(strBytes(parseStr('(a(b)c)')), 'a(b)c', 'balanced inner parentheses are kept');
  eq(strBytes(parseStr('(tab\\there)')), 'tab\there', 'backslash-t becomes a tab');
  eq(strBytes(parseStr('(nl\\nhere)')), 'nl\nhere', 'backslash-n becomes a newline');
  eq(strBytes(parseStr('(\\101\\102)')), 'AB', 'octal escapes decode');
  /* \010 consumes three octal digits (= 8, backspace), leaving a literal "1" */
  eq(strBytes(parseStr('(\\0101)')), '\b1', 'an octal escape takes at most three digits');
  eq(strBytes(parseStr('(one\\\ntwo)')), 'onetwo', 'a backslash-newline continues the line');
  eq(strBytes(parseStr('(\\q)')), 'q', 'an unknown escape yields the literal character');

  eq(strBytes(parseStr('<48656C6C6F>')), 'Hello', 'hex strings parse');
  eq(strBytes(parseStr('<4A4>')), 'J@', 'an odd-length hex string is padded with 0');
  eq(strBytes(parseStr('<48 65 6C>')), 'Hel', 'whitespace inside a hex string is ignored');

  eq(parseStr('% a comment\n42'), 42, 'comments are skipped');
  eq(parseStr('\n\r\t 42'), 42, 'leading whitespace is skipped');

  const stm = parseStr('<< /Length 5 >>\nstream\nABCDE\nendstream');
  ok(stm instanceof PDFStream, 'a dictionary followed by "stream" yields a PDFStream');
  eq(latin1(stm.raw), 'ABCDE', 'the stream body is captured using /Length');
  const stmBadLen = parseStr('<< /Length 999 >>\nstream\nABCDE\nendstream');
  eq(latin1(stmBadLen.raw), 'ABCDE', 'a wrong /Length falls back to the endstream marker');
  const stmNoLen = parseStr('<< /Filter /Fl >>\nstream\nXYZ\nendstream');
  eq(latin1(stmNoLen.raw), 'XYZ', 'a stream with no /Length is recovered');
  throwsSync(() => parseStr('<< /A 1 >>\nstream\nno terminator here'),
    'a stream with no endstream marker is rejected', /endstream/);
  throwsSync(() => parseStr('[1 2 3'), 'an unterminated array is rejected', /Unterminated array/);
  throwsSync(() => parseStr('<< /A 1'), 'an unterminated dictionary is rejected', /Unterminated dictionary/);
  throwsSync(() => parseStr('[' .repeat(80) + '1'), 'implausible nesting is rejected', /deep/);

  const multi = lexOf('/A /B /C');
  eq(multi.parse(0).name, 'A', 'the lexer advances across tokens (1/3)');
  eq(multi.parse(0).name, 'B', 'the lexer advances across tokens (2/3)');
  eq(multi.parse(0).name, 'C', 'the lexer advances across tokens (3/3)');
  eq(lexOf('  obj  ').readToken(), 'obj', 'readToken returns a bare keyword');
  eq(lexOf('').readToken(), null, 'readToken returns null at end of input');

  /* =====================================================================
     5. PDF strings
     ===================================================================== */
  G('PDF strings');

  eq(strBytes(pdfString('Simple')), 'Simple', 'ASCII text stays a plain byte string');
  const uni = pdfString('你好');
  eq(uni.__string[0], 0xfe, 'non-Latin-1 text gets a UTF-16BE BOM (first byte)');
  eq(uni.__string[1], 0xff, 'non-Latin-1 text gets a UTF-16BE BOM (second byte)');
  eq(uni.__string.length, 6, 'two CJK characters occupy BOM plus four bytes');
  eq(decodePdfString(uni.__string), '你好', 'a BOM-prefixed string decodes back');
  eq(decodePdfString(bytesOf('café')), 'café', 'a plain string decodes as Latin-1');
  eq(decodePdfString(pdfString('Round trip').__string), 'Round trip', 'ASCII round-trips');
  const astral = pdfString('\u{1F600}');
  eq(astral.__string.length, 6, 'an astral character becomes a surrogate pair');
  eq(astral.__string[2], 0xd8, 'the high surrogate is written first');

  /* =====================================================================
     6. parsePageRange
     ===================================================================== */
  G('Page ranges');

  deep(parsePageRange('all', 3), [0, 1, 2], '"all" selects every page');
  deep(parsePageRange('ALL', 3), [0, 1, 2], '"all" is case-insensitive');
  deep(parsePageRange('', 3), [0, 1, 2], 'an empty selection means every page');
  deep(parsePageRange(null, 2), [0, 1], 'a null selection means every page');
  deep(parsePageRange('2', 5), [1], 'a single page is zero-based in the result');
  deep(parsePageRange('2-4', 10), [1, 2, 3], 'a range is inclusive at both ends');
  deep(parsePageRange('4-2', 10), [1, 2, 3], 'a reversed range is normalised');
  deep(parsePageRange('8-', 10), [7, 8, 9], 'an open-ended range runs to the last page');
  deep(parsePageRange('-3', 10), [0, 1, 2], 'a leading dash counts from page one');
  deep(parsePageRange('1,5', 10), [0, 4], 'a comma-separated list works');
  deep(parsePageRange('1;5', 10), [0, 4], 'a semicolon also separates');
  deep(parsePageRange('3 - 4', 10), [2, 3], 'spaces around a dash are tolerated');
  deep(parsePageRange('1, 5', 10), [0, 4], 'a space after a comma is tolerated');
  deep(parsePageRange('5,1,3', 10), [4, 0, 2], 'the typed order is preserved');
  deep(parsePageRange('1,1,2', 10), [0, 0, 1], 'a repeated page is kept twice');
  deep(parsePageRange('8-99', 10), [7, 8, 9], 'a range beyond the end is clamped');
  deep(parsePageRange('2-3,7', 10), [1, 2, 6], 'ranges and singles combine');
  throwsSync(() => parsePageRange('abc', 10), 'a non-numeric selection is rejected', /not a valid page selection/);
  throwsSync(() => parsePageRange('99', 10), 'a selection past the end matches nothing', /matches no pages/);
  throwsSync(() => parsePageRange('0', 10), 'page zero matches nothing', /matches no pages/);

  /* =====================================================================
     7. Text metrics
     ===================================================================== */
  G('Text metrics');

  eq(textWidth('', 'Helvetica', 12), 0, 'an empty string has no width');
  near(textWidth('i', 'Helvetica', 1000), 222, 0.01, 'Helvetica "i" is 222 units');
  near(textWidth('W', 'Helvetica', 1000), 944, 0.01, 'Helvetica "W" is 944 units');
  near(textWidth('AB', 'Helvetica', 1000), 667 + 667, 0.01, 'widths of adjacent glyphs add');
  near(textWidth('Hello', 'Helvetica', 20), textWidth('Hello', 'Helvetica', 10) * 2, 1e-9,
    'width scales linearly with font size');
  ok(textWidth('Hello', 'Helvetica-Bold', 12) > textWidth('Hello', 'Helvetica', 12),
    'bold is wider than regular');
  near(textWidth('iiii', 'Courier', 1000), 2400, 0.01, 'Courier is monospaced at 600 units');
  near(textWidth('WWWW', 'Courier', 1000), 2400, 0.01, 'every Courier glyph is the same width');
  near(textWidth('X', 'NoSuchFont', 1000), textWidth('X', 'Helvetica', 1000), 1e-9,
    'an unknown font falls back to Helvetica');
  near(textWidth('—', 'Helvetica', 1000), 1000, 0.01, 'the em dash is measured');
  near(textWidth('–', 'Helvetica', 1000), 556, 0.01, 'the en dash is measured');
  near(textWidth('’', 'Helvetica', 1000), 222, 0.01, 'the right single quote is measured');
  near(textWidth('“', 'Helvetica', 1000), 333, 0.01, 'the left double quote is measured');
  near(textWidth('…', 'Helvetica', 1000), 1000, 0.01, 'the ellipsis is measured');
  ok(FONTS.Helvetica && FONTS['Helvetica-Bold'] && FONTS['Times-Roman'] && FONTS.Courier,
    'all four base-14 faces are exposed');

  /* =====================================================================
     8. Wrapping
     ===================================================================== */
  G('Wrapping');

  deep(wrapText('one two', 'Helvetica', 12, 10000), ['one two'], 'text that fits stays on one line');
  const wrapped = wrapText('aaa bbb ccc ddd eee fff', 'Helvetica', 12, 60);
  ok(wrapped.length > 1, 'text wider than the column is broken');
  ok(wrapped.every(l => textWidth(l, 'Helvetica', 12) <= 60 || !l.includes(' ')),
    'no wrapped line exceeds the column unless it is a single word');
  deep(wrapText('a\n\nb', 'Helvetica', 12, 500), ['a', '', 'b'], 'a blank line is preserved');
  deep(wrapText('l1\nl2', 'Helvetica', 12, 500), ['l1', 'l2'], 'explicit newlines split lines');
  const longWord = wrapText('unbreakableverylongtoken', 'Helvetica', 12, 10);
  eq(longWord.length, 1, 'an over-long single word is not split');
  eq(longWord[0], 'unbreakableverylongtoken', 'an over-long word is emitted intact');
  deep(wrapText('', 'Helvetica', 12, 100), [''], 'empty input yields one empty line');
  ok(wrapText('a  b', 'Helvetica', 12, 500)[0] === 'a b', 'runs of whitespace collapse');
  eq(wrapText('word '.repeat(200), 'Helvetica', 11, 400).length > 1, true,
    'a long paragraph wraps to several lines');

  /* =====================================================================
     9. WinAnsi content escaping
     ===================================================================== */
  G('WinAnsi escaping');

  eq(contentEscape('plain'), 'plain', 'plain ASCII passes through');
  eq(contentEscape('a(b'), 'a\\(b', 'an opening parenthesis is escaped');
  eq(contentEscape('a)b'), 'a\\)b', 'a closing parenthesis is escaped');
  eq(contentEscape('a\\b'), 'a\\\\b', 'a backslash is escaped');
  eq(contentEscape('‘'), '\\221', 'the left single quote maps to WinAnsi 0x91');
  eq(contentEscape('’'), '\\222', 'the right single quote maps to WinAnsi 0x92');
  eq(contentEscape('“'), '\\223', 'the left double quote maps to WinAnsi 0x93');
  eq(contentEscape('”'), '\\224', 'the right double quote maps to WinAnsi 0x94');
  eq(contentEscape('–'), '\\226', 'the en dash maps to WinAnsi 0x96');
  eq(contentEscape('—'), '\\227', 'the em dash maps to WinAnsi 0x97');
  eq(contentEscape('…'), '\\205', 'the ellipsis maps to WinAnsi 0x85');
  eq(contentEscape('€'), '\\200', 'the euro sign maps to WinAnsi 0x80');
  eq(contentEscape('•'), '\\225', 'the bullet maps to WinAnsi 0x95');
  eq(contentEscape('™'), '\\231', 'the trademark sign maps to WinAnsi 0x99');
  eq(contentEscape('é'), '\\351', 'an accented Latin-1 character is written octal');
  eq(contentEscape('−'), '-', 'the minus sign falls back to a hyphen');
  eq(contentEscape('‐'), '-', 'the hyphen character falls back to a hyphen');
  eq(contentEscape(' '), ' ', 'a non-breaking space falls back to a space');
  eq(contentEscape(' '), ' ', 'a thin space falls back to a space');
  eq(contentEscape('­'), '', 'a soft hyphen is dropped');
  eq(contentEscape('′'), "'", 'the prime falls back to an apostrophe');
  eq(contentEscape('a\tb'), 'a b', 'a control character becomes a space');
  eq(contentEscape('你'), '?', 'an unrepresentable CJK glyph becomes a question mark');
  eq(contentEscape('م'), '?', 'an unrepresentable Arabic glyph becomes a question mark');
  ok(!contentEscape('‘q’ — … €').includes('?'),
    'a realistic word-processor paste survives with no question marks');

  /* =====================================================================
     10. Writer
     ===================================================================== */
  G('Writer');

  const w = new PDFWriter();
  eq(w.serialiseValue(null), 'null', 'null serialises');
  eq(w.serialiseValue(true), 'true', 'true serialises');
  eq(w.serialiseValue(false), 'false', 'false serialises');
  eq(w.serialiseValue(42), '42', 'an integer serialises without a decimal point');
  eq(w.serialiseValue(1.5), '1.5', 'a real serialises');
  eq(w.serialiseValue(Infinity), '0', 'a non-finite number serialises as zero');
  eq(w.serialiseValue(new Name('Type')), '/Type', 'a Name serialises with a slash');
  eq(w.serialiseValue(new Name('A B')), '/A#20B', 'a space in a Name is hex-escaped');
  eq(w.serialiseValue(new Name('A/B')), '/A#2fB', 'a slash in a Name is hex-escaped');
  eq(w.serialiseValue(new Ref(4, 0)), '4 0 R', 'a Ref serialises');
  eq(w.serialiseValue([1, new Name('X')]), '[1 /X]', 'an array serialises');
  eq(w.serialiseValue({ A: 1 }), '<</A 1>>', 'a dictionary serialises');
  eq(w.serialiseValue({ A: undefined, B: 2 }), '<</B 2>>', 'undefined dictionary entries are dropped');
  eq(w.serialiseValue({ __string: bytesOf('hi') }), '(hi)', 'a string object serialises in parentheses');
  eq(w.serialiseValue({ __string: bytesOf('a)b') }), '(a\\)b)', 'a parenthesis inside a string is escaped');
  eq(w.serialiseValue({ __raw: '/Custom' }), '/Custom', 'a raw value is passed through');

  const w2 = new PDFWriter();
  const cat = w2.alloc();
  eq(cat, 1, 'the first allocated object number is 1');
  const added = w2.add({ Type: new Name('Test') });
  eq(added, 2, 'add allocates the next object number');
  w2.set(cat, { Type: new Name('Catalog') });
  const built = latin1(w2.build(new Ref(cat, 0), null, '1.4'));
  ok(built.startsWith('%PDF-1.4'), 'build honours the requested version');
  ok(built.includes('/Root 1 0 R'), 'the trailer names the catalogue');
  ok(/startxref\s+\d+/.test(built), 'build emits startxref');

  const wStm = new PDFWriter();
  const sRoot = wStm.alloc();
  wStm.set(sRoot, { Type: new Name('Catalog') });
  wStm.add(new PDFStream(Object.create(null), bytesOf('1234567890')));
  ok(latin1(wStm.build(new Ref(sRoot, 0), null, '1.4')).includes('/Length 10'),
    'stream /Length is computed at write time');

  /* =====================================================================
     11. createPDF
     ===================================================================== */
  G('createPDF');

  const simple = createPDF([{ ops: [{ text: 'Hi', x: 72, y: 700, size: 12 }] }], {});
  const simpleStr = latin1(simple);
  ok(simpleStr.startsWith('%PDF-'), 'output begins with the PDF header');
  ok(simpleStr.trimEnd().endsWith('%%EOF'), 'output ends with %%EOF');
  const sxMatch = simpleStr.match(/startxref\s+(\d+)/);
  ok(!!sxMatch, 'output contains startxref');
  eq(simpleStr.slice(Number(sxMatch[1]), Number(sxMatch[1]) + 4), 'xref',
    'startxref points at the xref table');
  ok(simpleStr.includes('/Type /Catalog'), 'a catalogue is written');
  ok(simpleStr.includes('/Type /Pages'), 'a page tree is written');
  ok(simpleStr.includes('/Count 1'), 'the page count is written');
  ok(simpleStr.includes('BT') && simpleStr.includes('Tj') && simpleStr.includes('ET'),
    'a text op emits a BT/Tj/ET block');
  ok(simpleStr.includes('/WinAnsiEncoding'), 'the font is declared as WinAnsi');
  ok(simpleStr.includes('/BaseFont /Helvetica'), 'the default face is Helvetica');
  ok(simpleStr.includes('[0 0 595.28 841.89]'), 'A4 is the default MediaBox');

  const letter = latin1(createPDF([{ ops: [] }], { pageSize: 'letter' }));
  ok(letter.includes('[0 0 612 792]'), 'pageSize letter is honoured');
  const custom = latin1(createPDF([{ size: [200, 300], ops: [] }], {}));
  ok(custom.includes('[0 0 200 300]'), 'an explicit page size overrides the default');
  const threePages = latin1(createPDF([{ ops: [] }, { ops: [] }, { ops: [] }], {}));
  ok(threePages.includes('/Count 3'), 'multiple pages are counted');

  const shapes = latin1(createPDF([{ ops: [
    { rect: [10, 10, 50, 20], fill: '#ff0000' },
    { rect: [10, 40, 50, 20], stroke: '#00ff00', lineWidth: 2 },
    { line: [0, 0, 100, 100], stroke: '#0000ff' }
  ] }], {}));
  ok(shapes.includes('re f'), 'a filled rectangle emits "re f"');
  ok(shapes.includes('re S'), 'a stroked rectangle emits "re S"');
  ok(/1 0 0 rg/.test(shapes), 'a red fill emits the right colour operator');
  ok(/0 1 0 RG/.test(shapes), 'a green stroke emits the right colour operator');
  ok(/m .* l S/.test(shapes), 'a line emits moveto/lineto/stroke');

  const titled = latin1(createPDF([{ ops: [] }], { info: { Title: 'My Doc' } }));
  ok(titled.includes('(My Doc)'), 'the Info title is written');
  ok(titled.includes('/Info'), 'the trailer references the Info dictionary');
  ok(!latin1(createPDF([{ ops: [] }], {})).includes('/Info'),
    'no Info dictionary is written when none is asked for');

  const fonts = latin1(createPDF([{ ops: [
    { text: 'a', x: 0, y: 0, font: 'Times-Roman' },
    { text: 'b', x: 0, y: 0, font: 'Helvetica-Bold' }
  ] }], {}));
  ok(fonts.includes('/BaseFont /Times-Roman'), 'Times is embedded by reference when used');
  ok(fonts.includes('/BaseFont /Helvetica-Bold'), 'Helvetica-Bold is embedded by reference when used');
  ok(fonts.includes('/HelveticaBold'), 'the font resource key strips non-alphanumerics');

  /* centring shifts x left by half the text width */
  const centred = latin1(createPDF([{ ops: [
    { text: 'AAAA', x: 300, y: 100, size: 10, align: 'center' }
  ] }], {}));
  const centredX = Number(/([\d.]+) 100 Td/.exec(centred)[1]);
  near(centredX, 300 - textWidth('AAAA', 'Helvetica', 10) / 2, 0.01,
    'align center offsets by half the text width');
  const right = latin1(createPDF([{ ops: [
    { text: 'AAAA', x: 300, y: 100, size: 10, align: 'right' }
  ] }], {}));
  const rightX = Number(/([\d.]+) 100 Td/.exec(right)[1]);
  near(rightX, 300 - textWidth('AAAA', 'Helvetica', 10), 0.01,
    'align right offsets by the full text width');

  /* =====================================================================
     12. Parsing real documents
     ===================================================================== */
  G('Parsing: classic xref table');

  const classic = await PDFDocument.load(fixture('classic5.pdf'));
  eq(await classic.pageCount(), 5, 'classic5.pdf reports five pages');
  eq(classic.version, '1.3', 'the header version is read');
  ok(classic.objects.size > 5, 'objects were materialised from the xref table');
  ok(!!classic.trailer.Root, 'the trailer names a catalogue');
  eq(classic.warnings.length, 0, 'a healthy document parses without warnings');
  const cPages = await classic.getPages();
  eq(cPages.length, 5, 'getPages returns every page');
  ok(cPages.every(p => p.dict), 'every page has a dictionary');
  ok(cPages.every(p => p.ref instanceof Ref), 'every page kept its object reference');

  G('Parsing: xref stream and object streams');

  const objstm = await PDFDocument.load(fixture('objstm4.pdf'));
  eq(await objstm.pageCount(), 4, 'objstm4.pdf reports four pages');
  ok(latin1(fixture('objstm4.pdf')).includes('/ObjStm'),
    'the fixture really does use object streams');
  ok(objstm.objects.size > 4, 'objects inside the object stream were expanded');
  ok(!!objstm.trailer.Root, 'the xref stream supplied a trailer');

  const many = await PDFDocument.load(fixture('many30.pdf'));
  eq(await many.pageCount(), 30, 'many30.pdf reports thirty pages');

  G('Parsing: geometry and rotation');

  const mixed = await PDFDocument.load(fixture('mixed3.pdf'));
  eq(await mixed.pageCount(), 3, 'mixed3.pdf reports three pages');
  const mPages = await mixed.getPages();
  const boxes = [];
  for (const p of mPages) {
    const b = await mixed.resolve(p.dict.MediaBox || p.inherited.MediaBox);
    boxes.push([Math.round(Number(b[2])), Math.round(Number(b[3]))]);
  }
  deep(boxes[0], [595, 842], 'page 1 is A4 portrait');
  deep(boxes[1], [842, 595], 'page 2 is A4 landscape');
  deep(boxes[2], [612, 792], 'page 3 is US Letter');
  const rot = Number(mPages[1].dict.Rotate !== undefined
    ? mPages[1].dict.Rotate : mPages[1].inherited.Rotate) || 0;
  eq(rot, 90, 'the rotation flag on page 2 is read');

  G('Parsing: metadata');

  const meta = await PDFDocument.load(fixture('meta1.pdf'));
  const info = await meta.getInfo();
  eq(info.Title, 'Confidential Report', 'the Title is read');
  eq(info.Author, 'A Patel', 'the Author is read');
  eq(info.Subject, 'Q3', 'the Subject is read');
  eq(info.Keywords, 'test,pdf', 'the Keywords are read');
  ok(!!info.Producer, 'the Producer is read');
  const noMeta = await PDFDocument.load(createPDF([{ ops: [] }], {}));
  deep(await noMeta.getInfo(), {}, 'a document with no Info yields an empty object');

  G('Parsing: streams and images');

  const withImg = await PDFDocument.load(fixture('withimage.pdf'));
  eq(await withImg.pageCount(), 1, 'withimage.pdf reports one page');
  const iPages = await withImg.getPages();
  const res = await withImg.resolve(iPages[0].dict.Resources || iPages[0].inherited.Resources);
  ok(isDict(res), 'the page has a Resources dictionary');
  const xo = await withImg.resolve(res.XObject);
  ok(isDict(xo), 'the page has an XObject dictionary');
  let foundImage = false, dct = false;
  for (const k of Object.keys(xo)) {
    const x = await withImg.resolve(xo[k]);
    if (x && x.dict && isName(x.dict.Subtype, 'Image')) {
      foundImage = true;
      const f = await withImg.resolve(x.dict.Filter);
      const names = (Array.isArray(f) ? f : [f]).filter(Boolean).map(n2 => n2.name);
      if (names.includes('DCTDecode')) dct = true;
    }
  }
  ok(foundImage, 'the embedded image is found');
  ok(dct, 'the JPEG keeps its DCTDecode filter rather than being inflated');

  const dense = await PDFDocument.load(fixture('dense3.pdf'));
  eq(await dense.pageCount(), 3, 'dense3.pdf reports three pages');
  const dPages = await dense.getPages();
  /* One page's content may be a single stream or an array of them — PyMuPDF
     emits one small stream per insert_text call, so this page has many. */
  const rawContents = await dense.resolve(dPages[0].dict.Contents);
  ok(Array.isArray(rawContents), 'this page splits its content across an array of streams');
  const streams = [];
  for (const c of rawContents) streams.push(await dense.resolve(c));
  ok(streams.every(s => s instanceof PDFStream), 'every content entry resolves to a stream');
  ok(streams.some(s => isName(s.dict.Filter, 'FlateDecode')),
    'the content streams are Flate-compressed');

  const first = streams.find(s => isName(s.dict.Filter, 'FlateDecode'));
  const decoded = await dense.decodeStream(first);
  ok(latin1(decoded) !== latin1(first.raw), 'decodeStream really inflates rather than copying');
  ok((await dense.decodeStream(first)) === decoded, 'a decoded stream is cached on the object');

  /* concatenated, the page must contain text-showing operators (Tj or TJ) */
  let allText = '';
  for (const s of streams) allText += latin1(await dense.decodeStream(s));
  ok(/\bT[jJ]\b/.test(allText), 'the inflated content contains a text-showing operator');
  ok(allText.includes('BT') && allText.includes('ET'), 'the inflated content has text blocks');

  G('Parsing: resilience');

  await throwsAsync(() => PDFDocument.load(bytesOf('this is not a PDF at all')),
    'a file with no PDF header is rejected', /does not begin with a PDF header/);
  await throwsAsync(() => PDFDocument.load(bytesOf('%PDF-1.4\nnothing useful here\n%%EOF')),
    'a file with no catalogue is rejected', /No document catalogue/);

  /* break the startxref pointer: the scanner should still find everything */
  const good = fixture('classic5.pdf');
  const broken = new Uint8Array(good);
  const gs = latin1(good);
  const sxPos = gs.lastIndexOf('startxref');
  const digits = /startxref\s+(\d+)/.exec(gs.slice(sxPos));
  const numPos = gs.indexOf(digits[1], sxPos);
  for (let i = 0; i < digits[1].length; i++) broken[numPos + i] = 0x39; // 999…
  const recovered = await PDFDocument.load(broken);
  eq(await recovered.pageCount(), 5, 'a broken startxref still yields five pages by scanning');
  ok(recovered.objects.size > 5, 'the scanner materialised objects');

  /* encrypted documents must be refused, not half-parsed */
  const encStr = latin1(createPDF([{ ops: [] }], {}))
    .replace('/Root 1 0 R', '/Root 1 0 R /Encrypt 99 0 R');
  await throwsAsync(() => PDFDocument.load(bytesOf(encStr)),
    'an encrypted document is refused outright', /encrypted/i);

  const rt = await PDFDocument.load(createPDF(
    [{ ops: [{ text: 'A', x: 10, y: 10 }] }, { ops: [{ text: 'B', x: 10, y: 10 }] }], {}));
  eq(await rt.pageCount(), 2, 'our own output parses back with the right page count');
  eq(await rt.resolve(new Ref(999, 0)), undefined, 'resolving an unknown reference yields undefined');
  eq(await rt.resolve(42), 42, 'resolving a non-reference returns it unchanged');

  /* =====================================================================
     13. assemble
     ===================================================================== */
  G('Assembly');

  const src5 = await PDFDocument.load(fixture('classic5.pdf'));

  const subset = await PDFDocument.load(
    await assemble([0, 2, 4].map(i => ({ doc: src5, pageIndex: i })), {}));
  eq(await subset.pageCount(), 3, 'assembling three pages produces three pages');

  const reversed = await PDFDocument.load(
    await assemble([4, 3, 2, 1, 0].map(i => ({ doc: src5, pageIndex: i })), {}));
  eq(await reversed.pageCount(), 5, 'reversing keeps every page');

  const dupe = await PDFDocument.load(
    await assemble([{ doc: src5, pageIndex: 0 }, { doc: src5, pageIndex: 0 }], {}));
  eq(await dupe.pageCount(), 2, 'the same page can be used twice');

  const merged = await PDFDocument.load(await assemble([
    ...[0, 1, 2, 3, 4].map(i => ({ doc: src5, pageIndex: i })),
    ...[0, 1, 2, 3].map(i => ({ doc: objstm, pageIndex: i }))
  ], {}));
  eq(await merged.pageCount(), 9,
    'merging a classic-xref document with an object-stream one gives nine pages');

  const rotated = await PDFDocument.load(await assemble(
    [{ doc: src5, pageIndex: 0, rotate: 90 }], {}));
  const rPages = await rotated.getPages();
  eq(Number(rPages[0].dict.Rotate) || 0, 90, 'a rotation is written onto the page');

  const mixedSrc = await PDFDocument.load(fixture('mixed3.pdf'));
  const addRot = await PDFDocument.load(await assemble(
    [{ doc: mixedSrc, pageIndex: 1, rotate: 90 }], {}));
  eq(Number((await addRot.getPages())[0].dict.Rotate) || 0, 180,
    'rotation is additive on a page that is already rotated');
  const wrapRot = await PDFDocument.load(await assemble(
    [{ doc: mixedSrc, pageIndex: 1, rotate: 270 }], {}));
  eq(Number((await wrapRot.getPages())[0].dict.Rotate) || 0, 0,
    'rotation wraps at 360 and is omitted when zero');
  const negRot = await PDFDocument.load(await assemble(
    [{ doc: src5, pageIndex: 0, rotate: -90 }], {}));
  eq(Number((await negRot.getPages())[0].dict.Rotate) || 0, 270,
    'a negative rotation is normalised into 0–359');

  const boxKept = await PDFDocument.load(await assemble(
    [{ doc: mixedSrc, pageIndex: 2 }], {}));
  const keptBox = await boxKept.resolve((await boxKept.getPages())[0].dict.MediaBox);
  deep([Math.round(Number(keptBox[2])), Math.round(Number(keptBox[3]))], [612, 792],
    'the source MediaBox survives assembly');
  ok((await (await PDFDocument.load(await assemble([{ doc: src5, pageIndex: 0 }], {})))
    .getPages())[0].dict.Resources !== undefined,
    'every assembled page carries a Resources entry');

  const withInfo = await PDFDocument.load(await assemble(
    [{ doc: src5, pageIndex: 0 }], { info: { Title: 'Assembled', Author: 'Tester' } }));
  const aInfo = await withInfo.getInfo();
  eq(aInfo.Title, 'Assembled', 'assemble writes the Title it is given');
  eq(aInfo.Author, 'Tester', 'assemble writes the Author it is given');
  const emptyInfo = await PDFDocument.load(await assemble(
    [{ doc: src5, pageIndex: 0 }], { info: { Title: '' } }));
  deep(await emptyInfo.getInfo(), {}, 'blank Info fields are not written');
  deep(await (await PDFDocument.load(await assemble([{ doc: src5, pageIndex: 0 }], {}))).getInfo(),
    {}, 'assembling with no Info strips the source metadata');

  await throwsAsync(() => assemble([], {}), 'assembling nothing is an error', /No pages were selected/);
  await throwsAsync(() => assemble([{ doc: src5, pageIndex: 99 }], {}),
    'assembling only out-of-range pages is an error', /No pages were selected/);

  ok(latin1(await assemble([{ doc: src5, pageIndex: 0 }], {})).startsWith('%PDF-1.7'),
    'assemble writes PDF 1.7 by default');
  ok(latin1(await assemble([{ doc: src5, pageIndex: 0 }], { version: '1.4' })).startsWith('%PDF-1.4'),
    'assemble honours an explicit version');

  /* image data must survive a rebuild byte for byte */
  const imgOut = await assemble([{ doc: withImg, pageIndex: 0 }], {});
  const imgDoc = await PDFDocument.load(imgOut);
  const outRes = await imgDoc.resolve((await imgDoc.getPages())[0].dict.Resources);
  const outXo = await imgDoc.resolve(outRes.XObject);
  let outRaw = null;
  for (const k of Object.keys(outXo)) {
    const x = await imgDoc.resolve(outXo[k]);
    if (x && x.dict && isName(x.dict.Subtype, 'Image')) outRaw = x.raw;
  }
  ok(outRaw && outRaw.length > 0, 'the image survives into the rebuilt document');
  let srcRaw = null;
  for (const k of Object.keys(xo)) {
    const x = await withImg.resolve(xo[k]);
    if (x && x.dict && isName(x.dict.Subtype, 'Image')) srcRaw = x.raw;
  }
  eq(outRaw.length, srcRaw.length, 'the copied image has the same byte length');
  ok(outRaw.every((b, i) => b === srcRaw[i]), 'the copied image is byte-for-byte identical');

  /* overlays: the watermark and page-number path */
  G('Overlays');

  const ov = await assemble([{
    doc: src5, pageIndex: 0,
    overlay: { content: 'q BT /MVRwm 20 Tf (X) Tj ET Q\n', fontKey: 'MVRwm',
               fontName: 'Helvetica-Bold', needsGS: true, opacity: 0.2 }
  }], {});
  const ovDoc = await PDFDocument.load(ov);
  const ovPage = (await ovDoc.getPages())[0];
  ok(Array.isArray(ovPage.dict.Contents), 'an overlay turns Contents into an array');
  eq(ovPage.dict.Contents.length, 2, 'the overlay is appended after the original content');
  const ovRes = await ovDoc.resolve(ovPage.dict.Resources);
  const ovFont = await ovDoc.resolve(ovRes.Font);
  ok(isDict(ovFont) && ovFont.MVRwm !== undefined, 'the overlay font is added to Resources');
  const ovFontDict = await ovDoc.resolve(ovFont.MVRwm);
  ok(isName(ovFontDict.BaseFont, 'Helvetica-Bold'), 'the overlay font uses the requested face');
  ok(isName(ovFontDict.Encoding, 'WinAnsiEncoding'), 'the overlay font is WinAnsi encoded');
  const ovGS = await ovDoc.resolve(ovRes.ExtGState);
  ok(isDict(ovGS) && ovGS.MVRgs !== undefined, 'needsGS adds an ExtGState');
  const gsDict = await ovDoc.resolve(ovGS.MVRgs);
  near(Number(gsDict.ca), 0.2, 1e-9, 'the ExtGState carries the fill opacity');
  near(Number(gsDict.CA), 0.2, 1e-9, 'the ExtGState carries the stroke opacity');
  ok(latin1(ov).includes('/MVRwm 20 Tf'), 'the overlay content stream is present in the output');

  const ovNoGS = await assemble([{
    doc: src5, pageIndex: 0,
    overlay: { content: 'BT /MVRpn 9 Tf (1) Tj ET\n', fontKey: 'MVRpn',
               fontName: 'Helvetica', needsGS: false, opacity: 1 }
  }], {});
  const ovNoGSDoc = await PDFDocument.load(ovNoGS);
  const ovNoGSRes = await ovNoGSDoc.resolve((await ovNoGSDoc.getPages())[0].dict.Resources);
  eq(await ovNoGSDoc.resolve(ovNoGSRes.ExtGState), undefined,
    'no ExtGState is added when needsGS is false');

  /* the original text must still be there under the watermark */
  const ovContents = await ovDoc.resolve(ovPage.dict.Contents[0]);
  const ovOrig = await ovDoc.decodeStream(ovContents);
  ok(latin1(ovOrig).includes('Tj'), 'the original page content is intact beneath the overlay');

  /* =====================================================================
     14. PAGE_SIZES
     ===================================================================== */
  G('Page sizes');

  deep(PAGE_SIZES.a4.map(Math.round), [595, 842], 'A4 is 595 × 842 pt');
  deep(PAGE_SIZES.a5.map(Math.round), [420, 595], 'A5 is 420 × 595 pt');
  deep(PAGE_SIZES.a3.map(Math.round), [842, 1191], 'A3 is 842 × 1191 pt');
  deep(PAGE_SIZES.letter, [612, 792], 'US Letter is 612 × 792 pt');
  deep(PAGE_SIZES.legal, [612, 1008], 'US Legal is 612 × 1008 pt');
  deep(PAGE_SIZES.tabloid, [792, 1224], 'Tabloid is 792 × 1224 pt');
  near(PAGE_SIZES.a3[0], PAGE_SIZES.a4[1], 0.01, 'A3 width equals A4 height');
  near(PAGE_SIZES.a4[0], PAGE_SIZES.a5[1], 0.01, 'A4 width equals A5 height');

  /* ---------------------------------------------------------------- */
  console.log(`\n${'-'.repeat(60)}`);
  console.log(`${pass + fail} assertions   ${pass} passed   ${fail} failed`);
  if (fail) {
    console.log('\nFailures:');
    failures.forEach(f => console.log('  · ' + f));
  }
  console.log();
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('\nSuite crashed:', e && e.stack || e);
  process.exit(1);
});
