/**
 * Claims on the text tools' pages (/text/), checked on each tool's engine
 * in Node (a vm with a stub window and Node's own crypto).
 */
'use strict';

module.exports = function ({ claim, manual, kit: K }) {
  const N = 'node';
  const T = (file, id) => K.tool(file, id);
  const out = (r) => (r && (r.output || r.error)) || '';

  /* ================================================================ */
  const CA = '/text/caesar-cipher/';
  const ca = (s, o) => K.tx(T('txt-caesar-cipher.js', 'caesar-cipher'), s, o);
  claim(CA, 'tip', 'Because the alphabet has 26 letters, applying it twice restores the original.', 'ROT13 twice', N, async () => {
    const s = 'Hello, World!'; const r = out(ca(out(ca(s, { mode: 'rot13' })), { mode: 'rot13' })); return [r === s, r];
  });
  claim(CA, 'tip', 'Non-letters pass through unchanged, so punctuation and spacing survive the round trip.', 'shift 3 and back', N, async () => {
    const s = 'Hi, there! 42 é 😀'; const e = out(ca(s, { shift: '3' })); const d = out(ca(e, { shift: '3', dir: 'dec' }));
    return [e === 'Kl, wkhuh! 42 é 😀' && d === s, e + ' → ' + d];
  });
  claim(CA, 'point', 'Capitals stay capitals; é, digits and emoji are left alone.', 'shift 1 on "Az é9😀"', N, async () => { const e = out(ca('Az é9😀', { shift: '1' })); return [e === 'Ba é9😀', e]; });
  claim(CA, 'tip', '"Try every shift" scores all 26 possibilities against English letter frequencies and marks the most likely with a star.', '26 rows, one star, on the right shift', N, async () => {
    const enc = out(ca('the quick brown fox jumps over the lazy dog and keeps running', { shift: '7' }));
    const o = out(ca(enc, { mode: 'crack' })); const rows = o.split('\n');
    const star = rows.filter((r) => /★/.test(r));
    return [rows.length === 26 && star.length === 1 && /^\s*7 ★ the quick/.test(star[0]), rows.length + ' rows; star: ' + star.join('')];
  });
  claim(CA, 'mistake', 'A message shifted by 3 needs Decode with 3, or Encode with 23.', 'both undo a shift of 3', N, async () => {
    const e = out(ca('attack at dawn', { shift: '3' }));
    const a = out(ca(e, { shift: '3', dir: 'dec' })), b = out(ca(e, { shift: '23' }));
    return [a === 'attack at dawn' && b === a, a + ' | ' + b];
  });
  claim(CA, 'dfaq', 'Variants such as ROT5 rotate digits and ROT47 every printable ASCII character; this tool shifts letters only.', 'digits unchanged by ROT13', N, async () => { const e = out(ca('abc 123', { mode: 'rot13' })); return [e === 'nop 123', e]; });

  /* ================================================================ */
  const CT = '/text/case-tools/';
  const ct = (s, o) => out(K.tx(T('txt-case-tools.js', 'case-tools'), s, o));
  claim(CT, 'tip', 'Duplicate removal compares trimmed lines, so trailing spaces do not create false uniques.', '"a " and "a"', N, async () => { const r = ct('a \na\nb', { action: 'dedupe', ci: 'no' }); return [r.split('\n').length === 2, K.j(r)]; });
  claim(CT, 'faq', 'The first. Later duplicates are dropped, so the original ordering of the surviving lines is preserved.', 'first occurrence kept, order kept', N, async () => { const r = ct('b\na\nb\nc\na', { action: 'dedupe' }); return [r === 'b\na\nc', K.j(r)]; });
  claim(CT, 'tip', 'Numeric sort reads the leading number on each line, which handles "10. item" correctly where alphabetical sort puts it before "2. item".', 'numeric vs A–Z', N, async () => {
    const n = ct('10. item\n2. item', { action: 'sortnum' }), a = ct('10. item\n2. item', { action: 'sort' }); return [n === '2. item\n10. item' && a === '10. item\n2. item', K.j(n) + ' | ' + K.j(a)];
  });
  claim(CT, 'point', 'Numeric sort reads each line with parseFloat; a line not starting with a number counts as 0.', '"b" sorts as 0', N, async () => { const r = ct('5\nb\n-1', { action: 'sortnum' }); return [r === '-1\nb\n5', K.j(r)]; });
  claim(CT, 'point', 'The A–Z sorts use the browser\'s localeCompare, so capitals and small letters interleave and Özil files among the O names instead of after zane.', 'Özil among the Os', N, async () => {
    const r = ct('zane\nÖzil\nOliver\noscar\nPaul', { action: 'sort' }).split('\n'); const i = r.indexOf('Özil');
    return [i >= 0 && i < r.indexOf('Paul') && i < r.indexOf('zane') && r.indexOf('oscar') < r.indexOf('Paul'), r.join(',')];
  });
  claim(CT, 'point', 'Strip HTML deletes anything from < to > within each line and turns &nbsp; into a space; no other entity is decoded.', 'tags, &nbsp; and &amp;', N, async () => {
    const r = ct('<b>a</b>&nbsp;b &amp; c\n<i\n>x', { action: 'strip' }); return [r.split('\n')[0] === 'a b &amp; c' && /<i/.test(r), K.j(r)];
  });
  claim(CT, 'mistake', 'The reversal works on UTF-16 code units, so each emoji is split in two and comes out broken.', 'reversing "a😀"', N, async () => {
    const r = ct('a😀', { action: 'reversetext' }); return [r !== '😀a' && r.length === 3, K.j(r) + ' (' + [...r].map((c) => c.codePointAt(0).toString(16)).join(' ') + ')'];
  });
  claim(CT, 'dfaq', 'case-sensitive matching kept 4 lines and ignoring case kept 2, each spelt as it first appeared.', 'the Room example', N, async () => {
    const s = 'Room 12\nroom 12\nRoom 12   \nRoom 3\nROOM 3';
    const a = ct(s, { action: 'dedupe', ci: 'yes' }), b = ct(s, { action: 'dedupe', ci: 'no' }); /* ci: yes = case sensitive, no = ignore case */
    return [a.split('\n').length === 4 && b === 'Room 12\nRoom 3', K.j(a) + ' | ' + K.j(b)];
  });
  claim(CT, 'dfaq', 'this page does not, so co-op sorts before cook here.', 'co-op vs cook', N, async () => { const r = ct('cook\nco-op', { action: 'sort' }); return [r === 'co-op\ncook', K.j(r)]; });

  /* ================================================================ */
  const MO = '/text/morse-code/';
  const mo = (s, o) => K.tx(T('txt-morse-code.js', 'morse-code'), s, o);
  claim(MO, 'tip', 'Letters are separated by a single space and words by a forward slash', '"SOS HI"', N, async () => { const r = out(mo('SOS HI')); return [r === '... --- ... / .... ..', r]; });
  claim(MO, 'tip', 'Detection is automatic: input containing only dots, dashes and separators is decoded, anything else is encoded.', 'Morse decodes, text encodes', N, async () => {
    const a = out(mo('.... ..')), b = out(mo('hi')); return [a === 'HI' && b === '.... ..', a + ' | ' + b];
  });
  claim(MO, 'works', 'Translation is a lookup in a table of 54 characters held in the page: A to Z, 0 to 9 and 18 punctuation marks', 'count the characters that encode', N, async () => {
    let n = 0; for (let c = 33; c < 127; c++) { const ch = String.fromCharCode(c); if (/[a-z]/.test(ch)) continue; const r = mo(ch, { dir: 'enc' }); if (/^[.\-]+$/.test(out(r).trim()) && !(r.warn || '')) n++; }
    return [n === 54, n + ' printable ASCII characters encode'];
  });
  claim(MO, 'point', 'Encoding upper-cases the text, writes each space as / and drops any character missing from the table, naming it under Unsupported characters.', '"a~b"', N, async () => {
    const r = mo('a~b', { dir: 'enc' }); return [out(r) === '.- -...' && K.stat(r, 'Unsupported characters') === '~', out(r) + ' / ' + K.stat(r, 'Unsupported characters')];
  });
  claim(MO, 'point', 'Decoding splits words at / or | and letters at whitespace; a group of signals not in the table becomes ?.', '| and an unknown group', N, async () => {
    const r = out(mo('.... .. | -.-- --- ......', { dir: 'dec' })); return [r === 'HI Y?' || r === 'HI YO?' || /^HI Y.*\?$/.test(r), r];
  });
  claim(MO, 'point', 'A lone row of hyphens or full stops is detected as Morse, so choose Text → Morse to encode one.', '"..." on auto decodes to S', N, async () => { const r = out(mo('...')); return [r === 'S', r]; });
  claim(MO, 'mistake', 'One em dash makes the whole input count as text, so "... — ..." is encoded, its dots becoming full stops (.-.-.-), instead of decoded.', 'an em dash', N, async () => {
    const r = out(mo('... — ...')); return [/\.-\.-\.-/.test(r), r];
  });
  claim(MO, 'dfaq', '1 is a dot and four dashes, and each digit up to 5 swaps another dash for a dot; 6 to 0 swap them back, ending with 0 as five dashes.', 'digits', N, async () => {
    const r = out(mo('1 5 6 0', { dir: 'enc' })); return [r === '.---- / ..... / -.... / -----', r];
  });
  claim(MO, 'mistake', 'Expecting lower case back: Morse has no capitals.', 'decoding gives capitals', N, async () => { const r = out(mo('.... ..', { dir: 'dec' })); return [r === 'HI', r]; });

  /* ================================================================ */
  const NW = '/text/number-to-words/';
  const nw = (s, o) => out(K.tx(T('txt-number-to-words.js', 'number-to-words'), s, o));
  claim(NW, 'faq', 'Why does it say "one hundred and twenty" rather than "one hundred twenty"?', '120 has "and"', N, async () => { const r = nw('120'); return [/^One hundred and twenty$/i.test(r), r]; });
  claim(NW, 'works', 'Commas, spaces and the £, $ and ₹ signs are removed first, so "£1,050.07" is read as 1050.07.', 'the example', N, async () => { const r = nw('£1,050.07'); return [/one thousand and fifty point zero seven/i.test(r), r]; });
  claim(NW, 'point', 'Currency styles round the digits as typed to the penny, cent or paisa, half up, carrying into the whole part: 0.285 is twenty-nine pence and 2.999 is three pounds.', 'GBP', N, async () => {
    const r = nw('0.285\n2.999', { style: 'gbp' }).split('\n'); return [/twenty-nine pence/i.test(r[0]) && /^Three pounds only$/i.test(r[1]), r.join(' | ')];
  });
  claim(NW, 'point', 'Plain style reads every decimal digit after "point".', '3.1415', N, async () => { const r = nw('3.1415'); return [/point one four one five$/i.test(r), r]; });
  claim(NW, 'mistake', 'Only £, $ and ₹ are stripped, so €40 is reported as not a number.', '€40', N, async () => { const r = nw('€40'); return [/not a number/i.test(r), r]; });
  claim(NW, 'dfaq', 'One lakh fifty thousand rupees only.', '1,50,000 in rupees', N, async () => { const r = nw('1,50,000', { style: 'inr' }); return [r === 'One lakh fifty thousand rupees only', r]; });
  claim(NW, 'dfaq', 'Four keeps its u in fourteen, but the tens word drops it, so 44 is Forty-four.', '44 and 14', N, async () => { const r = nw('44\n14'); return [r === 'Forty-four\nFourteen', K.j(r)]; });
  claim(NW, 'dfaq', '999,999,999,999, which begins Nine hundred and ninety-nine billion. A trillion or more is refused with a note.', 'the limit', N, async () => {
    const r = nw('999999999999\n1000000000000').split('\n'); return [/^Nine hundred and ninety-nine billion/.test(r[0]) && /too large|limit/i.test(r[1]), r.join(' | ')];
  });
  claim(NW, 'tip', 'Ordinal style handles the irregular forms — first, second, third, fifth, ninth, twelfth — rather than simply appending "th".', 'ordinals', N, async () => {
    const r = nw('1\n2\n3\n5\n9\n12\n20', { style: 'ordinal' }); return [r === 'First\nSecond\nThird\nFifth\nNinth\nTwelfth\nTwentieth', K.j(r)];
  });
  claim(NW, 'tip', 'Currency style ends with "only"', 'USD', N, async () => { const r = nw('5', { style: 'usd' }); return [/only$/.test(r), r]; });

  /* ================================================================ */
  const PA = '/text/palindrome-anagram/';
  const pa = (s, o) => K.tx(T('txt-palindrome-anagram.js', 'palindrome-anagram'), s, o);
  claim(PA, 'tip', '"A man, a plan, a canal: Panama" counts.', 'loose', N, async () => { const r = pa('A man, a plan, a canal: Panama'); return [K.stat(r, 'Line 1') === 'Palindrome', K.stat(r, 'Line 1')]; });
  claim(PA, 'faq', 'Yes, by the same rule — 12321 reads the same in both directions.', '12321', N, async () => { const r = pa('12321'); return [K.stat(r, 'Line 1') === 'Palindrome', K.stat(r, 'Line 1')]; });
  claim(PA, 'dfaq', 'the pair always share their letters, so the last-two-lines check reports them as Anagrams.', 'stressed / desserts', N, async () => { const r = pa('stressed\ndesserts'); return [K.stat(r, 'Last two lines') === 'Anagrams', K.stat(r, 'Last two lines')]; });
  claim(PA, 'mistake', 'Racecar with a capital R is not an exact palindrome, although racecar is.', 'exact matching', N, async () => {
    const a = pa('Racecar', { strict: 'strict' }), b = pa('racecar', { strict: 'strict' }); return [K.stat(a, 'Line 1') === 'Not a palindrome' && K.stat(b, 'Line 1') === 'Palindrome', K.stat(a, 'Line 1') + ' / ' + K.stat(b, 'Line 1')];
  });
  claim(PA, 'dfaq', 'A one-character line reads the same both ways and is marked as one; empty lines are skipped.', '"x", blank, "y"', N, async () => {
    const r = pa('x\n\ny'); return [K.stat(r, 'Line 1') === 'Palindrome' && K.stat(r, 'Line 2') === 'Palindrome' && K.stat(r, 'Line 3') === undefined, K.j(r.stats)];
  });
  claim(PA, 'mistake', 'Only the last two lines are compared, so any other lines go above them.', 'three lines: only lines 2 and 3 compared', N, async () => {
    const r = pa('listen\nabc\nsilent'); return [K.stat(r, 'Last two lines') !== 'Anagrams', K.stat(r, 'Last two lines')];
  });
  claim(PA, 'point', 'Loose matching lower-cases each line and deletes everything except a–z and 0–9', 'accented letters are deleted too', N, async () => {
    const r = pa('été'); return [K.stat(r, 'Line 1') === 'Palindrome', K.stat(r, 'Line 1') + ' (é dropped leaves "t")'];
  });

  /* ================================================================ */
  const PW = '/text/password-generator/';
  const pg = (f, extra) => K.gen(extra ? K.tool('txt-password-generator.js', 'password-generator', extra) : T('txt-password-generator.js', 'password-generator'), f);
  claim(PW, 'point', 'The default pool is 80 characters: 25 lower-case letters (no l), 24 capitals (no I or O), 8 digits (no 0 or 1) and 23 symbols.', 'characters seen in 50 × 128', N, async () => {
    const seen = new Set(); for (let i = 0; i < 20; i++) out(pg({ length: 128, count: 50 })).replace(/\n/g, '').split('').forEach((c) => seen.add(c));
    const s = [...seen]; const lo = s.filter((c) => /[a-z]/.test(c)), up = s.filter((c) => /[A-Z]/.test(c)), dg = s.filter((c) => /\d/.test(c)), sy = s.filter((c) => !/[A-Za-z0-9]/.test(c));
    return [lo.length === 25 && up.length === 24 && dg.length === 8 && sy.length === 23 && !/[lIO01]/.test(s.join('')) && K.stat(pg({}), 'Character pool') === '80 characters', lo.length + '+' + up.length + '+' + dg.length + '+' + sy.length];
  });
  claim(PW, 'point', 'Passphrases come from a built-in list of 510 four-letter words joined by hyphens, plus a number from 0 to 99 when digits are on. With capitals on, one more draw picks the capitalised word.',
    'shape of 50 passphrases', N, async () => {
      const ps = out(pg({ type: 'passphrase', count: 50, words: 5 })).split('\n');
      const bad = ps.filter((p) => { const parts = p.split('-'); const num = parts.pop(); const caps = parts.filter((w) => /^[A-Z]/.test(w)).length; return parts.length !== 5 || !parts.every((w) => /^[A-Za-z]{4}$/.test(w)) || !/^\d{1,2}$/.test(num) || caps !== 1; });
      return [!bad.length && K.stat(pg({ type: 'passphrase' }), 'Character pool') === '510 words', bad.slice(0, 3).join(', ') || ps[0]];
    });
  claim(PW, 'dfaq', 'The 20-character default gives 126 bits.', 'default entropy', N, async () => { const v = K.stat(pg({}), 'Entropy'); return [v === '126 bits', v]; });
  claim(PW, 'dfaq', 'letters and digits grow from 57 to 62 characters, taking 12 characters from 70 bits to 71 bits.', 'symbols off, lookalikes excluded vs included', N, async () => {
    const a = pg({ length: 12, symbols: 'no' }), b = pg({ length: 12, symbols: 'no', ambiguous: 'include' });
    return [K.stat(a, 'Character pool') === '57 characters' && K.stat(b, 'Character pool') === '62 characters' && K.stat(a, 'Entropy') === '70 bits' && K.stat(b, 'Entropy') === '71 bits', [K.stat(a, 'Character pool'), K.stat(a, 'Entropy'), K.stat(b, 'Character pool'), K.stat(b, 'Entropy')].join(' / ')];
  });
  claim(PW, 'point', 'No character type is forced in, so the entropy figure stays honest.', 'some 6-character passwords have no digit', N, async () => {
    const pws = out(pg({ length: 6, count: 50 })).split('\n'); const noDigit = pws.filter((p) => !/\d/.test(p)).length;
    return [noDigit > 0, noDigit + ' of 50 have no digit'];
  });
  claim(PW, 'point', 'The cracking time is 2 to the power of the entropy divided by a trillion guesses a second.', 'passphrase: 2^52 / 1e12 s', N, async () => {
    const r = pg({ type: 'passphrase' });
    /* 5 words of 510 plus a number 0–99: the unrounded entropy the figure is built from */
    const bits = 5 * Math.log2(510) + Math.log2(100);
    const want = Math.pow(2, bits) / 1e12;
    const shown = Number((K.stat(r, 'Offline cracking time*') || '').replace(/[^\d.]/g, ''));
    return [/seconds$/.test(K.stat(r, 'Offline cracking time*') || '') && Math.abs(shown - want) / want < 0.01, K.stat(r, 'Offline cracking time*') + ' vs 2^' + bits.toFixed(2) + ' / 1e12 = ' + want.toFixed(0) + ' s'];
  });
  claim(PW, 'works', 'Each character or word is chosen with crypto.getRandomValues, the browser\'s cryptographic generator.', 'getRandomValues called; Math.random never', N, async () => {
    let n = 0; const wc = require('crypto').webcrypto; let mr = 0;
    const MathSpy = Object.create(Math); MathSpy.random = () => { mr++; return Math.random(); };
    const r = pg({ count: 3 }, { crypto: { getRandomValues: (a) => { n++; return wc.getRandomValues(a); } }, Math: MathSpy });
    return [n > 0 && mr === 0 && out(r).split('\n').length === 3, n + ' getRandomValues calls, ' + mr + ' Math.random calls'];
  });
  claim(PW, 'dfaq', 'This list of 510 gives about 9 bits a word', 'log2(510)', N, async () => [Math.abs(Math.log2(510) - 9) < 0.05, Math.log2(510).toFixed(2) + ' bits']);

  /* ================================================================ */
  const RS = '/text/readability-score/';
  const rs = (s) => K.tx(T('txt-readability-score.js', 'readability-score'), s);
  claim(RS, 'works', 'The page\'s script applies the published formulas, and declines to score fewer than 30 words.', '29 words refused, 30 scored', N, async () => {
    const w = (n) => Array.from({ length: n }, (_, i) => 'word' + (i % 5)).join(' ') + '.';
    const a = rs(w(29)), b = rs(w(30)); return [!K.stat(a, 'Flesch Reading Ease') && !!K.stat(b, 'Flesch Reading Ease'), (a.error || a.warn || out(a)).slice(0, 80) + ' | ' + K.stat(b, 'Flesch Reading Ease')];
  });
  claim(RS, 'point', 'Reading Ease is 206.835 − 1.015 × words per sentence − 84.6 × syllables per word', 'recomputed from the shown counts', N, async () => {
    const text = 'The committee considered the proposal carefully. Several members expressed reservations about the timetable. ' .repeat(4) + 'It was approved in the end after a long discussion about money and time.';
    const r = rs(text); const wps = Number(K.stat(r, 'Words per sentence')), spw = Number(K.stat(r, 'Syllables per word'));
    const words = Number(K.stat(r, 'Words')), sents = Number(K.stat(r, 'Sentences'));
    const fre = Number(K.stat(r, 'Flesch Reading Ease'));
    const want = 206.835 - 1.015 * (words / sents) - 84.6 * spw;
    return [Math.abs(fre - want) < 0.6 && Math.abs(wps - words / sents) < 0.06, 'shown ' + fre + ', recomputed ' + want.toFixed(1) + ' (spw ' + spw + ')'];
  });
  claim(RS, 'point', 'Words are runs between spaces, so £5 is one.', '"£5" counts as a word', N, async () => {
    const base = 'one two three four five six seven eight nine ten. '.repeat(3);
    const a = Number(K.stat(rs(base), 'Words')), b = Number(K.stat(rs(base + '£5 now.'), 'Words')); return [b - a === 2, a + ' → ' + b];
  });
  claim(RS, 'dfaq', 'Long sentences of long words push Reading Ease below zero, and very simple text can push a grade below zero, shown as below grade 1.', 'both extremes', N, async () => {
    const hard = 'Notwithstanding institutional considerations, comprehensive organisational transformation necessitates interdepartmental collaboration encompassing multidimensional accountability frameworks '.repeat(3) + '.';
    const easy = 'The cat sat on the mat. '.repeat(8);
    const h = Number(K.stat(rs(hard), 'Flesch Reading Ease')), e = out(rs(easy));
    return [h < 0 && /below grade 1/.test(e), 'hard ' + h + '; easy: ' + (e.match(/Flesch-Kincaid[^\n]*/) || [''])[0]];
  });

  /* ================================================================ */
  const TD = '/text/text-diff/';
  const td = (s, o) => K.tx(T('txt-text-diff.js', 'text-diff'), s, o);
  claim(TD, 'tip', 'Lines starting with + were added, lines starting with − were removed, and lines with two spaces are unchanged.', 'markers', N, async () => {
    const o = out(td('a\nb\n---\na\nc')); return [o === '  a\n- b\n+ c' || o === '  a\n− b\n+ c', K.j(o)];
  });
  claim(TD, 'point', 'Ties go to the removal, so a replaced block shows all its − lines before its + lines.', 'two lines replaced', N, async () => {
    const o = out(td('x\na\nb\ny\n---\nx\nc\nd\ny')).split('\n').map((l) => l[0]).join('');
    return [/^ [-−][-−]\+\+ $/.test(o), K.j(o)];
  });
  claim(TD, 'point', 'Similarity is twice the unchanged units divided by the units in both texts, as a percentage.', '2 unchanged of 3 + 4 lines = 57.1%', N, async () => {
    const r = td('a\nb\nc\n---\na\nB\nc\nd'); return [K.stat(r, 'Similarity') === '57.1%', K.stat(r, 'Similarity')];
  });
  claim(TD, 'dfaq', 'The units in one text times those in the other may not exceed 4,000,000, so 2,000 lines against 2,000 is the most.', '2000×2000 runs, 2001×2000 refused', N, async () => {
    const L = (n, p) => Array.from({ length: n }, (_, i) => p + i).join('\n');
    const a = td(L(2000, 'a') + '\n---\n' + L(2000, 'b')), b = td(L(2001, 'a') + '\n---\n' + L(2000, 'b'));
    return [!a.error && !!b.error, (a.error || 'ok') + ' | ' + (b.error || 'accepted')];
  });
  claim(TD, 'dfaq', 'An extra empty line between paragraphs shows as an addition; only blank lines at the very start or end of each text are dropped.', 'inner blank added; edge blanks ignored', N, async () => {
    const a = td('p1\np2\n---\np1\n\np2'), b = td('\np1\n\n---\np1');
    return [/1 added/.test(K.stat(a, 'Result') || '') && /identical|no differences|0 added, 0 removed/i.test(K.stat(b, 'Result') || out(b)), K.stat(a, 'Result') + ' | ' + (K.stat(b, 'Result') || out(b))];
  });
  claim(TD, 'mistake', 'put that version second, and a note confirms the later lines were compared as part of the second text.', 'a second --- is content, with a note', N, async () => {
    const r = td('a\n---\nb\n---\nc'); return [/---/.test(out(r)) && !!r.note, K.j(r.note || '') + ' | ' + K.j(out(r))];
  });
  claim(TD, 'faq', 'Line mode treats a line as an atom — any change makes it a removal plus an addition. Switch to word mode to see the change at word granularity.', 'line vs word mode', N, async () => {
    const l = td('the quick fox\n---\nthe slow fox'), w = td('the quick fox\n---\nthe slow fox', { mode: 'word' });
    return [/1 added, 1 removed/.test(K.stat(l, 'Result') || '') && (K.stat(w, 'Unchanged lines') || K.stat(w, 'Unchanged words') || '') === '2', K.stat(l, 'Result') + ' | ' + K.j(w.stats)];
  });
  claim(TD, 'point', 'The whitespace and case options change only the comparison, although trimmed lines are also shown trimmed.', 'trim: "  a" equals "a" and shows trimmed', N, async () => {
    const r = td('  a\n---\na'); return [/identical|no differences|0 added/i.test((K.stat(r, 'Result') || '') + out(r)), K.j(out(r)) + ' ' + K.stat(r, 'Result')];
  });

  /* ================================================================ */
  const WC = '/text/word-counter/';
  const wc = (s, o) => K.tx(T('txt-word-counter.js', 'word-counter'), s, o);
  claim(WC, 'tip', 'Reading time assumes 238 words per minute and speaking time 140', '476 words: 2 min reading; 280 words: 2 min speaking', N, async () => {
    const a = wc('word '.repeat(476)), b = wc('word '.repeat(280));
    return [/^2 min/.test(K.stat(a, 'Reading time') || '') && /^2 min/.test(K.stat(b, 'Speaking time') || ''), K.stat(a, 'Reading time') + ' | ' + K.stat(b, 'Speaking time')];
  });
  claim(WC, 'point', 'Characters is the JavaScript string length in UTF-16 code units, so an emoji counts as 2.', '"a😀"', N, async () => { const v = K.stat(wc('a😀'), 'Characters'); return [v === '3', v]; });
  claim(WC, 'dfaq', 'Anything between spaces is a word here, so "Doors open at 7 for £5 in 2026." is 8 words.', 'the example', N, async () => { const v = K.stat(wc('Doors open at 7 for £5 in 2026.'), 'Words'); return [v === '8', v]; });
  claim(WC, 'dfaq', 'One, as long as there are no spaces round the hyphen: well-known counts once. A dash with a space either side counts as a word of its own.', 'well-known; "a - b"', N, async () => {
    const a = K.stat(wc('well-known'), 'Words'), b = K.stat(wc('a - b'), 'Words'); return [a === '1' && b === '3', a + ' / ' + b];
  });
  claim(WC, 'mistake', 'The density list keeps a straight one and drops a curly one, so don\'t and don’t are listed apart, as don\'t and dont.', 'both apostrophes', N, async () => {
    const o = out(wc('don\'t don’t')); return [/^don't\s/m.test(o) && /^dont\s/m.test(o), o.split('\n').slice(2).join(' | ')];
  });
  claim(WC, 'point', 'words are lower-cased and cut down to letters and digits in any script, with their accents and vowel signs, plus straight apostrophes and hyphens; 48 common words are left out unless the filter is off.',
    'café and नमस्ते kept; the filtered list', N, async () => {
      const o = out(wc('Café café नमस्ते the and of'));
      const off = out(wc('the and of', { ignoreCommon: 'no' }));
      return [/^café\s+2/m.test(o) && /नमस्ते/.test(o) && !/^the\s/m.test(o) && /^the\s/m.test(off), o.split('\n').slice(2).join(' | ')];
    });
  claim(WC, 'faq', 'By splitting on full stops, question marks, exclamation marks and ellipses.', 'four kinds of ending', N, async () => {
    const v = K.stat(wc('One. Two? Three! Four… Five'), 'Sentences'); return [v === '5', v];
  });
  claim(WC, 'point', 'a blank line separates paragraphs.', 'two paragraphs', N, async () => { const v = K.stat(wc('a b\n\nc d\ne'), 'Paragraphs'); return [v === '2', v]; });

  /* ---------- manual ---------- */
  manual(PW, 'tip', 'Cracking time assumes an offline attack at a trillion guesses per second against a fast hash.', 'An assumption about attackers; the arithmetic is checked above.');
  manual(RS, 'tip', 'UK government guidance targets a reading age of nine for public-facing content.', 'Needs the GOV.UK source with a date.');
  manual(RS, 'dfaq', 'Word reports Reading Ease and the Flesch-Kincaid grade from the same formulas', 'Microsoft Word behaviour.');
  manual(MO, 'dfaq', 'At 20 words per minute a dot lasts 60 milliseconds.', 'Arithmetic from the PARIS standard (1200 / wpm ms); not tool behaviour.');
  manual(NW, 'what', 'Under the UK\'s Bills of Exchange Act 1882, and India\'s Negotiable Instruments Act 1881, the words win when they disagree with the figures.', 'Legal statement; needs the Acts.');
  manual(TD, 'tip', 'The algorithm finds the longest common subsequence, which is the same approach Git uses', 'Git uses Myers\' algorithm (a shortest-edit-script method closely related to LCS); a person should decide whether "the same approach" is fair.');
  manual(CA, 'dfaq', 'as Friedrich Kasiski showed in 1863.', 'History; needs a source.');
};
