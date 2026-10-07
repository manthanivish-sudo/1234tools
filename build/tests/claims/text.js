/**
 * Claims on the text tools' pages (/text/), checked on each tool's engine
 * in Node (a vm with a stub window and Node's own crypto).
 */
'use strict';

module.exports = function ({ claim, manual, kit: K }) {
  const N = 'node', B = 'browser';
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
  claim(NW, 'point', 'American English drops the and inside a number, and the US cheque style writes cents as a fraction: 1234.56 becomes One thousand two hundred thirty-four and 56/100 dollars.',
    'British and American forms of five amounts, written out by hand', N, async () => {
      const UK = ['One hundred and twenty', 'One million and five', 'Two thousand and one', 'Nine hundred and ninety-nine', 'Forty-two'];
      const US = ['One hundred twenty', 'One million five', 'Two thousand one', 'Nine hundred ninety-nine', 'Forty-two'];
      const a = nw('120\n1000005\n2001\n999\n42').split('\n'), b = nw('120\n1000005\n2001\n999\n42', { dialect: 'us' }).split('\n');
      const c = nw('1234.56\n120\n0.5\n7.005', { style: 'cheque', dialect: 'us' }).split('\n');
      const C = ['One thousand two hundred thirty-four and 56/100 dollars', 'One hundred twenty and 00/100 dollars', 'Zero and 50/100 dollars', 'Seven and 01/100 dollars'];
      return [K.j(a) === K.j(UK) && K.j(b) === K.j(US) && K.j(c) === K.j(C), K.j(b) + ' | ' + K.j(c)];
    });
  claim(NW, 'tip', 'US cheque style writes the cents as a fraction, One thousand two hundred thirty-four and 56/100 dollars, the form printed on American checks', 'the tip\'s amount', N, async () => {
    const r = nw('1,234.56', { style: 'cheque', dialect: 'us' }); return [r === 'One thousand two hundred thirty-four and 56/100 dollars', r];
  });
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
  const pwWords = () => K.read('build/wordlist/words.txt').toString('utf8').split('\n').filter(Boolean);
  claim(PW, 'point', 'The default pool is 80 characters: 25 lower-case letters (no l), 24 capitals (no I or O), 8 digits (no 0 or 1) and 23 symbols.', 'characters seen in 50 × 128', N, async () => {
    const seen = new Set(); for (let i = 0; i < 20; i++) out(pg({ length: 128, count: 50 })).replace(/\n/g, '').split('').forEach((c) => seen.add(c));
    const s = [...seen]; const lo = s.filter((c) => /[a-z]/.test(c)), up = s.filter((c) => /[A-Z]/.test(c)), dg = s.filter((c) => /\d/.test(c)), sy = s.filter((c) => !/[A-Za-z0-9]/.test(c));
    return [lo.length === 25 && up.length === 24 && dg.length === 8 && sy.length === 23 && !/[lIO01]/.test(s.join('')) && K.stat(pg({}), 'Character pool') === '80 characters', lo.length + '+' + up.length + '+' + dg.length + '+' + sy.length];
  });
  claim(PW, 'point', 'Rejection sampling keeps it unbiased: a 32-bit draw in the top slice not divisible by the pool size is redrawn. The cracking time is 2 to the power of the entropy divided by a trillion guesses a second.',
    'ten digits over 128,000 draws are level (chi-square); the passphrase time is 2^bits / 1e12', N, async () => {
      const counts = new Array(10).fill(0);
      for (let i = 0; i < 20; i++) out(pg({ length: 128, count: 50, lower: 'no', upper: 'no', symbols: 'no', ambiguous: 'include', cover: 'no' })).replace(/\n/g, '').split('').forEach((c) => counts[Number(c)]++);
      const total = counts.reduce((a, b) => a + b, 0), exp = total / 10, chi = counts.reduce((a, c) => a + (c - exp) * (c - exp) / exp, 0);
      const r = pg({ type: 'passphrase' });
      const bits = 5 * Math.log2(pwWords().length) + Math.log2(100) + Math.log2(5);
      const want = Math.pow(2, bits) / 1e12 / 31557600, shown = Number((K.stat(r, 'Offline cracking time*') || '').replace(/[^\d.]/g, ''));
      return [total === 128000 && chi < 27.9 && /years$/.test(K.stat(r, 'Offline cracking time*') || '') && Math.abs(shown - want) / want < 0.01, 'chi-square ' + chi.toFixed(1) + ' (limit 27.9); ' + K.stat(r, 'Offline cracking time*') + ' vs ' + want.toFixed(0) + ' years'];
    });
  claim(PW, 'point', 'With Guarantee on, a password is redrawn until it holds every kind you chose, so each valid one is equally likely; the entropy is the log2 of how many there are.',
    'every password of 6 over three kinds has all three; the count and the chance of a digit first match a dynamic-programming count', N, async () => {
      const f = { length: 6, lower: 'no', upper: 'yes', digits: 'yes', symbols: 'yes', count: 50 };
      const sizes = [24, 8, 23], len = 6;
      /* strings of length 6 over the 55 characters that use every kind, counted by a table over subsets of kinds */
      let dp = new Map([[0, 1n]]);
      for (let i = 0; i < len; i++) { const nx = new Map(); for (const [mask, c] of dp) for (let k = 0; k < 3; k++) { const m = mask | (1 << k); nx.set(m, (nx.get(m) || 0n) + c * BigInt(sizes[k])); } dp = nx; }
      const valid = dp.get(7);
      const bits = Math.log2(Number(valid));
      /* the same table with the first character forced to be a digit */
      let dp2 = new Map([[2, 8n]]);
      for (let i = 1; i < len; i++) { const nx = new Map(); for (const [mask, c] of dp2) for (let k = 0; k < 3; k++) { const m = mask | (1 << k); nx.set(m, (nx.get(m) || 0n) + c * BigInt(sizes[k])); } dp2 = nx; }
      const p = Number(dp2.get(7)) / Number(valid);
      let all = 0, digitFirst = 0, n = 0;
      for (let t = 0; t < 120; t++) out(pg(f)).split('\n').forEach((s) => { n++; if (/[A-HJ-NP-Z]/.test(s) && /[2-9]/.test(s) && /[^A-Za-z0-9]/.test(s)) all++; if (/[2-9]/.test(s[0])) digitFirst++; });
      const sd = Math.sqrt(n * p * (1 - p));
      return [all === n && Math.abs(digitFirst - n * p) < 4 * sd && K.stat(pg(f), 'Entropy') === Math.round(bits) + ' bits', 'valid strings ' + valid + ' (' + bits.toFixed(2) + ' bits); digit first ' + digitFirst + ' of ' + n + ', expected ' + (n * p).toFixed(0) + ' ± ' + sd.toFixed(0)];
    });
  claim(PW, 'point', 'Passphrases come from a built-in list of 5,229 words written for this site, joined as you choose, with a number from 0 to 99 and one capitalised word by default.',
    'the list file has 5,229 distinct lower-case words of 4–9 letters; 50 passphrases have 5 listed words, one capital and a number', N, async () => {
      const list = pwWords(), set = new Set(list);
      const ps = out(pg({ type: 'passphrase', count: 50 })).split('\n');
      const bad = ps.filter((p) => { const parts = p.split('-'); const num = parts.pop(); const caps = parts.filter((w) => /^[A-Z]/.test(w)).length; return parts.length !== 5 || !parts.every((w) => set.has(w.toLowerCase())) || !/^\d{1,2}$/.test(num) || caps !== 1; });
      return [list.length === 5229 && set.size === 5229 && list.every((w) => /^[a-z]{4,9}$/.test(w)) && !bad.length && K.stat(pg({ type: 'passphrase' }), 'Character pool') === '5229 words', list.length + ' words; ' + (bad.slice(0, 2).join(', ') || ps[0])];
    });
  claim(PW, 'point', 'Pronounceable passwords alternate 17 consonants and 5 vowels, so each character is worth less.', '20 characters alternate consonant, vowel; 17 and 5 letters seen; 69 bits from a hand sum', N, async () => {
    const ps = out(pg({ type: 'pronounce', count: 50, upper: 'no', digits: 'no' })).split('\n');
    const cons = new Set(), vows = new Set();
    ps.forEach((p) => p.split('').forEach((c, i) => (i % 2 ? vows : cons).add(c)));
    const r = pg({ type: 'pronounce' });
    const hand = 10 * Math.log2(17) + 9 * Math.log2(5) + Math.log2(10) + Math.log2(20);
    return [ps.every((p) => /^([bcdfghjkmnprstvwz][aeiou])+$/.test(p) && p.length === 20) && cons.size === 17 && vows.size === 5 && K.stat(r, 'Entropy') === Math.round(hand) + ' bits', cons.size + ' consonants, ' + vows.size + ' vowels; ' + K.stat(r, 'Entropy') + ' vs ' + hand.toFixed(2)];
  });
  claim(PW, 'point', 'Check a password estimates a typed one against common passwords, the word list, sequences and keyboard rows.', 'password, Password123!, abcdefgh, qwerty, aaaaaaaa, a word with digits, and a random one', N, async () => {
    const chk = (t) => pg({ type: 'check', typed: t });
    const bits = (t) => Number((K.stat(chk(t), 'Estimated strength') || '').replace(/\D/g, ''));
    const w = pwWords()[100];
    const ok = bits('password') < 10 && /common/.test(out(chk('Password123!'))) && bits('Password123!') < 28 && /sequence/.test(out(chk('abcdefgh'))) && /keyboard row/.test(out(chk('xqwertyx'))) && /repeat/.test(out(chk('aaaaaaaa'))) && /1 word/.test(out(chk(w + '2024'))) && bits(w + '2024') < 40 && K.stat(chk('Zx9$mQ7!vLp2#'), 'Rating') === 'Very strong' && /no pattern found/.test(out(chk('Zx9$mQ7!vLp2#')));
    return [ok, ['password ' + bits('password'), 'Password123! ' + bits('Password123!'), w + '2024 ' + bits(w + '2024'), 'random ' + bits('Zx9$mQ7!vLp2#')].join(', ')];
  });
  claim(PW, 'tip', 'Check a password shows an estimate, with the guess rates it assumes. It runs in this page and nothing you type is kept or put in a link.', 'Chrome: four rates are listed; the typed text is in no storage and no link; one reload later the box is empty', B, async () => {
    const p = await K.open(PW);
    try {
      await p.evaluate(() => { Object.keys(localStorage).filter((k) => /password/.test(k)).forEach((k) => localStorage.removeItem(k)); });
      await p.reload({ waitUntil: 'load' });
      const secret = 'Zq7-needle-91!';
      const reqs = []; p.on('request', (r) => reqs.push(r.url()));
      await p.evaluate(() => { const t = document.getElementById('f-type'); t.value = 'check'; t.dispatchEvent(new Event('change', { bubbles: true })); });
      await p.evaluate((s) => { const t = document.getElementById('f-typed'); t.value = s; t.dispatchEvent(new Event('input', { bubbles: true })); }, secret);
      await K.sleep(900);
      const r = await p.evaluate((s) => ({
        text: document.querySelector('.code-out').textContent,
        store: JSON.stringify(localStorage) + JSON.stringify(sessionStorage) + document.cookie,
        urls: location.href + [...document.querySelectorAll('a[href]')].map((a) => a.href).join(' '),
        bars: document.querySelectorAll('.pw-bar.on').length, type: document.getElementById('f-typed').type
      }), secret);
      await p.reload({ waitUntil: 'load' });
      await K.sleep(600);
      const after = await p.evaluate(() => ({ typed: (document.getElementById('f-typed') || {}).value, type: document.getElementById('f-type').value }));
      const rates = (r.text.match(/Online|Offline/g) || []).length;
      const leak = (r.store + r.urls + reqs.join(' ')).indexOf('needle') >= 0 || (r.store + r.urls).indexOf(encodeURIComponent(secret)) >= 0;
      return [rates === 4 && !leak && r.type === 'password' && r.bars >= 1 && after.typed === '', rates + ' rates; leak in storage, links or requests: ' + leak + '; field type ' + r.type + '; after reload the box holds ' + JSON.stringify(after.typed)];
    } finally { await p.close(); }
  });
  claim(PW, 'dfaq', 'The 20-character default gives 126 bits.', 'default entropy', N, async () => { const v = K.stat(pg({}), 'Entropy'); return [v === '126 bits', v]; });
  claim(PW, 'dfaq', 'letters and digits grow from 57 to 62 characters, taking 12 characters from 70 bits to 71 bits.', 'symbols off, lookalikes excluded vs included', N, async () => {
    const a = pg({ length: 12, symbols: 'no' }), b = pg({ length: 12, symbols: 'no', ambiguous: 'include' });
    return [K.stat(a, 'Character pool') === '57 characters' && K.stat(b, 'Character pool') === '62 characters' && K.stat(a, 'Entropy') === '70 bits' && K.stat(b, 'Entropy') === '71 bits', [K.stat(a, 'Character pool'), K.stat(a, 'Entropy'), K.stat(b, 'Character pool'), K.stat(b, 'Entropy')].join(' | ')];
  });
  claim(PW, 'works', 'Each character or word is chosen with crypto.getRandomValues, the browser\'s cryptographic generator.', 'getRandomValues called; Math.random never', N, async () => {
    let n = 0; const wc = require('crypto').webcrypto; let mr = 0;
    const MathSpy = Object.create(Math); MathSpy.random = () => { mr++; return Math.random(); };
    const r = pg({ count: 3 }, { crypto: { getRandomValues: (a) => { n++; return wc.getRandomValues(a); } }, Math: MathSpy });
    const noCrypto = pg({ count: 3 }, { crypto: undefined });
    return [n > 0 && mr === 0 && out(r).split('\n').length === 3 && /no cryptographic random source/.test(noCrypto.error || ''), n + ' getRandomValues calls, ' + mr + ' Math.random calls; without crypto: ' + (noCrypto.error || '').slice(0, 40)];
  });
  claim(PW, 'dfaq', 'This list of 5,229 gives about 12.4 bits a word.', 'log2(5229)', N, async () => [pwWords().length === 5229 && Math.abs(Math.log2(5229) - 12.4) < 0.05, Math.log2(5229).toFixed(2) + ' bits']);
  manual(PW, 'faq', 'It was written for this site and is not copied from the EFF, Diceware or any dictionary.', 'Provenance of the list: it was written for this site (build/wordlist/source/, README.txt); a program cannot prove it was not copied. build/gen-passphrase-words.js --check proves the engine carries exactly that list.');

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
  claim(RS, 'tip', 'Long sentences are shaded amber past the limit you set (20 words by default) and red past one and a half times it; words of three or more syllables are underlined; the five hardest sentences are listed first.',
    'a 25-word and a 35-word sentence are amber and red, a short one is not; the underlined words are the 3+ syllable ones; the list starts with the lowest Reading Ease', B, async () => {
      const s25 = 'The committee considered the proposal carefully before it finally agreed that the budget should stay exactly where it was last year.';
      const s35 = 'Because the organisation had never previously attempted anything of this particular size or complexity, the directors asked for a comprehensive independent assessment of every operational dependency before agreeing to any commitment whatsoever.';
      const sh = 'It was fine.';
      const text = [s25, sh, s35].join(' ');
      const p = await K.open(RS);
      try {
        await p.evaluate(() => { Object.keys(localStorage).filter((k) => /readability/.test(k)).forEach((k) => localStorage.removeItem(k)); });
        await p.reload({ waitUntil: 'load' });
        await p.evaluate((t) => { const a = document.querySelector('textarea.code-area'); a.value = t; a.dispatchEvent(new Event('input', { bubbles: true })); }, text);
        await K.sleep(900);
        const r = await p.evaluate(() => ({
          amber: [...document.querySelectorAll('.rs-sent.rs-amber')].map((x) => x.textContent.trim().split(/\s+/).length),
          red: [...document.querySelectorAll('.rs-sent.rs-red')].map((x) => x.textContent.trim().split(/\s+/).length),
          longs: [...document.querySelectorAll('.rs-text .rs-long')].map((x) => x.textContent),
          first: (document.querySelector('.rs-hard li .rs-jump') || {}).textContent || '',
          legend: document.querySelector('.rs-legend').textContent
        }));
        const nw = (x) => x.split(/\s+/).length;
        return [r.amber.join() === String(nw(s25)) && r.red.join() === String(nw(s35)) && r.longs.indexOf('committee') >= 0 && r.longs.indexOf('organisation') >= 0 && r.longs.indexOf('fine.') < 0 && r.first.indexOf('Because the organisation') === 0, K.j(r)];
      } finally { await p.close(); }
    });

  /* ================================================================ */
  const TD = '/text/text-diff/';
  const td = (s, o) => K.tx(T('txt-text-diff.js', 'text-diff'), s, o);
  const tdPage = async (a, b, opts) => {
    const p = await K.open(TD);
    await p.evaluate(() => { Object.keys(localStorage).filter((k) => /text-diff/.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: 'load' });
    await p.evaluate((a, b, o) => {
      for (const k of Object.keys(o || {})) { const s = document.getElementById('f-' + k); s.value = o[k]; s.dispatchEvent(new Event('change', { bubbles: true })); }
      const set = (i, v) => { const t = document.querySelectorAll('.td-ta')[i]; t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); };
      set(0, a); set(1, b);
    }, a, b, opts || {});
    await K.sleep(900);
    return p;
  };
  claim(TD, 'tip', 'In the Differences text, lines starting with + were added, lines starting with − were removed, and lines with a space are unchanged; Download saves it as a unified .diff that git apply and patch read.',
    'the text is a unified diff; GNU patch applies it to the original and gets the changed text; Chrome saves it as text-diff.diff', B, async () => {
      const a = 'one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten', b = 'one\n2\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\neleven';
      const r = td(a + '\n---\n' + b);
      const f = K.write('td-orig.txt', a + '\n'), pf = K.write('td.diff', r.output + '\n');
      require('child_process').execFileSync('patch', [f, pf], { stdio: 'ignore' });
      const patched = require('fs').readFileSync(f, 'utf8');
      const p = await tdPage(a, b);
      try {
        await K.clearDownloads(p); await K.clickText(p, '.tool-io button', /^Download$/);
        await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 30000 });
        const [d] = await K.downloads(p);
        return [patched === b + '\n' && /^--- original\n\+\+\+ changed\n@@ -1,5 \+1,5 @@\n one\n-two\n\+2\n/.test(r.output) && d.name === 'text-diff.diff' && d.bytes.toString('utf8') === r.output, K.j(r.output.split('\n').slice(0, 6)) + ' | patched ok: ' + (patched === b + '\n') + ' | ' + d.name];
      } finally { await p.close(); }
    });
  claim(TD, 'point', 'Myers’ algorithm, the one behind Git, finds the shortest list of removals and additions.', 'on 300 random pairs, the unchanged lines equal the longest common subsequence found by dynamic programming, and the script rebuilds the second text', N, async () => {
    let seed = 41; const rnd = ((a) => (n) => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * n); })(seed);
    const bad = [];
    for (let t = 0; t < 300; t++) {
      const A = Array.from({ length: rnd(25) }, () => 'ab cd'.charAt(rnd(5)) + rnd(4)), B = Array.from({ length: rnd(25) }, () => 'ab cd'.charAt(rnd(5)) + rnd(4));
      const m = A.length, n = B.length; const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
      for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      const r = td(A.join('\n') + '\n---\n' + B.join('\n'), { ws: 'exact' });
      if (!r.diff) { if (m || n) { if (A.join('') !== '' || B.join('') !== '') bad.push('no diff for ' + m + '/' + n); } continue; }
      const same = r.diff.ops.filter((o) => o.t === '=').length;
      const rebuilt = r.diff.ops.map((o) => o.t === '-' ? null : (o.t === '=' ? r.diff.A[o.a] : r.diff.B[o.b])).filter((x) => x !== null);
      const orig = r.diff.ops.map((o) => o.t === '+' ? null : r.diff.A[o.a]).filter((x) => x !== null);
      if (same !== dp[0][0] || rebuilt.join('\n') !== B.join('\n') || orig.join('\n') !== A.join('\n')) bad.push(m + '/' + n + ': ' + same + ' vs ' + dp[0][0]);
    }
    return [bad.length === 0, bad.length ? bad.slice(0, 3).join('; ') : '300 pairs: minimal and correct'];
  });
  claim(TD, 'point', 'Ties go to the removal, so a replaced block shows all its − lines before its + lines. Inside a changed line, the changed words are marked.', 'two lines replaced; in Chrome the changed word is marked in both lines', B, async () => {
    const o = out(td('x\na\nb\ny\n---\nx\nc\nd\ny')).split('\n').filter((l) => /^[ +-]/.test(l) && !/^(---|\+\+\+)/.test(l)).map((l) => l[0]).join('');
    const p = await tdPage('The quick brown fox\njumps over', 'The quick red fox\njumps over');
    try {
      const marks = await p.evaluate(() => ({ del: [...document.querySelectorAll('.td-del-mark')].map((x) => x.textContent), ins: [...document.querySelectorAll('.td-ins-mark')].map((x) => x.textContent) }));
      return [o === ' --++ ' && marks.del.join() === 'brown' && marks.ins.join() === 'red', K.j(o) + ' ' + K.j(marks)];
    } finally { await p.close(); }
  });
  claim(TD, 'point', 'Ignore all whitespace, trim and ignore case change only the comparison; both texts are shown as you wrote them.', '"  a  b" equals "ab" and "A" equals "a" under the options, and the lines are shown untrimmed', N, async () => {
    const all = td('  a  b\n---\nab', { ws: 'all' }), trim = td('  a b\n---\na b'), exact = td('  a b\n---\na b', { ws: 'exact' }), ci = td('A\n---\na', { case: 'insensitive' });
    const shown = td('  x \n---\nx\ny', { ws: 'trim' }).diff;
    return [K.stat(all, 'Result') === 'The two texts are identical' && K.stat(trim, 'Result') === 'The two texts are identical' && /1 added, 1 removed/.test(K.stat(exact, 'Result')) && K.stat(ci, 'Result') === 'The two texts are identical' && shown.A[0] === '  x ',
      K.stat(all, 'Result') + ' | ' + K.stat(exact, 'Result') + ' | ' + K.j(shown.A)];
  });
  claim(TD, 'tip', 'Ignore all whitespace also matches lines that differ only by spaces inside them.', 'a b vs a   b', N, async () => {
    const r = td('a b\n---\na   b', { ws: 'all' }), s = td('a b\n---\na   b'); return [K.stat(r, 'Result') === 'The two texts are identical' && /1 added/.test(K.stat(s, 'Result')), K.stat(r, 'Result') + ' | ' + K.stat(s, 'Result')];
  });
  claim(TD, 'point', 'Similarity is twice the unchanged units divided by the units in both texts, as a percentage.', '2 unchanged of 3 + 4 lines = 57.1%', N, async () => {
    const r = td('a\nb\nc\n---\na\nB\nc\nd'); return [K.stat(r, 'Similarity') === '57.1%', K.stat(r, 'Similarity')];
  });
  claim(TD, 'point', 'The Text view is a unified diff, saved as .diff; Export HTML saves the coloured view.', 'Export HTML in Chrome: one text/html file, no script, both versions inside', B, async () => {
    const p = await tdPage('alpha\nbeta <b>\ngamma', 'alpha\nbeta <i>\ngamma\ndelta');
    try {
      await K.clearDownloads(p); await K.clickText(p, '.tool-io button', /^Export HTML$/);
      await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 30000 });
      const [d] = await K.downloads(p);
      const h = d.bytes.toString('utf8');
      return [/^<!doctype html>/.test(h) && d.name === 'text-diff.html' && !/<script/i.test(h) && /beta &lt;<mark class="d">b<\/mark>&gt;/.test(h) && /<mark class="i">i<\/mark>/.test(h) && /delta/.test(h) && !/https?:\/\//.test(h), d.name + ' ' + h.length + ' bytes, scripts: ' + /<script/i.test(h)];
    } finally { await p.close(); }
  });
  claim(TD, 'tip', 'The merge arrows beside each change copy that change into the other text, in line mode.', 'in Chrome: » puts the original line in the changed box; « puts the changed line in the original', B, async () => {
    const p = await tdPage('one\ntwo\nthree', 'one\n2\nthree');
    try {
      const texts = () => p.evaluate(() => [...document.querySelectorAll('.td-ta')].map((t) => t.value));
      await p.evaluate(() => document.querySelectorAll('.td-arrow')[0].click()); await K.sleep(700);
      const a = await texts();
      await p.evaluate(() => { const t = document.querySelectorAll('.td-ta')[1]; t.value = 'one\n2\nthree'; t.dispatchEvent(new Event('input', { bubbles: true })); }); await K.sleep(700);
      await p.evaluate(() => document.querySelectorAll('.td-arrow')[1].click()); await K.sleep(700);
      const b = await texts();
      return [K.j(a) === K.j(['one\ntwo\nthree', 'one\ntwo\nthree']) && K.j(b) === K.j(['one\n2\nthree', 'one\n2\nthree']), K.j(a) + ' | ' + K.j(b)];
    } finally { await p.close(); }
  });
  claim(TD, 'dfaq', 'Not by line count. A pair that needs more than 3,000 edits to line up is shown as one replaced block between the matching start and end, with a note saying so.', '3,000 different lines each way are shown as a block with the note; a similar 20,000-line pair is diffed exactly', N, async () => {
    const L = (n, p) => Array.from({ length: n }, (_, i) => p + i).join('\n');
    const a = td(L(3000, 'a') + '\n---\n' + L(3000, 'b'));
    const big = Array.from({ length: 20000 }, (_, i) => 'line ' + i), big2 = big.slice(); for (let i = 0; i < 20000; i += 97) big2[i] = 'changed ' + i;
    const c = td(big.join('\n') + '\n---\n' + big2.join('\n'));
    return [/cannot be lined up/.test(a.note || '') && K.stat(a, 'Result') === '3000 added, 3000 removed' && !c.note && K.stat(c, 'Result') === '207 added, 207 removed', (a.note || '').slice(0, 50) + ' | ' + K.stat(c, 'Result')];
  });
  claim(TD, 'dfaq', 'No. An extra empty line between paragraphs shows as an addition; only newlines at the very end of each text are dropped.', 'inner blank added; trailing newlines ignored', N, async () => {
    const a = td('p1\np2\n---\np1\n\np2'), b = td('p1\n\n\n---\np1');
    return [/1 added/.test(K.stat(a, 'Result') || '') && K.stat(b, 'Result') === 'The two texts are identical', K.stat(a, 'Result') + ' | ' + K.stat(b, 'Result')];
  });
  claim(TD, 'mistake', 'the old one-box form cuts at the first, and a note says the other --- lines were compared as part of the second text.', 'a second --- is content, with a note', N, async () => {
    const r = td('a\n---\nb\n---\nc'); return [/---/.test(r.diff.B.join('\n')) && /compared as part of the second text/.test(r.note || ''), K.j(r.note || '') + ' | ' + K.j(r.diff.B)];
  });
  claim(TD, 'faq', 'Line mode treats a line as an atom: any change makes it a removal plus an addition, though the changed words are marked inside both lines. Switch to word or character mode to see only the change.', 'line vs word vs character mode', N, async () => {
    const l = td('the quick fox\n---\nthe slow fox'), w = td('the quick fox\n---\nthe slow fox', { mode: 'word' }), c = td('cat\n---\ncart', { mode: 'char' });
    return [/1 added, 1 removed/.test(K.stat(l, 'Result') || '') && K.stat(w, 'Unchanged words') === '2' && w.output === 'the [-quick-]{+slow+} fox' && c.output === 'ca{+r+}t', K.stat(l, 'Result') + ' | ' + w.output + ' | ' + c.output];
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
  claim(WC, 'tip', 'Set a word goal for an essay or article and the bar fills as you write; the limit bars show X, SMS, search-result and social limits at once.', 'Chrome: goal 50 with 20 words shows 20 of 50, 30 left; a 300-character text turns X, SMS and the 155 limit red', B, async () => {
    const p = await K.open(WC);
    try {
      await p.evaluate(() => { Object.keys(localStorage).filter((k) => /word-counter/.test(k)).forEach((k) => localStorage.removeItem(k)); });
      await p.reload({ waitUntil: 'load' });
      const put = (v) => p.evaluate((v) => { const a = document.querySelector('textarea.code-area'); a.value = v; a.dispatchEvent(new Event('input', { bubbles: true })); }, v);
      await p.evaluate(() => { const g = document.getElementById('f-goal'); g.value = '50'; g.dispatchEvent(new Event('input', { bubbles: true })); });
      await put('word '.repeat(20).trim());
      await K.sleep(700);
      const a = await p.evaluate(() => [...document.querySelectorAll('.wc-row')].map((r) => r.querySelector('.wc-label').textContent + ': ' + r.querySelector('.wc-num').textContent));
      await put('x'.repeat(300));
      await K.sleep(700);
      const over = await p.evaluate(() => [...document.querySelectorAll('.wc-row')].filter((r) => r.querySelector('.is-over')).map((r) => r.querySelector('.wc-label').textContent));
      return [a[0] === 'Word goal: 20 of 50 · 30 left' && over.indexOf('X post') === 0 && over.indexOf('Meta description') >= 0 && over.indexOf('Instagram caption') < 0, K.j(a.slice(0, 2)) + ' | over: ' + over.join(', ')];
    } finally { await p.close(); }
  });
  claim(WC, 'tip', 'Chinese and Japanese text has no spaces, so each word is found with your browser\'s own word segmenter; Korean, like English, is counted between spaces.', 'a Japanese sentence is more than one word and fewer than its characters; without a segmenter each character counts; Korean words stay whole', N, async () => {
    const s = '東京は日本の首都です。', k = '서울은 한국의 수도입니다';
    const w = Number(K.stat(wc(s), 'Words')), n = [...s.replace(/。/g, '')].length;
    const bare = K.tool('txt-word-counter.js', 'word-counter', { Intl: { Collator: Intl.Collator, DateTimeFormat: Intl.DateTimeFormat, NumberFormat: Intl.NumberFormat } });
    const f = Number(K.stat(K.tx(bare, s), 'Words'));
    return [w > 1 && w < n && f === n && K.stat(wc(k), 'Words') === '3', 'segmenter ' + w + ', characters ' + n + ', fallback ' + f + ', Korean ' + K.stat(wc(k), 'Words')];
  });
  claim(WC, 'point', 'Phrases of two or three words are counted the same way, not starting or ending with a common word while the filter is on.', 'two- and three-word phrases of a hand-counted text, with and without the filter', N, async () => {
    const t = 'the quick brown fox and the quick brown dog';
    const two = out(wc(t, { gram: '2' })).split('\n').slice(2), off = out(wc(t, { gram: '2', ignoreCommon: 'no' })).split('\n').slice(2), three = out(wc(t, { gram: '3' })).split('\n').slice(2);
    return [/^quick brown\s+2\s+25\.00%$/.test(two[0]) && two.length === 3 && off.some((l) => /^the quick\s+2/.test(l)) && off.some((l) => /^fox and\s+1/.test(l)) && /^quick brown dog\s+1/.test(three[0] || '') && three.length === 2, K.j(two) + ' | ' + K.j(three)];
  });
  claim(WC, 'point', 'Chinese and Japanese runs are split by the browser’s word segmenter. The bars count X links as 23 and emoji as 2.', 'links 23, emoji 2, € 2 in SMS, GSM against Unicode, hand-counted', N, async () => {
    const lim = (s) => Object.fromEntries(wc(s).limits.map((l) => [l.id, l.used]));
    const a = lim('hi https://example.com/a/very/long/path?x=1 ok'), b = lim('a😀b'), c = lim('€5 [x]'), d = lim('Café'), e = lim('Hello 😀');
    return [a.x === 3 + 23 + 3 && b.x === 4 && c.sms === 9 && d.sms === 4 && e.sms === 8 && wc('é'.repeat(70)).limits.find((l) => l.id === 'sms').limit === 160 && wc('😀'.repeat(5)).limits.find((l) => l.id === 'sms').limit === 70, K.j([a.x, b.x, c.sms, d.sms, e.sms])];
  });
  claim(WC, 'faq', 'By splitting on full stops, question marks, exclamation marks, ellipses and their Chinese and Japanese forms.', 'five kinds of ending', N, async () => {
    const v = K.stat(wc('One. Two? Three! Four… Five。Six！Seven？Eight'), 'Sentences'); return [v === '8', v];
  });
  claim(WC, 'faq', 'A draft of what you type is kept in this browser only, so you can restore it after closing the tab; Clear removes it.', 'Chrome: the text comes back after a reload; Clear removes the offer', B, async () => {
    const p = await K.open(WC);
    try {
      await p.evaluate(() => { Object.keys(localStorage).filter((k) => /word-counter/.test(k)).forEach((k) => localStorage.removeItem(k)); });
      await p.reload({ waitUntil: 'load' });
      await p.evaluate(() => { const a = document.querySelector('textarea.code-area'); a.value = 'my private draft'; a.dispatchEvent(new Event('input', { bubbles: true })); });
      await K.sleep(1200);
      await p.reload({ waitUntil: 'load' });
      await K.sleep(500);
      const offer = await p.evaluate(() => { const d = document.querySelector('.dev-draft'); return d && !d.hidden ? d.textContent : ''; });
      await K.clickText(p, '.dev-draft button', /Restore/);
      await K.sleep(400);
      const back = await p.evaluate(() => document.querySelector('textarea.code-area').value);
      await K.clickText(p, '.tool-io button', /^Clear$/);
      await K.sleep(1200);
      await p.reload({ waitUntil: 'load' });
      await K.sleep(500);
      const after = await p.evaluate(() => { const d = document.querySelector('.dev-draft'); return d && !d.hidden ? d.textContent : ''; });
      return [/saved on this device/.test(offer) && back === 'my private draft' && after === '', K.j(offer.slice(0, 60)) + ' | ' + back + ' | after Clear: ' + K.j(after)];
    } finally { await p.close(); }
  });
  claim(WC, 'point', 'a blank line separates paragraphs.', 'two paragraphs', N, async () => { const v = K.stat(wc('a b\n\nc d\ne'), 'Paragraphs'); return [v === '2', v]; });

  /* ---------- manual ---------- */
  manual(PW, 'tip', 'Cracking time assumes an offline attack at a trillion guesses per second against a fast hash.', 'An assumption about attackers; the arithmetic is checked above.');
  manual(RS, 'tip', 'UK government guidance targets a reading age of nine for public-facing content.', 'Needs the GOV.UK source with a date.');
  manual(RS, 'dfaq', 'Word reports Reading Ease and the Flesch-Kincaid grade from the same formulas', 'Microsoft Word behaviour.');
  manual(WC, 'tip', 'Set a word goal for an essay or article', 'The platform limits in the bars (X 280 weighted characters, SMS 160 GSM or 70 Unicode, about 60 and 155 for search results, Instagram 2,200, LinkedIn 3,000, YouTube title 100, Google Ads headline 30) are the platforms’ published figures; they need their documentation with a date. The counting rules (links 23, emoji 2, GSM units) are checked above.');
  manual(MO, 'dfaq', 'At 20 words per minute a dot lasts 60 milliseconds.', 'Arithmetic from the PARIS standard (1200 / wpm ms); not tool behaviour.');
  manual(NW, 'what', 'Under the UK\'s Bills of Exchange Act 1882, and India\'s Negotiable Instruments Act 1881, the words win when they disagree with the figures.', 'Legal statement; needs the Acts.');
  manual(TD, 'tip', 'The algorithm finds the longest common subsequence, which is the same approach Git uses', 'Git uses Myers\' algorithm (a shortest-edit-script method closely related to LCS); a person should decide whether "the same approach" is fair.');
  manual(CA, 'dfaq', 'as Friedrich Kasiski showed in 1863.', 'History; needs a source.');
};
