/**
 * Claims on the calculator pages of /mathematics/, /utilities/,
 * /engineering/ and /design/: every sentence a page promises (lede, card,
 * "Why people use it", formula, tips, FAQ and the depth sections), each
 * checked on the page's own engine in Node.
 *
 * The two random tools (dice roller, random number generator) are loaded
 * here with a crypto.getRandomValues of our own: it can be scripted with
 * chosen 32-bit values (so every combination of dice can be enumerated
 * exactly) or left to a seeded generator for the distribution checks;
 * Math.random is counted, so a fall back to it shows.
 *
 * The scientific calculator is not a calc spec: its parser is
 * engine/live.bundle.js (window.MVRLive.evaluate), run here in a vm; the
 * claims about its display and keypad run in Chrome.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');

module.exports = function ({ claim, manual, kit: K }) {
  const N = 'node';
  const B = 'browser';
  const j = (v) => JSON.stringify(v);
  const spec = (url) => K.calcSpec(url);
  const run = (url, inputs) => K.calc(url, inputs);
  const show = (url, key, v) => K.calcShow(spec(url), key, v);
  const near = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= (tol === undefined ? 1e-9 * Math.max(1, Math.abs(b)) : tol);
  const input = (url, key) => (spec(url).inputs || []).find((i) => i.key === key) || {};
  const options = (url, key) => (input(url, key).options || []).map((o) => o.label);
  const optValues = (url, key) => (input(url, key).options || []).map((o) => String(o.value));
  const outLabel = (url, key) => ((spec(url).outputs || []).find((o) => o.key === key) || {}).label;
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
  /* a small seeded generator, so the random inputs of a check reproduce */
  const seeded = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ints = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

  /* ---------- the random tools, with a crypto of our own ---------- */
  /* the source behind the scripted values: a seeded 32-bit generator,
     reset at the start of every check, so a distribution check gives the
     same counts on every run and can only fail when the engine changes
     (the browser's own crypto source is not what these checks are about) */
  let srcState = 1;
  const real32 = () => { srcState = (srcState + 0x6D2B79F5) | 0; let t = Math.imul(srcState ^ (srcState >>> 15), 1 | srcState); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (t ^ (t >>> 14)) >>> 0; };
  const claimR = (page, where, quote, name, env, fn) => claim(page, where, quote, name, env, async (k) => { srcState = 0x5EED + quote.length * 7919; return fn(k); });
  const randomCache = new Map();
  function randomEngine(url) {
    if (randomCache.has(url)) return randomCache.get(url);
    const e = K.calcEngine(url);
    const st = { feed: [], calls: 0, mathCalls: 0 };
    const M = Object.create(Math);
    M.random = () => { st.mathCalls++; return Math.random(); };
    const crypto = { getRandomValues: (buf) => { st.calls++; for (let i = 0; i < buf.length; i++) buf[i] = st.feed.length ? st.feed.shift() : real32(); return buf; } };
    const window = { TOOLS: {} };
    const ctx = vm.createContext({ window, console, Intl, Math: M, Date, Number, String, Array, Object, JSON, isFinite, isNaN, parseFloat, parseInt, crypto });
    vm.runInContext(fs.readFileSync(path.join(K.ROOT, 'engine', e.file), 'utf8'), ctx, { filename: e.file });
    const t = window.TOOLS[e.slug];
    const go = (inputs, feed) => { st.feed = (feed || []).slice(); st.calls = 0; st.mathCalls = 0; return t.compute(Object.assign(K.calcDefaults(t), inputs || {})); };
    const r = { t, go, st };
    randomCache.set(url, r);
    return r;
  }
  const list = (s) => String(s).split(',').map((x) => Number(x.trim()));

  /* ---------- the scientific calculator's parser ---------- */
  let live = null;
  const L = () => {
    if (!live) {
      const window = {};
      vm.runInContext(fs.readFileSync(path.join(K.ROOT, 'engine', 'sci-calc.js'), 'utf8'), vm.createContext({ window }), { filename: 'sci-calc.js' });
      live = window.MVRSci;
    }
    return live;
  };
  const ev = (s, a) => L().evaluate(s, a || 'rad').value;
  const evErr = (s) => { try { const r = L().evaluate(s, 'rad'); return 'no error: ' + r.value; } catch (e) { return e.message; } };

  /* ================================================================ */
  /* /mathematics/percentage/                                           */
  /* ================================================================ */
  const P = '/mathematics/percentage/';
  const pc = (value, total) => run(P, { value, total });
  claim(P, 'lede', 'Calculate percentages, percentage change, and reverse percentages in both directions.', '% of, change, and the amount before a rise or a cut', N, async () => {
    const a = pc(20, 120), b = pc(15, 68);
    return [near(a.aOfB, 16.6666666667, 1e-6) && near(a.change, 500) && near(a.beforeRise, 100) && near(b.beforeCut, 80) && near(a.increased, 144) && near(a.decreased, 96),
      'aOfB ' + a.aOfB + ', change ' + a.change + ', before a 20% rise on 120: ' + a.beforeRise + ', before a 15% cut on 68: ' + b.beforeCut];
  });
  claim(P, 'card', 'Calculate percentages, percentage change, and reverse percentages in both directions.', 'the card line is the lede', N, async () => {
    const b = pc(25, 75); return [near(b.beforeRise, 60) && near(b.beforeCut, 100), 'before rise ' + b.beforeRise + ', before cut ' + b.beforeCut];
  });
  claim(P, 'why', 'Type two numbers. Get % of, % change and reverse % at once.', 'one run gives all of them', N, async () => {
    const r = pc(80, 64); const keys = ['aOfB', 'pctOfB', 'change', 'beforeRise', 'beforeCut'];
    return [keys.every((k) => isFinite(r[k])) && keys.every((k) => outLabel(P, k)), keys.map((k) => outLabel(P, k) + ' = ' + r[k]).join('; ')];
  });
  claim(P, 'formula', 'part = whole × pct/100 · change = (new − old)/old × 100', 'both, on random, negative and decimal inputs', N, async () => {
    const rnd = seeded(11); const bad = [];
    for (let k = 0; k < 300; k++) {
      const a = ints(rnd, -5000, 5000) / (k % 3 ? 1 : 100), t = ints(rnd, -5000, 5000) / (k % 2 ? 1 : 10);
      const r = pc(a, t);
      if (!near(r.pctOfB, t * a / 100, 1e-9 * Math.max(1, Math.abs(t * a)))) bad.push('pctOfB ' + a + ',' + t);
      if (a !== 0 && !near(r.change, (t - a) / a * 100, 1e-9 * Math.max(1, Math.abs((t - a) / a * 100)))) bad.push('change ' + a + ',' + t);
    }
    const z = pc(0, 50);
    return [!bad.length && isNaN(z.change) && show(P, 'change', z.change) === '—', bad.slice(0, 5).join(' | ') || 'from 0 the change shows ' + show(P, 'change', z.change)];
  });
  claim(P, 'what', 'Almost every percentage question is one of three sums: a part of a whole, the change from an old value to a new one, or the amount before a percentage was added or taken away.', 'all three from the boxes', N, async () => {
    const a = pc(35, 200), b = pc(200, 230), c = pc(15, 230);
    return [near(a.pctOfB, 70) && near(b.change, 15) && near(c.beforeRise, 200) && near(pc(20, 160).beforeCut, 200), j([a.pctOfB, b.change, c.beforeRise])];
  });
  claim(P, 'works', 'Percentage change divides by the starting value, so swapping A and B changes the answer.', '60 → 75 and 75 → 60', N, async () => {
    const a = pc(60, 75).change, b = pc(75, 60).change; return [near(a, 25) && near(b, -20), a + ' / ' + b];
  });
  claim(P, 'works', 'A as a % of B = A ÷ B × 100', 'A ÷ B × 100', N, async () => { const r = pc(54, 72); return [near(r.aOfB, 75), r.aOfB]; });
  claim(P, 'works', 'B increased by A% = B × (1 + A ÷ 100)', 'increase', N, async () => { const r = pc(12.5, 80); return [near(r.increased, 90) && near(r.decreased, 70), r.increased + ' / ' + r.decreased]; });
  claim(P, 'works', 'Each result rearranges part = whole × rate ÷ 100 for the missing number.', 'the part, the rate, and the whole before a rise or cut (none before a 100% cut)', N, async () => {
    const r = pc(25, 150), z = pc(100, 50), m = pc(-100, 50);
    return [near(r.beforeRise, 120) && near(r.beforeCut, 200) && isNaN(z.beforeCut) && isNaN(m.beforeRise), r.beforeRise + ' / ' + r.beforeCut + '; a 100% cut: ' + z.beforeCut + '; a −100% rise: ' + m.beforeRise];
  });
  claim(P, 'works', '% difference = |A − B| ÷ ((A + B) ÷ 2) × 100', 'symmetric difference', N, async () => { const r = pc(60, 75); return [near(r.difference, 15 / 67.5 * 100), r.difference]; });
  claim(P, 'ui', 'the first box, Value A', 'the boxes are Value A and Value B, in that order', N, async () => {
    const ins = spec(P).inputs.map((i) => i.label); const m = spec(P).inputs[0]; return [m.key === 'mode' && m.default === 'all' && ins[1] === 'Value A' && ins[2] === 'Value B', ins.join(', ')];
  });
  claim(P, 'worked', 'so going back from £75 to £60 would be a 20% cut: the same £15, measured against a larger starting point.', '75 → 60', N, async () => { const r = pc(75, 60); return [near(r.change, -20), r.change]; });
  claim(P, 'worked', 'because it measures the gap against the average, £67.50', 'the symmetric difference is the gap over the average', N, async () => { const r = pc(60, 75); return [near(r.difference, 15 / 67.5 * 100), r.difference]; });
  claim(P, 'use', 'Check whether “was £75, now £60” really is the 20% off the label claims.', '75 → 60 is −20%', N, async () => { const r = pc(75, 60); return [near(r.change, -20), r.change]; });
  claim(P, 'use', 'Turn 54 out of 72 into a percentage, or find how many marks 65% of a paper needs.', '54 of 72; 65% of 72', N, async () => {
    const a = pc(54, 72), b = pc(65, 72); return [near(a.aOfB, 75) && near(b.pctOfB, 46.8), a.aOfB + '% / ' + b.pctOfB + ' marks'];
  });
  claim(P, 'use', 'Compare a rise in pounds with the percentage quoted, or with inflation.', '£30,000 → £31,500', N, async () => { const r = pc(30000, 31500); return [near(r.change, 5), r.change + '%']; });
  claim(P, 'mistake', 'Percentage change always divides by the starting value: a rise from 50 to 60 is 20%, not 16.7%.', '50 → 60', N, async () => { const r = pc(50, 60); return [near(r.change, 20), r.change]; });
  claim(P, 'mistake', 'A £120 price that includes a 20% increase came from £100 (120 ÷ 1.2), not £96.', 'before a 20% rise on £120; 20% off is the wrong £96', N, async () => {
    const r = pc(20, 120); return [near(r.beforeRise, 100) && near(r.decreased, 96), r.beforeRise + ' / ' + r.decreased];
  });
  claim(P, 'dfaq', 'Here, put 15 in Value A and 240 in Value B and read “A% of B”.', '15% of 240', N, async () => { const r = pc(15, 240); return [near(r.pctOfB, 36) && outLabel(P, 'pctOfB') === 'A% of B', outLabel(P, 'pctOfB') + ' = ' + r.pctOfB]; });
  claim(P, 'dfaq', 'from 80 to 92 is 12 ÷ 80 × 100 = 15%. Enter the old value as A.', 'old value in A', N, async () => { const r = pc(80, 92); return [near(r.change, 15), r.change]; });
  claim(P, 'dfaq', 'adding 15% back gives the wrong £78.20.', 'B increased by 15% on 68', N, async () => { const r = pc(15, 68); return [near(r.increased, 78.2), r.increased]; });
  claim(P, 'dfaq', 'Here, enter 15 and 68 and read “B before an A% cut”.', 'the coat: £80', N, async () => {
    const r = pc(15, 68); return [near(r.beforeCut, 80) && outLabel(P, 'beforeCut') === 'B before an A% cut' && show(P, 'beforeCut', r.beforeCut) === '80', outLabel(P, 'beforeCut') + ' shows ' + show(P, 'beforeCut', r.beforeCut)];
  });
  claim(P, 'dfaq', 'A share cannot, but a change can: sales rising from 40 to 100 is a 150% increase.', '40 → 100', N, async () => { const r = pc(40, 100); return [near(r.change, 150), r.change]; });
  claim(P, 'tip', 'Percentage change is directional: going 100 → 50 is −50%, but 50 → 100 is +100%.', 'both directions', N, async () => { const a = pc(100, 50).change, b = pc(50, 100).change; return [near(a, -50) && near(b, 100), a + ' / ' + b]; });
  claim(P, 'tip', 'A 20% drop followed by a 20% rise does not return you to the start — it leaves you 4% down.', '100 → 80 → 96', N, async () => {
    const down = pc(20, 100).decreased, up = pc(20, down).increased, ch = pc(100, up).change; return [near(down, 80) && near(up, 96) && near(ch, -4), down + ' → ' + up + ' (' + ch + '%)'];
  });
  claim(P, 'tip', 'Percentage difference (symmetric) compares two values without treating either as the baseline.', 'A, B and B, A give one answer', N, async () => {
    const rnd = seeded(5); for (let k = 0; k < 100; k++) { const a = ints(rnd, 1, 9999), b = ints(rnd, 1, 9999); if (!near(pc(a, b).difference, pc(b, a).difference)) return [false, a + ', ' + b]; } return [true, '100 pairs'];
  });
  claim(P, 'faq', 'If a rate moves from 5% to 7%, that is a rise of 2 percentage points, but a 40% increase in relative terms.', '5 → 7', N, async () => { const r = pc(5, 7); return [near(r.change, 40), r.change]; });

  /* ================================================================ */
  /* /mathematics/average-calculator/                                   */
  /* ================================================================ */
  const A = '/mathematics/average-calculator/';
  const av = (data, weights) => run(A, { data, weights: weights || '' });
  claim(A, 'lede', 'Calculate mean, median, mode, range and weighted average from a list of numbers.', 'all five from one list', N, async () => {
    const r = av('4, 8, 8, 1', '1, 1, 1, 5');
    return [near(r.mean, 5.25) && near(r.median, 6) && r.mode === '8' && near(r.range, 7) && near(r.weighted, 25 / 8), j([r.mean, r.median, r.mode, r.range, r.weighted])];
  });
  claim(A, 'card', 'Calculate mean, median, mode, range and weighted average from a list of numbers.', 'the card line is the lede', N, async () => { const r = av('3 3 9'); return [near(r.mean, 5) && r.mode === '3' && near(r.range, 6), j([r.mean, r.mode, r.range])]; });
  claim(A, 'why', 'Enter numbers and weights. Get mean, median, mode and weighted mean.', 'the outputs', N, async () => {
    const r = av('68, 74, 59, 81', '20, 30, 10, 40'); return [near(r.weighted, (68 * 20 + 74 * 30 + 59 * 10 + 81 * 40) / 100) && isFinite(r.mean) && isFinite(r.median) && r.mode === 'No mode', j([r.mean, r.median, r.mode, r.weighted])];
  });
  claim(A, 'formula', 'mean = Σx / n · weighted mean = Σ(w·x) / Σw', 'against a sum done here', N, async () => {
    const rnd = seeded(7);
    for (let k = 0; k < 200; k++) {
      const n = ints(rnd, 1, 15); const xs = Array.from({ length: n }, () => ints(rnd, -500, 500) / 4); const ws = xs.map(() => ints(rnd, 1, 9));
      const r = av(xs.join(', '), ws.join(' '));
      const m = xs.reduce((s, x) => s + x, 0) / n, w = xs.reduce((s, x, i) => s + x * ws[i], 0) / ws.reduce((s, x) => s + x, 0);
      if (!near(r.mean, m, 1e-9) || !near(r.weighted, w, 1e-9)) return [false, xs.join(',') + ' w ' + ws.join(',') + ' → ' + r.mean + ' / ' + r.weighted];
    }
    return [true, '200 random lists'];
  });
  claim(A, 'works', 'so weights of 1, 2 and 1 count the middle value twice', 'weights 1, 2, 1 = the middle value twice', N, async () => {
    const r = av('62, 70, 55', '1, 2, 1'), m = av('62, 70, 70, 55'); return [near(r.weighted, m.mean), r.weighted + ' vs ' + m.mean];
  });
  claim(A, 'works', 'The geometric mean takes the nth root of the product; the harmonic mean divides the count by the sum of reciprocals.', '2 and 8', N, async () => {
    const r = av('2, 8'); return [near(r.geometric, 4) && near(r.harmonic, 3.2), r.geometric + ' / ' + r.harmonic];
  });
  claim(A, 'works', 'median = middle of the sorted list (mean of the middle two when n is even)', 'unsorted, odd and even', N, async () => {
    const a = av('9, 1, 5'), b = av('9, 1, 5, 2'); return [near(a.median, 5) && near(b.median, 3.5), a.median + ' / ' + b.median];
  });
  claim(A, 'what', 'the median is the middle value once the list is sorted, and the mode is the most frequent value.', 'mode of 3, 7, 7, 1', N, async () => { const r = av('3, 7, 7, 1, 2'); return [r.mode === '7' && near(r.median, 3), r.mode + ' / ' + r.median]; });
  claim(A, 'worked', 'The median, 15, and the mode, 15, describe a usual week far better, and the range of 28 hours shows how far one busy week stretched the spread.', 'the hours example', N, async () => {
    const r = av('12, 15, 15, 18, 40'); return [near(r.mean, 20) && near(r.median, 15) && r.mode === '15' && near(r.range, 28), j([r.mean, r.median, r.mode, r.range])];
  });
  claim(A, 'use', 'Average yearly growth factors with the geometric mean, the only one that compounds back to the real end value.', 'geometric mean compounds back', N, async () => {
    const r = av('1.2, 0.8, 1.1'); return [near(Math.pow(r.geometric, 3), 1.2 * 0.8 * 1.1, 1e-12) && !near(Math.pow(r.mean, 3), 1.2 * 0.8 * 1.1, 1e-6), r.geometric + '³ = ' + Math.pow(r.geometric, 3)];
  });
  claim(A, 'use', 'A median of monthly bills ignores one freak month.', 'one month ×10 leaves the median', N, async () => {
    const a = av('80, 85, 90, 95, 100'), b = av('80, 85, 90, 95, 1000'); return [near(a.median, b.median) && b.mean > a.mean + 100, a.median + ' / ' + b.median];
  });
  claim(A, 'mistake', 'Class averages of 60% from 10 pupils and 80% from 30 pupils do not make 70% overall; weight each by its class size and it is 75%.', 'weighted by class size', N, async () => {
    const r = av('60, 80', '10, 30'); return [near(r.mean, 70) && near(r.weighted, 75), r.mean + ' / ' + r.weighted];
  });
  claim(A, 'mistake', 'Two numbers run together without a separator become one value, so make sure Count matches what you meant to enter.', '"68 74" and "6874"', N, async () => {
    const a = av('68 74'), b = av('6874'); return [a.count === 2 && b.count === 1 && outLabel(A, 'count') === 'Count', a.count + ' / ' + b.count];
  });
  claim(A, 'dfaq', 'Marks of 62, 70 and 55 with weights 1, 2 and 1 give (62 + 140 + 55) ÷ 4 = 64.25, against a plain mean of 62.333.', 'weighted and plain', N, async () => {
    const r = av('62, 70, 55', '1, 2, 1'); return [near(r.weighted, 64.25) && near(r.mean, 62.3333333, 1e-6), r.weighted + ' / ' + r.mean];
  });
  claim(A, 'dfaq', 'The growth factors are 1.10 and 0.90, and their geometric mean is 0.99499', 'geometric mean of 1.1 and 0.9', N, async () => { const r = av('1.10, 0.90'); return [near(r.geometric, 0.99499, 5e-6) && near(r.mean, 1), r.geometric + ' / ' + r.mean]; });
  claim(A, 'dfaq', 'It is 40 km/h, the harmonic mean, not 45', 'harmonic mean of 30 and 60', N, async () => { const r = av('30, 60'); return [near(r.harmonic, 40) && near(r.mean, 45), r.harmonic + ' / ' + r.mean]; });
  claim(A, 'tip', 'The mean is pulled by outliers; the median is not.', 'one outlier', N, async () => { const a = av('10, 11, 12'), b = av('10, 11, 120'); return [near(a.median, b.median) && b.mean > 40, a.mean + '→' + b.mean + ', median ' + b.median]; });
  claim(A, 'tip', 'Use the geometric mean for growth rates and the harmonic mean for averaging rates such as speed.', 'both are given, for positive values only', N, async () => {
    const a = av('2, 8'), b = av('-2, 8'); return [isFinite(a.geometric) && isFinite(a.harmonic) && isNaN(b.geometric) && show(A, 'geometric', b.geometric) === '—', 'positive: ' + a.geometric + ', with a negative: ' + show(A, 'geometric', b.geometric)];
  });
  claim(A, 'tip', 'Weighted averages need one weight per value', 'a weight short: no weighted average, and a note', N, async () => {
    const r = av('1, 2, 3', '1, 2'); return [isNaN(r.weighted) && /2 weights for 3 numbers/.test(r.note), r.weighted + ' / ' + r.note];
  });
  manual(A, 'faq', 'Mean for symmetric data, median when there are outliers or the distribution is skewed, and mode for categories.', 'advice on which average to report; the tool gives all three');
  claim(A, 'ui', 'Numbers (comma or space separated)', 'commas, spaces and semicolons all separate', N, async () => { const r = av('1,2 3;4 , 5,'); return [r.count === 5 && near(r.sum, 15), r.count + ' values']; });

  /* ================================================================ */
  /* /mathematics/fraction-calculator/                                  */
  /* ================================================================ */
  const F = '/mathematics/fraction-calculator/';
  const fr = (n1, d1, op, n2, d2) => run(F, { n1, d1, op, n2, d2 });
  claim(F, 'lede', 'Add, subtract, multiply and divide fractions, with the answer simplified and as a decimal and percentage.', 'the four operations', N, async () => {
    const r = ['+', '-', '*', '/'].map((op) => fr(1, 2, op, 1, 3));
    return [r.map((x) => x.simplified).join(',') === '5/6,1/6,1/6,3/2' && near(r[3].decimal, 1.5) && near(r[3].percent, 150), r.map((x) => x.simplified + ' ' + x.decimal + ' ' + x.percent + '%').join(' | ')];
  });
  claim(F, 'card', 'Add, subtract, multiply and divide fractions, with the answer simplified and as a decimal and percentage.', 'the card line is the lede', N, async () => {
    const r = fr(3, 4, '+', 5, 6); return [r.simplified === '19/12' && near(r.decimal, 19 / 12) && near(r.percent, 1900 / 12), r.simplified + ' ' + r.decimal];
  });
  claim(F, 'why', 'Enter two fractions. Get it simplified, as a mixed number and decimal.', '3/4 + 5/6', N, async () => {
    const r = fr(3, 4, '+', 5, 6); return [r.simplified === '19/12' && r.mixed === '1 7/12' && near(r.decimal, 1.5833333333), j([r.simplified, r.mixed, r.decimal])];
  });
  claim(F, 'why', 'Pick +, −, × or ÷', 'the operation select has exactly the four', N, async () => { const v = optValues(F, 'op'); return [v.join('') === '+-*/', options(F, 'op').join(', ')]; });
  claim(F, 'formula', 'a/b + c/d = (ad + cb) / bd, then divide by the greatest common divisor', 'unsimplified and simplified on random fractions', N, async () => {
    const rnd = seeded(3);
    for (let k = 0; k < 300; k++) {
      const a = ints(rnd, -40, 40), b = ints(rnd, 1, 40) * (k % 7 ? 1 : -1), c = ints(rnd, -40, 40), d = ints(rnd, 1, 40);
      const r = fr(a, b, '+', c, d); const top = a * d + c * b, bot = b * d; const g = gcd(top, bot) || 1;
      let sn = top / g, sd = bot / g; if (sd < 0) { sn = -sn; sd = -sd; }
      if (r.unsimplified !== top + '/' + bot || r.simplified !== sn + '/' + sd || r.gcdUsed !== g) return [false, a + '/' + b + ' + ' + c + '/' + d + ' → ' + j(r)];
    }
    return [true, '300 random sums, negative denominators among them'];
  });
  claim(F, 'works', 'Adding and subtracting cross-multiply onto the shared denominator b × d. Multiplying multiplies tops and bottoms; dividing multiplies by the second fraction turned upside down.', 'the unsimplified results', N, async () => {
    const u = ['+', '-', '*', '/'].map((op) => fr(2, 3, op, 4, 5).unsimplified); return [u.join(' ') === '22/15 -2/15 8/15 10/12', u.join(' ')];
  });
  claim(F, 'works', 'the greatest common divisor, shown as “Divided by (GCD)”', 'the output', N, async () => { const r = fr(2, 4, '+', 2, 4); return [outLabel(F, 'gcdUsed') === 'Divided by (GCD)' && r.gcdUsed === 16 && r.simplified === '1/1', outLabel(F, 'gcdUsed') + ' ' + r.gcdUsed + ' → ' + r.simplified]; });
  claim(F, 'what', '3/4 means 3 parts of a whole cut into 4 equal parts, and equals 0.75.', '3/4 as a decimal', N, async () => { const r = fr(3, 4, '*', 1, 1); return [r.decimal === 0.75 && r.simplified === '3/4', r.decimal]; });
  claim(F, 'what', 'Fractions keep values exact where decimals round them off: 1/3 is exact', '1/3 stays 1/3', N, async () => { const r = fr(1, 3, '+', 0, 1); return [r.simplified === '1/3', r.simplified]; });
  claim(F, 'worked', 'which is 18/12 before simplifying. Top and bottom both divide by 6, leaving 3/2, which is 1 1/2 as a mixed number and 1.5 as a decimal.', '2/3 ÷ 4/9', N, async () => {
    const r = fr(2, 3, '/', 4, 9); return [r.unsimplified === '18/12' && r.gcdUsed === 6 && r.simplified === '3/2' && r.mixed === '1 1/2' && near(r.decimal, 1.5), j(r)];
  });
  claim(F, 'use', 'Three quarters of a recipe that needs 2/3 of a cup of flour is 3/4 × 2/3 = 1/2 a cup.', '3/4 × 2/3', N, async () => { const r = fr(3, 4, '*', 2, 3); return [r.simplified === '1/2', r.simplified]; });
  claim(F, 'use', 'Add 5/8 in and 3/16 in timber or drill sizes without converting to decimals: 13/16 in.', '5/8 + 3/16', N, async () => { const r = fr(5, 8, '+', 3, 16); return [r.simplified === '13/16', r.simplified]; });
  claim(F, 'use', 'Multiply 1/6 by 1/6 for the chance of two sixes in a row, 1/36.', '1/6 × 1/6', N, async () => { const r = fr(1, 6, '*', 1, 6); return [r.simplified === '1/36', r.simplified]; });
  claim(F, 'mistake', '1/2 + 1/3 is not 2/5; over a shared denominator it is 3/6 + 2/6 = 5/6.', '1/2 + 1/3', N, async () => { const r = fr(1, 2, '+', 1, 3); return [r.simplified === '5/6', r.simplified]; });
  claim(F, 'mistake', 'The boxes take whole numbers and round decimals, so 2 1/4 goes in as the improper fraction 9/4 (2 × 4 + 1 over 4).', '2.25 is rounded; 9/4 is 2.25', N, async () => {
    const a = fr(2.25, 1, '*', 1, 1), b = fr(9, 4, '*', 1, 1); return [a.simplified === '2/1' && b.mixed === '2 1/4' && near(b.decimal, 2.25), a.simplified + ' / ' + b.mixed];
  });
  claim(F, 'dfaq', '5/8 − 1/6 becomes 30/48 − 8/48 = 22/48, which halves to 11/24.', '5/8 − 1/6', N, async () => { const r = fr(5, 8, '-', 1, 6); return [r.unsimplified === '22/48' && r.simplified === '11/24', r.unsimplified + ' → ' + r.simplified]; });
  claim(F, 'dfaq', 'To get it here, multiply the fraction by 1/1 and read the percentage line.', '7/8 × 1/1', N, async () => { const r = fr(7, 8, '*', 1, 1); return [near(r.percent, 87.5) && show(F, 'percent', r.percent) === '87.5%', show(F, 'percent', r.percent)]; });
  claim(F, 'dfaq', 'as a mixed number 7/6 is 1 1/6; 7/4 × 2/3 comes to exactly that.', '7/4 × 2/3', N, async () => { const r = fr(7, 4, '*', 2, 3); return [r.simplified === '7/6' && r.mixed === '1 1/6', r.simplified + ' = ' + r.mixed]; });
  claim(F, 'dfaq', 'gives a negative result with the minus sign kept on top: 1/4 − 2/3 = −5/12.', 'negative results, and a negative bottom', N, async () => {
    const a = fr(1, 4, '-', 2, 3), b = fr(1, -4, '+', 0, 1), c = fr(-7, 6, '+', 0, 1);
    return [a.simplified === '-5/12' && b.simplified === '-1/4' && c.mixed === '-1 1/6', a.simplified + ', ' + b.simplified + ', ' + c.mixed];
  });
  claim(F, 'tip', 'multiplying them together always works, though it may not give the smallest common denominator.', '1/4 + 1/4 over 16, simplified to 1/2', N, async () => { const r = fr(1, 4, '+', 1, 4); return [r.unsimplified === '8/16' && r.simplified === '1/2', r.unsimplified + ' → ' + r.simplified]; });
  claim(F, 'tip', 'Dividing by a fraction is the same as multiplying by its reciprocal: ÷ 2/3 is × 3/2.', '÷ 2/3 against × 3/2', N, async () => {
    const rnd = seeded(9); for (let k = 0; k < 100; k++) { const a = ints(rnd, -20, 20), b = ints(rnd, 1, 20); if (fr(a, b, '/', 2, 3).simplified !== fr(a, b, '*', 3, 2).simplified) return [false, a + '/' + b]; } return [true, '100 fractions'];
  });
  claim(F, 'tip', 'A fraction is fully simplified when the numerator and denominator share no common factor other than 1.', 'every result is in lowest terms', N, async () => {
    const rnd = seeded(13); const ops = ['+', '-', '*', '/'];
    for (let k = 0; k < 400; k++) {
      const n2 = ints(rnd, -30, 30) || 1; const r = fr(ints(rnd, -30, 30), ints(rnd, 1, 30), ops[k % 4], n2, ints(rnd, 1, 30));
      const [t, b] = r.simplified.split('/').map(Number); if (gcd(t, b) !== 1 && t !== 0) return [false, r.simplified];
      if (t === 0 && b !== 1) return [false, 'zero as ' + r.simplified];
    }
    return [true, '400 results'];
  });
  claim(F, 'faq', 'It should be — the result is divided by the greatest common divisor. If it looks large, check the inputs: 1/3 + 1/7 genuinely needs 21 as the denominator.', '1/3 + 1/7', N, async () => { const r = fr(1, 3, '+', 1, 7); return [r.simplified === '10/21', r.simplified]; });

  /* ================================================================ */
  /* /mathematics/geometry-calculator/                                  */
  /* ================================================================ */
  const G = '/mathematics/geometry-calculator/';
  const ge = (shape, a, b, c) => run(G, { shape, a, b, c });
  const PI = Math.PI;
  claim(G, 'lede', 'Area, perimeter, surface area and volume for common 2D and 3D shapes.', 'each shape gives its figures', N, async () => {
    const shapes = optValues(G, 'shape'); const r = shapes.map((s) => ge(s, 3, 4, 5));
    const flat = r.slice(0, 4).every((x) => isFinite(x.area)), solid = r.slice(4).every((x) => isFinite(x.volume) && isFinite(x.surface));
    return [shapes.join(',') === 'rectangle,triangle,circle,trapezium,cuboid,cylinder,sphere,cone' && flat && solid && isFinite(r[0].perimeter) && isFinite(r[2].perimeter), shapes.join(', ')];
  });
  claim(G, 'card', 'Area, perimeter, surface area and volume for common 2D and 3D shapes.', 'the card line is the lede', N, async () => { const r = ge('cuboid', 1, 2, 3); return [near(r.volume, 6) && near(r.surface, 22), r.volume + ' / ' + r.surface]; });
  claim(G, 'why', 'Pick the shape, enter the sizes, get area, surface and volume.', 'a cylinder', N, async () => { const r = ge('cylinder', 2, 5, 0); return [near(r.area, 4 * PI) && near(r.volume, 20 * PI) && near(r.surface, 28 * PI), j([r.area, r.surface, r.volume])]; });
  claim(G, 'formula', 'circle A = πr² · cylinder V = πr²h · sphere V = 4/3 πr³', 'the three, on random sizes', N, async () => {
    const rnd = seeded(21);
    for (let k = 0; k < 100; k++) {
      const r = ints(rnd, 1, 500) / 10, h = ints(rnd, 1, 500) / 10;
      if (!near(ge('circle', r, 0, 0).area, PI * r * r) || !near(ge('cylinder', r, h, 0).volume, PI * r * r * h) || !near(ge('sphere', r, 0, 0).volume, 4 / 3 * PI * r * r * r)) return [false, r + ', ' + h];
    }
    return [true, '100 sizes'];
  });
  claim(G, 'works', 'radius and height for a cylinder or cone; length, width and depth for a cuboid; the two parallel sides and the height for a trapezium.', 'which box is which', N, async () => {
    const cy = ge('cylinder', 2, 10, 99), co = ge('cone', 3, 4, 99), cu = ge('cuboid', 2, 3, 4), tr = ge('trapezium', 6, 4, 10);
    return [near(cy.volume, 40 * PI) && near(co.volume, 12 * PI) && near(cu.volume, 24) && near(tr.area, 32), j([cy.volume, co.volume, cu.volume, tr.area])];
  });
  claim(G, 'works', 'A cone’s surface adds its round base to the sloping side.', 'πr² + πr × slant', N, async () => { const r = ge('cone', 3, 4, 0); return [near(r.surface, PI * 9 + PI * 3 * 5), r.surface]; });
  claim(G, 'works', 'rectangle: A = l × w, perimeter = 2(l + w)', 'rectangle', N, async () => { const r = ge('rectangle', 4, 2.5, 9); return [near(r.area, 10) && near(r.perimeter, 13), r.area + ' / ' + r.perimeter]; });
  claim(G, 'works', 'triangle: A = ½ × base × height', 'triangle', N, async () => { const r = ge('triangle', 8, 5, 9); return [near(r.area, 20), r.area]; });
  claim(G, 'works', 'trapezium: A = ½ × (a + c) × h', 'trapezium', N, async () => { const r = ge('trapezium', 3, 2, 7); return [near(r.area, 10), r.area]; });
  claim(G, 'works', 'cuboid: V = l × w × d, surface = 2(lw + wd + ld)', 'cuboid', N, async () => { const r = ge('cuboid', 2, 1, 0.3); return [near(r.volume, 0.6) && near(r.surface, 5.8), r.volume + ' / ' + r.surface]; });
  claim(G, 'works', 'cylinder: V = πr²h, surface = 2πr(r + h)', 'cylinder', N, async () => { const r = ge('cylinder', 3, 7, 0); return [near(r.volume, PI * 63) && near(r.surface, 2 * PI * 3 * 10), r.volume + ' / ' + r.surface]; });
  claim(G, 'works', 'sphere: V = 4/3 × πr³, surface = 4πr²', 'sphere', N, async () => { const r = ge('sphere', 2, 9, 9); return [near(r.volume, 32 / 3 * PI) && near(r.surface, 16 * PI), r.volume + ' / ' + r.surface]; });
  claim(G, 'works', 'cone: V = ⅓ × πr²h, surface = πr(r + √(r² + h²))', 'cone', N, async () => { const r = ge('cone', 5, 12, 0); return [near(r.volume, 100 * PI) && near(r.surface, PI * 5 * 18), r.volume + ' / ' + r.surface]; });
  claim(G, 'what', 'close enough to one of these eight shapes to give a usable figure', 'eight shapes', N, async () => { const o = options(G, 'shape'); return [o.length === 8, o.join(', ')]; });
  claim(G, 'ui', 'radius, half the diameter, in the first box', 'the first box is labelled for the radius', N, async () => { const l = spec(G).inputs[1].label; return [/radius/.test(l) && spec(G).inputs[1].key === 'a', l]; });
  claim(G, 'worked', 'Choose Cuboid and enter 2, 1 and 0.3. The volume is 0.6 cubic metres', 'the raised bed', N, async () => { const r = ge('cuboid', 2, 1, 0.3); return [near(r.volume, 0.6) && near(r.surface, 5.8) && near(r.area, 2), j([r.volume, r.surface, r.area])]; });
  claim(G, 'use', 'Sand or grain piles into roughly a cone, holding a third of the matching cylinder.', 'cone = cylinder ÷ 3', N, async () => { const a = ge('cone', 4, 3, 0).volume, b = ge('cylinder', 4, 3, 0).volume; return [near(a * 3, b), a + ' × 3 = ' + b]; });
  claim(G, 'mistake', 'A pot 30 cm across has a radius of 15 cm; using 30 makes the volume four times too large.', 'radius 30 against 15', N, async () => { const a = ge('cylinder', 30, 20, 0).volume, b = ge('cylinder', 15, 20, 0).volume; return [near(a / b, 4), a / b]; });
  claim(G, 'mistake', 'A bed 2 m by 50 cm by 30 cm goes in as 2, 0.5 and 0.3, all in metres.', '0.3 m³', N, async () => { const r = ge('cuboid', 2, 0.5, 0.3); return [near(r.volume, 0.3), r.volume]; });
  claim(G, 'dfaq', 'Cube the radius, then multiply by π and by 4/3. A ball 22 cm across has an 11 cm radius, so its volume is 5,575.28 cm³', 'the ball', N, async () => { const r = ge('sphere', 11, 0, 0); return [near(r.volume, 5575.28, 0.005) && near(r.surface, 1520.53, 0.005), r.volume + ' / ' + r.surface]; });
  claim(G, 'dfaq', 'Average the two parallel sides and multiply by the height between them. Sides of 6 m and 10 m, 4 m apart, give ½ × 16 × 4 = 32 m².', 'trapezium 6, 10, 4 apart', N, async () => { const r = ge('trapezium', 6, 4, 10); return [near(r.area, 32), r.area]; });
  claim(G, 'dfaq', 'so the perimeter cannot be known from them. A base of 8 and a height of 5 give an area of 20 whatever the slope.', 'no perimeter for a triangle', N, async () => {
    const r = ge('triangle', 8, 5, 3); return [near(r.area, 20) && isNaN(r.perimeter) && show(G, 'perimeter', r.perimeter) === '—', r.area + ', perimeter ' + show(G, 'perimeter', r.perimeter)];
  });
  claim(G, 'tip', 'Units are whatever you put in. Enter metres and area comes out in square metres, volume in cubic metres.', 'no unit is assumed: ×100 in gives ×10⁴ area, ×10⁶ volume', N, async () => {
    const a = ge('cuboid', 2, 3, 4), b = ge('cuboid', 200, 300, 400); return [near(b.area / a.area, 1e4) && near(b.volume / a.volume, 1e6) && !(spec(G).inputs || []).some((i) => i.unit), a.volume + ' → ' + b.volume];
  });
  claim(G, 'tip', 'Only the inputs relevant to the chosen shape are used — a circle ignores width and depth.', 'circle and sphere ignore the other boxes', N, async () => {
    const a = ge('circle', 5, 1, 1), b = ge('circle', 5, 99, 77), c = ge('sphere', 2, 1, 1), d = ge('sphere', 2, 50, 60);
    return [j(a) === j(b) && j(c) === j(d), a.area + ' / ' + b.area];
  });
  claim(G, 'tip', 'For a triangle the second input is the perpendicular height, not the slanted side length.', 'area = ½ × first × second box', N, async () => { const r = ge('triangle', 10, 6, 0); return [near(r.area, 30), r.area]; });
  claim(G, 'faq', 'Work in centimetres and divide the cubic centimetres by 1,000, or work in metres and multiply the cubic metres by 1,000.', 'the two routes agree', N, async () => {
    const cm = ge('cylinder', 15, 40, 0).volume / 1000, m = ge('cylinder', 0.15, 0.4, 0).volume * 1000; return [near(cm, m, 1e-9), cm + ' L / ' + m + ' L'];
  });

  /* ================================================================ */
  /* /mathematics/lcm-gcd/                                              */
  /* ================================================================ */
  const LG = '/mathematics/lcm-gcd/';
  const lg = (nums) => run(LG, { nums });
  const lcmBrute = (xs) => { let m = Math.max(...xs); const top = xs.reduce((p, x) => p * x, 1); for (let v = m; v <= top; v += m) if (xs.every((x) => v % x === 0)) return v; return top; };
  claim(LG, 'lede', 'Find the least common multiple and greatest common divisor of any list of numbers.', 'a list of six', N, async () => { const r = lg('6, 10, 15, 21, 35, 14'); return [r.gcd === 1 && r.lcm === 210 && r.count === 6, j([r.gcd, r.lcm, r.count])]; });
  claim(LG, 'card', 'Find the least common multiple and greatest common divisor of any list of numbers.', 'the card line is the lede', N, async () => { const r = lg('12 18 24'); return [r.gcd === 6 && r.lcm === 72, r.gcd + ' / ' + r.lcm]; });
  claim(LG, 'why', 'Enter the numbers. Get the LCM, the HCF and the simplest ratio.', 'all three', N, async () => { const r = lg('45, 60, 75'); return [r.lcm === 900 && r.gcd === 15 && r.simplified === '3 : 4 : 5', j([r.lcm, r.gcd, r.simplified])]; });
  claim(LG, 'formula', 'gcd via the Euclidean algorithm · lcm(a,b) = |ab| / gcd(a,b)', 'against brute force on random pairs and triples', N, async () => {
    const rnd = seeded(17);
    for (let k = 0; k < 150; k++) {
      const xs = Array.from({ length: 2 + (k % 2) }, () => ints(rnd, 1, 60));
      const r = lg(xs.join(', ')); let g = xs[0]; xs.forEach((x) => { g = gcd(g, x); });
      if (r.gcd !== g || r.lcm !== lcmBrute(xs)) return [false, xs.join(',') + ' → ' + r.gcd + ' / ' + r.lcm];
    }
    return [true, '150 lists'];
  });
  claim(LG, 'what', 'for 15 and 20 the GCD is 5 and the LCM is 60.', '15 and 20', N, async () => { const r = lg('15, 20'); return [r.gcd === 5 && r.lcm === 60, r.gcd + ' / ' + r.lcm]; });
  claim(LG, 'works', 'A longer list is folded two numbers at a time, and the LCM is built the same way from each pair’s GCD.', '4, 6, 10, 15', N, async () => { const r = lg('4, 6, 10, 15'); return [r.gcd === 1 && r.lcm === 60, r.gcd + ' / ' + r.lcm]; });
  claim(LG, 'ui', 'the whole numbers you enter; signs are dropped and zeros left out', '−12, 0, 18', N, async () => { const r = lg('-12, 0, 18'); return [r.gcd === 6 && r.lcm === 36 && r.count === 2, j([r.gcd, r.lcm, r.count])]; });
  claim(LG, 'worked', 'so in those units the widths are 3 : 4 : 5. Laid in three separate rows, the runs first finish level at 900 mm, the LCM, which takes 20 tiles of 45 mm, 15 of 60 mm and 12 of 75 mm.', 'tiles', N, async () => {
    const r = lg('45, 60, 75'); return [r.gcd === 15 && r.simplified === '3 : 4 : 5' && r.lcm === 900 && 900 / 45 === 20 && 900 / 60 === 15 && 900 / 75 === 12, j(r)];
  });
  claim(LG, 'use', 'Someone on a 4-day cycle and someone on a 6-day cycle share a day off every 12 days.', '4 and 6', N, async () => { const r = lg('4, 6'); return [r.lcm === 12, r.lcm]; });
  claim(LG, 'use', 'The LCM of 8 and 12, which is 24, is the smallest denominator for adding eighths and twelfths.', '8 and 12', N, async () => { const r = lg('8, 12'); return [r.lcm === 24, r.lcm]; });
  claim(LG, 'use', 'Lengths of 84 cm and 126 cm cut into equal pieces with nothing left over can be up to 42 cm long.', '84 and 126', N, async () => { const r = lg('84, 126'); return [r.gcd === 42, r.gcd]; });
  claim(LG, 'mistake', '84 × 126 is 10,584, a common multiple, but the least is 252; the product counts their shared factor of 42 twice.', 'product against LCM', N, async () => { const r = lg('84, 126'); return [r.lcm === 252 && r.product === 10584 && r.product / r.lcm === 42, r.lcm + ' / ' + r.product]; });
  claim(LG, 'mistake', 'Each entry is rounded to a whole number, so prices of £2.50 and £3.75 should go in as pence, 250 and 375, giving a GCD of 125.', 'decimals rounded; pence', N, async () => {
    const a = lg('2.50, 3.75'), b = lg('250, 375'); return [a.gcd === 1 && a.lcm === 12 && b.gcd === 125, '2.50, 3.75 → ' + a.gcd + ' (read as 3 and 4); 250, 375 → ' + b.gcd];
  });
  claim(LG, 'dfaq', '126 ÷ 84 leaves 42, and 84 ÷ 42 leaves 0, so the HCF is 42.', '126 and 84', N, async () => { const r = lg('126, 84'); return [r.gcd === 42, r.gcd]; });
  claim(LG, 'dfaq', '8 and 9 have a GCD of 1, so their LCM is 72, the plain product.', '8 and 9', N, async () => { const r = lg('8, 9'); return [r.gcd === 1 && r.lcm === 72 && /^Yes/.test(r.coprime), j([r.gcd, r.lcm, r.coprime])]; });
  claim(LG, 'dfaq', 'Services due every 6, 8 and 10 weeks all fall in the same week every 120 weeks.', '6, 8, 10', N, async () => { const r = lg('6, 8, 10'); return [r.lcm === 120, r.lcm]; });
  claim(LG, 'tip', 'GCD and HCF are the same thing under different names', 'one output named both ways', N, async () => { const l = outLabel(LG, 'gcd'); return [/divisor/.test(l) && /HCF/.test(l), l]; });
  claim(LG, 'tip', 'For two numbers, gcd × lcm always equals their product. That identity does not extend to three or more.', 'random pairs; 2, 4, 8', N, async () => {
    const rnd = seeded(19); for (let k = 0; k < 200; k++) { const a = ints(rnd, 1, 5000), b = ints(rnd, 1, 5000); const r = lg(a + ', ' + b); if (r.gcd * r.lcm !== a * b) return [false, a + ', ' + b]; }
    const t = lg('2, 4, 8'); return [t.gcd * t.lcm !== 64, 'pairs hold; 2, 4, 8: ' + t.gcd + ' × ' + t.lcm + ' = ' + t.gcd * t.lcm + ' against 64'];
  });
  claim(LG, 'faq', 'They need not be prime themselves — 8 and 9 are coprime despite both being composite.', '8 and 9 coprime; 8 and 12 not', N, async () => { const a = lg('8, 9'), b = lg('8, 12'); return [/^Yes/.test(a.coprime) && b.coprime === 'No', a.coprime + ' / ' + b.coprime]; });

  /* ================================================================ */
  /* /mathematics/number-base-converter/                                */
  /* ================================================================ */
  const NB = '/mathematics/number-base-converter/';
  const nb = (value, from) => run(NB, { value, from: String(from) });
  claim(NB, 'lede', 'Convert between binary, octal, decimal and hexadecimal, plus base 32 and base 36.', 'the six bases in and out', N, async () => {
    const v = optValues(NB, 'from'); const r = nb('2026', 10);
    return [v.join(',') === '2,8,10,16,32,36' && r.binary === '11111101010' && r.octal === '3752' && r.hex === '7EA' && r.base32 === '1VA' && r.base36 === '1KA', v.join(',') + ' → ' + j([r.binary, r.octal, r.hex, r.base32, r.base36])];
  });
  claim(NB, 'card', 'Convert between binary, octal, decimal and hexadecimal, plus base 32 and base 36.', 'the card line is the lede', N, async () => { const r = nb('1KA', 36); return [r.decimal === 2026, r.decimal]; });
  claim(NB, 'why', 'Enter a value in binary, octal, decimal, hex, base 32 or 36. Get all six.', 'every base in gives the same six out', N, async () => {
    const outs = [['11111101010', 2], ['3752', 8], ['2026', 10], ['7EA', 16], ['1VA', 32], ['1KA', 36]].map(([v, b]) => { const r = nb(v, b); return [r.decimal, r.binary, r.octal, r.hex, r.base32, r.base36].join(' '); });
    return [new Set(outs).size === 1, outs[0]];
  });
  claim(NB, 'formula', 'positional notation: Σ digitᵢ × baseⁱ', 'random values in every base against a sum done here', N, async () => {
    const rnd = seeded(23); const D = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let k = 0; k < 300; k++) {
      const base = [2, 8, 10, 16, 32, 36][k % 6]; const len = ints(rnd, 1, 8); let s = '', v = 0;
      for (let i = 0; i < len; i++) { const d = ints(rnd, i ? 0 : 1, base - 1); s += D[d]; v = v * base + d; }
      const r = nb(s, base); if (r.decimal !== v) return [false, s + ' in base ' + base + ' → ' + r.decimal + ', not ' + v];
    }
    return [true, '300 values'];
  });
  claim(NB, 'works', '7EA in hex = 7 × 16² + 14 × 16 + 10 = 2026', '7EA', N, async () => { const r = nb('7EA', 16); return [r.decimal === 2026, r.decimal]; });
  claim(NB, 'works', 'Going the other way, divide by the target base again and again and read the remainders from last to first.', 'repeated division done here', N, async () => {
    const D = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; const to = (n, b) => { let s = ''; do { s = D[n % b] + s; n = Math.floor(n / b); } while (n); return s; };
    const rnd = seeded(29); for (let k = 0; k < 200; k++) { const n = ints(rnd, 0, 1e9); const r = nb(String(n), 10); if (r.binary !== to(n, 2) || r.octal !== to(n, 8) || r.hex !== to(n, 16) || r.base32 !== to(n, 32) || r.base36 !== to(n, 36)) return [false, n]; }
    return [true, '200 numbers'];
  });
  claim(NB, 'works', 'the digit in position i, where A = 10, B = 11 … Z = 35', 'A, B and Z in base 36', N, async () => { const r = [nb('A', 36), nb('B', 36), nb('Z', 36), nb('z', 36)].map((x) => x.decimal); return [r.join(',') === '10,11,35,35', r.join(',')]; });
  claim(NB, 'works', '2, 8, 10, 16, 32 or 36', 'the From base choices', N, async () => { const v = optValues(NB, 'from'); return [v.join(',') === '2,8,10,16,32,36', v.join(',')]; });
  claim(NB, 'what', 'one octal digit stands for three bits, one hex digit for four', '7 → 111, F → 1111, 777 → 9 bits', N, async () => {
    const a = nb('777', 8), b = nb('FFF', 16); return [a.binary === '111111111' && b.binary === '111111111111', a.binary + ' / ' + b.binary];
  });
  claim(NB, 'worked', 'Enter 755 with From base set to Octal: the decimal value is 493 and the binary is 111101101.', 'chmod 755', N, async () => { const r = nb('755', 8); return [r.decimal === 493 && r.binary === '111101101' && r.hex === '1ED', j([r.decimal, r.binary, r.hex])]; });
  claim(NB, 'use', 'Subnet masks make sense in binary: 240 is 11110000, the first four bits set.', '240', N, async () => { const r = nb('240', 10); return [r.binary === '11110000', r.binary]; });
  claim(NB, 'use', 'A colour such as #1E90FF is three hex bytes, one each for red, green and blue.', '1E90FF needs 3 bytes', N, async () => { const r = nb('1E90FF', 16); return [r.bytes === 3 && r.decimal === 0x1E90FF, r.bytes + ' bytes, ' + r.decimal]; });
  claim(NB, 'mistake', '101 read as decimal is one hundred and one; read as binary it is 5.', '101 in two bases', N, async () => { const a = nb('101', 10), b = nb('101', 2); return [a.decimal === 101 && b.decimal === 5, a.decimal + ' / ' + b.decimal]; });
  claim(NB, 'mistake', 'Bytes required rounds the bit length up to whole bytes, so 2026 needs 11 bits but occupies 2 bytes.', '2026; 255 and 256 at the byte edge', N, async () => {
    const a = nb('2026', 10), b = nb('255', 10), c = nb('256', 10); return [a.bits === 11 && a.bytes === 2 && b.bytes === 1 && c.bytes === 2, j([a.bits, a.bytes, b.bytes, c.bytes])];
  });
  claim(NB, 'dfaq', '11000000 is 128 + 64 = 192.', '11000000', N, async () => { const r = nb('11000000', 2); return [r.decimal === 192, r.decimal]; });
  claim(NB, 'dfaq', '255, which is 11111111 in binary and FF in hex. Sixteen bits reach 65,535, or FFFF', '255 and 65,535', N, async () => {
    const a = nb('255', 10), b = nb('65535', 10); return [a.binary === '11111111' && a.hex === 'FF' && b.hex === 'FFFF' && b.bits === 16, a.hex + ' / ' + b.hex + ' (' + b.bits + ' bits)'];
  });
  claim(NB, 'dfaq', '2026 is 1KA in base 36 and 1VA in base 32.', '2026', N, async () => { const r = nb('2026', 10); return [r.base36 === '1KA' && r.base32 === '1VA', r.base36 + ' / ' + r.base32]; });
  claim(NB, 'tip', 'Prefixes are understood: 0b1010, 0xFF and 0o777 are read as binary, hex and octal with From base on Decimal or on their own base.', 'the prefixes, on Decimal and on their own base; 0B12 in hex is a number', N, async () => {
    const d = [nb('0b1010', 10), nb('0xFF', 10), nb('0o777', 10)].map((x) => x.decimal), o = [nb('0b1010', 2), nb('0xFF', 16), nb('0o777', 8)].map((x) => x.decimal);
    const h = nb('0B12', 16).decimal;
    return [d.join(',') === '10,255,511' && o.join(',') === '10,255,511' && h === 0xB12, 'on Decimal ' + d.join(',') + '; own base ' + o.join(',') + '; 0B12 in hex ' + h];
  });
  claim(NB, 'tip', 'Each hex digit is exactly four binary digits', 'each 4-bit group of the binary is one hex digit', N, async () => {
    const rnd = seeded(31);
    for (let k = 0; k < 100; k++) {
      const n = ints(rnd, 1, 2 ** 40); const r = nb(String(n), 10); const groups = r.grouped.split(' ');
      const hex = groups.map((g) => parseInt(g, 2).toString(16).toUpperCase()).join('');
      if (hex !== r.hex) return [false, r.grouped + ' / ' + r.hex];
    }
    return [true, '100 numbers'];
  });
  claim(NB, 'tip', 'Bases above 16 use letters up to Z. Base 36 is the highest that fits in digits plus the Latin alphabet.', 'ZZ in base 36; Z is not a base-32 digit', N, async () => {
    const a = nb('ZZ', 36), b = nb('Z', 32); return [a.decimal === 1295 && !b.decimal && /do not exist in base 32/.test(b.note), a.decimal + ' / ' + b.note];
  });
  claim(NB, 'faq', 'JavaScript numbers are exact only up to 2⁵³. Beyond about 53 bits the value cannot be represented precisely, so the tool refuses rather than returning a quietly wrong answer.', 'the 2⁵³ edge in three bases; fractions and minus signs', N, async () => {
    const ok53 = nb('1'.repeat(53), 2), over = nb('1'.repeat(54), 2), hex = nb('FFFFFFFFFFFFFFFF', 16), dec = nb('9007199254740993', 10), max = nb('9007199254740991', 10);
    const frac = nb('1.5', 10), neg = nb('-5', 10);
    const refused = [over, hex, dec].every((r) => r.decimal === undefined && /exceeds the range/.test(r.note));
    return [ok53.decimal === 2 ** 53 - 1 && max.decimal === 9007199254740991 && refused && frac.decimal === undefined && /fractional/.test(frac.note) && neg.decimal === -5 && neg.binary === '-101' && neg.bits === 3,
      '53 ones: ' + ok53.decimal + '; 54 ones: ' + over.note + '; 16 F: ' + hex.note + '; 2⁵³+1: ' + dec.note + '; 1.5: ' + frac.note + '; −5: ' + neg.binary + ' (' + neg.bits + ' bits)'];
  });

  /* ================================================================ */
  /* /mathematics/prime-factorisation/                                  */
  /* ================================================================ */
  const PR = '/mathematics/prime-factorisation/';
  const pf = (n) => run(PR, { n });
  const divisorsOf = (n) => { const d = []; for (let i = 1; i <= n; i++) if (n % i === 0) d.push(i); return d; };
  claim(PR, 'lede', 'Break a number into prime factors, list all divisors, and test whether it is prime.', '720720 (240 divisors) and 1e12 (169) listed in full', N, async () => {
    const a = pf(720720), b = pf(1e12), c = pf(2027);
    const la = a.divisorList.split(', ').length, lb = b.divisorList.split(', ').length;
    return [la === 240 && a.divisorCount === 240 && lb === 169 && /^Yes/.test(c.isPrime) && a.factorisation === '2^4 × 3^2 × 5 × 7 × 11 × 13', la + ' and ' + lb + ' divisors listed; 2027: ' + c.isPrime];
  });
  claim(PR, 'card', 'Break a number into prime factors, list all divisors, and test whether it is prime.', 'the card line is the lede', N, async () => { const r = pf(360); return [r.divisorList.split(', ').length === 24 && r.isPrime === 'No', r.divisorCount + ' divisors']; });
  claim(PR, 'why', 'Enter a number. Get its prime factors, divisors and a prime check.', 'a four-digit number', N, async () => { const r = pf(4620); return [r.factorisation === '2^2 × 3 × 5 × 7 × 11' && r.divisorList.split(', ').length === 48 && r.isPrime === 'No', j([r.factorisation, r.divisorCount])]; });
  claim(PR, 'why', 'See every divisor', 'the list matches brute force, never cut short', N, async () => {
    const rnd = seeded(37); for (let k = 0; k < 60; k++) { const n = ints(rnd, 1, 200000); const r = pf(n); if (r.divisorList !== divisorsOf(n).join(', ')) return [false, n]; } return [true, '60 numbers'];
  });
  claim(PR, 'formula', 'trial division up to √n', 'a semiprime and a prime near a trillion; a prime square', N, async () => {
    const a = pf(999983 * 1000003), b = pf(999999999989), c = pf(999983 * 999983);
    return [a.factorisation === '999983 × 1000003' && /^Yes/.test(b.isPrime) && c.factorisation === '999983^2', j([a.factorisation, b.isPrime, c.factorisation])];
  });
  claim(PR, 'what', '360 is 2 × 2 × 2 × 3 × 3 × 5, written compactly as 2³ × 3² × 5.', '360', N, async () => { const r = pf(360); return [r.factorList === '2 × 2 × 2 × 3 × 3 × 5' && r.factorisation === '2^3 × 3^2 × 5', r.factorList + ' = ' + r.factorisation]; });
  claim(PR, 'works', 'From the exponents, the number of divisors is each exponent plus one, multiplied together.', 'divisor count against brute force', N, async () => {
    const rnd = seeded(41); for (let k = 0; k < 80; k++) { const n = ints(rnd, 1, 100000); if (pf(n).divisorCount !== divisorsOf(n).length) return [false, n]; } return [true, '80 numbers'];
  });
  claim(PR, 'works', 'sum of divisors = Σ d, for every d that divides n exactly', 'sum against brute force', N, async () => {
    const rnd = seeded(43); for (let k = 0; k < 60; k++) { const n = ints(rnd, 1, 100000); if (pf(n).sumOfDivisors !== divisorsOf(n).reduce((s, d) => s + d, 0)) return [false, n]; } return [true, '60 numbers'];
  });
  claim(PR, 'worked', 'which is prime: 504 = 2^3 × 3^2 × 7.', '504', N, async () => { const r = pf(504); return [r.factorisation === '2^3 × 3^2 × 7' && r.divisorCount === 24 && r.sumOfDivisors === 1560, j([r.factorisation, r.divisorCount, r.sumOfDivisors])]; });
  claim(PR, 'worked', 'Because 2 and 7 appear to odd powers, 504 is not a perfect square; multiplying it by 14 makes every exponent even.', '504 × 14 = 7056', N, async () => { const r = pf(504 * 14); return [r.factorisation === '2^4 × 3^2 × 7^2', r.factorisation]; });
  claim(PR, 'use', 'Factor top and bottom and cancel shared primes: 504/1001 share a 7 and reduce to 72/143.', 'the shared 7', N, async () => {
    const a = pf(504).factorList.split(' × '), b = pf(1001).factorList.split(' × '); const shared = a.filter((x) => b.indexOf(x) >= 0);
    return [shared.join() === '7' && 504 / 7 === 72 && 1001 / 7 === 143, 'shared: ' + shared.join()];
  });
  claim(PR, 'use', 'A number is a perfect square when every exponent is even, and its square root halves each exponent.', '7056 = 84²', N, async () => { const a = pf(7056), b = pf(84); return [a.factorisation === '2^4 × 3^2 × 7^2' && b.factorisation === '2^2 × 3 × 7', a.factorisation + ' / ' + b.factorisation]; });
  claim(PR, 'mistake', '504 = 8 × 63 is a factorisation but not a prime one', 'only primes come out', N, async () => { const r = pf(504); return [r.factorList === '2 × 2 × 2 × 3 × 3 × 7', r.factorList]; });
  claim(PR, 'mistake', 'Trial division stops there: 1,000,000,000,000 is factorised, with all 169 of its divisors listed, but anything larger is refused rather than left running.', 'the trillion edge', N, async () => {
    const a = pf(1e12), b = pf(1e12 + 1); return [a.factorisation === '2^12 × 5^12' && a.divisorList.split(', ').length === 169 && !b.factorisation && /above a trillion/.test(b.note), a.factorisation + ' / ' + b.note];
  });
  claim(PR, 'dfaq', '1001 = 7 × 11 × 13. That is why 7, 11 and 13 all divide any six-digit number made of a three-digit block written twice, such as 123123.', '1001 and every abcabc', N, async () => {
    if (pf(1001).factorList !== '7 × 11 × 13') return [false, pf(1001).factorList];
    for (let x = 100; x <= 999; x++) { const f = pf(x * 1001).factorList.split(' × '); if (!['7', '11', '13'].every((p) => f.indexOf(p) >= 0)) return [false, x * 1001 + ': ' + f.join(' × ')]; }
    return [true, '900 numbers'];
  });
  claim(PR, 'dfaq', 'For 97 that means testing 2, 3, 5 and 7 only, since 11² is 121, and none goes, so its only divisors are 1, 97.', '97', N, async () => { const r = pf(97); return [/^Yes/.test(r.isPrime) && r.divisorList === '1, 97', r.isPrime + ' / ' + r.divisorList]; });
  claim(PR, 'dfaq', '28 qualifies: all its divisors add up to 56, and 56 − 28 = 28.', '28', N, async () => { const r = pf(28); return [r.sumOfDivisors === 56, r.sumOfDivisors]; });
  claim(PR, 'tip', 'Every whole number above 1 has exactly one prime factorisation', 'factors multiply back and are prime', N, async () => {
    const rnd = seeded(47); const isP = (p) => { if (p < 2) return false; for (let d = 2; d * d <= p; d++) if (p % d === 0) return false; return true; };
    for (let k = 0; k < 200; k++) { const n = ints(rnd, 2, 1e8); const f = pf(n).factorList.split(' × ').map(Number); if (f.reduce((p, x) => p * x, 1) !== n || !f.every(isP)) return [false, n]; }
    return [true, '200 numbers'];
  });
  claim(PR, 'tip', 'Trial division only needs to reach √n: any factor above the square root pairs with one below it.', 'a large prime factor left over is kept', N, async () => { const r = pf(2 * 999999937); return [r.factorisation === '2 × 999999937', r.factorisation]; });
  claim(PR, 'tip', '1 is not prime. It has only one divisor', '1', N, async () => { const r = pf(1); return [r.isPrime === 'No' && r.divisorCount === 1 && r.divisorList === '1' && /no prime factors/.test(r.factorisation), j([r.isPrime, r.divisorCount, r.factorisation])]; });
  manual(PR, 'faq', 'the presumed hardness of factoring very large semiprimes is what RSA encryption rests on.', 'background on cryptography, not something this tool does');

  /* ================================================================ */
  /* /mathematics/quadratic-solver/                                     */
  /* ================================================================ */
  const Q = '/mathematics/quadratic-solver/';
  const qs = (a, b, c) => run(Q, { a, b, c });
  claim(Q, 'lede', 'Solve ax² + bx + c = 0, including complex roots, vertex, and discriminant.', 'x² + 2x + 5', N, async () => {
    const r = qs(1, 2, 5); return [r.root1 === '-1.0000 + 2.0000i' && r.root2 === '-1.0000 − 2.0000i' && r.discriminant === -16 && r.vertexX === -1 && r.vertexY === 4, j(r)];
  });
  claim(Q, 'card', 'Solve ax² + bx + c = 0, including complex roots, vertex, and discriminant.', 'the card line is the lede', N, async () => { const r = qs(1, -3, 2); return [r.root1 === 2 && r.root2 === 1 && r.discriminant === 1, j(r)]; });
  claim(Q, 'why', 'Enter a, b and c. Get both roots, the vertex and the discriminant.', 'the ball', N, async () => {
    const r = qs(-4.9, 20, 1.5); return [near(r.root1, -0.0736702, 1e-6) && near(r.root2, 4.15530, 1e-5) && near(r.vertexX, 20 / 9.8) && near(r.discriminant, 429.4), j(r)];
  });
  claim(Q, 'why', 'Calculators that stop at complex roots', 'this one gives the complex pair', N, async () => { const r = qs(2, 2, 5); return [/i$/.test(r.root1) && r.nature === 'Two complex conjugate roots', r.root1 + ' / ' + r.root2]; });
  claim(Q, 'formula', 'x = (−b ± √(b² − 4ac)) / 2a', 'roots satisfy the equation; no cancellation when b² ≫ 4ac', N, async () => {
    const rnd = seeded(53);
    for (let k = 0; k < 300; k++) {
      const a = (ints(rnd, 1, 200) / 10) * (k % 2 ? 1 : -1), b = ints(rnd, -500, 500) / 10, c = ints(rnd, -500, 500) / 10;
      const r = qs(a, b, c); if (typeof r.root1 !== 'number' || r.root1 === r.root2) continue;
      const exact1 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a), exact2 = (-b - Math.sqrt(b * b - 4 * a * c)) / (2 * a);
      if (!near(r.root1, exact1, 1e-9 * Math.max(1, Math.abs(exact1))) || !near(r.root2, exact2, 1e-9 * Math.max(1, Math.abs(exact2)))) return [false, [a, b, c].join(', ') + ' → ' + r.root1 + ', ' + r.root2];
    }
    const t = qs(1, 1e8, 1), u = qs(1, -1e8, 1);
    return [Math.abs(t.root1 / -1e-8 - 1) < 1e-12 && t.root2 === -1e8 && Math.abs(u.root2 / 1e-8 - 1) < 1e-12 && u.root1 === 1e8,
      'x² + 10⁸x + 1: ' + t.root1 + ', ' + t.root2 + '; x² − 10⁸x + 1: ' + u.root1 + ', ' + u.root2];
  });
  claim(Q, 'what', 'two crossings, one point where it just touches, or none on the real number line.', 'the three natures', N, async () => {
    const n = [qs(1, -3, 2), qs(1, -6, 9), qs(1, 0, 1)].map((r) => r.nature); return [n.join('|') === 'Two distinct real roots|One repeated real root|Two complex conjugate roots', n.join(' | ')];
  });
  claim(Q, 'works', 'The vertex sits halfway between the roots, at x = −b ÷ 2a, and its height comes from putting that x back into the equation.', 'vertex x is the roots\' midpoint', N, async () => {
    const r = qs(2, -4, -6); return [near(r.vertexX, (r.root1 + r.root2) / 2) && near(r.vertexY, 2 * r.vertexX * r.vertexX - 4 * r.vertexX - 6), r.vertexX + ', ' + r.vertexY];
  });
  claim(Q, 'works', 'vertex: x = −b ÷ 2a, y = c − b² ÷ 4a', 'random coefficients', N, async () => {
    const rnd = seeded(59); for (let k = 0; k < 100; k++) { const a = (ints(rnd, 1, 50) / 5) * (k % 2 ? 1 : -1), b = ints(rnd, -50, 50), c = ints(rnd, -50, 50); const r = qs(a, b, c); if (!near(r.vertexX, -b / (2 * a)) || !near(r.vertexY, c - b * b / (4 * a), 1e-9 * Math.max(1, Math.abs(c - b * b / (4 * a))))) return [false, [a, b, c].join(',')]; }
    return [true, '100 cases'];
  });
  claim(Q, 'works', 'when D < 0: x = −b ÷ 2a ± (√(−D) ÷ 2a) i', 'complex parts, a negative a too', N, async () => {
    const a = qs(1, 2, 5), b = qs(-2, 4, -10); return [a.root1 === '-1.0000 + 2.0000i' && b.root1 === '1.0000 + 2.0000i' && b.root2 === '1.0000 − 2.0000i', a.root1 + ' / ' + b.root1];
  });
  claim(Q, 'worked', 'The discriminant is 16 + 48 = 64, a perfect square, so the roots come out whole: x = 3 and x = −1. The vertex is at x = 1, y = −8', '2x² − 4x − 6', N, async () => {
    const r = qs(2, -4, -6); return [r.discriminant === 64 && r.root1 === 3 && r.root2 === -1 && r.vertexX === 1 && r.vertexY === -8, j(r)];
  });
  claim(Q, 'use', 'A rectangle 3 m longer than it is wide with an area of 40 m² gives x² + 3x − 40 = 0, so the width is 5 m.', 'x² + 3x − 40', N, async () => { const r = qs(1, 3, -40); return [r.root1 === 5 && r.root2 === -8, r.root1 + ', ' + r.root2]; });
  claim(Q, 'mistake', 'For x² − 5x + 6, b is −5; entering 5 gives roots of −2 and −3 instead of 3 and 2.', 'the sign of b', N, async () => { const a = qs(1, -5, 6), b = qs(1, 5, 6); return [a.root1 === 3 && a.root2 === 2 && b.root1 === -2 && b.root2 === -3, [a.root1, a.root2, b.root1, b.root2].join(', ')]; });
  claim(Q, 'mistake', 'x² = 3x + 10 must become x² − 3x − 10 = 0 first', 'x² − 3x − 10', N, async () => { const r = qs(1, -3, -10); return [r.root1 === 5 && r.root2 === -2, r.root1 + ', ' + r.root2]; });
  claim(Q, 'dfaq', 'For x² + 2x + 5 the discriminant is −16 and the roots are −1 ± 2i; the vertex, at (−1, 4), sits above the axis.', 'x² + 2x + 5', N, async () => { const r = qs(1, 2, 5); return [r.discriminant === -16 && r.root1 === '-1.0000 + 2.0000i' && r.vertexX === -1 && r.vertexY === 4, j(r)]; });
  claim(Q, 'dfaq', 'x² − 6x + 9 = 0 is (x − 3)², with the repeated root 3.', '(x − 3)², and 0.1x² + 0.6x + 0.9 whose b² − 4ac is lost to rounding', N, async () => {
    const a = qs(1, -6, 9), b = qs(0.1, 0.6, 0.9); return [a.root1 === 3 && a.nature === 'One repeated real root' && b.nature === 'One repeated real root' && show(Q, 'root1', b.root1) === '-3', a.nature + '; 0.1, 0.6, 0.9: ' + b.nature + ' ' + show(Q, 'root1', b.root1)];
  });
  claim(Q, 'dfaq', 'x² − 2 = 0 has roots of plus or minus √2, shown as 1.4142 and −1.4142; enter b as 0 when there is no x term.', 'as the page shows them', N, async () => {
    const r = qs(1, 0, -2); const s1 = show(Q, 'root1', r.root1), s2 = show(Q, 'root2', r.root2); return [s1 === '1.4142' && s2 === '-1.4142', s1 + ' / ' + s2];
  });
  claim(Q, 'tip', 'The discriminant alone tells you the root type: positive gives two real roots, zero gives one, negative gives a complex pair.', 'sign of D against nature', N, async () => {
    const rnd = seeded(61); for (let k = 0; k < 200; k++) { const a = ints(rnd, 1, 5), b = ints(rnd, -10, 10), c = ints(rnd, -10, 10); const r = qs(a, b, c); const d = b * b - 4 * a * c; const want = d > 0 ? 'Two distinct real roots' : d === 0 ? 'One repeated real root' : 'Two complex conjugate roots'; if (r.nature !== want) return [false, [a, b, c].join(',')]; }
    return [true, '200 cases'];
  });
  claim(Q, 'tip', 'The vertex is the parabola’s minimum when a > 0 and its maximum when a < 0.', 'the curve either side of the vertex', N, async () => {
    const f = (a, b, c, x) => a * x * x + b * x + c; const u = qs(2, -4, 1), d = qs(-2, 4, 1);
    return [f(2, -4, 1, u.vertexX + 0.1) > u.vertexY && f(2, -4, 1, u.vertexX - 0.1) > u.vertexY && f(-2, 4, 1, d.vertexX + 0.1) < d.vertexY && f(-2, 4, 1, d.vertexX - 0.1) < d.vertexY, u.vertexY + ' / ' + d.vertexY];
  });
  claim(Q, 'faq', 'The equation is no longer quadratic but linear (bx + c = 0), with the single root x = −c/b. The tool detects and handles this.', 'a = 0', N, async () => {
    const r = qs(0, 2, -6), z = qs(0, 0, 5); return [r.root1 === 3 && /Linear/.test(r.nature) && isNaN(r.root2) && isNaN(z.root1), j(r) + ' / b = 0: ' + z.root1];
  });

  /* ================================================================ */
  /* /mathematics/ratio-calculator/                                     */
  /* ================================================================ */
  const R = '/mathematics/ratio-calculator/';
  const ra = (a, b, c, total) => run(R, { a, b, c: c === undefined ? 0 : c, total: total === undefined ? 0 : total });
  claim(R, 'lede', 'Simplify ratios, solve for a missing term, and scale a ratio to a total.', '30 : 40, C = 9, total 700', N, async () => { const r = ra(30, 40, 9, 700); return [r.simplified === '3 : 4' && near(r.missingD, 12) && near(r.shareA, 300) && near(r.shareB, 400), j(r)]; });
  claim(R, 'card', 'Simplify ratios, solve for a missing term, and scale a ratio to a total.', 'the card line is the lede', N, async () => { const r = ra(5, 3, 15, 1200); return [r.simplified === '5 : 3' && near(r.missingD, 9) && near(r.shareA, 750), j([r.simplified, r.missingD, r.shareA])]; });
  claim(R, 'why', 'Enter the ratio. Simplify it, solve A:B = C:D or share a total.', '2 : 7 of £900', N, async () => { const r = ra(2, 7, 4, 900); return [r.simplified === '2 : 7' && near(r.missingD, 14) && near(r.shareA, 200) && near(r.shareB, 700), j([r.simplified, r.missingD, r.shareA, r.shareB])]; });
  claim(R, 'why', 'Rounding that leaves pennies over', 'the shares always add back to the total', N, async () => {
    const rnd = seeded(67); for (let k = 0; k < 200; k++) { const a = ints(rnd, 1, 99), b = ints(rnd, 1, 99), t = ints(rnd, 1, 1e6) / 100; const r = ra(a, b, 0, t); if (!near(r.shareA + r.shareB, t, 1e-9 * t)) return [false, a + ':' + b + ' of ' + t]; }
    return [true, '200 shares'];
  });
  claim(R, 'formula', 'a : b = c : d → d = bc / a', 'D on random inputs', N, async () => {
    const rnd = seeded(71); for (let k = 0; k < 100; k++) { const a = ints(rnd, 1, 500), b = ints(rnd, 1, 500), c = ints(rnd, 0, 500); if (!near(ra(a, b, c).missingD, b * c / a)) return [false, [a, b, c].join(',')]; } return [true, '100 cases'];
  });
  claim(R, 'works', 'Simplifying divides both terms by their greatest common divisor. A proportion A : B = C : D is solved by cross-multiplying. Sharing a total gives each side its own part of A + B.', 'all three on 48 : 16', N, async () => {
    const r = ra(48, 16, 6, 100); return [r.simplified === '3 : 1' && near(r.missingD, 2) && near(r.shareA, 75), j([r.simplified, r.missingD, r.shareA])];
  });
  claim(R, 'works', 'A’s share = total × A ÷ (A + B)', 'the shares and percentages', N, async () => { const r = ra(3, 2, 0, 50); return [near(r.shareA, 30) && near(r.shareB, 20) && near(r.percentA, 60) && near(r.percentB, 40), j([r.shareA, r.shareB, r.percentA])]; });
  claim(R, 'what', 'so 30 : 40 and 300 : 400 are the same ratio.', 'both simplify to 3 : 4', N, async () => { const a = ra(30, 40), b = ra(300, 400); return [a.simplified === '3 : 4' && b.simplified === '3 : 4', a.simplified + ' / ' + b.simplified]; });
  claim(R, 'worked', 'Enter A = 5, B = 3 and share a total of 1200: A takes £750 and B £450, which is 62.5% and 37.5%. With C = 15, the proportion 5 : 3 = 15 : D gives D = 9', 'the partners', N, async () => {
    const r = ra(5, 3, 15, 1200); return [near(r.shareA, 750) && near(r.shareB, 450) && near(r.percentA, 62.5) && near(r.percentB, 37.5) && near(r.missingD, 9), j(r)];
  });
  claim(R, 'use', 'At 1 : 50, 9 cm on the drawing is 450 cm, or 4.5 m, on site.', '1 : 50', N, async () => { const r = ra(1, 50, 9); return [near(r.missingD, 450), r.missingD]; });
  claim(R, 'use', 'A 48-tooth chainring driving a 16-tooth sprocket simplifies to 3 : 1', '48 : 16', N, async () => { const r = ra(48, 16); return [r.simplified === '3 : 1', r.simplified]; });
  claim(R, 'mistake', '1.5 : 2 rounded to 2 : 2 becomes 1 : 1; entered as it is, it is scaled to whole numbers and simplified to 3 : 4.', '1.5 : 2 and 2 : 2', N, async () => { const a = ra(1.5, 2), b = ra(2, 2); return [a.simplified === '3 : 4' && b.simplified === '1 : 1', a.simplified + ' / ' + b.simplified]; });
  claim(R, 'mistake', 'C has to correspond to A; if your known amount belongs with B, swap A and B first.', 'C sits on A\'s side', N, async () => { const a = ra(5, 3, 9), b = ra(3, 5, 9); return [near(a.missingD, 5.4) && near(b.missingD, 15), a.missingD + ' / ' + b.missingD]; });
  claim(R, 'dfaq', '£900 shared 2 : 7 is £900 ÷ 9 = £100 a part, so £200 and £700.', '2 : 7 of 900', N, async () => { const r = ra(2, 7, 0, 900); return [near(r.shareA, 200) && near(r.shareB, 700), r.shareA + ' / ' + r.shareB]; });
  claim(R, 'dfaq', '45 : 60 shares a factor of 15 and becomes 3 : 4.', '45 : 60', N, async () => { const r = ra(45, 60); return [r.simplified === '3 : 4', r.simplified]; });
  claim(R, 'dfaq', 'girls are 3 ÷ 5 = 60% and boys 40%.', '3 : 2', N, async () => { const r = ra(3, 2); return [near(r.percentA, 60) && near(r.percentB, 40), r.percentA + ' / ' + r.percentB]; });
  claim(R, 'dfaq', 'but this calculator takes two terms.', 'two ratio boxes, A and B', N, async () => { const k = spec(R).inputs.map((i) => i.key + ':' + i.label); return [k.join('|') === 'a:A|b:B|c:C (for A:B = C:D)|total:Share a total of', k.join(' | ')]; });
  claim(R, 'tip', 'In 3:4, A is 3/7 of the total, not 3/4.', '3 : 4', N, async () => { const r = ra(3, 4); return [near(r.percentA, 300 / 7) && r.asFraction === '3/4', r.percentA + '% (the fraction line, A : B, is ' + r.asFraction + ')']; });
  claim(R, 'tip', 'Scaling a recipe or a mix is a proportion problem: keep A:B fixed and solve for the new quantity.', '200 g flour : 150 g sugar with 300 g flour', N, async () => { const r = ra(200, 150, 300); return [near(r.missingD, 225), r.missingD]; });
  claim(R, 'tip', 'Aspect ratios are just ratios in their simplest form — 1920:1080 reduces to 16:9.', '1920 : 1080', N, async () => { const r = ra(1920, 1080); return [r.simplified === '16 : 9', r.simplified]; });

  /* ================================================================ */
  /* /mathematics/roman-numerals/                                       */
  /* ================================================================ */
  const RO = '/mathematics/roman-numerals/';
  const rn = (value) => run(RO, { value: String(value) });
  const romans = (() => { let m = null; return () => m || (m = Array.from({ length: 3999 }, (_, i) => rn(i + 1).result)); })();
  claim(RO, 'lede', 'Convert numbers to Roman numerals and back, with the rules explained.', 'every number 1–3999 there and back', N, async () => {
    const all = romans(); for (let n = 1; n <= 3999; n++) { const back = rn(all[n - 1]); if (back.decimal !== n || back.note) return [false, n + ' → ' + all[n - 1] + ' → ' + back.decimal]; } return [true, '3999 round trips'];
  });
  claim(RO, 'card', 'Convert numbers to Roman numerals and back, with the rules explained.', 'the card line is the lede', N, async () => { const a = rn(1994), b = rn('MCMXCIV'); return [a.result === 'MCMXCIV' && b.result === '1994', a.result + ' / ' + b.result]; });
  claim(RO, 'why', 'Type a number or a numeral. Get the conversion and the breakdown.', 'both directions with a breakdown', N, async () => { const a = rn(1994), b = rn('MCMXCIV'); return [a.breakdown === 'M CM XC IV' && b.breakdown === 'M CM XC IV' && b.direction === 'Roman → Number', a.breakdown + ' / ' + b.direction]; });
  claim(RO, 'formula', 'I=1, V=5, X=10, L=50, C=100, D=500, M=1000', 'each letter', N, async () => { const v = ['I', 'V', 'X', 'L', 'C', 'D', 'M'].map((s) => rn(s).decimal); return [v.join(',') === '1,5,10,50,100,500,1000', v.join(',')]; });
  claim(RO, 'what', 'A smaller symbol placed before a larger one is subtracted instead, so XL is 40 and CM is 900.', 'XL and CM', N, async () => { const a = rn('XL').decimal, b = rn('CM').decimal; return [a === 40 && b === 900, a + ' / ' + b]; });
  claim(RO, 'works', 'From a number, the converter takes the largest of thirteen values that fits, writes its symbol, subtracts and repeats.', 'greedy over the 13 values', N, async () => {
    const MAP = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    const all = romans(); for (let n = 1; n <= 3999; n++) { let s = '', m = n; for (const [v, t] of MAP) while (m >= v) { s += t; m -= v; } if (all[n - 1] !== s) return [false, n]; } return [true, '3999 numbers'];
  });
  claim(RO, 'works', 'then rewrites the total in standard form to test the spelling you typed.', 'IIII is tested and flagged', N, async () => { const r = rn('IIII'); return [r.decimal === 4 && /IV/.test(r.note), r.note]; });
  claim(RO, 'worked', '3888 gives the longest numeral in the standard range: MMMDCCCLXXXVIII, fifteen characters.', 'the longest of all 3999', N, async () => {
    const all = romans(); let best = 0; all.forEach((s, i) => { if (s.length > all[best].length) best = i; }); const longest = all.filter((s) => s.length === all[best].length);
    return [all[3887] === 'MMMDCCCLXXXVIII' && all[3887].length === 15 && longest.length === 1, (best + 1) + ': ' + all[best] + ' (' + all[best].length + ')'];
  });
  claim(RO, 'worked', 'By contrast, 1666 uses each of the seven symbols exactly once, in descending order: MDCLXVI.', '1666', N, async () => { const r = rn(1666); return [r.result === 'MDCLXVI', r.result]; });
  claim(RO, 'use', 'Tell Henry VIII from Henry VII', 'VIII and VII', N, async () => { const a = rn('VIII').decimal, b = rn('VII').decimal; return [a === 8 && b === 7, a + ' / ' + b]; });
  claim(RO, 'use', 'Check a date before it becomes permanent: 1999 is MCMXCIX.', '1999', N, async () => { const r = rn(1999); return [r.result === 'MCMXCIX', r.result]; });
  claim(RO, 'use', 'Clause and schedule numbers such as (xiv) are read the same way in lower case.', 'xiv', N, async () => { const r = rn('xiv'); return [r.decimal === 14 && !r.note, r.decimal]; });
  claim(RO, 'mistake', 'Only I, X and C are subtracted, and only from the next two symbols up, so 499 is CDXCIX: 400, 90 and 9.', '499, and ID flagged', N, async () => { const a = rn(499), b = rn('ID'); return [a.result === 'CDXCIX' && a.breakdown === 'CD XC IX' && b.decimal === 499 && /CDXCIX/.test(b.note), a.result + ' / ' + b.note]; });
  claim(RO, 'mistake', 'In MCMXL the first C belongs to CM, 900, not to the M before it, so the numeral is 1940.', 'MCMXL', N, async () => { const r = rn('MCMXL'); return [r.decimal === 1940 && r.breakdown === 'M CM XL', r.decimal + ' ' + r.breakdown]; });
  claim(RO, 'dfaq', 'MMXXVI: MM for 2000, XX for 20 and VI for 6. The hundreds place is empty, and an empty place is simply left out.', '2026', N, async () => { const r = rn(2026); return [r.result === 'MMXXVI', r.result]; });
  claim(RO, 'dfaq', 'In standard notation, 3999, written MMMCMXCIX. Enter it here and the breakdown shows the pieces: M M M CM XC IX.', '3999; 4000 refused; MMMM flagged', N, async () => {
    const a = rn(3999), b = rn(4000), c = rn('MMMM');
    return [a.result === 'MMMCMXCIX' && a.breakdown === 'M M M CM XC IX' && !b.result && /1 to 3999/.test(b.note) && /stop at 3999/.test(c.note), a.breakdown + ' / ' + b.note + ' / MMMM: ' + c.note];
  });
  claim(RO, 'dfaq', 'the converter reads xiv and XIV alike as 14.', 'case', N, async () => { const a = rn('xiv'), b = rn('XIV'); return [a.decimal === 14 && b.decimal === 14 && a.breakdown === b.breakdown, a.decimal + ' / ' + b.decimal]; });
  claim(RO, 'dfaq', 'It reads it as 4 but flags that the standard spelling is IV. Any non-standard numeral gets the same treatment: its value, plus the form to use instead.', 'IIII, VV, IC, XXXX', N, async () => {
    const t = [['IIII', 4, 'IV'], ['VV', 10, 'X'], ['IC', 99, 'XCIX'], ['XXXX', 40, 'XL']].map(([s, v, f]) => { const r = rn(s); return r.decimal === v && new RegExp('is ' + f + '\\.$').test(r.note); });
    return [t.every(Boolean), j(['IIII', 'VV', 'IC', 'XXXX'].map((s) => rn(s).note))];
  });
  claim(RO, 'tip', 'Subtractive pairs are limited to IV, IX, XL, XC, CD and CM. IC for 99 is not valid — it is XCIX.', 'no other pair in any output; 99', N, async () => {
    const all = romans(); const V = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; const allowed = ['IV', 'IX', 'XL', 'XC', 'CD', 'CM'];
    for (const s of all) for (let i = 0; i + 1 < s.length; i++) if (V[s[i]] < V[s[i + 1]] && allowed.indexOf(s[i] + s[i + 1]) < 0) return [false, s];
    return [rn(99).result === 'XCIX', '99 is ' + rn(99).result];
  });
  claim(RO, 'tip', 'A symbol repeats at most three times: 4 is IV, not IIII.', 'no output repeats a letter four times', N, async () => { const bad = romans().filter((s) => /(.)\1\1\1/.test(s)); return [!bad.length && rn(4).result === 'IV', bad.slice(0, 3).join(',') || 'none']; });
  claim(RO, 'tip', 'There is no zero and no way to write a fraction', '0 and 3.5 refused', N, async () => { const a = rn(0), b = rn('3.5'); return [!a.result && !b.result && a.note && b.note, a.note + ' / ' + b.note]; });
  claim(RO, 'faq', 'Most converters stop where the unambiguous notation does.', 'stops at 3999', N, async () => { const a = rn(3999), b = rn(4000); return [a.result === 'MMMCMXCIX' && !b.result && /overbar/.test(b.note), b.note]; });

  /* ================================================================ */
  /* /mathematics/scientific-calculator/ (live tool)                    */
  /* ================================================================ */
  const SC = '/mathematics/scientific-calculator/';
  claim(SC, 'lede', 'A full scientific calculator with trigonometry, logarithms, powers, roots and constants.', 'one of each', N, async () => {
    const v = [ev('sin(pi/2)'), ev('log(1000)'), ev('ln(e)'), ev('2^10'), ev('sqrt(2)^2'), ev('cbrt(27)'), ev('tau/pi')];
    return [near(v[0], 1) && near(v[1], 3) && near(v[2], 1) && v[3] === 1024 && near(v[4], 2) && near(v[5], 3) && near(v[6], 2), v.join(', ')];
  });
  claim(SC, 'card', 'A full scientific calculator with trigonometry, logarithms, powers, roots and constants.', 'the card line is the lede', N, async () => { const v = ev('cos(0)+log2(8)+phi^0'); return [near(v, 5), v]; });
  claim(SC, 'why', 'Type the expression or tap the keys. Trig, logs, powers and roots.', 'the keypad builds the same expression', B, async () => {
    const p = await K.open(SC, { wait: '.calc-expr' });
    try {
      for (const label of ['2', '+', '3', '×', '4']) { const ok = await p.evaluate((l) => { const b = [...document.querySelectorAll('.calc-key')].find((x) => x.textContent === l); if (!b) return false; b.click(); return true; }, label); if (!ok) return [false, 'no key ' + label]; }
      const r = await p.evaluate(() => [document.querySelector('.calc-expr').value, document.querySelector('.calc-result').textContent]);
      const keys = await p.evaluate(() => [...document.querySelectorAll('.calc-key')].map((b) => b.textContent));
      return [r[0] === '2+3*4' && r[1] === '14' && ['sin', 'log', 'xʸ', '√', '∛'].every((k) => keys.indexOf(k) >= 0), j(r) + ' keys ' + keys.join(' ')];
    } finally { await p.close(); }
  });
  claim(SC, 'why', 'Set degrees or radians', 'the angle mode changes trig', N, async () => { const a = ev('sin(90)', 'deg'), b = ev('sin(90)', 'rad'); return [near(a, 1) && near(b, Math.sin(90)), a + ' / ' + b]; });
  claim(SC, 'privacy', 'Nothing you enter is transmitted or logged, and the page keeps working with the network off.', 'typing sends nothing, and works offline', B, async () => {
    const p = await K.open(SC, { wait: '.calc-expr' });
    try {
      await K.sleep(500);
      const before = p.__requests.length;
      await p.type('.calc-expr', '123456789*7');
      await p.keyboard.press('Enter');
      await K.sleep(800);
      const sent = p.__requests.slice(before);
      const stored = await p.evaluate(() => { const all = []; for (const s of [localStorage, sessionStorage]) for (let i = 0; i < s.length; i++) all.push(s.getItem(s.key(i))); return all.join(' '); });
      await p.setOfflineMode(true);
      await p.evaluate(() => { const e = document.querySelector('.calc-expr'); e.value = ''; e.dispatchEvent(new Event('input')); e.focus(); });
      await p.type('.calc-expr', '6*7');
      const off = await p.$eval('.calc-result', (e) => e.textContent);
      await p.setOfflineMode(false);
      return [!sent.length && off === '42', 'requests after typing: ' + (sent.map((r) => r.url).join(', ') || 'none') + '; offline 6*7 = ' + off];
    } finally { await p.close(); }
  });
  claim(SC, 'privacy', 'The last 20 lines of history, the memory and the angle mode are kept in this browser only, so they are there next time; Clear removes the history.', 'one versioned key in localStorage, kept across a reload, emptied by Clear', B, async () => {
    const p = await K.open(SC, { wait: '.calc-expr' });
    try {
      await p.evaluate(() => localStorage.removeItem('1234tools.scientific.v1'));
      for (let k = 0; k < 22; k++) { await p.evaluate((x) => { const e = document.querySelector('.calc-expr'); e.value = String(x) + '+1'; e.dispatchEvent(new Event('input')); }, k); await p.focus('.calc-expr'); await p.keyboard.press('Enter'); }
      await p.evaluate(() => [...document.querySelectorAll('[data-angle]')].find((b) => b.dataset.angle === 'deg').click());
      const kept = await p.evaluate(() => JSON.parse(localStorage.getItem('1234tools.scientific.v1') || '{}'));
      await p.reload({ waitUntil: 'load' });
      await p.waitForSelector('.calc-expr');
      const after = await p.evaluate(() => [document.querySelectorAll('.calc-hist-row').length, document.querySelector('.calc-display .calc-mode').textContent, Object.keys(localStorage).filter((k) => /scientific/.test(k)).join(',')]);
      await p.evaluate(() => [...document.querySelectorAll('.calc-history .btn-ghost')].find((b) => b.textContent === 'Clear').click());
      const cleared = await p.evaluate(() => [document.querySelectorAll('.calc-hist-row').length, (JSON.parse(localStorage.getItem('1234tools.scientific.v1') || '{}').history || []).length]);
      return [kept.history.length === 20 && after[0] === 20 && after[1] === 'DEG' && after[2] === '1234tools.scientific.v1' && cleared[0] === 0 && cleared[1] === 0, 'kept ' + kept.history.length + ', after reload ' + after.join(' / ') + ', after Clear ' + cleared.join('/')];
    } finally { try { await p.evaluate(() => localStorage.removeItem('1234tools.scientific.v1')); } catch (e) { /* closed */ } await p.close(); }
  });
  claim(SC, 'tip', 'Type expressions directly or use the keypad — both feed the same parser, so 2+3*4 correctly gives 14, not 20.', 'precedence', N, async () => { const v = [ev('2+3*4'), ev('(2+3)*4'), ev('2^3^2'), ev('-2^2')]; return [v.join(',') === '14,20,512,-4', v.join(', ')]; });
  claim(SC, 'tip', 'Supported functions: sin, cos, tan and their inverses and hyperbolics, ln, log, log2, sqrt, cbrt, abs, exp, floor, ceil, round, sign. Use ! for factorial.', 'every one named', N, async () => {
    const t = [['sin(0)', 0], ['cos(0)', 1], ['tan(0)', 0], ['asin(1)', Math.PI / 2], ['acos(1)', 0], ['atan(1)', Math.PI / 4], ['sinh(1)', Math.sinh(1)], ['cosh(1)', Math.cosh(1)], ['tanh(1)', Math.tanh(1)],
      ['ln(e^2)', 2], ['log(100)', 2], ['log2(1024)', 10], ['sqrt(81)', 9], ['cbrt(-8)', -2], ['abs(-3)', 3], ['exp(1)', Math.E], ['floor(2.7)', 2], ['ceil(2.1)', 3], ['round(2.5)', 3], ['sign(-4)', -1], ['5!', 120], ['0!', 1]];
    const bad = t.filter(([s, v]) => !near(ev(s), v, 1e-12)); return [!bad.length, bad.map(([s]) => s + ' = ' + ev(s)).join(', ') || t.length + ' functions'];
  });
  claim(SC, 'tip', 'Constants pi, e, tau and phi can be used anywhere a number can', 'in sums, powers, functions and brackets', N, async () => {
    const v = [ev('pi'), ev('e'), ev('tau'), ev('phi'), ev('phi^2-phi'), ev('2*pi/tau'), ev('-e+e'), ev('sqrt(tau*pi/2)/pi')];
    return [near(v[0], Math.PI) && near(v[1], Math.E) && near(v[2], 2 * Math.PI) && near(v[3], (1 + Math.sqrt(5)) / 2) && near(v[4], 1) && near(v[5], 1) && v[6] === 0 && near(v[7], 1), v.join(', ')];
  });
  claim(SC, 'tip', 'The angle mode applies to trigonometric functions only', 'deg changes sin and asin, not log, sinh or sqrt', N, async () => {
    const same = ['log(50)', 'sinh(1)', 'sqrt(2)', 'exp(1)', '2^0.5'].every((s) => ev(s, 'deg') === ev(s, 'rad'));
    return [same && near(ev('asin(1)', 'deg'), 90) && near(ev('cos(180)', 'deg'), -1) && near(ev('sin(100)', 'grad'), 1), 'asin(1) in deg = ' + ev('asin(1)', 'deg')];
  });
  claim(SC, 'tip', 'and is shown next to the display so it cannot be mistaken.', 'the mode tag sits in the display and follows the buttons', B, async () => {
    const p = await K.open(SC, { wait: '.calc-expr' });
    try {
      const first = await p.$eval('.calc-display .calc-mode', (e) => e.textContent);
      await p.evaluate(() => [...document.querySelectorAll('[data-angle]')].find((b) => b.dataset.angle === 'deg').click());
      await p.type('.calc-expr', 'sin(90)');
      const r = await p.evaluate(() => [document.querySelector('.calc-display .calc-mode').textContent, document.querySelector('.calc-result').textContent]);
      return [first === 'RAD' && r[0] === 'DEG' && r[1] === '1', first + ' → ' + r.join(', ')];
    } finally { await p.close(); }
  });
  claim(SC, 'tip', 'Expressions are parsed with a proper tokeniser, not eval, so a typo produces a useful message rather than a broken page.', 'typos give messages; code is not run', N, async () => {
    const m = ['2+*3', 'sin(', '2)', 'foo(2)', '2..3', '2#3', 'constructor', 'alert(1)'].map(evErr);
    const src = fs.readFileSync(path.join(K.ROOT, 'engine', 'sci-calc.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    return [m.every((x) => !/^no error/.test(x) && x.length > 8) && !/\beval\s*\(|new Function\s*\(/.test(src), m.join(' | ')];
  });
  claim(SC, 'faq', 'Why does sin(90) give 1 in one mode and 0.894 in another?', 'deg and rad', N, async () => { const a = ev('sin(90)', 'deg'), b = ev('sin(90)', 'rad'); return [near(a, 1) && b.toFixed(3) === '0.894', a + ' / ' + b]; });
  claim(SC, 'faq', 'Because 90 degrees is a right angle but 90 radians is about 14 full turns.', '90 ÷ 2π', N, async () => { const v = ev('90/tau'); return [Math.round(v) === 14, v]; });
  claim(SC, 'faq', 'It uses double-precision floating point, giving about 15–17 significant digits.', '0.1 + 0.2, and 1e16 + 1', N, async () => { const a = ev('0.1+0.2'), b = ev('1e16+1'); return [a === 0.30000000000000004 && b === 1e16, a + ' / ' + b]; });
  claim(SC, 'faq', 'That means 0.1 + 0.2 shows as 0.30000000000000004 if you ask for full precision', 'the display rounds; = puts the full value in the entry line', B, async () => {
    const p = await K.open(SC, { wait: '.calc-expr' });
    try {
      await p.type('.calc-expr', '0.1+0.2');
      const shown = await p.$eval('.calc-result', (e) => e.textContent);
      await p.keyboard.press('Enter');
      const full = await p.$eval('.calc-expr', (e) => e.value);
      return [shown === '0.3' && full === '0.30000000000000004', 'display ' + shown + '; after = the entry line holds ' + full];
    } finally { await p.close(); }
  });

  /* ================================================================ */
  /* /mathematics/statistics/                                           */
  /* ================================================================ */
  const ST = '/mathematics/statistics/';
  const sts = (data) => run(ST, { data });
  const sd = (xs, pop) => { const m = xs.reduce((s, x) => s + x, 0) / xs.length; return Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - (pop ? 0 : 1))); };
  claim(ST, 'lede', 'Compute mean, median, mode, standard deviation, variance, and quartiles from a dataset.', 'all of them', N, async () => {
    const r = sts('2, 4, 4, 4, 5, 5, 7, 9'); return [near(r.mean, 5) && near(r.median, 4.5) && r.mode === '4' && near(r.popSD, 2) && near(r.sampVar, 32 / 7) && near(r.q1, 4) && near(r.q3, 5.5), j(r)];
  });
  claim(ST, 'card', 'Compute mean, median, mode, standard deviation, variance, and quartiles from a dataset.', 'the card line is the lede', N, async () => { const r = sts('1 2 3 4'); return [near(r.q1, 1.75) && near(r.q3, 3.25) && near(r.sampVar, 5 / 3), j([r.q1, r.q3, r.sampVar])]; });
  claim(ST, 'why', 'Paste the numbers. Get mean, median, SD, quartiles and IQR.', 'the outputs', N, async () => { const r = sts('62, 71, 58, 90, 74, 66, 81, 77, 69, 95, 55, 72'); return [['mean', 'median', 'sampSD', 'popSD', 'q1', 'q3', 'iqr'].every((k) => isFinite(r[k])) && near(r.iqr, r.q3 - r.q1), j(r)]; });
  claim(ST, 'why', 'Read sample and population SD', 'both are shown, labelled', N, async () => { const a = outLabel(ST, 'sampSD'), b = outLabel(ST, 'popSD'); return [/sample/.test(a) && /population/.test(b), a + ' / ' + b]; });
  claim(ST, 'formula', 'σ = √( Σ(xᵢ − μ)² / N ) · s = √( Σ(xᵢ − x̄)² / (N−1) )', 'random sets, and values near 10⁹ that lose a one-pass formula', N, async () => {
    const rnd = seeded(73);
    for (let k = 0; k < 200; k++) { const xs = Array.from({ length: ints(rnd, 2, 20) }, () => ints(rnd, -1000, 1000) / 10); const r = sts(xs.join(', ')); if (!near(r.popSD, sd(xs, true), 1e-9) || !near(r.sampSD, sd(xs, false), 1e-9)) return [false, xs.join(',')]; }
    const big = sts('1000000001, 1000000002, 1000000003'); return [near(big.sampSD, 1, 1e-9) && near(big.popSD, Math.sqrt(2 / 3), 1e-9), 'near 10⁹: s = ' + big.sampSD + ', σ = ' + big.popSD];
  });
  claim(ST, 'what', 'roughly the typical distance of a value from the mean, in the same units as the data.', 'scaling the data scales the SD', N, async () => { const a = sts('3, 5, 9, 12'), b = sts('30, 50, 90, 120'); return [near(b.sampSD, 10 * a.sampSD), a.sampSD + ' → ' + b.sampSD]; });
  claim(ST, 'works', 'Q1 sits at position (N − 1) × 0.25, counting the smallest value as position 0, and Q3 at (N − 1) × 0.75.', 'interpolated positions', N, async () => {
    const rnd = seeded(79);
    for (let k = 0; k < 100; k++) {
      const xs = Array.from({ length: ints(rnd, 1, 15) }, () => ints(rnd, 0, 100)); const s = xs.slice().sort((a, b) => a - b);
      const q = (p) => { const i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + ((s[lo + 1] === undefined ? s[lo] : s[lo + 1]) - s[lo]) * (i - lo); };
      const r = sts(xs.join(' ')); if (!near(r.q1, q(0.25)) || !near(r.q3, q(0.75)) || !near(r.iqr, q(0.75) - q(0.25))) return [false, xs.join(',')];
    }
    return [true, '100 sets'];
  });
  claim(ST, 'worked', 'if these ten are the whole class, report the second', 'the second SD shown is the population one', N, async () => {
    const r = sts('4, 8, 6, 5, 3, 7, 9, 5, 6, 5'); const o = spec(ST).outputs.map((x) => x.key); return [o.indexOf('sampSD') < o.indexOf('popSD') && near(r.popSD, 1.7205, 5e-5) && near(r.sampSD, 1.8135, 5e-5), r.sampSD + ' then ' + r.popSD];
  });
  claim(ST, 'mistake', 'Commas separate values, so 1,250 is read as two numbers, 1 and 250; remove the separators first.', '"1,250"', N, async () => { const r = sts('1,250'); return [r.count === 2 && r.sum === 251, r.count + ' values']; });
  claim(ST, 'mistake', 'The rule here matches a spreadsheet’s QUARTILE.INC; QUARTILE.EXC or a textbook method can give a slightly different Q1 and Q3 for the same data.', 'Microsoft\'s QUARTILE.INC and QUARTILE.EXC examples', N, async () => {
    /* QUARTILE.INC({1,2,4,7,8,9,10,12},1) = 3.5 and QUARTILE.EXC({6,7,15,36,39,40,41,42,43,47,49},1) = 15, ,3) = 43 (Microsoft's function pages) */
    const a = sts('1, 2, 4, 7, 8, 9, 10, 12'), b = sts('6, 7, 15, 36, 39, 40, 41, 42, 43, 47, 49');
    return [near(a.q1, 3.5) && near(b.q1, 25.5) && near(b.q3, 42.5), 'INC set: Q1 ' + a.q1 + '; the EXC set gives ' + b.q1 + ' and ' + b.q3 + ' here, against 15 and 43 by QUARTILE.EXC'];
  });
  claim(ST, 'dfaq', 'The textbook set 2, 4, 4, 4, 5, 5, 7, 9 has a mean of 5 and a population SD of exactly 2', 'the textbook set', N, async () => { const r = sts('2, 4, 4, 4, 5, 5, 7, 9'); return [r.mean === 5 && r.popSD === 2, r.mean + ' / ' + r.popSD]; });
  claim(ST, 'dfaq', 'Commutes of 21, 23, 22, 24, 22 and 58 minutes have a mean of 28.33 but a median of 22.5, and a sample SD of 14.57; the IQR, 1.75, barely registers the 58.', 'the commutes', N, async () => {
    const r = sts('21, 23, 22, 24, 22, 58'); return [near(r.mean, 28.33, 0.005) && near(r.median, 22.5) && near(r.sampSD, 14.57, 0.005) && near(r.iqr, 1.75), j([r.mean, r.median, r.sampSD, r.iqr])];
  });
  claim(ST, 'dfaq', 'Values separated by new lines, spaces, commas or semicolons are all read, so a copied column or row works as it is.', 'a pasted column, a tabbed row', N, async () => { const a = sts('1\r\n2\n3\n'), b = sts('4\t5;6, 7 8'); return [a.count === 3 && b.count === 5 && b.sum === 30, a.count + ' / ' + b.count]; });
  claim(ST, 'tip', 'Use the sample standard deviation (n−1) when your data is a sample drawn from a larger population', 's = σ × √(N ÷ (N − 1))', N, async () => { const r = sts('3, 7, 7, 19'); return [near(r.sampSD, r.popSD * Math.sqrt(4 / 3)), r.sampSD + ' / ' + r.popSD]; });
  claim(ST, 'tip', 'The median resists outliers; the mean does not.', 'one outlier', N, async () => { const a = sts('10, 11, 12, 13'), b = sts('10, 11, 12, 1300'); return [near(a.median, b.median) && b.mean > 300, a.mean + ' → ' + b.mean + ', median ' + b.median]; });
  claim(ST, 'tip', 'Points beyond Q1 − 1.5·IQR or Q3 + 1.5·IQR are conventional outliers.', 'the commutes: 58 is beyond, 24 is not', N, async () => { const r = sts('21, 23, 22, 24, 22, 58'); const hi = r.q3 + 1.5 * r.iqr; return [58 > hi && 24 < hi, 'upper fence ' + hi]; });
  claim(ST, 'faq', 'Dividing by N gives the population standard deviation, correct when your data is the entire population. Dividing by N−1 (Bessel’s correction) gives an unbiased estimate when your data is a sample.', 'variance divisors', N, async () => { const r = sts('1, 2, 3, 4, 5'); return [near(r.popVar, 2) && near(r.sampVar, 2.5), r.popVar + ' / ' + r.sampVar]; });
  claim(ST, 'ui', 'Data Set (comma or space separated)', 'blanks are not zeros', N, async () => { const r = sts(', 4, , 6 ,'); return [r.count === 2 && r.mean === 5, r.count + ' values']; });

  /* ================================================================ */
  /* /utilities/cooking-converter/                                      */
  /* ================================================================ */
  const CK = '/utilities/cooking-converter/';
  const DENS = { water: '1000', sifted: '529', spooned: '600', sugar: '845', brown: '800', icing: '460', butter: '911', honey: '1030', oats: '400', rice: '780', cocoa: '340' };
  const ck = (amount, unit, ing, scale) => run(CK, { amount, unit, ingredient: DENS[ing] || ing, scale: scale === undefined ? 1 : scale });
  claim(CK, 'lede', 'Convert between cups, tablespoons, millilitres, grams and ounces for common ingredients.', 'units in and out', N, async () => {
    const r = ck(1, 'cup', 'sugar'); const u = optValues(CK, 'unit');
    return [['cup', 'tbsp', 'ml'].every((x) => u.indexOf(x) >= 0) && near(r.grams, 202.8) && near(r.ounces, 202.8 / 28.349523125) && near(r.tbsp, 16) && near(r.ml, 240) && options(CK, 'ingredient').length === 11, u.join(',') + ' → ' + j([r.grams, r.ml, r.ounces])];
  });
  claim(CK, 'card', 'Convert between cups, tablespoons, millilitres, grams and ounces for common ingredients.', 'the card line is the lede', N, async () => { const r = ck(3, 'tbsp', 'honey'); return [near(r.ml, 45) && near(r.grams, 46.35), r.ml + ' ml / ' + r.grams + ' g']; });
  claim(CK, 'why', 'Pick the ingredient and amount. Get grams, ml, spoons and ounces.', 'outputs', N, async () => { const r = ck(2, 'cup', 'spooned'); return [near(r.grams, 288) && near(r.ml, 480) && near(r.tbsp, 32) && near(r.tsp, 96) && near(r.ounces, 288 / 28.349523125), j(r)]; });
  claim(CK, 'formula', 'volume converts exactly; volume to weight depends on ingredient density', 'volume is the same for every ingredient; weight is not', N, async () => {
    const a = ck(1, 'cup', 'water'), b = ck(1, 'cup', 'cocoa'); return [a.ml === b.ml && a.tbsp === 16 && a.tsp === 48 && near(a.grams, 240) && near(b.grams, 81.6), a.grams + ' / ' + b.grams];
  });
  claim(CK, 'what', 'This tool takes the US cup as 240 ml, the size used on US nutrition labels, with a 15 ml tablespoon and a 5 ml teaspoon.', '240, 15, 5', N, async () => { const v = [ck(1, 'cup', 'water').ml, ck(1, 'tbsp', 'water').ml, ck(1, 'tsp', 'water').ml]; return [v.join(',') === '240,15,5', v.join(', ')]; });
  claim(CK, 'what', 'The older US customary cup is about 236.6 ml', '8 US fluid ounces, from the engine\'s exact fluid ounce', N, async () => { const v = ck(8, 'floz', 'water').ml; return [Math.abs(v - 236.5882365) < 1e-9 && v.toFixed(1) === '236.6', v]; });
  claim(CK, 'works', 'The amount is turned into millilitres and multiplied by the scale factor. Grams follow from the ingredient’s density in grams per litre, and every other unit is a division of the same millilitre figure.', 'scale and density', N, async () => {
    const r = ck(2, 'tbsp', 'butter', 3); return [near(r.ml, 90) && near(r.grams, 90 * 0.911) && near(r.cups, 90 / 240) && near(r.litres, 0.09), j(r)];
  });
  claim(CK, 'works', 'ounces = grams ÷ 28.3495 fl oz = ml ÷ 29.5735', 'the factors against their definitions', N, async () => {
    /* 1 oz = 0.45359237 kg ÷ 16; 1 US fl oz = 231 in³ ÷ 128 = 29.5735295625 ml */
    const r = ck(1000, 'ml', 'water'); const oz = 453.59237 / 16, floz = 231 * 16.387064 / 128;
    return [near(r.ounces, 1000 / oz, 1e-9) && near(r.floz, 1000 / floz, 1e-9), 'oz ' + (1000 / r.ounces) + ', fl oz ' + (1000 / r.floz)];
  });
  claim(CK, 'works', 'cup 240, tablespoon 15, teaspoon 5, US fluid ounce 29.5735', 'ml per unit', N, async () => { const v = ['cup', 'tbsp', 'tsp', 'floz'].map((u) => ck(1, u, 'water').ml); return [v[0] === 240 && v[1] === 15 && v[2] === 5 && v[3].toFixed(4) === '29.5735', v.join(', ')]; });
  claim(CK, 'works', 'grams per litre: water 1,000, granulated sugar 845, butter 911', 'densities', N, async () => { const v = ['water', 'sugar', 'butter'].map((i) => ck(1000, 'ml', i).grams); return [v.join(',') === '1000,845,911', v.join(', ')]; });
  claim(CK, 'worked', 'Enter 0.75 cups, choose granulated sugar and scale by 1.5: that is 270 ml, which weighs 228.15 g, or 18 tablespoons', 'the cookies', N, async () => { const r = ck(0.75, 'cup', 'sugar', 1.5); return [near(r.ml, 270) && near(r.grams, 228.15) && near(r.tbsp, 18), j([r.ml, r.grams, r.tbsp])]; });
  claim(CK, 'worked', 'Packed brown sugar in the same volume would weigh 216 g, because the tool uses 800 g per litre for brown against 845 for white.', 'brown sugar', N, async () => { const r = ck(0.75, 'cup', 'brown', 1.5); return [near(r.grams, 216), r.grams]; });
  claim(CK, 'use', 'Halve, double or multiply by 1.5 in the same step as the conversion.', 'scale 0.5 and 2', N, async () => { const a = ck(1, 'cup', 'oats', 0.5), b = ck(1, 'cup', 'oats', 2); return [near(a.grams, 48) && near(b.grams, 192), a.grams + ' / ' + b.grams]; });
  claim(CK, 'mistake', 'One cup is 240 g of water but only 81.6 g of cocoa powder.', 'water and cocoa', N, async () => { const a = ck(1, 'cup', 'water'), b = ck(1, 'cup', 'cocoa'); return [near(a.grams, 240) && near(b.grams, 81.6), a.grams + ' / ' + b.grams]; });
  claim(CK, 'mistake', 'Fluid ounces measure volume and ounces weight: a cup of butter is 8.1 fl oz but 7.7 oz.', 'butter', N, async () => { const r = ck(1, 'cup', 'butter'); return [r.floz.toFixed(1) === '8.1' && r.ounces.toFixed(1) === '7.7', r.floz + ' / ' + r.ounces]; });
  claim(CK, 'dfaq', 'With butter at 911 g per litre, one 240 ml cup weighs 218.64 g.', 'butter cup', N, async () => { const r = ck(1, 'cup', 'butter'); return [near(r.grams, 218.64), r.grams]; });
  claim(CK, 'dfaq', '16, since 240 ml ÷ 15 ml is 16. A teaspoon is a third of a tablespoon, so a cup is also 48 teaspoons.', 'spoons in a cup', N, async () => { const r = ck(1, 'cup', 'water'); return [r.tbsp === 16 && r.tsp === 48, r.tbsp + ' / ' + r.tsp]; });
  claim(CK, 'dfaq', 'About 15.45 g. Honey is denser than water, at 1,030 g per litre here', 'a tablespoon of honey', N, async () => { const r = ck(1, 'tbsp', 'honey'); return [near(r.grams, 15.45), r.grams]; });
  claim(CK, 'dfaq', 'Choose millilitres and the flour that matches how it was measured. 100 ml of sifted plain flour is 52.9 g.', 'sifted flour', N, async () => { const r = ck(100, 'ml', 'sifted'); return [near(r.grams, 52.9), r.grams]; });
  claim(CK, 'tip', 'A cup is a volume, not a weight, so a cup of flour and a cup of sugar weigh very differently.', 'flour against sugar', N, async () => { const a = ck(1, 'cup', 'spooned').grams, b = ck(1, 'cup', 'sugar').grams; return [b > a * 1.3, a + ' / ' + b]; });
  claim(CK, 'tip', 'How you fill the cup changes the result by up to 20%: sifted flour weighs far less than flour scooped straight from the bag.', 'sifted below spooned, within 20%', N, async () => { const a = ck(1, 'cup', 'sifted').grams, b = ck(1, 'cup', 'spooned').grams; return [a < b && b / a < 1.2, a + ' / ' + b]; });
  claim(CK, 'tip', 'Cup sizes differ by country: 240 ml in the US, 250 ml in Australia, 284 ml for an old UK breakfast cup.', 'US 240 here; 10 imperial fl oz is 284 ml', N, async () => {
    const imp = 10 * 28.4130625; return [ck(1, 'cup', 'water').ml === 240 && Math.round(imp) === 284 && /Cup \(US, 240 ml\)/.test(options(CK, 'unit')[0]), 'US cup ' + ck(1, 'cup', 'water').ml + ' ml; 10 imp fl oz = ' + imp + ' ml'];
  });
  claim(CK, 'faq', 'Published values range from about 120 g to 145 g per cup for plain flour.', 'both flours here fall in that range', N, async () => { const a = ck(1, 'cup', 'sifted').grams, b = ck(1, 'cup', 'spooned').grams; return [a >= 120 && b <= 145, a + ' / ' + b]; });

  /* ================================================================ */
  /* /utilities/dice-roller/                                            */
  /* ================================================================ */
  const DI = '/utilities/dice-roller/';
  const dice = () => randomEngine(DI);
  /* every combination of n dice of s sides, each once: the feed v = face − 1 */
  const allRolls = (n, s, extra, fn) => {
    const D = dice(); const total = Math.pow(s, n); const out = [];
    for (let k = 0; k < total; k++) { const feed = []; let m = k; for (let i = 0; i < n; i++) { feed.push(m % s); m = Math.floor(m / s); } out.push(fn ? fn(D.go(Object.assign({ count: n, sides: String(s), modifier: 0, drop: 'none' }, extra || {}), feed)) : D.go(Object.assign({ count: n, sides: String(s), modifier: 0, drop: 'none' }, extra || {}), feed)); }
    return out;
  };
  claimR(DI, 'lede', 'Roll up to 200 dice from d4 to d100 with a modifier and a drop rule, shown in standard RPG notation.', '200 dice, the sides on offer, notation', N, async () => {
    const D = dice(); const a = D.go({ count: 200, sides: '100', modifier: 3, drop: 'low' }); const b = D.go({ count: 250, sides: '4', modifier: 0, drop: 'none' });
    return [list(a.rolls).length === 200 && a.notation === '200d100+3' && list(b.rolls).length === 200 && optValues(DI, 'sides').join(',') === '4,6,8,10,12,20,100', a.notation + ', 250 asked → ' + list(b.rolls).length + '; sides ' + options(DI, 'sides').join(' ')];
  });
  claimR(DI, 'card', 'Roll up to 200 dice from d4 to d100 with a modifier and a drop rule, shown in standard RPG notation.', 'the card line is the lede', N, async () => { const r = dice().go({ count: 3, sides: '8', modifier: -2, drop: 'high' }); return [r.notation === '3d8-2' && r.droppedValue !== '—', r.notation + ' dropped ' + r.droppedValue]; });
  claimR(DI, 'why', 'Pick dice, sides and modifier. Get every roll and the total.', 'every roll is listed and summed', N, async () => {
    const r = dice().go({ count: 5, sides: '12', modifier: 4, drop: 'none' }); const rolls = list(r.rolls); return [rolls.length === 5 && r.total === rolls.reduce((s, x) => s + x, 0) + 4, r.rolls + ' → ' + r.total];
  });
  claimR(DI, 'formula', 'standard notation: 2d6+3 means two six-sided dice plus three', '2d6+3 over every combination', N, async () => {
    const t = allRolls(2, 6, { modifier: 3 }, (r) => [r.notation, r.total, list(r.rolls)]);
    return [t.every(([n, tot, rl]) => n === '2d6+3' && tot === rl[0] + rl[1] + 3) && Math.min(...t.map((x) => x[1])) === 5 && Math.max(...t.map((x) => x[1])) === 15, '36 combinations'];
  });
  claimR(DI, 'what', 'NdS means N dice with S sides, and a number after a plus or minus sign is added to the total.', 'notation with + and −', N, async () => { const a = dice().go({ count: 2, sides: '20', modifier: 5 }), b = dice().go({ count: 1, sides: '20', modifier: -1 }), c = dice().go({ count: 4, sides: '6', modifier: 0 }); return [a.notation === '2d20+5' && b.notation === '1d20-1' && c.notation === '4d6', [a.notation, b.notation, c.notation].join(' ')]; });
  claimR(DI, 'what', 'd100, or percentile dice, gives a number from 1 to 100.', 'every face of a d100', N, async () => { const v = allRolls(1, 100, {}, (r) => r.total); return [v.join(',') === Array.from({ length: 100 }, (_, i) => i + 1).join(','), Math.min(...v) + '–' + Math.max(...v)]; });
  claimR(DI, 'what', 'this roller takes the same pieces from its four boxes', 'four inputs', N, async () => { const l = spec(DI).inputs.map((i) => i.label); return [l.join('|') === 'Number of dice|Sides|Modifier|Drop', l.join(', ')]; });
  claimR(DI, 'works', 'Each die is an independent whole number from 1 to S, every face equally likely.', '120,000 d6 and d20 faces from the real random source', N, async () => {
    const D = dice(); const out = [];
    for (const s of [6, 20]) {
      const c = {}; let n = 0; for (let k = 0; k < 600; k++) list(D.go({ count: 200, sides: String(s), modifier: 0, drop: 'none' }).rolls).forEach((x) => { c[x] = (c[x] || 0) + 1; n++; });
      const exp = n / s; const keys = Object.keys(c).map(Number); const worst = Math.max(...keys.map((k) => Math.abs(c[k] - exp) / exp));
      if (keys.length !== s || Math.min(...keys) !== 1 || Math.max(...keys) !== s || worst > 0.05) return [false, 'd' + s + ': ' + j(c)];
      out.push('d' + s + ' worst face ' + (worst * 100).toFixed(2) + '% off');
    }
    return [true, out.join('; ')];
  });
  claimR(DI, 'works', 'With a drop rule, the single lowest or highest die is removed before the kept dice are summed; the modifier is added last. A drop needs at least two dice.', 'one of two equal lows; one die keeps it', N, async () => {
    const D = dice(); const a = D.go({ count: 3, sides: '6', modifier: 2, drop: 'low' }, [0, 0, 5]), b = D.go({ count: 3, sides: '6', modifier: 0, drop: 'high' }, [5, 5, 0]), c = D.go({ count: 1, sides: '6', modifier: 0, drop: 'low' }, [3]);
    return [a.rolls === '1, 1, 6' && a.droppedValue === '1' && a.sum === 7 && a.total === 9 && b.sum === 7 && c.sum === 4 && c.droppedValue === '—', j([a.total, b.sum, c.sum, c.droppedValue])];
  });
  claimR(DI, 'works', 'average of one die = (S + 1) ÷ 2', 'every face of every die', N, async () => {
    const bad = [4, 6, 8, 10, 12, 20, 100].filter((s) => { const v = allRolls(1, s, {}, (r) => r.total); return v.reduce((a, x) => a + x, 0) / v.length !== (s + 1) / 2; }); return [!bad.length, bad.join(',') || 'd4 to d100'];
  });
  claimR(DI, 'works', 'range with no drop = N + M to N × S + M', '3d4−2 and 2d8+1', N, async () => {
    const a = allRolls(3, 4, { modifier: -2 }, (r) => r.total), b = allRolls(2, 8, { modifier: 1 }, (r) => r.total);
    return [Math.min(...a) === 1 && Math.max(...a) === 10 && Math.min(...b) === 3 && Math.max(...b) === 17, Math.min(...a) + '–' + Math.max(...a) + ', ' + Math.min(...b) + '–' + Math.max(...b)];
  });
  claimR(DI, 'worked', 'Set 2 dice, d20, Drop the lowest and a modifier of 5: the roll is 2d20+5, and the total can be anything from 6 to 25.', 'advantage, all 400 pairs', N, async () => {
    const t = allRolls(2, 20, { modifier: 5, drop: 'low' }, (r) => [r.notation, r.total]); const tot = t.map((x) => x[1]);
    return [t[0][0] === '2d20+5' && Math.min(...tot) === 6 && Math.max(...tot) === 25, t[0][0] + ' ' + Math.min(...tot) + '–' + Math.max(...tot)];
  });
  claimR(DI, 'worked', 'Keeping the higher die lifts the average die from 10.5 to 13.825 before the +5. If you need 15 or more on the die, a single d20 manages it 30% of the time; with advantage it is 51%, because only 14 × 14 = 196 of the 400 pairs miss.', 'exact over 400 pairs', N, async () => {
    const kept = allRolls(2, 20, { drop: 'low' }, (r) => r.sum); const one = allRolls(1, 20, {}, (r) => r.sum);
    const avg = kept.reduce((s, x) => s + x, 0) / 400, hit = kept.filter((x) => x >= 15).length, hit1 = one.filter((x) => x >= 15).length;
    return [avg === 13.825 && 400 - hit === 196 && hit1 === 6, 'average ' + avg + ', misses ' + (400 - hit) + ', single d20 ' + hit1 + '/20'];
  });
  claimR(DI, 'use', 'Roll up to 200 dice at once and compare the total with the expected average.', '200 dice; 201 is held at 200', N, async () => { const a = dice().go({ count: 200, sides: '6' }), b = dice().go({ count: 201, sides: '6' }); return [list(a.rolls).length === 200 && list(b.rolls).length === 200 && b.notation === '200d6', list(a.rolls).length + ' / ' + b.notation]; });
  claimR(DI, 'mistake', 'In 3d6+2 the 2 is added once, so totals run from 5 to 20, not 9 to 24.', 'all 216', N, async () => { const t = allRolls(3, 6, { modifier: 2 }, (r) => r.total); return [Math.min(...t) === 5 && Math.max(...t) === 20, Math.min(...t) + '–' + Math.max(...t)]; });
  claimR(DI, 'mistake', 'Choosing a drop rule with one die. Nothing is removed, and Dropped shows —.', 'one die, drop lowest', N, async () => { const r = dice().go({ count: 1, sides: '20', drop: 'low' }); return [r.droppedValue === '—' && r.sum === Number(r.rolls), r.droppedValue + ' ' + r.rolls]; });
  claimR(DI, 'mistake', 'It is the mean of the dice kept on this roll; over many rolls a d6 averages 3.5.', 'Average per die is this roll\'s kept mean; 120,000 faces average 3.5', N, async () => {
    const D = dice(); const r = D.go({ count: 4, sides: '6', drop: 'low' }, [0, 1, 2, 5]); let s = 0, n = 0; for (let k = 0; k < 600; k++) list(D.go({ count: 200, sides: '6' }).rolls).forEach((x) => { s += x; n++; });
    return [r.average === (2 + 3 + 6) / 3 && Math.abs(s / n - 3.5) < 0.03 && outLabel(DI, 'average') === 'Average per die', 'this roll ' + r.average + '; long run ' + (s / n).toFixed(4)];
  });
  claimR(DI, 'dfaq', 'Exactly 15,869 ÷ 1,296, about 12.24, against 10.5 for a plain 3d6.', 'all 1,296 rolls of 4d6 drop lowest', N, async () => {
    const t = allRolls(4, 6, { drop: 'low' }, (r) => r.sum); const p = allRolls(3, 6, {}, (r) => r.sum); const s = t.reduce((a, x) => a + x, 0);
    return [s === 15869 && t.length === 1296 && p.reduce((a, x) => a + x, 0) / 216 === 10.5, s + ' / ' + t.length];
  });
  claimR(DI, 'dfaq', 'Choose d100 here and every value has a 1% chance.', 'each face once; the incomplete top slice of 2³² rejected', N, async () => {
    const D = dice(); const v = allRolls(1, 100, {}, (r) => r.total); const bound = 4294967296 - (4294967296 % 100);
    const r = D.go({ count: 1, sides: '100' }, [bound, bound + 50, 41]); const used = D.st.calls;
    return [new Set(v).size === 100 && r.total === 42 && used === 3, 'values above ' + (bound - 1) + ' redrawn: ' + used + ' draws for one die, face ' + r.total];
  });
  claimR(DI, 'dfaq', '27 of the 216 combinations add up to 10, so 12.5%. A 3 or an 18 each come up once in 216.', 'all 216', N, async () => { const t = allRolls(3, 6, {}, (r) => r.total); const c = (v) => t.filter((x) => x === v).length; return [c(10) === 27 && c(3) === 1 && c(18) === 1, c(10) + ', ' + c(3) + ', ' + c(18)]; });
  claimR(DI, 'dfaq', 'One d20 with a modifier of −1 shows as 1d20-1, and the total runs from 0 to 19.', '1d20−1', N, async () => { const t = allRolls(1, 20, { modifier: -1 }, (r) => [r.notation, r.total]); const v = t.map((x) => x[1]); return [t[0][0] === '1d20-1' && Math.min(...v) === 0 && Math.max(...v) === 19, t[0][0] + ' ' + Math.min(...v) + '–' + Math.max(...v)]; });
  claimR(DI, 'tip', 'Standard notation is NdS+M: 3d6+2 rolls three six-sided dice and adds two.', '3d6+2', N, async () => { const r = dice().go({ count: 3, sides: '6', modifier: 2 }, [0, 1, 2]); return [r.notation === '3d6+2' && r.total === 8, r.notation + ' = ' + r.total]; });
  claimR(DI, 'tip', 'Dropping the lowest die is the usual method for rolling character statistics — it shifts the distribution upward.', '4d6 drop lowest against 3d6', N, async () => { const a = allRolls(4, 6, { drop: 'low' }, (r) => r.sum), b = allRolls(3, 6, {}, (r) => r.sum); const m = (x) => x.reduce((s, y) => s + y, 0) / x.length; return [m(a) > m(b) + 1.5, m(a) + ' / ' + m(b)]; });
  claimR(DI, 'tip', 'Rolls use the cryptographic random source, so they are not predictable from previous results.', 'one crypto draw per die, Math.random never', N, async () => { const D = dice(); D.go({ count: 7, sides: '20' }); return [D.st.calls === 7 && D.st.mathCalls === 0, D.st.calls + ' crypto draws, ' + D.st.mathCalls + ' Math.random']; });
  claimR(DI, 'faq', 'On 2d6 there is one way to make 2 but six ways to make 7, so 7 comes up six times as often.', 'all 36', N, async () => { const t = allRolls(2, 6, {}, (r) => r.total); const c = (v) => t.filter((x) => x === v).length; return [c(2) === 1 && c(7) === 6, c(2) + ' / ' + c(7)]; });
  claimR(DI, 'example', '6, 2, 3, 1', 'the panel is one possible 4d6 drop-lowest roll, and the engine gives that shape', N, async () => {
    const shown = [6, 2, 3, 1]; const D = dice(); const r = D.go({ count: 4, sides: '6', modifier: 0, drop: 'low' }, shown.map((x) => x - 1));
    for (let k = 0; k < 500; k++) { const x = D.go({ count: 4, sides: '6', modifier: 0, drop: 'low' }); const rl = list(x.rolls); if (rl.length !== 4 || rl.some((v) => v < 1 || v > 6) || x.total !== rl.reduce((s, v) => s + v, 0) - Math.min(...rl)) return [false, j(x)]; }
    return [r.rolls === '6, 2, 3, 1' && r.total === 11, 'those faces give ' + r.total];
  });

  /* ================================================================ */
  /* /utilities/random-number-generator/                                */
  /* ================================================================ */
  const RN = '/utilities/random-number-generator/';
  const rng = () => randomEngine(RN);
  const draw = (o, feed) => rng().go(Object.assign({ min: 1, max: 100, count: 6, unique: 'no', sort: 'draw' }, o), feed);
  const nums = (r) => (r.numbers ? list(r.numbers) : []);
  claimR(RN, 'lede', 'Generate random numbers in any range, with or without duplicates, using a cryptographic source.', 'small, negative and huge ranges; both duplicate modes', N, async () => {
    const a = nums(draw({ min: -1e12, max: 1e12, count: 50, unique: 'no' })), b = nums(draw({ min: 1, max: 3, count: 50, unique: 'yes' }));
    const D = rng(); const s = draw({ min: 1, max: 1e15, count: 3 }).source;
    return [a.length === 50 && a.every((x) => x >= -1e12 && x <= 1e12) && new Set(a).size === 50 && b.length === 50 && new Set(b).size <= 3 && s === 'crypto.getRandomValues' && D.st.mathCalls === 0, 'huge range ' + a.slice(0, 2).join(', ') + '…; 50 from 1–3: ' + new Set(b).size + ' distinct; ' + s];
  });
  claimR(RN, 'card', 'Generate random numbers in any range, with or without duplicates, using a cryptographic source.', 'the card line is the lede', N, async () => { const r = draw({ min: 10, max: 20, count: 11, unique: 'no' }); return [new Set(nums(r)).size === 11, r.numbers]; });
  claimR(RN, 'why', 'Set the range and how many. Get numbers from a cryptographic source.', 'crypto, not Math.random', N, async () => { const D = rng(); const r = draw({ count: 10 }); return [r.source === 'crypto.getRandomValues' && D.st.calls >= 10 && D.st.mathCalls === 0, D.st.calls + ' crypto draws']; });
  claimR(RN, 'why', 'Generators that lean to low numbers', 'this one does not: 300,000 draws from 1–3, 1–7 and 1–250', N, async () => {
    const out = [];
    for (const hi of [3, 7, 250]) {
      const c = new Array(hi + 1).fill(0); let n = 0; for (let k = 0; k < 300; k++) nums(draw({ min: 1, max: hi, count: 1000, unique: 'yes' })).forEach((x) => { c[x]++; n++; });
      const exp = n / hi; const worst = Math.max(...c.slice(1).map((x) => Math.abs(x - exp) / exp)); const lowHalf = c.slice(1, Math.floor(hi / 2) + 1).reduce((s, x) => s + x, 0) / (Math.floor(hi / 2) * exp);
      if (worst > (hi === 250 ? 0.12 : 0.02) || Math.abs(lowHalf - 1) > 0.01) return [false, '1–' + hi + ': ' + j(c.slice(1, 10))];
      out.push('1–' + hi + ' low half ×' + lowHalf.toFixed(4));
    }
    return [true, out.join('; ')];
  });
  claimR(RN, 'why', 'Choose how many, no repeats', 'No duplicates never repeats', N, async () => { for (let k = 0; k < 300; k++) { const v = nums(draw({ min: 1, max: 20, count: 20 })); if (new Set(v).size !== 20) return [false, v.join(',')]; } return [true, '300 draws of 20 from 1–20']; });
  claimR(RN, 'formula', 'crypto.getRandomValues with rejection sampling to avoid modulo bias', 'a value in the incomplete top slice is redrawn', N, async () => {
    const D = rng(); const r = draw({ min: 0, max: 2, count: 1, unique: 'yes' }, [4294967295, 4294967294]); const used = D.st.calls;
    return [used === 2 && r.numbers === String(4294967294 % 3), '2³² − 1 rejected for a span of 3; ' + used + ' draws; result ' + r.numbers];
  });
  claimR(RN, 'what', 'so that every value is equally likely and no result can be predicted from earlier ones', 'crypto source; every value reachable once per 2³² ÷ span', N, async () => {
    const D = rng(); const vals = []; for (let v = 0; v < 12; v++) vals.push(Number(draw({ min: 1, max: 12, count: 1, unique: 'yes' }, [v]).numbers));
    return [vals.join(',') === '1,2,3,4,5,6,7,8,9,10,11,12' && D.st.mathCalls === 0, vals.join(',')];
  });
  claimR(RN, 'what', 'With No duplicates, each number can come out once, like balls from a drum; with duplicates allowed, every draw starts from the full range again.', 'scripted: the same raw value twice', N, async () => {
    const a = draw({ min: 1, max: 5, count: 3, unique: 'no' }, [0, 0, 0]), b = draw({ min: 1, max: 5, count: 3, unique: 'yes' }, [0, 0, 0]);
    return [a.numbers === '1, 2, 3' && b.numbers === '1, 1, 1', 'no duplicates ' + a.numbers + '; duplicates allowed ' + b.numbers];
  });
  claimR(RN, 'works', 'The range holds max − min + 1 whole numbers.', '−10 to 10: 21 fit, 22 do not', N, async () => { const a = draw({ min: -10, max: 10, count: 21 }), b = draw({ min: -10, max: 10, count: 22 }); return [nums(a).length === 21 && /only holds 21/.test(b.note), b.note]; });
  claimR(RN, 'works', 'Each draw takes a random 32-bit value, rejects it if it falls in the incomplete slice at the top, and keeps the remainder after dividing by the span.', 'min + (v mod span); the pool shrinks (4, then 3 mod 3 = 0 of the three left …)', N, async () => {
    const a = draw({ min: 50, max: 59, count: 1, unique: 'yes' }, [123457]), b = draw({ min: 1, max: 4, count: 4, unique: 'no' }, [3, 3, 3, 3]);
    return [a.numbers === String(50 + 123457 % 10) && b.numbers === '4, 1, 3, 2', a.numbers + ' / ' + b.numbers];
  });
  claimR(RN, 'works', 'Spans over 2³², about 4.3 billion, join two values into 53 bits.', 'a span of 10¹²: two raw values, 21 + 32 bits', N, async () => {
    const D = rng(); const span = 1e12 + 1; const x = 0xABCDEF12, y = 0x12345678; const r = draw({ min: -5e11, max: 5e11, count: 1, unique: 'yes' }, [x, y]); const used = D.st.calls;
    const want = -5e11 + ((x >>> 11) * 4294967296 + y) % span;
    const big = nums(draw({ min: 1, max: 9e15, count: 20, unique: 'no' }));
    return [r.numbers === String(want) && used === 2 && big.length === 20 && big.every((v) => v >= 1 && v <= 9e15), r.numbers + ' from ' + used + ' values; 20 from 1–9e15 drawn'];
  });
  claimR(RN, 'works', 'number = min + (v mod span), keeping only v < 2³² − (2³² mod span)', 'the bound for a span of 3,000,000,000', N, async () => {
    const D = rng(); const bound = 4294967296 - (4294967296 % 3e9); const r = draw({ min: 0, max: 3e9 - 1, count: 1, unique: 'yes' }, [bound, bound - 1]);
    return [bound === 3e9 && D.st.calls === 2 && r.numbers === String(bound - 1), 'bound ' + bound + ', ' + D.st.calls + ' draws, ' + r.numbers];
  });
  claimR(RN, 'works', 'a random 32-bit value from crypto.getRandomValues', 'the source named in the result', N, async () => { const r = draw({}); return [r.source === 'crypto.getRandomValues' && outLabel(RN, 'source') === 'Random source', outLabel(RN, 'source') + ': ' + r.source]; });
  claimR(RN, 'worked', 'set the range, ask for 6, choose No duplicates and Lowest first. Every press holds 6 numbers in the range 1 to 59, a different set each time.', '300 presses', N, async () => {
    const seen = new Set();
    for (let k = 0; k < 300; k++) { const v = nums(draw({ min: 1, max: 59, count: 6, unique: 'no', sort: 'asc' })); if (v.length !== 6 || new Set(v).size !== 6 || v.some((x) => x < 1 || x > 59) || v.join() !== v.slice().sort((a, b) => a - b).join()) return [false, v.join(',')]; seen.add(v.join()); }
    return [seen.size === 300, seen.size + ' different sets'];
  });
  claimR(RN, 'worked', 'Any particular set of six has a 1 in 45,057,474 chance of being drawn: 59 × 58 × 57 × 56 × 55 × 54 ÷ 720', 'C(59, 6)', N, async () => { const c = 59 * 58 * 57 * 56 * 55 * 54 / 720; return [c === 45057474, c]; });
  claimR(RN, 'mistake', 'Six numbers from 1 to 59 with duplicates allowed contain a repeat about 23.1% of the time.', '100,000 draws', N, async () => {
    let rep = 0; const n = 100000; for (let k = 0; k < n; k++) { const v = nums(draw({ min: 1, max: 59, count: 6, unique: 'yes' })); if (new Set(v).size < 6) rep++; }
    const exact = 1 - (58 * 57 * 56 * 55 * 54) / Math.pow(59, 5); return [Math.abs(rep / n - 0.231) < 0.005 && exact.toFixed(3) === '0.231', (rep / n * 100).toFixed(2) + '% (exactly ' + (exact * 100).toFixed(2) + '%)'];
  });
  claimR(RN, 'mistake', 'Sixty from 1 to 59 cannot be done, and the tool replies that the range only holds 59.', '60 from 1–59', N, async () => { const r = draw({ min: 1, max: 59, count: 60 }); return [!r.numbers && /only holds 59/.test(r.note), r.note]; });
  claimR(RN, 'mistake', '1, 2, 3, 4, 5, 6 is exactly as likely as any other set', 'every ordered pair from 1–4 comes from exactly one pair of draws', N, async () => {
    const c = {}; for (let x = 0; x < 4; x++) for (let y = 0; y < 3; y++) { const v = draw({ min: 1, max: 4, count: 2, unique: 'no' }, [x, y]).numbers; c[v] = (c[v] || 0) + 1; }
    const neat = draw({ min: 1, max: 59, count: 6, unique: 'no' }, [0, 0, 0, 0, 0, 0]).numbers;
    return [Object.keys(c).length === 12 && Object.values(c).every((x) => x === 1) && neat === '1, 2, 3, 4, 5, 6', Object.keys(c).length + ' ordered pairs, once each; ' + neat];
  });
  claimR(RN, 'dfaq', 'With 312 entries the range is 1 to 312, and each entry has a 1 in 312 chance.', 'each of 312 from one raw value each', N, async () => {
    const D = rng(); const got = new Set(); for (let v = 0; v < 312; v++) got.add(draw({ min: 1, max: 312, count: 1 }, [v]).numbers);
    const r = draw({ min: 1, max: 312, count: 1 }); return [got.size === 312 && r.range === '1 to 312', got.size + ' entries; range ' + r.range];
  });
  claimR(RN, 'dfaq', 'A minimum of -10 and a maximum of 10 gives the range -10 to 10, which is 21 values including zero.', 'the range shown and the values drawn', N, async () => {
    const seen = new Set(); for (let k = 0; k < 200; k++) nums(draw({ min: -10, max: 10, count: 21 })).forEach((x) => seen.add(x));
    const r = draw({ min: -10, max: 10, count: 1 }); return [r.range === '-10 to 10' && seen.size === 21 && seen.has(0) && seen.has(-10) && seen.has(10), r.range + ', ' + seen.size + ' values'];
  });
  claimR(RN, 'dfaq', 'With duplicates allowed, 1 in the size of the range: 1 in 100 for numbers from 1 to 100.', '200,000 pairs', N, async () => {
    let same = 0; const n = 200000; for (let k = 0; k < n; k++) { const v = nums(draw({ min: 1, max: 100, count: 2, unique: 'yes' })); if (v[0] === v[1]) same++; }
    return [Math.abs(same / n - 0.01) < 0.0015, (same / n * 100).toFixed(3) + '%'];
  });
  claimR(RN, 'dfaq', 'No, it only sorts the numbers already drawn. Keep Draw order when the order matters, such as first, second and third prize.', 'the same raw values, both orders', N, async () => {
    const feed = [17, 3, 40, 9]; const a = draw({ min: 1, max: 50, count: 4, sort: 'draw' }, feed), b = draw({ min: 1, max: 50, count: 4, sort: 'asc' }, feed);
    return [nums(a).slice().sort((x, y) => x - y).join() === nums(b).join() && a.numbers !== b.numbers, a.numbers + ' → ' + b.numbers];
  });
  claimR(RN, 'tip', 'Numbers come from the browser’s cryptographic random source, not Math.random, and use rejection sampling so every value in the range is equally likely.', 'crypto calls, no Math.random, rejection', N, async () => {
    const D = rng(); draw({ min: 1, max: 7, count: 1, unique: 'yes' }, [4294967295]); const a = D.st.calls; draw({ count: 50, unique: 'yes' });
    return [a === 2 && D.st.mathCalls === 0, 'a top-slice value took ' + a + ' draws; Math.random calls ' + D.st.mathCalls];
  });
  claimR(RN, 'tip', 'Naive generators take a random number modulo the range, which quietly favours the lower values. This one does not.', 'a span of 3e9: v ≥ 3e9 is redrawn, not folded onto 0–1.29e9', N, async () => {
    const D = rng(); const r = draw({ min: 0, max: 3e9 - 1, count: 1, unique: 'yes' }, [3e9 + 5, 7]); return [r.numbers === '7' && D.st.calls === 2, r.numbers + ' after ' + D.st.calls + ' draws (naive: ' + ((3e9 + 5) % 3e9) + ')'];
  });
  manual(RN, 'faq', 'For anything with legal weight, use a documented procedure with witnesses.', 'advice about running a fair draw; no tool behaviour to check');
  claimR(RN, 'example', '103, 106, 150', 'the panel is one possible draw of 3 unique from 1–250, and the engine gives that shape', N, async () => {
    const shown = [103, 106, 150]; for (let k = 0; k < 500; k++) { const v = nums(draw({ min: 1, max: 250, count: 3, unique: 'no', sort: 'draw' })); if (v.length !== 3 || new Set(v).size !== 3 || v.some((x) => x < 1 || x > 250)) return [false, v.join(',')]; }
    return [shown.every((x) => x >= 1 && x <= 250) && new Set(shown).size === 3, 'shape holds over 500 draws'];
  });
  claimR(RN, 'ui', 'Lowest first', 'the order and duplicate choices', N, async () => { const a = options(RN, 'sort'), b = options(RN, 'unique'); return [a.join('|') === 'Draw order|Lowest first' && b.join('|') === 'Allow duplicates|No duplicates', a.join(', ') + '; ' + b.join(', ')]; });

  /* ================================================================ */
  /* /utilities/fuel-efficiency/                                        */
  /* ================================================================ */
  const FU = '/utilities/fuel-efficiency/';
  const fu = (efficiency, unit, distance, distUnit, price, priceUnit) => run(FU, { efficiency, unit, distance, distUnit, price, priceUnit });
  const GAL_US = 3.785411784, GAL_UK = 4.54609, MILE = 1.609344;
  claim(FU, 'lede', 'Convert between MPG and L/100km, and calculate the fuel cost of a journey.', 'MPG ↔ L/100 km and a trip cost', N, async () => {
    const r = fu(40, 'mpguk', 100, 'mi', 1.5, 'l'); return [near(r.l100, 282.481 / 40) && near(r.mpgus, 235.214583 / r.l100) && near(r.cost, r.litres * 1.5), j([r.l100, r.mpgus, r.cost])];
  });
  claim(FU, 'card', 'Convert between MPG and L/100km, and calculate the fuel cost of a journey.', 'the card line is the lede', N, async () => { const r = fu(5.8, 'l100', 350, 'mi', 1.52, 'l'); return [near(r.cost, 49.66, 0.005), r.cost]; });
  claim(FU, 'why', 'Enter efficiency, distance and fuel price. Get the trip cost.', 'cost = litres × price', N, async () => { const r = fu(45, 'mpguk', 400, 'mi', 1.45, 'l'); return [near(r.cost, r.litres * 1.45) && near(r.cost, 58.59, 0.005), r.cost]; });
  claim(FU, 'why', 'Mixing up US and UK gallons', 'both MPGs are offered, and differ', N, async () => { const o = options(FU, 'unit'); const a = fu(30, 'mpgus', 100, 'mi', 1, 'l').litres, b = fu(30, 'mpguk', 100, 'mi', 1, 'l').litres; return [o.indexOf('MPG (US)') >= 0 && o.indexOf('MPG (Imperial)') >= 0 && b > a * 1.15, o.join(', ')]; });
  claim(FU, 'formula', 'L/100km = 235.214583 / MPG(US)', 'the constant from its definition, and the engine', N, async () => {
    const k = 100 * GAL_US / MILE; const r = fu(25, 'mpgus', 0, 'km', 0, 'l'); return [k.toFixed(6) === '235.214583' && near(r.l100, 235.214583 / 25), k + ' / ' + r.l100];
  });
  claim(FU, 'works', 'Every efficiency is converted to litres per 100 km first. The distance becomes kilometres, the fuel needed is the rate times the distance, and the cost is that volume at the pump price, turned into a price per litre if it was entered per US gallon.', 'per US gallon and per litre agree', N, async () => {
    const a = fu(20, 'kml', 100, 'mi', 1.6, 'l'), b = fu(20, 'kml', 100, 'mi', 1.6 * GAL_US, 'gal'); return [near(a.l100, 5) && near(a.litres, 5 * MILE) && near(a.cost, b.cost), j([a.litres, a.cost, b.cost])];
  });
  claim(FU, 'works', 'L/100 km = 282.481 ÷ MPG (UK) = 235.215 ÷ MPG (US) = 100 ÷ km per litre', 'the three conversions', N, async () => { const a = fu(50, 'mpguk', 0, 'km', 0, 'l').l100, b = fu(50, 'mpgus', 0, 'km', 0, 'l').l100, c = fu(20, 'kml', 0, 'km', 0, 'l').l100; return [near(a, 282.481 / 50) && near(b, 235.214583 / 50) && near(c, 5), [a, b, c].join(', ')]; });
  claim(FU, 'works', 'litres per 100 km at one mile per imperial gallon (4.54609 L ÷ 1.609344 km × 100)', 'the engine\'s 282.481 against the definition', N, async () => { const k = GAL_UK / MILE * 100; const r = fu(1, 'mpguk', 0, 'km', 0, 'l').l100; return [k.toFixed(3) === '282.481' && Math.abs(r - k) / k < 1e-6, k + ' / ' + r]; });
  claim(FU, 'works', 'the same for a 3.785 L US gallon', '1 MPG (US)', N, async () => { const r = fu(1, 'mpgus', 0, 'km', 0, 'l').l100; return [r.toFixed(3) === '235.215', r]; });
  claim(FU, 'worked', 'Choose L/100 km, Miles and Litre: the car needs 32.67 litres and the trip costs £49.66, or £0.14 a mile.', 'cost per unit of the distance chosen', N, async () => { const r = fu(5.8, 'l100', 350, 'mi', 1.52, 'l'); return [near(r.litres, 32.67, 0.005) && near(r.costPerDistance, 0.14, 0.005), r.litres + ' / ' + r.costPerDistance]; });
  claim(FU, 'worked', 'On a British dashboard the same car would read 48.7 MPG; on an American one, 40.6 MPG.', '5.8 L/100 km in MPG', N, async () => { const r = fu(5.8, 'l100', 0, 'km', 0, 'l'); return [near(r.mpguk, 48.7, 0.05) && near(r.mpgus, 40.6, 0.05), r.mpguk + ' / ' + r.mpgus]; });
  claim(FU, 'use', 'Put a UK brochure’s MPG and a European L/100 km figure on one scale before buying or hiring.', '55 MPG (UK) against 5.5 L/100 km', N, async () => { const r = fu(55, 'mpguk', 0, 'km', 0, 'l'); return [near(r.l100, 282.481 / 55), r.l100]; });
  claim(FU, 'mistake', '40 MPG from a UK brochure is 7.06 L/100 km; read as US gallons it becomes 5.88, and the fuel estimate falls by about 17%.', '40 MPG both ways', N, async () => { const a = fu(40, 'mpguk', 100, 'km', 1, 'l'), b = fu(40, 'mpgus', 100, 'km', 1, 'l'); const fall = 1 - b.litres / a.litres; return [a.l100.toFixed(2) === '7.06' && b.l100.toFixed(2) === '5.88' && Math.round(fall * 100) === 17, a.l100 + ' / ' + b.l100 + ' (' + (fall * 100).toFixed(1) + '%)']; });
  claim(FU, 'mistake', 'Leaving Price Per on US Gallon. That is the default, and a UK price per litre entered against it is spread over 3.785 litres, so the cost comes out far too low.', 'the default, and the factor', N, async () => {
    const d = input(FU, 'priceUnit').default; const a = fu(40, 'mpguk', 100, 'mi', 1.5, 'gal'), b = fu(40, 'mpguk', 100, 'mi', 1.5, 'l'); return [d === 'gal' && near(b.cost / a.cost, GAL_US), 'default ' + d + '; ' + a.cost + ' against ' + b.cost];
  });
  claim(FU, 'dfaq', 'Multiply by about 0.833, the ratio of the two gallons. 50 MPG in imperial gallons is 41.6 MPG in US gallons.', '50 MPG (UK)', N, async () => { const r = fu(50, 'mpguk', 0, 'km', 0, 'l'); return [r.mpgus.toFixed(1) === '41.6' && (GAL_US / GAL_UK).toFixed(3) === '0.833', r.mpgus]; });
  claim(FU, 'dfaq', 'At 40 MPG (UK) and £1.50 a litre, 100 miles uses 11.37 litres and costs £17.05.', '100 miles', N, async () => { const r = fu(40, 'mpguk', 100, 'mi', 1.5, 'l'); return [near(r.litres, 11.37, 0.005) && near(r.cost, 17.05, 0.005), r.litres + ' / ' + r.cost]; });
  claim(FU, 'dfaq', 'Divide 100 by the L/100 km figure, or read the km/L result: 5.8 L/100 km is 17.24 km per litre.', 'km/L', N, async () => { const r = fu(5.8, 'l100', 0, 'km', 0, 'l'); return [near(r.kml, 17.24, 0.005), r.kml]; });
  claim(FU, 'tip', 'MPG and L/100km are inverse measures: higher MPG is better, lower L/100km is better.', 'L/100 km × MPG is constant', N, async () => { const v = [20, 40, 60].map((m) => fu(m, 'mpgus', 0, 'km', 0, 'l').l100 * m); return [v.every((x) => near(x, 235.214583)), v.join(', ')]; });
  claim(FU, 'tip', 'A US gallon is about 3.785 L; an Imperial gallon is about 4.546 L, so UK MPG figures look ~20% better than US figures for the same car.', 'the same car in both MPGs', N, async () => { const r = fu(6, 'l100', 0, 'km', 0, 'l'); return [Math.round((r.mpguk / r.mpgus - 1) * 100) === 20, (r.mpguk / r.mpgus)]; });
  claim(FU, 'tip', 'Improving from 15 to 20 MPG saves more fuel per mile than improving from 40 to 50 MPG', 'fuel for 1,000 miles', N, async () => { const l = (m) => fu(m, 'mpgus', 1000, 'mi', 0, 'l').litres; const a = l(15) - l(20), b = l(40) - l(50); return [a > b, a + ' L / ' + b + ' L']; });
  claim(FU, 'faq', 'It is 100 × 3.785411784 (litres per US gallon) ÷ 1.609344 (km per mile), the factor that converts miles-per-gallon into litres-per-100-kilometres.', 'the definition', N, async () => { const k = 100 * GAL_US / MILE; return [Math.abs(k - 235.214583) < 5e-7, k]; });
  claim(FU, 'ui', 'Fuel Price per Unit', 'priced per US gallon or per litre, miles or kilometres', N, async () => { const a = options(FU, 'priceUnit'), b = options(FU, 'distUnit'); return [a.join('|') === 'US Gallon|Litre' && b.join('|') === 'Miles|Kilometres' && input(FU, 'price').unit === '£', a.join(', ') + '; ' + b.join(', ')]; });

  /* ================================================================ */
  /* /utilities/gpa-calculator/                                         */
  /* ================================================================ */
  const GP = '/utilities/gpa-calculator/';
  const gp = (grades, credits, scale) => run(GP, { grades, credits: credits || '', scale: String(scale || 4) });
  claim(GP, 'lede', 'Calculate weighted and unweighted grade point average from course grades and credits.', 'with and without credits', N, async () => {
    const a = gp('A, C', '3, 1'), b = gp('A, C'); return [near(a.gpa, 3.5) && /Weighted/.test(a.method) && near(b.gpa, 3) && /Unweighted/.test(b.method), a.gpa + ' / ' + b.gpa];
  });
  claim(GP, 'card', 'Calculate weighted and unweighted grade point average from course grades and credits.', 'the card line is the lede', N, async () => { const r = gp('A, B+, A-, B, C+', '4, 3, 3, 3, 1'); return [near(r.gpa, 3.45, 0.005), r.gpa]; });
  claim(GP, 'why', 'Enter grades and credits. Get your weighted GPA on a 4, 5 or 10 scale.', 'the three scales', N, async () => {
    const v = [4, 5, 10].map((s) => gp('A, B', '3, 1', s).gpa); return [near(v[0], 3.75) && near(v[1], 4.6875) && near(v[2], 9.375) && optValues(GP, 'scale').sort().join() === '10,4,5', v.join(', ')];
  });
  claim(GP, 'formula', 'GPA = Σ(grade points × credits) / Σ credits', 'random transcripts', N, async () => {
    const pts = { A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7, 'C+': 2.3, C: 2, 'C-': 1.7, 'D+': 1.3, D: 1, 'D-': 0.7, F: 0 }; const g = Object.keys(pts); const rnd = seeded(83);
    for (let k = 0; k < 150; k++) { const n = ints(rnd, 1, 8); const gs = Array.from({ length: n }, () => g[ints(rnd, 0, g.length - 1)]); const cs = gs.map(() => ints(rnd, 1, 6)); const want = gs.reduce((s, x, i) => s + pts[x] * cs[i], 0) / cs.reduce((s, x) => s + x, 0); const r = gp(gs.join(', '), cs.join(', ')); if (!near(r.gpa, want, 1e-9)) return [false, gs + ' / ' + cs]; }
    return [true, '150 transcripts'];
  });
  claim(GP, 'what', 'from 4.0 for an A down to 0 for an F', 'A and F', N, async () => { const a = gp('A').gpa, f = gp('F').gpa; return [a === 4 && f === 0, a + ' / ' + f]; });
  claim(GP, 'works', 'Total quality points divided by total credits is the GPA on the 4.0 scale; the 10- and 5-point results are straight multiples of it.', 'quality points ÷ credits', N, async () => { const r = gp('B+, A', '4, 2', 10); return [near(r.qualityPoints, 21.2) && r.totalCredits === 6 && near(r.gpa4, 21.2 / 6) && near(r.gpa, 21.2 / 6 * 2.5), j([r.qualityPoints, r.totalCredits, r.gpa4, r.gpa])]; });
  claim(GP, 'works', 'GPA (10) = GPA (4.0) × 2.5', '×2.5', N, async () => { const r = gp('B', '', 10); return [r.gpa === 7.5, r.gpa]; });
  claim(GP, 'works', 'GPA (5) = GPA (4.0) × 1.25', '×1.25', N, async () => { const r = gp('B', '', 5); return [r.gpa === 3.75, r.gpa]; });
  claim(GP, 'works', 'percentage = GPA (4.0) ÷ 4 × 100', 'the percentage', N, async () => { const r = gp('B', '', 10); return [r.percentage === 75, r.percentage]; });
  claim(GP, 'works', 'A+ and A 4.0, A− 3.7, B+ 3.3, B 3.0, B− 2.7, C+ 2.3, C 2.0, C− 1.7, D+ 1.3, D 1.0, D− 0.7, F 0', 'every grade, typed with - or −', N, async () => {
    const t = [['A+', 4], ['A', 4], ['A−', 3.7], ['A-', 3.7], ['B+', 3.3], ['B', 3], ['B−', 2.7], ['C+', 2.3], ['C', 2], ['C-', 1.7], ['D+', 1.3], ['D', 1], ['D−', 0.7], ['F', 0], ['b+', 3.3]];
    const bad = t.filter(([g, v]) => !near(gp(g).gpa, v)); return [!bad.length, bad.map(([g]) => g + ' = ' + gp(g).gpa + ' ' + gp(g).note).join(', ') || t.length + ' grades'];
  });
  claim(GP, 'worked', 'The quality points are 8 + 11.1 + 9 + 13.8 = 41.9 over 14 credits, a GPA of 2.99. Leave the credits box empty and the same grades average 3.25', 'the term', N, async () => {
    const a = gp('A, A-, B, C+', '2, 3, 3, 6'), b = gp('A, A-, B, C+'); return [near(a.qualityPoints, 41.9) && a.totalCredits === 14 && near(a.gpa, 2.99, 0.005) && near(b.gpa, 3.25), j([a.qualityPoints, a.gpa, b.gpa])];
  });
  claim(GP, 'use', 'Restate a 4.0-scale GPA on a 10-point scale as a first estimate; for the reverse, divide by 2.5.', '3.2 → 8; a 10-point figure is not read', N, async () => { const r = gp('3.2', '', 10); return [near(r.gpa, 8) && near(8 / 2.5, 3.2), r.gpa]; });
  claim(GP, 'mistake', 'With grades A, B, C and credits 3, 3 the tool notes “You gave 2 credit values for 3 grades” and averages without weights.', 'the note', N, async () => { const r = gp('A, B, C', '3, 3'); return [/You gave 2 credit values for 3 grades/.test(r.note) && near(r.gpa, 3) && /Unweighted/.test(r.method), r.note]; });
  claim(GP, 'mistake', 'A 3.8 over 12 credits and a 3.0 over 18 credits make 3.32, not 3.4; enter the two GPAs as grades with their credits to weight them.', 'two semesters', N, async () => { const a = gp('3.8, 3.0', '12, 18'), b = gp('3.8, 3.0'); return [near(a.gpa, 3.32) && near(b.gpa, 3.4), a.gpa + ' / ' + b.gpa]; });
  claim(GP, 'dfaq', 'On this tool’s proportional conversion, 87.5%.', '3.5', N, async () => { const r = gp('3.5'); return [r.percentage === 87.5, r.percentage]; });
  claim(GP, 'dfaq', 'Choose the 10.0 scale and enter the grades or the GPA itself: 3.2 on the 4.0 scale becomes 8.0.', '3.2 on the 10.0 scale', N, async () => { const r = gp('3.2', '', 10); return [near(r.gpa, 8) && /10\.0 scale/.test(options(GP, 'scale').join()), r.gpa]; });
  claim(GP, 'dfaq', 'A grade’s points multiplied by its credits. A B+ in a 4-credit course earns 13.2 quality points.', 'B+ × 4', N, async () => { const r = gp('B+', '4'); return [near(r.qualityPoints, 13.2), r.qualityPoints]; });
  claim(GP, 'dfaq', 'Yes, as 0 points with its full credits. An A and an F in two 3-credit courses average 2.0.', 'A and F', N, async () => { const r = gp('A, F', '3, 3'); return [r.gpa === 2 && r.totalCredits === 6, r.gpa]; });
  claim(GP, 'tip', 'Give credits to weight by course size. Without them every course counts equally', 'blank credits', N, async () => { const r = gp('A, C, C'); return [near(r.gpa, 8 / 3) && r.totalCredits === 3, r.gpa]; });
  claim(GP, 'tip', 'Grade-to-point mappings differ between institutions, particularly for A+ and for pass/fail courses.', 'A+ is 4.0 here, not 4.3', N, async () => { const r = gp('A+'); return [r.gpa === 4, r.gpa]; });
  claim(GP, 'tip', 'Scale conversion here is proportional.', 'every scale is the 4.0 figure times scale ÷ 4', N, async () => { const r = [4, 5, 10].map((s) => gp('A-, B', '1, 1', s).gpa / s); return [near(r[0], r[1]) && near(r[1], r[2]), r.join(', ')]; });
  claim(GP, 'faq', 'Use the figure as a rough indication and quote your official transcript for applications.', 'the percentage is labelled approximate', N, async () => { const l = outLabel(GP, 'percentage'); return [/Approximate/.test(l), l]; });
  claim(GP, 'ui', '4.0 scale (US)', 'the scale choices say what they are', N, async () => { const o = options(GP, 'scale'); return [o.join('|') === '4.0 scale (US)|10.0 scale (India CGPA)|5.0 scale (4.0 × 1.25)', o.join(', ')]; });

  /* ================================================================ */
  /* /utilities/shoe-size-converter/                                    */
  /* ================================================================ */
  const SH = '/utilities/shoe-size-converter/';
  const sh = (size, system) => run(SH, { size, system });
  claim(SH, 'lede', 'Convert shoe sizes between UK, US, EU, Japan and foot length in centimetres.', 'every system in, every system out', N, async () => {
    const v = optValues(SH, 'system'); const r = sh(9, 'uk'); return [v.join(',') === 'uk,usm,usw,eu,cm' && ['uk', 'usMen', 'usWomen', 'eu', 'japan', 'cm'].every((k) => isFinite(r[k])), v.join(',') + ' → ' + j(r)];
  });
  claim(SH, 'card', 'Convert shoe sizes between UK, US, EU, Japan and foot length in centimetres.', 'the card line is the lede', N, async () => { const r = sh(42, 'eu'); return [r.uk === 8.5 && r.usMen === 9.5 && r.usWomen === 11, j(r)]; });
  claim(SH, 'why', 'Enter your size and system. Get UK, US, EU, Japan and foot length.', 'from US women', N, async () => { const r = sh(8, 'usw'); return [r.uk === 5.5 && r.usMen === 6.5 && r.eu === 38.5 && r.japan === 24 && r.cm === 24.1, j(r)]; });
  claim(SH, 'formula', 'derived from foot length; each system uses a different origin and increment', 'every system goes through one foot length', N, async () => {
    const a = sh(9, 'uk'), b = sh(10, 'usm'), c = sh(11.5, 'usw'), d = sh(a.cm + 0, 'cm'); return [a.cm === b.cm && b.cm === c.cm && d.uk === 9, [a.cm, b.cm, c.cm].join(', ')];
  });
  claim(SH, 'what', 'The UK and US step in thirds of an inch, the EU in two-thirds of a centimetre, and Japan uses the foot length in centimetres', 'one size up in each', N, async () => {
    const f = (s, sys) => { const r = sh(s, sys); return r.inches * 2.54; };
    const uk = ((10 + 23) / 3 - (9 + 23) / 3) * 2.54, eu = (43 / 1.5 - 42 / 1.5);
    const r = sh(26.5, 'cm');
    return [near(uk, 2.54 / 3) && near(eu, 2 / 3) && r.japan === 26.5 && near(sh(10, 'uk').inches - sh(9, 'uk').inches, 1 / 3, 0.011), 'UK step ' + uk.toFixed(4) + ' cm, EU step ' + eu.toFixed(4) + ' cm; ' + f(9, 'uk')];
  });
  claim(SH, 'what', 'US men’s sizes sit one above UK sizes and US women’s two and a half above, which is how the same shoe can be labelled 9, 10 and 11.5.', 'UK 9', N, async () => { const r = sh(9, 'uk'); return [r.uk === 9 && r.usMen === 10 && r.usWomen === 11.5, j([r.uk, r.usMen, r.usWomen])]; });
  claim(SH, 'works', 'Every size is first turned into a foot length. The UK and EU formulas include an allowance for the last, the mould a shoe is built on, so a size describes a shoe slightly longer than the foot. Results are rounded to the nearest half size.', 'all sizes are half sizes', N, async () => {
    const rnd = seeded(89); const sys = ['uk', 'usm', 'usw', 'eu', 'cm'];
    for (let k = 0; k < 200; k++) { const r = sh(ints(rnd, 30, 300) / 10, sys[k % 5]); if (!['uk', 'usMen', 'usWomen', 'eu', 'japan'].every((x) => Number.isInteger(r[x] * 2))) return [false, j(r)]; }
    return [true, '200 sizes'];
  });
  claim(SH, 'works', 'foot (in) = (UK + 23) ÷ 3', 'UK 7', N, async () => { const r = sh(7, 'uk'); return [r.inches === 10, r.inches]; });
  claim(SH, 'works', 'EU = 1.5 × (foot cm + 1.5)', '26 cm', N, async () => { const r = sh(26, 'cm'); return [r.eu === Math.round(2 * 1.5 * 27.5) / 2, r.eu]; });
  claim(SH, 'works', 'Japan = foot cm', '25 cm', N, async () => { const r = sh(25, 'cm'); return [r.japan === 25, r.japan]; });
  claim(SH, 'worked', 'A US women’s 8 works back to a foot length of 24.1 cm, or 9.5 in. That is a UK 5.5, an EU 38.5 and a Japanese 24, and the same foot in a men’s or unisex trainer is a US 6.5.', 'US women\'s 8', N, async () => { const r = sh(8, 'usw'); return [r.cm === 24.1 && r.inches === 9.5 && r.uk === 5.5 && r.eu === 38.5 && r.japan === 24 && r.usMen === 6.5, j(r)]; });
  claim(SH, 'worked', 'If a brand makes only whole EU sizes, the choice is between 38 and 39', 'the EU size is a half', N, async () => { const r = sh(8, 'usw'); return [r.eu === 38.5, r.eu]; });
  claim(SH, 'use', 'Measure the foot in centimetres and read every system from that one length.', 'from cm', N, async () => { const r = sh(27, 'cm'); return [['uk', 'usMen', 'usWomen', 'eu', 'japan'].every((k) => isFinite(r[k])), j(r)]; });
  claim(SH, 'mistake', 'The cm box expects foot length, and an insole is already longer, so it overstates the size.', 'the choice says foot length; a longer length gives a bigger size', N, async () => { const o = options(SH, 'system'); const a = sh(26, 'cm'), b = sh(27, 'cm'); return [o.indexOf('Foot length (cm)') >= 0 && b.uk > a.uk && b.eu > a.eu, o.join(', ')]; });
  claim(SH, 'mistake', 'A UK 10 is a US men’s 11 and a US women’s 12.5.', 'UK 10', N, async () => { const r = sh(10, 'uk'); return [r.usMen === 11 && r.usWomen === 12.5, j(r)]; });
  claim(SH, 'dfaq', 'UK 9, US men’s 10, US women’s 11.5 and EU 43; in Japan the size is simply 27.', '27 cm', N, async () => { const r = sh(27, 'cm'); return [r.uk === 9 && r.usMen === 10 && r.usWomen === 11.5 && r.eu === 43 && r.japan === 27, j(r)]; });
  claim(SH, 'dfaq', 'A UK 5, or US women’s 7.5, from a foot about 23.8 cm long.', 'EU 38', N, async () => { const r = sh(38, 'eu'); return [r.uk === 5 && r.usWomen === 7.5 && r.cm === 23.8, j(r)]; });
  claim(SH, 'dfaq', 'The tool rounds them to the nearest half centimetre.', '24.3 and 24.2 cm', N, async () => { const a = sh(24.3, 'cm'), b = sh(24.2, 'cm'); return [a.japan === 24.5 && b.japan === 24, a.japan + ' / ' + b.japan]; });
  manual(SH, 'tip', 'Two pairs marked the same size from different brands can differ by a full size.', 'about brands\' sizing, not the converter');
  claim(SH, 'tip', 'EU sizing uses Paris points of two-thirds of a centimetre; UK and US use barleycorns of a third of an inch. They do not align cleanly, which is why conversions are approximate.', 'EU before rounding is rarely a half size', N, async () => {
    let off = 0; for (let uk = 3; uk <= 13; uk += 0.5) { const cm = (uk + 23) / 3 * 2.54; const eu = 1.5 * (cm + 1.5); if (!Number.isInteger(Math.round(eu * 2 * 1e6) / 1e6)) off++; }
    const r = sh(9, 'uk'); return [off >= 19 && Number.isInteger(r.eu * 2), off + ' of 21 UK sizes land between EU half sizes'];
  });
  claim(SH, 'faq', 'Converting between them almost never lands exactly, so charts round', 'EU → UK → EU drifts', N, async () => { const a = sh(42, 'eu'); const b = sh(a.uk, 'uk'); return [a.eu === 42 && b.eu !== 42, 'EU 42 → UK ' + a.uk + ' → EU ' + b.eu]; });

  /* ================================================================ */
  /* /utilities/square-footage/                                         */
  /* ================================================================ */
  const SQ = '/utilities/square-footage/';
  const sq = (o) => run(SQ, Object.assign({ unit: 'ft', l1: 0, w1: 0, l2: 0, w2: 0, waste: 0, price: 0 }, o));
  const FT2 = 1 / (0.3048 * 0.3048);
  claim(SQ, 'lede', 'Calculate floor area for rooms, including L-shaped spaces, plus material quantities and cost.', 'an L-shape with waste and price', N, async () => {
    const r = sq({ l1: 14, w1: 12, l2: 6, w2: 5, waste: 10, price: 28 }); return [r.sqft === 198 && near(r.withWaste, 217.8) && r.boxes === 11 && near(r.cost, 217.8 * 28), j([r.sqft, r.withWaste, r.boxes, r.cost])];
  });
  claim(SQ, 'card', 'Calculate floor area for rooms, including L-shaped spaces, plus material quantities and cost.', 'the card line is the lede', N, async () => { const r = sq({ l1: 10, w1: 10, l2: 5, w2: 4 }); return [r.sqft === 120, r.sqft]; });
  claim(SQ, 'why', 'Enter room sections and waste. Get area, order quantity and cost.', 'outputs', N, async () => { const r = sq({ unit: 'm', l1: 4, w1: 3, waste: 10, price: 20 }); return [near(r.sqm, 12) && near(r.withWasteM, 13.2) && near(r.cost, 264), j([r.sqm, r.withWasteM, r.cost])]; });
  claim(SQ, 'formula', 'area = length × width, summed across sections', 'random rooms', N, async () => {
    const rnd = seeded(97); for (let k = 0; k < 100; k++) { const v = [1, 2, 3, 4].map(() => ints(rnd, 0, 400) / 4); const r = sq({ l1: v[0], w1: v[1], l2: v[2], w2: v[3] }); if (!near(r.sqft, v[0] * v[1] + v[2] * v[3])) return [false, v.join(',')]; } return [true, '100 rooms'];
  });
  claim(SQ, 'what', 'so the tool gives both, plus square yards.', 'sq ft, m² and sq yd', N, async () => { const r = sq({ l1: 9, w1: 1 }); return [r.sqft === 9 && near(r.sqyd, 1) && near(r.sqm, 9 / FT2), j([r.sqft, r.sqm, r.sqyd])]; });
  claim(SQ, 'works', 'Each section’s length and width are converted to feet and multiplied, and the sections are added. The waste allowance goes on top as a percentage, and boxes are the order area divided by 20 square feet, rounded up.', 'boxes at the 20 sq ft edges', N, async () => {
    const a = sq({ l1: 10, w1: 4 }), b = sq({ l1: 10, w1: 4.01 }), c = sq({ l1: 10, w1: 10, waste: 20 });
    return [a.boxes === 2 && b.boxes === 3 && near(c.withWaste, 120) && c.boxes === 6, [a.boxes, b.boxes, c.boxes].join(', ')];
  });
  claim(SQ, 'works', 'm² = sq ft ÷ 10.7639', 'the factor against the foot\'s definition (0.3048 m)', N, async () => { const r = sq({ l1: 100, w1: 1 }); return [near(100 / r.sqm, FT2, 1e-9) && FT2.toFixed(4) === '10.7639', 100 / r.sqm]; });
  claim(SQ, 'works', 'sq yd = sq ft ÷ 9', 'square yards', N, async () => { const r = sq({ l1: 18, w1: 1 }); return [r.sqyd === 2, r.sqyd]; });
  claim(SQ, 'works', 'length and width of each section, in feet, metres or inches', 'the units', N, async () => { const o = options(SQ, 'unit'); return [o.join('|') === 'Feet|Metres|Inches', o.join(', ')]; });
  claim(SQ, 'worked', 'With Metres selected the room is 15.12 m², or 162.75 sq ft, and the order with waste is 17.388 m². In packs covering 20 sq ft each, that is 10 boxes.', 'the bedroom', N, async () => {
    const r = sq({ unit: 'm', l1: 4.2, w1: 3.6, waste: 15 }); return [near(r.sqm, 15.12) && near(r.sqft, 162.75, 0.005) && near(r.withWasteM, 17.388) && r.boxes === 10, j([r.sqm, r.sqft, r.withWasteM, r.boxes])];
  });
  claim(SQ, 'use', 'Restate a US listing in square feet as square metres, or the reverse.', '1,000 sq ft and 100 m²', N, async () => { const a = sq({ l1: 1000, w1: 1 }), b = sq({ unit: 'm', l1: 100, w1: 1 }); return [near(a.sqm, 92.90304) && near(b.sqft, 1076.391041671, 1e-6), a.sqm + ' m² / ' + b.sqft + ' sq ft']; });
  claim(SQ, 'mistake', 'All four lengths use the one unit selected, so an alcove measured in centimetres must be converted to metres first.', 'one unit, no centimetres', N, async () => { const u = spec(SQ).inputs.filter((i) => i.type === 'select'); return [u.length === 1 && optValues(SQ, 'unit').indexOf('cm') < 0, u.map((i) => i.label).join(', ')]; });
  claim(SQ, 'mistake', '1 m is 3.28 ft, but 1 m² is 10.76 sq ft: a 4 m by 3 m room is 12 m² and 129.17 sq ft, not 39.4.', '4 m × 3 m', N, async () => { const r = sq({ unit: 'm', l1: 4, w1: 3 }); return [near(r.sqm, 12) && near(r.sqft, 129.17, 0.005), r.sqm + ' / ' + r.sqft]; });
  claim(SQ, 'mistake', 'If the supplier’s own pack calculator already adds a margin, set the allowance here to 0.', 'waste 0', N, async () => { const r = sq({ l1: 12, w1: 10, waste: 0 }); return [r.withWaste === r.sqft, r.withWaste]; });
  claim(SQ, 'dfaq', 'Choose Inches and enter the sizes as measured: 144 by 120 inches is 120 sq ft, because 144 square inches make one square foot.', 'inches', N, async () => { const r = sq({ unit: 'in', l1: 144, w1: 120 }); return [near(r.sqft, 120), r.sqft]; });
  claim(SQ, 'dfaq', 'Nine square feet, a square 3 ft each way. The 4.2 by 3.6 m bedroom is 18.08 sq yd.', 'the bedroom in sq yd', N, async () => { const r = sq({ unit: 'm', l1: 4.2, w1: 3.6 }); return [near(r.sqyd, 18.08, 0.005) && sq({ l1: 3, w1: 3 }).sqyd === 1, r.sqyd]; });
  claim(SQ, 'tip', 'A 10% waste allowance is typical for straight-laid flooring.', 'the default allowance is 10%', N, async () => { const d = input(SQ, 'waste'); return [d.default === 10 && d.unit === '%', d.default + d.unit]; });
  claim(SQ, 'tip', 'Break irregular rooms into rectangles and add them. Two sections cover most L-shaped spaces.', 'two sections', N, async () => { const k = spec(SQ).inputs.map((i) => i.key).filter((x) => /^[lw]\d$/.test(x)); return [k.join() === 'l1,w1,l2,w2', k.join(', ')]; });
  claim(SQ, 'ui', 'Price per sq ft — or per m² when measuring in metres', 'per m² in metres, per sq ft in feet and inches', N, async () => {
    const m = sq({ unit: 'm', l1: 2, w1: 1, price: 10 }), f = sq({ unit: 'ft', l1: 20, w1: 1, price: 10 }), i = sq({ unit: 'in', l1: 144, w1: 12, price: 10 });
    return [near(m.cost, 20) && near(f.cost, 200) && near(i.cost, 120), [m.cost, f.cost, i.cost].join(', ')];
  });

  /* ================================================================ */
  /* /utilities/tip-calculator/                                         */
  /* ================================================================ */
  const TP = '/utilities/tip-calculator/';
  const tp = (bill, tip, people, round) => run(TP, { bill, tip, people, round: round || 'none' });
  claim(TP, 'lede', 'Work out a tip and split a bill between any number of people, with optional rounding.', 'from 1 to 1,000 people; the roundings', N, async () => {
    const a = tp(1000, 10, 1000), b = tp(85, 12.5, 4, 'up'), c = tp(85, 12.5, 4, 'total');
    return [near(a.each, 1.1) && b.each === 24 && c.total === 96, j([a.each, b.each, c.total])];
  });
  claim(TP, 'card', 'Work out a tip and split a bill between any number of people, with optional rounding.', 'the card line is the lede', N, async () => { const r = tp(146.4, 12.5, 6, 'up'); return [r.each === 28 && r.total === 168, j([r.each, r.total])]; });
  claim(TP, 'why', 'Enter the bill, tip and how many. See what each person pays.', 'each', N, async () => { const r = tp(120, 12.5, 4); return [near(r.each, 33.75), r.each]; });
  claim(TP, 'formula', 'tip = bill × rate · each = (bill + tip) / people', 'random bills', N, async () => {
    const rnd = seeded(101); for (let k = 0; k < 200; k++) { const b = ints(rnd, 0, 50000) / 100, t = ints(rnd, 0, 40) / 2, n = ints(rnd, 1, 20); const r = tp(b, t, n); if (!near(r.tipAmt, b * t / 100, 1e-9) || !near(r.each, (b + b * t / 100) / n, 1e-9)) return [false, [b, t, n].join(',')]; }
    return [true, '200 bills'];
  });
  claim(TP, 'what', 'rounding the total up adds a little to the tip once, while rounding every share up adds a little per person.', 'the same bill both ways', N, async () => { const a = tp(100.1, 0, 10, 'total'), b = tp(100.1, 0, 10, 'up'); return [near(a.tipAmt, 0.9) && near(b.tipAmt, 9.9), a.tipAmt + ' / ' + b.tipAmt]; });
  claim(TP, 'works', 'When the total or the shares are rounded up, the tip is recalculated as the new total less the bill, so the effective rate rises slightly.', 'effective rate rises', N, async () => { const a = tp(64.8, 15, 3, 'total'); return [near(a.tipAmt, a.total - 64.8) && a.effectiveTip > 15, a.effectiveTip]; });
  claim(TP, 'works', 'shares rounded up: each = ⌈each⌉, total = each × people, effective rate = (total − bill) ÷ bill × 100', 'the rounded-share route; whole shares not pushed up', N, async () => {
    const r = tp(85, 12.5, 4, 'up'), w = tp(80, 25, 4, 'up'); return [r.each === 24 && r.total === 96 && near(r.effectiveTip, 11 / 85 * 100) && w.each === 25, j([r.each, r.total, r.effectiveTip, w.each])];
  });
  claim(TP, 'works', 'round up to the next whole pound', 'whole pounds, from 1p over', N, async () => { const a = tp(30.01, 0, 1, 'total'), b = tp(30, 0, 1, 'total'); return [a.total === 31 && b.total === 30, a.total + ' / ' + b.total]; });
  claim(TP, 'worked', 'Exactly, the tip is £9.72 and the total £74.52. With Round the total up, the total becomes £75.00, so each pays £25.00, and the tip is really £10.20, an effective rate of 15.741%.', 'the three friends', N, async () => {
    const a = tp(64.8, 15, 3), b = tp(64.8, 15, 3, 'total'); return [near(a.tipAmt, 9.72) && near(a.total, 74.52) && b.total === 75 && b.each === 25 && near(b.tipAmt, 10.2) && near(b.effectiveTip, 15.741, 0.0005), j([a.tipAmt, b.total, b.each, b.tipAmt, b.effectiveTip])];
  });
  claim(TP, 'use', 'Set the tip to 0% and use the tool only to split.', 'tip 0', N, async () => { const r = tp(90, 0, 4); return [r.each === 22.5 && r.tipAmt === 0, r.each]; });
  claim(TP, 'use', 'Round a fare up to a whole number and see what tip that implies.', '£17.40 rounded up', N, async () => { const r = tp(17.4, 0, 1, 'total'); return [r.total === 18 && near(r.effectiveTip, 0.6 / 17.4 * 100), r.effectiveTip]; });
  claim(TP, 'mistake', 'A £120 bill with 12.5% service is £135; a further 12.5% on top pays the gratuity twice.', '£135 and the double', N, async () => { const a = tp(120, 12.5, 1), b = tp(135, 12.5, 1); return [a.total === 135 && near(b.tipAmt, 16.875), a.total + ' / ' + b.tipAmt]; });
  claim(TP, 'mistake', 'Every share can rise by almost £1, so ten people can add nearly £10 to the tip without meaning to.', '£100.10 between ten, shares rounded up', N, async () => { const r = tp(100.1, 0, 10, 'up'); return [r.each === 11 && near(r.tipAmt, 9.9), r.each + ' / ' + r.tipAmt]; });
  claim(TP, 'dfaq', '£4.70, which makes the total £51.70.', '10% on £47', N, async () => { const r = tp(47, 10, 1); return [near(r.tipAmt, 4.7) && near(r.total, 51.7), r.tipAmt + ' / ' + r.total]; });
  claim(TP, 'dfaq', 'A £120 bill with a 12.5% tip is £135 in total, or £33.75 each.', '£120 between 4', N, async () => { const r = tp(120, 12.5, 4); return [r.total === 135 && r.each === 33.75, r.total + ' / ' + r.each]; });
  claim(TP, 'dfaq', 'It matches the rate you entered when rounding is off, and creeps above it when the total or the shares are rounded up.', 'never below, equal when exact', N, async () => {
    const rnd = seeded(103); for (let k = 0; k < 200; k++) { const b = ints(rnd, 1, 50000) / 100, t = ints(rnd, 0, 40) / 2, n = ints(rnd, 1, 12); const e = tp(b, t, n), u = tp(b, t, n, 'up'), o = tp(b, t, n, 'total'); if (!near(e.effectiveTip, t, 1e-9) || u.effectiveTip < t - 1e-9 || o.effectiveTip < t - 1e-9) return [false, [b, t, n].join(',')]; }
    return [true, '200 bills'];
  });
  manual(TP, 'tip', 'Tipping norms vary enormously: around 15–20% is customary in the US, 10–15% in the UK, and tipping is unusual or even unwelcome in Japan.', 'custom in different countries, not something the tool computes');
  manual(TP, 'tip', 'many restaurants add 12.5% automatically for larger tables.', 'restaurant practice, not tool behaviour');
  claim(TP, 'tip', 'Rounding each share up is the practical option when people are paying cash and nobody wants to hunt for change.', 'every share is whole pounds', N, async () => { const rnd = seeded(107); for (let k = 0; k < 100; k++) { const r = tp(ints(rnd, 1, 50000) / 100, 12.5, ints(rnd, 1, 9), 'up'); if (!Number.isInteger(r.each)) return [false, r.each]; } return [true, '100 bills']; });
  claim(TP, 'ui', 'Round each share up', 'the rounding choices', N, async () => { const o = options(TP, 'round'); return [o.join('|') === 'Exact|Round each share up|Round the total up', o.join(', ')]; });

  /* ================================================================ */
  /* /engineering/gauge-absolute-pressure/                              */
  /* ================================================================ */
  const GA = '/engineering/gauge-absolute-pressure/';
  const ga = (value, unit, ref, atm, atmUnit) => run(GA, { value, unit, ref, atm: atm === undefined ? 1.01325 : atm, atmUnit: atmUnit || 'bar' });
  /* the definitions, not the engine's table */
  const DEF = { bar: 1e5, atm: 101325, psi: 0.45359237 * 9.80665 / (0.0254 * 0.0254), inHg: 0.0254 * 13595.1 * 9.80665 };
  claim(GA, 'lede', 'Gauge to absolute pressure and back: psig to psia, barg to bara, kPa and MPa, at your local air pressure.', 'both directions, four units, local air', N, async () => {
    const a = ga(30, 'psi', 'gauge'), b = ga(a.psia, 'psi', 'absolute'), c = ga(500, 'kPa', 'gauge', 950, 'hPa'), d = ga(1, 'MPa', 'absolute');
    return [near(b.psig, 30, 1e-9) && near(c.kpaa, 595) && near(d.mpag, 1 - 0.101325) && near(a.bara - a.barg, 1.01325), j([b.psig, c.kpaa, d.mpag])];
  });
  claim(GA, 'card', 'Gauge to absolute pressure and back: psig to psia, barg to bara, kPa and MPa, at your local air pressure.', 'the card line is the lede', N, async () => { const r = ga(2, 'bar', 'gauge'); return [near(r.bara, 3.01325), r.bara]; });
  claim(GA, 'why', 'Enter a pressure, its unit and whether it is gauge or absolute. Get both, in every unit.', 'every unit, both references', N, async () => {
    const r = ga(30, 'psi', 'gauge'); const keys = ['psig', 'psia', 'barg', 'bara', 'kpag', 'kpaa', 'mpag', 'mpaa', 'mbarg', 'mbara', 'atma']; const u = optValues(GA, 'unit');
    return [keys.every((k) => isFinite(r[k])) && u.join(',') === 'psi,bar,mbar,kPa,MPa', u.join(',') + ' → ' + keys.length + ' results'];
  });
  claim(GA, 'why', 'Forgetting the air pressure changes', 'the atmosphere is an input', N, async () => { const a = ga(6, 'bar', 'gauge'), b = ga(6, 'bar', 'gauge', 900, 'hPa'); return [!near(a.bara, b.bara, 1e-6), a.bara + ' / ' + b.bara]; });
  claim(GA, 'why', 'Read psig, psia, barg and bara', 'the four rows', N, async () => { const l = ['psig', 'psia', 'barg', 'bara'].map((k) => (spec(GA).outputs.find((o) => o.key === k) || {}).unit); return [l.join() === 'psig,psia,barg,bara', l.join(', ')]; });
  claim(GA, 'formula', 'absolute = gauge + atmospheric · gauge = absolute − atmospheric · standard atmosphere = 1.01325 bar = 101.325 kPa = 14.6959 psi', 'the standard atmosphere from its definitions, and the default', N, async () => {
    const psi = DEF.atm / DEF.psi; const r = ga(0, 'psi', 'gauge');
    return [DEF.atm / DEF.bar === 1.01325 && DEF.atm / 1000 === 101.325 && psi.toFixed(4) === '14.6959' && input(GA, 'atm').default === 1.01325 && near(r.psia, psi, 1e-9) && near(r.kpaa, 101.325),
      '101325 Pa = ' + DEF.atm / DEF.bar + ' bar = ' + psi + ' psi; 0 psig = ' + r.psia + ' psia'];
  });
  claim(GA, 'what', 'Mixing them up is an error of a whole atmosphere, about 14.7 psi.', 'psia − psig', N, async () => { const r = ga(32, 'psi', 'gauge'); return [(r.psia - r.psig).toFixed(1) === '14.7', r.psia - r.psig]; });
  claim(GA, 'works', 'a bar is 100,000 Pa, a psi is 6,894.757 Pa and the standard atmosphere is 101,325 Pa.', 'the engine\'s factors against the definitions', N, async () => {
    const r = ga(1, 'psi', 'absolute', 1, 'bar'), b = ga(1, 'bar', 'absolute'), m = ga(1, 'mbar', 'absolute');
    return [near(r.kpaa * 1000, DEF.psi, 1e-9) && DEF.psi.toFixed(3) === '6894.757' && near(b.kpaa, 100) && near(m.kpaa, 0.1) && near(b.atma, 1e5 / 101325), '1 psi = ' + r.kpaa * 1000 + ' Pa (definition ' + DEF.psi + ')'];
  });
  claim(GA, 'works', 'p(abs) = p(gauge) + p(atm)', 'random readings', N, async () => {
    const rnd = seeded(109); for (let k = 0; k < 100; k++) { const v = ints(rnd, 0, 10000) / 100, atm = ints(rnd, 800, 1100); const r = ga(v, 'bar', 'gauge', atm, 'hPa'); if (!near(r.bara, v + atm / 1000, 1e-9)) return [false, v + ' @ ' + atm]; } return [true, '100 readings'];
  });
  claim(GA, 'works', 'p(gauge) = p(abs) − p(atm)', 'random readings', N, async () => {
    const rnd = seeded(113); for (let k = 0; k < 100; k++) { const v = ints(rnd, 0, 10000) / 10, atm = ints(rnd, 280, 310) / 10; const r = ga(v, 'kPa', 'absolute', atm, 'inHg'); if (!near(r.kpag, v - atm * DEF.inHg / 1000, 1e-9)) return [false, v + ' @ ' + atm]; } return [true, '100 readings'];
  });
  claim(GA, 'works', '1 atm = 101,325 Pa = 1.01325 bar = 14.6959 psi', 'one standard atmosphere absolute', N, async () => { const r = ga(101.325, 'kPa', 'absolute'); return [near(r.atma, 1) && near(r.bara, 1.01325) && near(r.psia, DEF.atm / DEF.psi, 1e-9) && near(r.psig, 0), j([r.atma, r.bara, r.psia, r.psig])]; });
  claim(GA, 'worked', 'MAP stands for manifold absolute pressure, so choose kPa and Absolute. At the standard atmosphere the boost a dashboard gauge would show is 78.675 kPag, which is 0.78675 barg or 11.4108 psig.', 'the MAP reading', N, async () => { const r = ga(180, 'kPa', 'absolute'); return [near(r.kpag, 78.675) && near(r.barg, 0.78675) && near(r.psig, 11.4108, 5e-5), j([r.kpag, r.barg, r.psig])]; });
  claim(GA, 'use', 'A pump or valve rated in bara set against a site gauge in barg: 10 bara is 8.98675 barg at the standard atmosphere.', '10 bara', N, async () => { const r = ga(10, 'bar', 'absolute'); return [near(r.barg, 8.98675), r.barg]; });
  claim(GA, 'use', 'A vacuum gauge showing −0.9 barg means 0.11325 bara', '−0.9 barg', N, async () => { const r = ga(-0.9, 'bar', 'gauge'); return [near(r.bara, 0.11325) && /partial vacuum/.test(r.note), r.bara + ' / ' + r.note]; });
  claim(GA, 'use', 'Enter the local barometric pressure: with 900 hPa outside, 6 barg is 6.9 bara rather than 7.01325.', '900 hPa', N, async () => { const a = ga(6, 'bar', 'gauge', 900, 'hPa'), b = ga(6, 'bar', 'gauge'); return [near(a.bara, 6.9) && near(b.bara, 7.01325), a.bara + ' / ' + b.bara]; });
  claim(GA, 'mistake', '30 psig is 2.0684 barg but 3.0817 bara; a plain psi to bar converter gives only the first.', '30 psig', N, async () => { const r = ga(30, 'psi', 'gauge'); return [near(r.barg, 2.0684, 5e-5) && near(r.bara, 3.0817, 5e-5) && near(r.barg, 30 * DEF.psi / 1e5, 1e-12), r.barg + ' / ' + r.bara]; });
  claim(GA, 'dfaq', 'at the standard atmosphere, −1.01325 barg or −14.6959 psig, a perfect vacuum. Anything lower is impossible, and the converter says so.', 'the vacuum edge', N, async () => {
    const a = ga(-1.01325, 'bar', 'gauge'), b = ga(-1.02, 'bar', 'gauge'), c = ga(-14.6959, 'psi', 'gauge');
    return [a.bara === 0 && /perfect vacuum/.test(a.note) && /^Impossible/.test(b.answer) && near(c.psia, 0, 1e-4), a.bara + ' / ' + b.answer + ' / ' + c.psia];
  });
  claim(GA, 'dfaq', 'The standard atmosphere, 1013.25 hPa, suits most work.', 'the hPa choice', N, async () => { const r = ga(0, 'bar', 'gauge', 1013.25, 'hPa'); return [near(r.bara, 1.01325) && options(GA, 'atmUnit').indexOf('hPa or mbar (standard: 1013.25)') >= 0, r.bara]; });
  claim(GA, 'dfaq', 'Both are absolute, in different units: 1 bara is 14.5038 psia.', '1 bara', N, async () => { const r = ga(1, 'bar', 'absolute'); return [r.psia.toFixed(4) === '14.5038', r.psia]; });
  claim(GA, 'tip', 'Tyre, compressor and boiler gauges read gauge pressure: zero on the dial means the same pressure as the air around it, not zero pressure.', '0 psig', N, async () => { const r = ga(0, 'psi', 'gauge'); return [r.psig === 0 && near(r.bara, 1.01325), r.psia]; });
  claim(GA, 'tip', 'A car’s MAP sensor reads absolute pressure. Choose Absolute for its reading, and the psig or barg row is what a boost gauge would show.', '250 kPa absolute', N, async () => { const r = ga(250, 'kPa', 'absolute'); return [near(r.barg, 2.5 - 1.01325), r.barg]; });
  claim(GA, 'tip', 'For a precise answer away from sea level or in unusual weather, enter today’s local barometric pressure in place of the standard atmosphere.', 'every atmosphere unit', N, async () => {
    const v = [[0.95, 'bar'], [950, 'hPa'], [95, 'kPa'], [95000 / DEF.psi, 'psi'], [95000 / DEF.inHg, 'inHg']].map(([a, u]) => ga(1, 'bar', 'gauge', a, u).bara); return [v.every((x) => near(x, 1.95, 1e-9)), v.join(', ')];
  });
  claim(GA, 'ui', 'bar (standard: 1.01325)', 'each standard value in the atmosphere choices', N, async () => {
    const want = { bar: DEF.atm / 1e5, hPa: DEF.atm / 100, kPa: DEF.atm / 1000, psi: DEF.atm / DEF.psi, inHg: DEF.atm / DEF.inHg };
    const bad = (input(GA, 'atmUnit').options || []).filter((o) => { const m = /standard: ([\d.]+)/.exec(o.label); const dp = m[1].split('.')[1].length; return Math.abs(Number(m[1]) - want[o.value]) > 0.5 * Math.pow(10, -dp) + 1e-12; });
    return [!bad.length, bad.map((o) => o.label + ' (' + want[o.value] + ')').join(', ') || options(GA, 'atmUnit').join(', ')];
  });
  claim(GA, 'faq', 'Absolute pressure is measured from a perfect vacuum, so it is never negative.', 'a negative absolute is refused', N, async () => { const r = ga(-1, 'psi', 'absolute'); return [/^Impossible/.test(r.answer) && /cannot be negative/.test(r.note), r.answer]; });
  claim(GA, 'faq', 'so it reads zero when open to the air and goes negative under a vacuum.', '0.5 bara is negative gauge', N, async () => { const r = ga(0.5, 'bar', 'absolute'); return [near(r.barg, -0.51325) && /partial vacuum/.test(r.note), r.barg]; });
  claim(GA, 'faq', 'kPa and MPa are often written kPag and kPa(a).', 'the suffixes used', N, async () => { const r = ga(100, 'kPa', 'gauge'), s = ga(1, 'MPa', 'absolute'); return [/kPag = [\d.,]+ kPa\(a\)$/.test(r.answer) && /MPa\(a\) = .* MPag$/.test(s.answer), r.answer + ' | ' + s.answer]; });
  claim(GA, 'faq', 'A flat tyre still holds air at atmospheric pressure, and the gauge reads 0 psig, not 0 psia.', '0 psig is 14.6959 psia', N, async () => { const r = ga(0, 'psi', 'gauge'); return [r.answer === '0 psig = 14.6959 psia', r.answer]; });
  claim(GA, 'faq', 'With the engine off it reads the barometric pressure. Under boost, subtract the atmospheric pressure from the MAP reading to get the boost a gauge would show; at idle the reading is below atmospheric and the gauge figure is negative, a vacuum.', 'engine off, boost, idle', N, async () => {
    const off = ga(101.325, 'kPa', 'absolute'), boost = ga(200, 'kPa', 'absolute'), idle = ga(35, 'kPa', 'absolute'); return [off.kpag === 0 && near(boost.kpag, 98.675) && idle.kpag < 0 && /vacuum/.test(idle.note), [off.kpag, boost.kpag, idle.kpag].join(', ')];
  });

  /* ================================================================ */
  /* /engineering/ohms-law/                                             */
  /* ================================================================ */
  const OH = '/engineering/ohms-law/';
  const oh = (voltage, current, resistance) => run(OH, { voltage, current, resistance });
  claim(OH, 'lede', 'Calculate voltage, current, resistance, and power. Enter any two values.', 'each pair of V, I and R', N, async () => {
    const a = oh(12, 2, null), b = oh(12, null, 6), c = oh(null, 2, 6); return [a.resistance === 6 && b.current === 2 && c.voltage === 12 && [a, b, c].every((r) => r.power === 24), j([a, b, c].map((r) => r.power))];
  });
  claim(OH, 'card', 'Calculate voltage, current, resistance, and power. Enter any two values.', 'the card line is the lede', N, async () => { const r = oh(3, 0.02, null); return [near(r.resistance, 150) && near(r.power, 0.06), r.resistance]; });
  claim(OH, 'why', 'Enter any two of voltage, current and resistance. Get the rest.', 'one value is not enough', N, async () => { const a = oh(9, null, 470), b = oh(9, null, null); return [near(a.current, 9 / 470) && /any two/.test(b.note), a.current + ' / ' + b.note]; });
  claim(OH, 'why', 'Leave the third blank', 'resistance starts blank', N, async () => { const d = K.calcDefaults(spec(OH)); return [d.resistance === null && d.voltage !== null && d.current !== null, j(d)]; });
  claim(OH, 'why', 'Read resistance and power', 'both shown', N, async () => { const r = oh(5, 0.25, null); return [r.resistance === 20 && r.power === 1.25, r.resistance + ' Ω, ' + r.power + ' W']; });
  claim(OH, 'formula', 'V = I · R · P = V · I = I²R = V²/R', 'the power forms agree on random circuits', N, async () => {
    const rnd = seeded(127); for (let k = 0; k < 100; k++) { const I = ints(rnd, 1, 1000) / 100, R = ints(rnd, 1, 10000) / 10; const r = oh(null, I, R); if (!near(r.voltage, I * R) || !near(r.power, I * I * R, 1e-9 * I * I * R) || !near(r.power, r.voltage * r.voltage / R, 1e-9 * r.power)) return [false, I + ' A, ' + R + ' Ω']; }
    return [true, '100 circuits'];
  });
  claim(OH, 'works', 'With any two of voltage, current and resistance, the third follows by rearranging V = I × R.', 'the three rearrangements', N, async () => { const a = oh(230, null, 26.45), b = oh(230, a.current, null), c = oh(null, a.current, 26.45); return [near(b.resistance, 26.45) && near(c.voltage, 230), j([a.current, b.resistance, c.voltage])]; });
  claim(OH, 'worked', 'Leave current blank and enter 230 and 26.45: the current is 8.6957 A and the power 2000 W, a 2 kW heater.', 'the heater', N, async () => { const r = oh(230, null, 26.45); return [near(r.current, 8.6957, 5e-5) && near(r.power, 2000, 1e-6), r.current + ' / ' + r.power]; });
  claim(OH, 'what', 'double the voltage across a fixed resistor and the current doubles.', 'twice the volts, twice the amps', N, async () => { const a = oh(6, null, 47), b = oh(12, null, 47); return [near(b.current, 2 * a.current), a.current + ' → ' + b.current]; });
  claim(OH, 'worked', 'That current is under 13 A, so the standard 13 A plug fuse covers it, while a 5 A fuse would blow.', 'between 5 A and 13 A', N, async () => { const r = oh(230, null, 26.45); return [r.current > 5 && r.current < 13, r.current]; });
  claim(OH, 'use', 'A 9 V battery across 470 Ω drives 19.15 mA and turns 0.17 W into heat.', '9 V, 470 Ω', N, async () => { const r = oh(9, null, 470); return [near(r.current * 1000, 19.15, 0.005) && near(r.power, 0.17, 0.005), r.current + ' / ' + r.power]; });
  claim(OH, 'use', 'A 10 kΩ pull-up on a 3.3 V line passes only 0.33 mA', '3.3 V, 10 kΩ', N, async () => { const r = oh(3.3, null, 10000); return [near(r.current * 1000, 0.33), r.current]; });
  claim(OH, 'use', 'Compare V ÷ I measured in a live circuit with the part’s marked value.', 'V and I give R', N, async () => { const r = oh(11.8, 0.0251, null); return [near(r.resistance, 11.8 / 0.0251), r.resistance]; });
  claim(OH, 'mistake', 'With voltage and current both given, resistance is recalculated from them and whatever is typed there is ignored, so clear the one you want worked out.', 'a typed resistance is overridden', N, async () => { const r = oh(12, 2, 999); return [r.resistance === 6, r.resistance]; });
  claim(OH, 'mistake', '4.7 kΩ is 4700; at 12 V that draws 2.553 mA, while 4.7 entered by mistake gives 2.553 A, a thousand times more.', '4700 against 4.7', N, async () => { const a = oh(12, null, 4700), b = oh(12, null, 4.7); return [near(a.current * 1000, 2.553, 0.0005) && near(b.current, 2.553, 0.0005), a.current + ' / ' + b.current]; });
  claim(OH, 'mistake', 'from 5 V, a 2 V LED leaves 3 V across it.', '3 V at 20 mA is 150 Ω', N, async () => { const r = oh(5 - 2, 0.02, null); return [near(r.resistance, 150), r.resistance]; });
  claim(OH, 'dfaq', 'Multiply the current squared by the resistance, or the voltage by the current. 0.5 A through 24 Ω is 0.25 × 24 = 6 W, with 12 V across it, so a 5 W part would overheat.', '0.5 A, 24 Ω', N, async () => { const r = oh(null, 0.5, 24); return [r.power === 6 && r.voltage === 12, r.power + ' W, ' + r.voltage + ' V']; });
  claim(OH, 'tip', 'Leave one field blank and fill the other two — the tool solves for the missing quantity.', 'blank or not a number counts as missing', N, async () => { const a = oh('', 2, 6), b = oh(12, 2, ''); return [a.voltage === 12 && b.resistance === 6, a.voltage + ' / ' + b.resistance]; });
  claim(OH, 'tip', 'Keep units consistent: milliamps must be converted to amps (divide by 1000) before entry.', 'the current box is in amps', N, async () => { const i = input(OH, 'current'); return [i.unit === 'A' && input(OH, 'voltage').unit === 'V' && input(OH, 'resistance').unit === 'Ω', i.label + ' (' + i.unit + ')']; });
  manual(OH, 'tip', 'Choose a rating at least double the calculated power.', 'design advice; the tool gives the power, not a rating');
  manual(OH, 'faq', 'Diodes, transistors, and filament lamps are non-ohmic — their resistance changes with voltage or temperature.', 'physics background, not tool behaviour');

  /* ================================================================ */
  /* /design/aspect-ratio/                                              */
  /* ================================================================ */
  const AS = '/design/aspect-ratio/';
  const as = (w1, h1, w2) => run(AS, { w1, h1, w2: w2 === undefined ? 0 : w2 });
  claim(AS, 'lede', 'Calculate proportional dimensions and simplify aspect ratios for images and video.', '4032 × 3024 to 1080', N, async () => { const r = as(4032, 3024, 1080); return [r.newHeight === 810 && r.ratio === '4:3', r.newHeight + ', ' + r.ratio]; });
  claim(AS, 'card', 'Calculate proportional dimensions and simplify aspect ratios for images and video.', 'the card line is the lede', N, async () => { const r = as(1920, 1080, 1280); return [r.newHeight === 720 && r.ratio === '16:9', r.newHeight + ', ' + r.ratio]; });
  claim(AS, 'why', 'Enter the original size and the new width. Get the height and ratio.', 'height and ratio', N, async () => { const r = as(3000, 2000, 1200); return [r.newHeight === 800 && r.ratio === '3:2', r.newHeight + ', ' + r.ratio]; });
  claim(AS, 'why', 'Odd heights that video encoders reject', 'an even height is given', N, async () => {
    const rnd = seeded(131); for (let k = 0; k < 200; k++) { const r = as(ints(rnd, 100, 8000), ints(rnd, 100, 8000), ints(rnd, 2, 4000)); if (r.evenHeight % 2 || Math.abs(r.evenHeight - r.newHeight) > 1) return [false, j(r)]; }
    return [true, '200 sizes'];
  });
  claim(AS, 'formula', 'newHeight = newWidth × (originalHeight / originalWidth)', 'random sizes', N, async () => { const rnd = seeded(137); for (let k = 0; k < 100; k++) { const w = ints(rnd, 1, 9000), h = ints(rnd, 1, 9000), n = ints(rnd, 1, 9000); if (!near(as(w, h, n).newHeight, n * h / w)) return [false, [w, h, n].join(',')]; } return [true, '100 sizes']; });
  claim(AS, 'what', 'a 1920 × 1080 video and a 1280 × 720 one are both 16:9.', 'both', N, async () => { const a = as(1920, 1080).ratio, b = as(1280, 720).ratio; return [a === '16:9' && b === '16:9', a + ' / ' + b]; });
  claim(AS, 'works', 'Width and height are divided by their greatest common divisor to give the simplest ratio.', 'random sizes', N, async () => { const rnd = seeded(139); for (let k = 0; k < 100; k++) { const w = ints(rnd, 1, 9000), h = ints(rnd, 1, 9000); const g = gcd(w, h); if (as(w, h).ratio !== w / g + ':' + h / g) return [false, w + '×' + h]; } return [true, '100 sizes']; });
  claim(AS, 'works', 'megapixels = W × H ÷ 1,000,000', 'megapixels', N, async () => { const r = as(4032, 3024); return [near(r.megapixels, 12.192768), r.megapixels]; });
  claim(AS, 'worked', 'The simplified ratio is 3:2, or 1.5 as a decimal, the same shape as a 6 × 4 inch print', '3000 × 2000 and 6 × 4', N, async () => { const a = as(3000, 2000), b = as(6, 4); return [a.ratio === '3:2' && a.decimal === 1.5 && b.ratio === '3:2', a.ratio + ' / ' + b.ratio]; });
  claim(AS, 'use', 'A 1080 × 1920 Story scaled to 720 wide becomes 1280 high and stays 9:16.', 'the Story', N, async () => { const r = as(1080, 1920, 720); return [r.newHeight === 1280 && r.ratio === '9:16', r.newHeight + ', ' + r.ratio]; });
  claim(AS, 'use', 'A4 paper is 297 × 210 mm, a decimal of 1.414, so a 3:2 photo printed on it will crop or leave a border.', 'A4 against 3:2', N, async () => { const a = as(297, 210), b = as(3, 2); return [a.decimal.toFixed(3) === '1.414' && b.decimal === 1.5, a.decimal + ' / ' + b.decimal]; });
  claim(AS, 'use', 'A 2560 × 1080 screen reduces to 64:27, sold as 21:9.', '2560 × 1080', N, async () => { const r = as(2560, 1080); return [r.ratio === '64:27', r.ratio]; });
  claim(AS, 'mistake', '1366 × 768 simplifies to 683:384, not 16:9: the decimal is 1.7786 against 1.7778, close but not equal.', '1366 × 768', N, async () => { const a = as(1366, 768), b = as(16, 9); return [a.ratio === '683:384' && a.decimal.toFixed(4) === '1.7786' && b.decimal.toFixed(4) === '1.7778', a.ratio + ' ' + a.decimal]; });
  claim(AS, 'mistake', 'the calculator gives a size, not new pixels.', 'an enlargement is just a size', N, async () => { const r = as(800, 600, 1200); return [r.newHeight === 900, r.newHeight]; });
  claim(AS, 'dfaq', '16:9, or 1.7778 as a decimal. Dividing both sides by their greatest common divisor, 120, gives 16 and 9; the frame holds 2.0736 megapixels.', '1920 × 1080', N, async () => { const r = as(1920, 1080); return [r.ratio === '16:9' && gcd(1920, 1080) === 120 && near(r.megapixels, 2.0736) && r.decimal.toFixed(4) === '1.7778', j(r)]; });
  claim(AS, 'dfaq', 'The new height shown is then the width you need: a 1920 × 1080 frame scaled to 1350 high needs a width of 2400.', 'the swap, done as the answer says', N, async () => {
    const W = 1920, H = 1080; const r = as(H, W, 1350); /* original height in Original Width, original width in Original Height */
    return [r.newHeight === 2400 && near(2400 / 1350, W / H), 'Original Width ' + H + ', Original Height ' + W + ', New Width 1350 → ' + r.newHeight];
  });
  claim(AS, 'tip', 'Common ratios: 16:9 widescreen video, 4:3 legacy displays, 1:1 square social posts, 9:16 vertical/stories, 3:2 most DSLR sensors.', 'familiar sizes reduce to them', N, async () => {
    const v = [as(3840, 2160), as(1024, 768), as(1080, 1080), as(1080, 1920), as(6000, 4000)].map((r) => r.ratio); return [v.join(' ') === '16:9 4:3 1:1 9:16 3:2', v.join(' ')];
  });
  claim(AS, 'tip', 'Scaling to a non-integer height causes half-pixel rendering. Round to an even number for video encoding; the nearest even height is shown with the results.', '1366 × 768 at 1000 wide', N, async () => {
    const r = as(1366, 768, 1000); return [!Number.isInteger(r.newHeight) && r.evenHeight === 562 && /even height/.test(outLabel(AS, 'evenHeight')), r.newHeight + ' → ' + r.evenHeight + ' (' + outLabel(AS, 'evenHeight') + ')'];
  });
  manual(AS, 'faq', 'Most codecs (H.264, H.265) subsample chroma in 2×2 blocks, so both width and height must be divisible by 2 — some encoders require multiples of 4 or 16.', 'codec background; the tool gives the even height');
};
