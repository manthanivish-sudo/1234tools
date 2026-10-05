/*
 * The Reel Maker's text → phoneme step (engine/aivid-tts-g2p.js) in Node:
 * dictionary words, stress, -s/-ed/-ing stems, the/to before vowels,
 * numbers, money in lakh and crore, years, times, acronyms, this site's own
 * words, the letter-to-sound fallback, both accents, and that every symbol
 * it emits is in Kokoro's vocabulary. Also measures how much of the site's
 * own story text (assets/stories.js) the dictionaries cover.
 *
 *   node build/ai-video/tests/tts-g2p.js [--root <export dir>]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const at = args.indexOf('--root');
const ROOT = path.resolve(at >= 0 ? args[at + 1] : path.join(__dirname, '..', '..', '..'));
const G = require(path.join(ROOT, 'engine/aivid-tts-g2p.js'));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/models/kokoro-82m/kokoro-82m.json'), 'utf8'));
const lex = (a) => JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/models/kokoro-82m/lexicon-' + a + '.json'), 'utf8'));
const US = G.create(lex('us'), 'en-us'), GB = G.create(lex('gb'), 'en-gb');

let passes = 0; const fails = [];
const check = (ok, what) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + what); if (ok) passes++; else fails.push(what); };
const ps = (g, t) => g.phonemize(t).phonemes;
const eq = (g, t, want) => { const got = ps(g, t); check(got === want, JSON.stringify(t) + ' → ' + got + (got === want ? '' : '  (want ' + want + ')')); };

/* dictionary, stress, function words */
eq(US, 'Stop guessing your taxes.', 'stˈɑp ɡˈɛsɪŋ jʊɹ tˈæksᵻz.');
eq(GB, 'Stop guessing your taxes.', 'stˈɒp ɡˈɛsɪŋ jɔː tˈaksɪz.');
eq(US, 'the apple, the car', 'ði ˈæpᵊl, ðə kˈɑɹ');
eq(US, 'to eat, to go', 'tʊ ˈit, tə ɡˌO');
eq(US, 'I used to record a live video.', 'ˌI jˈust tə ɹəkˈɔɹd ɐ lˈIv vˈɪdiO.');
eq(US, 'Press record to record.', 'pɹˈɛs ɹˈɛkəɹd tə ɹəkˈɔɹd.');
eq(US, 'Better', 'bˈɛTəɹ');
/* numbers, money, years, times, percentages */
check(G.cardinal(1234567) === 'one million two hundred thirty-four thousand five hundred sixty-seven', 'cardinal 1234567');
check(G.indian(15000000) === 'one crore fifty lakh', 'indian 1,50,00,000 = one crore fifty lakh');
check(G.indian(150000) === 'one lakh fifty thousand', 'indian 1,50,000 = one lakh fifty thousand');
check(G.year(2026) === 'twenty twenty-six' && G.year(1905) === 'nineteen oh five' && G.year(2005) === 'two thousand five', 'years 2026, 1905, 2005');
check(G.ordinal(21) === 'twenty-first' && G.ordinal(12) === 'twelfth', 'ordinals 21st, 12th');
check(G.expand('₹1,50,000').join(' ') === 'one lakh fifty thousand rupees', '₹1,50,000 → one lakh fifty thousand rupees');
check(G.expand('$4.99').join(' ') === 'four dollars and ninety-nine cents', '$4.99 → four dollars and ninety-nine cents');
check(G.expand('18%').join(' ') === 'eighteen percent', '18% → eighteen percent');
check(G.expand('10:30').join(' ') === 'ten thirty', '10:30 → ten thirty');
check(G.expand('2.5').join(' ') === 'two point five', '2.5 → two point five');
check(G.expand('5-10').join(' ') === 'five to ten', '5-10 → five to ten');
/* acronyms and this site's words */
eq(US, 'GST', 'ʤˌi ˌɛs tˈi');
eq(US, 'SIP', 'ˌɛs ˌI pˈi');
eq(US, 'PDFs', 'pˌi dˌi ˈɛfs');
eq(GB, 'Pay by UPI.', 'pˈA bI jˌuː pˌiː ˈI.');
eq(US, 'Visit 1234tools.com', 'vˈɪzət twˈɛlv θˈɜɹTi fˈɔɹ tˈulz dˈɑt kˈɑm');
eq(US, 'Made with 1234Tools', 'mˌAd wɪð twˈɛlv θˈɜɹTi fˈɔɹ tˈulz');
for (const w of ['Wi-Fi', 'WiFi', 'wifi', 'WI-FI']) eq(US, w, 'wˈIfˌI');
eq(GB, 'Wi-Fi', 'wˈIfI');
eq(US, 'QR', 'kjˌu ˈɑɹ');
eq(US, 'UTM', 'jˌu tˌi ˈɛm');
eq(US, 'URL', 'jˌu ˌɑɹ ˈɛl');
eq(US, 'PNG', 'pˌi ˌɛn ʤˈi');
eq(US, 'JPEG', 'ʤˈA pˈɛɡ');
eq(US, 'AI', 'ˌA ˈI');
check(ps(US, 'on 4 October 2026') === ps(US, 'on 04/10/2026') && /fˈɔɹθ ʌv ɑktˈObəɹ/.test(ps(US, 'on 4 October 2026')), 'dates: 4 October 2026 = 04/10/2026 = "the fourth of October, twenty twenty-six"');
check(/sˈɛntəm/.test(ps(US, '12 cm')) && /mˈɪləm/.test(ps(US, '5 mm')) && /kəlˈɑm.*ˈWəɹ/.test(ps(US, '60 km/h')), 'units: cm, mm, km/h said in full');
check(ps(US, '1,250.50 pounds') === ps(US, '£1,250.50') && /pˈɛns/.test(ps(US, '£1,250.50')), 'a voice-over’s "1,250.50 pounds" is said as pounds and pence');
check(ps(US, '1,50,000 rupees') === ps(US, '₹1,50,000') && /lˈɑk/.test(ps(US, '₹1,50,000')), 'a voice-over’s "1,50,000 rupees" is said in lakh');
eq(US, 'challan', 'ʧˈɑlən');
eq(GB, 'WhatsApp', 'wˈɒtsap');
check(/ʤ/.test(ps(US, 'JSON')) && /ˈA/.test(ps(US, 'JSON')), 'JSON is "jay-son"');
/* words in no dictionary: letter-to-sound rules, stressed */
const oov = ps(US, 'zorblax');
check(/^z/.test(oov) && /ˈ/.test(oov), 'an unknown word is read by the rules, with stress (zorblax → ' + oov + ')');
check(!/[Oæ]/.test(ps(GB, 'zorblaxo')), 'British fallback uses British vowels (' + ps(GB, 'zorblaxo') + ')');
/* everything emitted is in Kokoro's vocabulary */
const sample = fs.readFileSync(path.join(ROOT, 'assets/stories.js'), 'utf8').match(/"(?:hook|pain|promise|cta)":"(?:[^"\\]|\\.){8,200}"/g) || [];
const vocab = new Set(Object.keys(M.vocab));
let bad = 0, total = 0;
for (const s of sample.slice(0, 400)) {
  const t = JSON.parse('{' + s + '}'); const text = Object.values(t)[0];
  for (const g of [US, GB]) { const p = ps(g, text); total++; if ([...p].some((c) => !vocab.has(c))) bad++; }
}
check(total > 50 && bad === 0, 'every symbol is in Kokoro’s vocabulary, over ' + total + ' story lines in both accents');
/* coverage of the site's own text by the dictionaries alone */
const L = lex('us');
const has = (w) => L.g[w] !== undefined || L.s[w] !== undefined || L.g[w.toLowerCase()] !== undefined || L.s[w.toLowerCase()] !== undefined;
const ws = sample.flatMap((s) => (Object.values(JSON.parse('{' + s + '}'))[0].match(/[A-Za-z][a-z']+/g) || []));
const hit = ws.filter(has).length;
console.log('  info dictionary coverage of ' + ws.length + ' lower/title-case story words: ' + (100 * hit / ws.length).toFixed(1) + '% (the rest go through stems, then the rules)');
console.log('\n' + passes + ' passed, ' + fails.length + ' failed');
if (fails.length) process.exit(1);
