/*
 * Caption Counter (/social/caption-counter/), proved two ways:
 *
 *   1. In Node, engine/social-caption-counter.js (window.SocialCount) on
 *      fixed captions whose counts were worked out by hand — emoji, a ZWJ
 *      family, a flag, a keycap, a skin tone, CJK, a decomposed accent, links
 *      with and without https:// — and, when twitter-text is installed
 *      (--ref <its folder>, default E:/tmp/wsoc-social/ref/node_modules/
 *      twitter-text), X's own library on the same captions and more; the
 *      grapheme fallback against Intl.Segmenter; the Instagram fix and the
 *      "… more" cut against hand-written results.
 *   2. In Chrome, the page: the rows and figures for a typed caption equal
 *      Node's own Intl.Segmenter, String length and Buffer.byteLength (and
 *      twitter-text for X); the copy buttons; the draft kept only when asked
 *      and removed when unticked; X Premium; ?text=; keyboard reach; 390 and
 *      1400 px in both themes; no request off 127.0.0.1.
 *
 *   node build/social/tests/caption-counter.js [--root <site>] [--port 8877] [--out <dir>] [--ref <twitter-text dir>]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const T = require('./_kit.js')({ name: 'caption-counter', port: 8877 });
const URL_ = '/social/caption-counter/';

function engine() {
  const sb = { console, Intl, TextEncoder, URLSearchParams }; sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(T.ROOT, 'engine/social-caption-counter.js'), 'utf8'), sb);
  return sb.SocialCount;
}
let tt = null;
const REF = T.flag('ref', 'E:/tmp/wsoc-social/ref/node_modules/twitter-text');
try { if (REF && fs.existsSync(REF)) tt = require(REF); } catch (e) { tt = null; }
const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
const graphemes = (s) => [...seg.segment(s)].length;

(async () => {
  const C = engine();
  T.section('1. counts worked out by hand');
  /* [caption, { field: expected }] — each expected figure counted by hand */
  const HAND = [
    ['hello', { characters: 5, utf16: 5, codePoints: 5, bytes: 5, x: 5, threads: 5 }],
    ['👨\u200d👩\u200d👧\u200d👦', { characters: 1, codePoints: 7, utf16: 11, bytes: 25, x: 2, threads: 25, emoji: 1 }],
    ['🇬🇧', { characters: 1, codePoints: 2, utf16: 4, bytes: 8, x: 2, threads: 8, emoji: 1 }],
    ['日本語', { characters: 3, utf16: 3, bytes: 9, x: 6, threads: 3 }],
    ['cafe\u0301', { characters: 4, codePoints: 5, bytes: 6, x: 4 }],
    ['Read https://www.example.com/a/very/long/path?x=1 now', { x: 32 }],
    ['ok 👍🏽', { characters: 4, utf16: 7, x: 5, threads: 11, emoji: 1 }],
    ['1\ufe0f\u20e3', { characters: 1, codePoints: 3, utf16: 3, bytes: 7, x: 2, threads: 7, emoji: 1 }],
    ['™ and ©', { x: 8 }],
    ['—…', { x: 3 }],
    ['x'.repeat(281), { x: 281, utf16: 281 }],
    ['Visit 1234tools.com!', { x: 30 }],
    ['see example.io/path.', { x: 28 }],
    ['😀', { threads: 4, x: 2, utf16: 2 }],
    ['a\nb\n\nc', { lines: 4, blankLines: 1, words: 3 }]
  ];
  for (const [s, exp] of HAND) {
    const c = C.count(s);
    const bad = Object.keys(exp).filter((k) => c[k] !== exp[k]);
    T.check(!bad.length, JSON.stringify(s.length > 40 ? s.slice(0, 40) + '…' : s) + ': ' + Object.keys(exp).map((k) => k + ' ' + c[k] + (c[k] === exp[k] ? '' : ' (want ' + exp[k] + ')')).join(', '));
  }
  const tags = C.hashtags('#tag #2026 #ok_1 a#b #Café');
  T.check(JSON.stringify(tags) === JSON.stringify(['#tag', '#ok_1', '#Café']), 'hashtags: #2026 and a#b are not tags, #Café is: ' + tags.join(' '));
  const ms = C.mentions('@user me@site.com @a.b hi');
  T.check(JSON.stringify(ms) === JSON.stringify(['@user', '@a.b']), 'mentions: an email address is not one: ' + ms.join(' '));
  const ls = C.links('see example.io/path. and https://a.co/x) and foo.notatld');
  T.check(JSON.stringify(ls.map((l) => l.url)) === JSON.stringify(['example.io/path', 'https://a.co/x']), 'links: trailing full stop and unbalanced bracket left out, unknown ending ignored: ' + ls.map((l) => l.url).join(' | '));

  T.section('2. verdicts');
  const row = (text, id, o) => C.rows(text, o).find((r) => r.id === id);
  T.check(row('a'.repeat(2200), 'instagram').state !== 'over' && row('a'.repeat(2201), 'instagram').state === 'over', 'Instagram: 2,200 fits, 2,201 is over');
  T.check(row('🙂'.repeat(1100), 'instagram').used === 2200 && row('🙂'.repeat(1101), 'instagram').state === 'over', 'Instagram counts an emoji as 2 UTF-16 units (1,101 emoji are over)');
  T.check(row('x'.repeat(280), 'x').state !== 'over' && row('x'.repeat(281), 'x').state === 'over' && row('x'.repeat(281), 'x', { xPremium: true }).limit === 25000, 'X: 280 fits, 281 is over, Premium raises it to 25,000');
  T.check(row('😀'.repeat(125), 'threads').used === 500 && row('😀'.repeat(126), 'threads').state === 'over', 'Threads: 125 emoji are 500 (4 bytes each), 126 are over');
  T.check(row('a b c d e f'.split(' ').map((w) => '#' + w + 'x').join(' '), 'instagram').state === 'near' && row(Array.from({ length: 31 }, (_, i) => '#t' + 'abcdefghijklmnopqrstuvwxyzabcde'[i]).join(' '), 'instagram').state === 'over', 'Instagram: 6 hashtags warn, 31 are over');
  T.check(row(Array.from({ length: 21 }, (_, i) => '@u' + i).join(' '), 'instagram').state === 'over', 'Instagram: 21 @ tags are over');
  T.check(row('a https://a.co b.com c.com d.com e.com f.com', 'threads').state === 'over' && row('a https://a.co b.com c.com d.com e.com', 'threads').state !== 'over', 'Threads: 6 links are over, 5 are not');
  T.check(row('My <best> video', 'youtube-title').state === 'over' && row('x'.repeat(100), 'youtube-title').state !== 'over' && row('x'.repeat(101), 'youtube-title').state === 'over', 'YouTube title: < > refused, 100 fits, 101 over');
  T.check(row('é'.repeat(2500), 'youtube-desc').used === 5000 && row('é'.repeat(2501), 'youtube-desc').state === 'over', 'YouTube description counted in UTF-8 bytes (2,501 é are over)');
  T.check(row('a'.repeat(2200), 'tiktok').state !== 'over' && row('a'.repeat(2201), 'tiktok').state === 'over', 'TikTok: 2,200 fits, 2,201 over');
  T.check(row('a'.repeat(3000), 'linkedin').state !== 'over' && row('a'.repeat(3001), 'linkedin').state === 'over', 'LinkedIn: 3,000 fits, 3,001 over');
  T.check(row('a'.repeat(63206), 'facebook').state !== 'over' && row('a'.repeat(63207), 'facebook').state === 'over', 'Facebook: 63,206 fits, 63,207 over');

  T.section('3. the Instagram fix and the "… more" cut, against hand-written results');
  T.check(C.fixInstagram('Para one  \n\nPara two\n \n\nend\n') === 'Para one\n\u2800\nPara two\n\u2800\n\u2800\nend', 'blank lines get U+2800, line ends trimmed, outer blank lines dropped');
  T.check(C.fixInstagram('no gaps\nhere') === 'no gaps\nhere', 'a caption without blank lines is unchanged');
  const pv = C.preview('a\nb\nc', 'instagram');
  T.check(pv.shown === 'a\nb' && pv.cut, 'Instagram preview stops after two lines');
  const pv2 = C.preview('y'.repeat(200), 'instagram');
  T.check(pv2.shown.length === 125 && pv2.cut, 'Instagram preview stops at 125 characters');
  const pv3 = C.preview('Line one\nLine two', 'tiktok');
  T.check(pv3.shown === 'Line one' && pv3.cut, 'TikTok preview stops after one line');
  T.check(!C.preview('short', 'linkedin').cut, 'a short caption is not cut');

  T.section('4. graphemes without Intl.Segmenter');
  const GS = ['👨\u200d👩\u200d👧\u200d👦🇬🇧🇫🇷1\ufe0f\u20e3e\u0301👍🏽', 'नमस\u094dत\u0947 द\u0941न\u093fय\u093e', 'Ünïcödé', '🏳\ufe0f\u200d🌈 and 🏴\u200d☠\ufe0f', 'a\r\nb', 'abc', 'త\u0c46ల\u0c41గ\u0c41 భ\u0c3eష', 'தம\u0bbfழ\u0bcd ம\u0bcaழ\u0bbf', 'ಕನ\u0ccdನಡ', 'ক\u09cdষম\u09be','🇬🇧🇫🇷🇩🇪'];
  for (const s of GS) T.check(C.graphemesFallback(s).length === graphemes(s), JSON.stringify(s) + ': fallback ' + C.graphemesFallback(s).length + ', Intl.Segmenter ' + graphemes(s));

  T.section('5. X: against twitter-text' + (tt ? ' (' + REF + ')' : ' — not installed, skipped (untested here)'));
  if (tt) {
    const S = ['hello', '©', '™', '😀', '👨\u200d👩\u200d👧\u200d👦', '🇬🇧', '1\ufe0f\u20e3', '日本語', 'café', 'cafe\u0301', 'https://www.example.com/a/very/long/path?x=1', 'example.com', 'see example.com/path.',
      'a\nb', '—', '…', '₹', 'ok 👍🏽', '❤', '❤\ufe0f', '☺', 'www.example.org', '#tag @user', 'ᄀ', '𝐀', '👍🏽👍🏽', '(see https://a.co/x)', 'Visit 1234tools.com!', 'email me@site.com',
      '안녕하세요 세계', 'Привет мир', 'नमस\u094dत\u0947', '🏳\ufe0f\u200d🌈 flag', '#\ufe0f\u20e3', 'Ünïcödé ½ ¾ ° €', '“quoted” ‘single’ – en — em', 'tab\there', 'x'.repeat(300),
      'New in the shop this week ☕\ufe0f our oat flat white, £3.20.\n\nPop in before 10 and the second one is half price 🎉 — tag a friend who needs it @smallbatchcafe\n\nMenu: smallbatch.example.com/menu\n#coffee #flatwhite #oatmilk #localcafe'];
    let same = 0;
    for (const s of S) {
      const a = C.xWeight(s).weight, b = tt.parseTweet(s).weightedLength;
      if (a === b) same++; else console.log('     differs on ' + JSON.stringify(s) + ': ' + a + ' vs twitter-text ' + b);
    }
    T.check(same === S.length, same + ' of ' + S.length + ' captions weigh the same as twitter-text');
  }

  T.section('6. the page');
  await T.start();
  const p = await T.open(URL_, { wait: '#cc-text' });
  const type = (t) => p.evaluate((t) => { const a = document.querySelector('#cc-text'); a.value = t; a.dispatchEvent(new Event('input', { bubbles: true })); }, t);
  const rowsOf = () => p.$$eval('.social-cc-row', (l) => l.map((r) => ({ id: r.dataset.platform, num: r.querySelector('.social-cc-num').textContent, cls: r.className, unit: r.querySelector('.social-cc-unit').textContent })));
  const statsOf = () => p.$$eval('.social-cc-stats .stat-row', (l) => Object.fromEntries(l.map((r) => [r.querySelector('.stat-key').textContent, r.querySelector('.stat-val').textContent])));
  const n = (s) => Number(String(s).replace(/,/g, ''));
  const h1 = await p.$eval('h1', (e) => e.textContent);
  T.check(/Caption Counter/.test(h1), 'h1 says Caption Counter');
  T.check((await p.$$('.social-cc-row')).length === 8, 'eight platform rows');

  await p.click('.social-cc-actions .btn-ghost');
  await T.sleep(250);
  const ex = await p.$eval('#cc-text', (a) => a.value);
  const st = await statsOf();
  T.check(n(st.Characters) === graphemes(ex) && n(st['UTF-16 units']) === ex.length && n(st['Bytes (UTF-8)']) === Buffer.byteLength(ex), 'example: characters ' + st.Characters + ', UTF-16 ' + st['UTF-16 units'] + ', bytes ' + st['Bytes (UTF-8)'] + ' equal Node’s own counts');
  T.check(n(st.Hashtags) === (ex.match(/#\w+/g) || []).length && n(st.Mentions) === 1 && n(st.Links) === 1, 'example: ' + st.Hashtags + ' hashtags, ' + st.Mentions + ' mention, ' + st.Links + ' link');
  const rs = await rowsOf();
  const xr = rs.find((r) => r.id === 'x');
  if (tt) T.check(n(xr.num.split('/')[0]) === tt.parseTweet(ex).weightedLength, 'X row ' + xr.num + ' equals twitter-text ' + tt.parseTweet(ex).weightedLength);
  const ig = rs.find((r) => r.id === 'instagram');
  T.check(n(ig.num.split('/')[0]) === ex.length && / 2,200$/.test(ig.num), 'Instagram row ' + ig.num + ' (UTF-16 length ' + ex.length + ')');
  T.check(fs.writeFileSync(path.join(T.OUT, 'example-caption.txt'), ex) === undefined, 'example caption saved for the content runs');
  console.log('     example figures: ' + JSON.stringify(st) + ' | ' + rs.map((r) => r.id + ' ' + r.num).join(', '));

  await type('Read https://www.example.com/a/very/long/path?x=1 now');
  await T.sleep(250);
  T.check((await rowsOf()).find((r) => r.id === 'x').num === '32 / 280', 'a typed caption with a long link: X row 32 / 280');
  await type('x'.repeat(281));
  await T.sleep(250);
  const over = (await rowsOf()).find((r) => r.id === 'x');
  T.check(/is-over/.test(over.cls) && over.num === '281 / 280', 'X row turns red at 281');
  await p.click('#cc-premium');
  await T.sleep(250);
  T.check((await rowsOf()).find((r) => r.id === 'x').num === '281 / 25,000', 'X Premium: 281 / 25,000');
  await p.click('#cc-premium');

  T.section('7. the line-break fix and the preview');
  await type('Para one  \n\nPara two\n \n\nend\n');
  await T.sleep(250);
  await p.evaluate(() => { window.__copied = []; });
  await p.click('.social-cc .btn-primary');
  await T.sleep(200);
  const copied = await p.evaluate(() => window.__copied[0]);
  T.check(copied === 'Para one\n\u2800\nPara two\n\u2800\n\u2800\nend', 'Copy with the line-break fix copies the fixed text: ' + JSON.stringify(copied));
  await type('Line one\nLine two');
  await p.select('#cc-platform', 'tiktok');
  await T.sleep(250);
  const pvText = await p.$eval('.social-cc-preview', (e) => e.textContent);
  T.check(/^Line one… more$/.test(pvText), 'TikTok preview shows the first line then “… more”: ' + JSON.stringify(pvText));
  T.check(await p.$eval('.social-cc .btn-primary', (b) => b.disabled), 'no blank lines: the fix button is off');

  T.section('8. storage: nothing kept unless asked');
  await type('A private draft 🙂');
  await T.sleep(250);
  const before = await p.evaluate(() => localStorage.getItem('1234tools-social-caption-draft-v1'));
  T.check(before === null, 'typing stores nothing');
  await p.click('#cc-keep');
  await T.sleep(200);
  const kept = await p.evaluate(() => JSON.parse(localStorage.getItem('1234tools-social-caption-draft-v1') || 'null'));
  T.check(kept && kept.text === 'A private draft 🙂', 'ticking “Keep this text as a draft” keeps it');
  const p2 = await T.open(URL_, { wait: '#cc-text', keepStorage: true });
  await T.sleep(300);
  T.check((await p2.$eval('#cc-text', (a) => a.value)) === 'A private draft 🙂', 'a new visit opens with the draft');
  await p2.click('#cc-keep');
  await T.sleep(200);
  T.check((await p2.evaluate(() => localStorage.getItem('1234tools-social-caption-draft-v1'))) === null, 'unticking removes the draft');
  const keys = await p2.evaluate(() => Object.keys(localStorage).filter((k) => /social/.test(k)));
  T.check(keys.every((k) => /^1234tools-social-caption-counter-v1$/.test(k)), 'what is left is the versioned settings key only: ' + keys.join(', '));
  await p2.close();
  const p3 = await T.open(URL_ + '?text=' + encodeURIComponent('From a link ✨'), { wait: '#cc-text' });
  await T.sleep(250);
  T.check((await p3.$eval('#cc-text', (a) => a.value)) === 'From a link ✨', '?text= fills the box');
  await p3.close();

  T.section('9. keyboard, layout');
  const kb = await T.keyboard(p);
  T.check(!kb.bad.length && !kb.unlabelled.length, kb.n + ' controls reachable with Tab and labelled' + (kb.bad.length ? '; not: ' + kb.bad.join(' | ') : '') + (kb.unlabelled.length ? '; unlabelled: ' + kb.unlabelled.join(', ') : ''));
  const t0 = Date.now();
  await type('word '.repeat(4000));
  await p.waitForFunction(() => /20,000/.test(document.querySelector('.social-cc-row[data-platform=instagram] .social-cc-num').textContent), { timeout: 5000 });
  T.check(Date.now() - t0 < 2000, 'a 20,000-character caption is counted in ' + (Date.now() - t0) + ' ms');
  await p.close();
  await T.layouts(URL_, async (q) => { await q.click('.social-cc-actions .btn-ghost'); });
  await T.finish();
})().catch(async (e) => { console.error(e); T.fails.push('the run broke: ' + e.message); await T.finish(); });
