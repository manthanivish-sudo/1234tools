(function(){
/* Percentages, one question at a time, or every answer for two numbers.

   The three classic questions:  P% of N = P ÷ 100 × N;  X is (X ÷ Y × 100)%
   of Y;  X is P% of (X × 100 ÷ P).  Then change, (new − old) ÷ |old| × 100;
   difference, |A − B| ÷ ((A + B) ÷ 2) × 100; reverse percentages (the figure
   before a P% rise is N ÷ (1 + P ÷ 100), before a cut N ÷ (1 − P ÷ 100));
   and a fraction, decimal or percentage written each of the other ways.

   "Every answer" keeps the two boxes, A and B, that links and the Tool Finder
   fill (?value=20&total=150), with the eight results they always gave.
   A fraction is read exactly: a decimal with d places is n ÷ 10^d, then cut
   down by the greatest common divisor, so 0.375 is 3/8. */
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; };
function readFraction(s) {
  const t = String(s || '').trim().replace(/\s+/g, ' ');
  let m;
  if ((m = /^(-?)(\d+) (\d+)\/(\d+)$/.exec(t))) { const d = Number(m[4]); if (!d) return null; return { n: (Number(m[2]) * d + Number(m[3])) * (m[1] ? -1 : 1), d }; }
  if ((m = /^(-?\d+)\/(-?\d+)$/.exec(t))) { const d = Number(m[2]); if (!d) return null; return { n: Number(m[1]) * Math.sign(d), d: Math.abs(d) }; }
  let pct = false, u = t;
  if (/%$/.test(u)) { pct = true; u = u.slice(0, -1).trim(); }
  if ((m = /^(-?)(\d*)(?:\.(\d+))?$/.exec(u)) && (m[2] || m[3])) {
    const places = (m[3] || '').length + (pct ? 2 : 0);
    const digits = Number((m[2] || '0') + (m[3] || ''));
    if (!Number.isSafeInteger(digits) || places > 15) return null;
    return { n: digits * (m[1] ? -1 : 1), d: Math.pow(10, places) };
  }
  return null;
}
const blankNum = (v) => v === null || v === undefined || v === '' || Number.isNaN(v);
const fx = (v) => Number(Number(v).toPrecision(12));

window.TOOLS = window.TOOLS || {};
window.TOOLS["percentage"] = {
"title": "Percentage Calculator",
"category": "mathematics",
"icon": "％",
"description": "Calculate percentages, percentage change, and reverse percentages in both directions.",
"keywords": ["percentage calculator","percent change","percentage increase","percent of"],
"formula": "part = whole × pct/100  ·  change = (new − old)/old × 100",
"inputs": [{"key":"mode","label":"Question","type":"select","options":[{"value":"all","label":"Every answer for two numbers, A and B"},{"value":"of","label":"What is P% of N?"},{"value":"what","label":"X is what percentage of Y?"},{"value":"whole","label":"X is P% of what?"},{"value":"change","label":"Percentage change from one figure to another"},{"value":"diff","label":"Percentage difference between two figures"},{"value":"reverse","label":"The figure before a percentage rise or cut"},{"value":"frac","label":"Fraction, decimal and percentage"}],"default":"all"},
  {"key":"value","label":"Value A","type":"number","default":25,"showIf":{"key":"mode","is":"all"}},{"key":"total","label":"Value B","type":"number","default":200,"showIf":{"key":"mode","is":"all"}},
  {"key":"p","label":"Percentage","type":"number","unit":"%","default":20,"showIf":{"key":"mode","is":["of","whole","reverse"]}},
  {"key":"x","label":"X (the part)","type":"number","default":30,"showIf":{"key":"mode","is":["what","whole"]}},
  {"key":"n","label":"N (the whole, or the figure now)","type":"number","default":150,"showIf":{"key":"mode","is":["of","what","reverse"]}},
  {"key":"from","label":"From (the old figure)","type":"number","default":80,"showIf":{"key":"mode","is":["change","diff"]}},
  {"key":"to","label":"To (the new figure)","type":"number","default":100,"showIf":{"key":"mode","is":["change","diff"]}},
  {"key":"dir","label":"N is the figure after a","type":"select","options":[{"value":"rise","label":"Rise"},{"value":"cut","label":"Cut"}],"default":"rise","showIf":{"key":"mode","is":"reverse"}},
  {"key":"frac","label":"A fraction, decimal or percentage","type":"text","default":"3/8","showIf":{"key":"mode","is":"frac"},"hint":"For example 3/8, 1 1/2, 0.375 or 37.5%."}],
"validate": (v) => {
      const e = {};
      if (v.mode === 'what' && v.n === 0) e.n = 'Y cannot be 0: nothing is a percentage of zero.';
      if (v.mode === 'whole' && v.p === 0) e.p = 'The percentage cannot be 0 here.';
      if (v.mode === 'change' && v.from === 0) e.from = 'A change from 0 has no percentage: any rise from nothing is infinite.';
      if (v.mode === 'reverse' && v.dir === 'cut' && v.p === 100) e.p = 'After a 100% cut everything is 0, so the figure before cannot be found.';
      if (v.mode === 'frac' && !readFraction(v.frac)) e.frac = 'Write a fraction such as 3/8 or 1 1/2, a decimal such as 0.375, or a percentage such as 37.5%.';
      return e;
    },
"compute": ({ mode, value, total, p, x, n, from, to, dir, frac }) => {
      if (mode === undefined || mode === null || mode === 'all') return {
      aOfB: total === 0 ? NaN : (value / total) * 100,
      pctOfB: (value / 100) * total,
      change: value === 0 ? NaN : ((total - value) / value) * 100,
      increased: total * (1 + value / 100),
      decreased: total * (1 - value / 100),
      difference: (value + total) === 0 ? NaN : (Math.abs(value - total) / ((value + total) / 2)) * 100,
      /* reverse percentages: B is the figure after an A% rise or cut, and
         these are the amounts it started from */
      beforeRise: value === -100 ? NaN : total / (1 + value / 100),
      beforeCut: value === 100 ? NaN : total / (1 - value / 100)
      };
      const s = (v) => String(fx(v));
      if (mode === 'of') { const r = p / 100 * n; return { result: r, answer: s(p) + '% of ' + s(n) + ' is ' + s(r) }; }
      if (mode === 'what') { const r = x / n * 100; return { result: r, answer: s(x) + ' is ' + s(r) + '% of ' + s(n) }; }
      if (mode === 'whole') { const r = x * 100 / p; return { result: r, answer: s(x) + ' is ' + s(p) + '% of ' + s(r) }; }
      if (mode === 'change') {
        const r = (to - from) / Math.abs(from) * 100;
        return { result: r, answer: (r > 0 ? 'A rise of ' : r < 0 ? 'A fall of ' : 'No change: ') + s(Math.abs(r)) + '%', diffAbs: to - from };
      }
      if (mode === 'diff') {
        const mean = (from + to) / 2;
        const r = mean === 0 ? NaN : Math.abs(from - to) / Math.abs(mean) * 100;
        return { result: r, answer: 'They differ by ' + s(r) + '% of their average', diffAbs: Math.abs(to - from) };
      }
      if (mode === 'reverse') {
        const k = dir === 'cut' ? 1 - p / 100 : 1 + p / 100;
        const r = n / k;
        return { result: r, answer: s(n) + ' after a ' + s(p) + '% ' + (dir === 'cut' ? 'cut' : 'rise') + ' started at ' + s(r), diffAbs: n - r };
      }
      if (mode === 'frac') {
        const q = readFraction(frac);
        if (!q) return {};
        const g = gcd(q.n, q.d) || 1;
        const nn = q.n / g, dd = q.d / g;
        const dec = q.n / q.d;
        const whole = Math.trunc(nn / dd), rest = Math.abs(nn % dd);
        return {
          result: dec * 100,
          answer: s(dec * 100) + '%',
          decimal: dec,
          fraction: dd === 1 ? String(nn) : nn + '/' + dd,
          mixed: dd !== 1 && Math.abs(nn) > dd ? whole + ' ' + rest + '/' + dd : ''
        };
      }
      return {};
    },
"outputs": [{"key":"aOfB","label":"A is what % of B","format":"percent","primary":true},{"key":"answer","label":"Answer","format":"text","primary":true},{"key":"result","label":"Result","format":"number"},{"key":"diffAbs","label":"Difference in units","format":"number"},{"key":"decimal","label":"As a decimal","format":"number"},{"key":"fraction","label":"As a fraction, simplest form","format":"text"},{"key":"mixed","label":"As a mixed number","format":"text"},{"key":"pctOfB","label":"A% of B","format":"number"},{"key":"change","label":"% change from A to B","format":"percent"},{"key":"increased","label":"B increased by A%","format":"number"},{"key":"decreased","label":"B decreased by A%","format":"number"},{"key":"difference","label":"% difference (symmetric)","format":"percent"},{"key":"beforeRise","label":"B before an A% rise","format":"number"},{"key":"beforeCut","label":"B before an A% cut","format":"number"}],
"steps": (v, r, f) => {
      const u = (x) => f.upto(x, 6);
      switch (v.mode) {
        case 'of': return ['Write the percentage as a fraction of 100: ' + u(v.p) + '% = ' + u(v.p) + ' ÷ 100 = ' + u(v.p / 100) + '.', 'Multiply by N: ' + u(v.p / 100) + ' × ' + u(v.n) + ' = ' + u(r.result) + '.'];
        case 'what': return ['Divide the part by the whole: ' + u(v.x) + ' ÷ ' + u(v.n) + ' = ' + u(v.x / v.n) + '.', 'Multiply by 100 to make it a percentage: ' + u(v.x / v.n) + ' × 100 = ' + u(r.result) + '%.'];
        case 'whole': return ['X is ' + u(v.p) + '% of the whole, so 1% of it is ' + u(v.x) + ' ÷ ' + u(v.p) + ' = ' + u(v.x / v.p) + '.', 'The whole is 100% of it: ' + u(v.x / v.p) + ' × 100 = ' + u(r.result) + '.'];
        case 'change': return ['Take the old figure from the new: ' + u(v.to) + ' − ' + u(v.from) + ' = ' + u(v.to - v.from) + '.', 'Divide by the old figure and multiply by 100: ' + u(v.to - v.from) + ' ÷ ' + u(Math.abs(v.from)) + ' × 100 = ' + u(r.result) + '%.'];
        case 'diff': return ['The gap between them: |' + u(v.from) + ' − ' + u(v.to) + '| = ' + u(Math.abs(v.from - v.to)) + '.', 'Their average: (' + u(v.from) + ' + ' + u(v.to) + ') ÷ 2 = ' + u((v.from + v.to) / 2) + '.', 'Gap ÷ average × 100 = ' + u(r.result) + '%.'];
        case 'reverse': return ['After a ' + u(v.p) + '% ' + (v.dir === 'cut' ? 'cut the figure is ' + u(100 - v.p) : 'rise the figure is ' + u(100 + v.p)) + '% of what it was, so divide by ' + u(v.dir === 'cut' ? 1 - v.p / 100 : 1 + v.p / 100) + '.', u(v.n) + ' ÷ ' + u(v.dir === 'cut' ? 1 - v.p / 100 : 1 + v.p / 100) + ' = ' + u(r.result) + '. Taking ' + u(v.p) + '% off ' + u(v.n) + ' instead would give ' + u(v.n * (v.dir === 'cut' ? 1 + v.p / 100 : 1 - v.p / 100)) + ', which is wrong.'];
        case 'frac': return r.fraction ? ['As a decimal: ' + u(r.decimal) + '.', 'As a percentage: ' + u(r.decimal) + ' × 100 = ' + u(r.result) + '%.', 'In its simplest form: ' + r.fraction + (r.mixed ? ', or ' + r.mixed : '') + '.'] : [];
        default: return ['A as a percentage of B: ' + u(v.value) + ' ÷ ' + u(v.total) + ' × 100 = ' + u(r.aOfB) + '%.', 'A% of B: ' + u(v.value) + ' ÷ 100 × ' + u(v.total) + ' = ' + u(r.pctOfB) + '.', 'Change from A to B: (' + u(v.total) + ' − ' + u(v.value) + ') ÷ ' + u(v.value) + ' × 100 = ' + u(r.change) + '%.'];
      }
    },
"tips": ["Percentage change is directional: going 100 → 50 is −50%, but 50 → 100 is +100%. The same absolute move gives different percentages.","A 20% drop followed by a 20% rise does not return you to the start — it leaves you 4% down.","Percentage difference (symmetric) compares two values without treating either as the baseline.","Choose a question to get a form for just that sum, with the working step by step under the formula.","To find a price before VAT or a discount, use the figure before a rise or cut: dividing is right, taking the percentage off the new figure is not."],
"faq": [{"q":"What is the difference between percentage points and percent?","a":"If a rate moves from 5% to 7%, that is a rise of 2 percentage points, but a 40% increase in relative terms. Mixing the two is a common source of misleading statistics."},{"q":"How do I turn a fraction into a percentage?","a":"Divide the top by the bottom and multiply by 100: 3/8 is 0.375, which is 37.5%. Choose “Fraction, decimal and percentage” and type 3/8, 1 1/2, 0.375 or 37.5% to see all three forms and the simplest fraction."}]
};
})();
