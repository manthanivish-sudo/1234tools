/*
 * Engagement Rate Calculator (/social/engagement-rate-calculator/).
 *
 *   1. In Node, SocialER.compute on fixed inputs whose rates were worked out
 *      by hand (the sums are in the comments), the validation (zero
 *      followers, zero posts, negatives, fractions, words, "1,234"), and the
 *      notes for reach above followers and impressions below reach.
 *   2. In Chrome: ?likes=…&followers=… fill the form; each card shows the
 *      hand-worked figure to the chosen decimals; Copy results copies every
 *      line; the decimals are remembered and the figures are not; keyboard
 *      reach; 390 and 1400 px in both themes; no request off 127.0.0.1.
 *
 *   node build/social/tests/engagement-rate-calculator.js [--root <site>] [--port 8878] [--out <dir>]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const T = require('./_kit.js')({ name: 'engagement-rate-calculator', port: 8878 });
const URL_ = '/social/engagement-rate-calculator/';

function engine() {
  const sb = { console, Intl, URLSearchParams }; sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(T.ROOT, 'engine/social-engagement-rate-calculator.js'), 'utf8'), sb);
  return sb.SocialER;
}
const near = (a, b) => a !== null && Math.abs(a - b) < 1e-9;

/* worked by hand:
   A  412 + 38 + 17 + 55 = 522 engagements
      522 / 12,400 × 100 = 4.20967…%   522 / 9,850 × 100 = 5.29949…%
      522 / 14,200 × 100 = 3.67605…%   (412 + 38) / 12,400 × 100 = 3.62903…%
   B  10 posts: 3,200 + 240 + 95 + 410 = 3,945
      3,945 / 10 / 8,000 × 100 = 4.93125%   3,945 / 52,000 × 100 = 7.58653…%
      (3,200 + 240) / 10 / 8,000 × 100 = 4.3%   3,945 / 10 = 394.5 a post
   C  900 likes, 2,000 followers, reach 15,000: 45% by followers, 6% by reach */
const A = { likes: 412, comments: 38, shares: 17, saves: 55, followers: 12400, reach: 9850, impressions: 14200, posts: 1 };
const B = { likes: '3,200', comments: 240, shares: 95, saves: 410, followers: '8000', reach: '52,000', impressions: '', posts: 10 };
const Cc = { likes: 900, followers: 2000, reach: 15000 };

(async () => {
  const E = engine();
  T.section('1. rates worked out by hand');
  const val = (r, id) => r.results.find((x) => x.id === id).value;
  const a = E.compute(A);
  T.check(a.ok && a.engagements === 522, 'A: 522 engagements');
  T.check(near(val(a, 'followers'), 522 / 12400 * 100) && E.fmtRate(val(a, 'followers'), 2) === '4.21%', 'A: by followers 4.21%');
  T.check(near(val(a, 'reach'), 522 / 9850 * 100) && E.fmtRate(val(a, 'reach'), 2) === '5.30%', 'A: by reach 5.30%');
  T.check(near(val(a, 'impressions'), 522 / 14200 * 100) && E.fmtRate(val(a, 'impressions'), 2) === '3.68%', 'A: by impressions 3.68%');
  T.check(near(val(a, 'likes-comments'), 450 / 12400 * 100) && E.fmtRate(val(a, 'likes-comments'), 2) === '3.63%', 'A: likes and comments 3.63%');
  T.check(val(a, 'per-post') === 522, 'A: 522 a post');
  T.check(!a.notes.length, 'A: no notes (reach under followers, impressions over reach)');
  const b = E.compute(B);
  T.check(b.ok && b.engagements === 3945, 'B: "3,200" and "52,000" read as numbers; 3,945 engagements');
  T.check(near(val(b, 'followers'), 4.93125) && E.fmtRate(val(b, 'followers'), 2) === '4.93%', 'B: 10 posts, by followers 4.93% (divided by posts)');
  T.check(near(val(b, 'reach'), 3945 / 52000 * 100) && E.fmtRate(val(b, 'reach'), 2) === '7.59%', 'B: by reach 7.59% (reach summed, not divided by posts)');
  T.check(val(b, 'impressions') === null && /Enter impressions/.test(b.results.find((x) => x.id === 'impressions').why), 'B: no impressions: no rate, and it says why');
  T.check(near(val(b, 'likes-comments'), 4.3), 'B: likes and comments 4.30%');
  T.check(val(b, 'per-post') === 394.5 && E.fmtCount(394.5, 2) === '394.5', 'B: 394.5 a post');
  const c = E.compute(Cc);
  T.check(c.ok && near(val(c, 'followers'), 45) && near(val(c, 'reach'), 6), 'C: 45% by followers, 6% by reach');
  T.check(c.notes.some((n) => /Reach is higher than followers/.test(n)), 'C: reach above followers is allowed, with a note');

  T.section('2. validation');
  const z = E.compute({ likes: 10, followers: 0 });
  T.check(z.ok && val(z, 'followers') === null && /nothing to divide by/.test(z.results[0].why), 'followers 0: no division, says why');
  const z2 = E.compute({ likes: 10, followers: 100, reach: 0 });
  T.check(z2.ok && val(z2, 'reach') === null && /Reach is 0/.test(z2.results[1].why), 'reach 0: no division, says why');
  T.check(!E.compute({ likes: 10, followers: 100, posts: 0 }).ok, 'posts 0: refused');
  T.check(/negative/.test((E.compute({ likes: -1, followers: 100 }).errors[0] || {}).message || ''), 'a negative count is refused');
  T.check(/whole number/.test((E.compute({ likes: '12.5', followers: 100 }).errors[0] || {}).message || ''), 'a fraction is refused');
  T.check(/must be a number/.test((E.compute({ likes: 'lots', followers: 100 }).errors[0] || {}).message || ''), 'words are refused');
  const imp = E.compute({ likes: 10, followers: 100, reach: 500, impressions: 300 });
  T.check(imp.notes.some((n) => /Impressions are lower than reach/.test(n)), 'impressions below reach: a note');
  const many = E.compute({ likes: 900, comments: 300, followers: 10000, reach: 1000 });
  T.check(many.notes.some((n) => /more engagements than accounts reached/.test(n)), 'engagements above reach: a note');
  const pageSrc = fs.readFileSync(path.join(T.ROOT, URL_.slice(1), 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  T.check(!/\b(good|average|benchmark)\b[^.]{0,40}\b\d+(\.\d+)?\s?%/i.test(pageSrc), 'the page quotes no benchmark rate');

  T.section('3. the page');
  await T.start();
  const q = Object.entries(A).map(([k, v]) => k + '=' + v).join('&');
  const p = await T.open(URL_ + '?' + q, { wait: '.social-er-card' });
  const cards = () => p.$$eval('.social-er-card', (l) => Object.fromEntries(l.map((c) => [c.dataset.formula, { v: c.querySelector('.social-er-value').textContent, f: c.querySelector('.social-er-formula').textContent, w: (c.querySelector('.social-er-worked') || {}).textContent || '' }])));
  let cs = await cards();
  T.check(cs.followers.v === '4.21%' && cs.reach.v === '5.30%' && cs.impressions.v === '3.68%' && cs['likes-comments'].v === '3.63%' && cs['per-post'].v === '522', 'link-filled form shows 4.21%, 5.30%, 3.68%, 3.63%, 522: ' + Object.values(cs).map((x) => x.v).join(', '));
  T.check(/÷ followers × 100/.test(cs.followers.f) && cs.followers.w === '= 522 ÷ 12,400 × 100', 'each card shows its formula and its sum: ' + cs.followers.f + ' ' + cs.followers.w);
  T.check(/Engagements: 522/.test(await p.$eval('.social-er-total', (e) => e.textContent)), 'the total line says 522');
  await p.select('#er-decimals', '3');
  await T.sleep(150);
  cs = await cards();
  T.check(cs.followers.v === '4.210%' && cs.reach.v === '5.299%', 'three decimals: 4.210% and 5.299%');
  await p.evaluate(() => { window.__copied = []; });
  await p.evaluate(() => [...document.querySelectorAll('.social-er .btn-primary')].find((b) => /Copy results/.test(b.textContent)).click());
  await T.sleep(200);
  const copied = await p.evaluate(() => window.__copied[0] || '');
  T.check(/^Engagements: 522\n/.test(copied) && /Engagement rate by reach: 5\.299%  \(522 ÷ 9,850 × 100\)/.test(copied) && copied.split('\n').length === 6, 'Copy results copies six lines with the working');
  const set = async (k, v) => p.evaluate((k, v) => { const i = document.getElementById('er-' + k); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, k, v);
  await set('followers', '0');
  await T.sleep(100);
  cs = await cards();
  T.check(cs.followers.v === '—' && cs.reach.v === '5.299%', 'followers 0: that card shows — and the rate by reach still shows');
  await set('posts', '0');
  await T.sleep(100);
  const err = await p.$eval('.social-er .io-msg', (e) => ({ t: e.textContent, c: e.className }));
  T.check(/is-error/.test(err.c) && /at least 1/.test(err.t) && (await p.$eval('#er-posts', (e) => e.getAttribute('aria-invalid'))) === 'true', 'posts 0: an error, and the field is marked invalid');
  await set('posts', '1'); await set('followers', '2000'); await set('reach', '15000');
  await T.sleep(100);
  T.check(/Reach is higher than followers/.test(await p.$eval('.social-er-notes', (e) => e.textContent)), 'reach above followers: the note shows');

  T.section('4. storage');
  const stored = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => /social/.test(k)).map((k) => [k, localStorage.getItem(k)])));
  T.check(JSON.stringify(stored) === JSON.stringify({ '1234tools-social-engagement-rate-v1': '{"decimals":3}' }), 'only the decimals are kept: ' + JSON.stringify(stored));
  const p2 = await T.open(URL_, { wait: '.social-er-card', keepStorage: true });
  T.check((await p2.$eval('#er-decimals', (s) => s.value)) === '3' && (await p2.$eval('#er-likes', (i) => i.value)) === '', 'a new visit keeps 3 decimals and no figures');
  const kb = await T.keyboard(p2);
  T.check(!kb.bad.length && !kb.unlabelled.length, kb.n + ' controls reachable with Tab and labelled' + (kb.unlabelled.length ? '; unlabelled: ' + kb.unlabelled.join(', ') : ''));
  await p2.close(); await p.close();
  await T.layouts(URL_ + '?' + q);
  await T.finish();
})().catch(async (e) => { console.error(e); T.fails.push('the run broke: ' + e.message); await T.finish(); });
