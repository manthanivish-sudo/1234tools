/* Spin the Wheel's own rules, for build/tests/games.js.
   The maths is checked against geometry written out again here, not against
   the engine's own output; the page is driven like a visitor would. */
'use strict';
const TAU = Math.PI * 2;

/* the other half of the geometry, independently: which slice does a point on the wheel belong to? */
function sliceOfAngle(weights, angle) {
  const W = weights.reduce((a, b) => a + b, 0);
  const a = ((angle % TAU) + TAU) % TAU;
  let lo = 0;
  for (let i = 0; i < weights.length; i++) {
    const hi = lo + weights[i] / W * TAU;
    if (a >= lo && a < hi) return { i, lo, hi, a };
    lo = hi;
  }
  return { i: weights.length - 1, lo, hi: TAU, a };
}
function chiExpected(counts, expected) {
  return counts.reduce((s, c, i) => s + (c - expected[i]) * (c - expected[i]) / expected[i], 0);
}
const clickLabel = (page, text) => page.evaluate((t) => {
  const l = Array.from(document.querySelectorAll('[data-tool="spin-the-wheel"] label.game-check')).find((x) => x.textContent.indexOf(t) >= 0);
  l.querySelector('input').click();
  return l.querySelector('input').checked;
}, text);
const clickButton = (page, text) => page.evaluate((t) => {
  const b = Array.from(document.querySelectorAll('[data-tool="spin-the-wheel"] button')).find((x) => x.textContent.indexOf(t) === 0);
  b.click();
}, text);
const lines = (page) => page.evaluate(() => document.querySelector('[data-tool="spin-the-wheel"] textarea').value.split('\n').filter(Boolean));
const setList = async (page, text) => {
  await page.evaluate((t) => {
    const ta = document.querySelector('[data-tool="spin-the-wheel"] textarea');
    ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
};
const press = async (page, key) => {
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press(key);
};

module.exports = {
  check: async function (page, h) {
    const r = await page.evaluate(() => {
      const M = window.GAME_TOOLS['spin-the-wheel'].maths;
      const K = window.GameKit;
      const out = {};
      out.parse = [M.parseEntry('Asha*3'), M.parseEntry('Ravi'), M.parseEntry('Meera * 60'), M.parseEntry('*3'), M.parseEntry('Zoya*0'), M.parseEntry('A*B')];
      out.list = M.parseEntries('Asha*3\n\n  Ravi  \nKabir*2\n' + 'x'.repeat(90)).map((e) => e.n.length + ':' + e.w);
      out.hundred = M.parseEntries(Array.from({ length: 150 }, (_, i) => 'N' + i).join('\n')).length;
      /* the winner draw: 7 entries, 30 000 draws */
      const c7 = new Array(7).fill(0), w7 = [1, 1, 1, 1, 1, 1, 1];
      for (let i = 0; i < 30000; i++) c7[M.drawWinner(w7, K.randInt)]++;
      out.c7 = c7;
      /* A*3 against B, 30 000 draws */
      const c2 = [0, 0];
      for (let i = 0; i < 30000; i++) c2[M.drawWinner([3, 1], K.randInt)]++;
      out.c2 = c2;
      const c3 = [0, 0, 0];
      for (let i = 0; i < 40000; i++) c3[M.drawWinner([1, 2, 5], K.randInt)]++;
      out.c3 = c3;
      /* 1000 random spins: collect where each one ends */
      out.spins = [];
      for (let n = 0; n < 1000; n++) {
        const k = 2 + Math.floor(Math.random() * 11);
        const weights = Array.from({ length: k }, () => 1 + Math.floor(Math.random() * 6));
        const from = Math.random() * 40 - 10;
        const sp = M.planSpin(weights, K.randInt, 3 + Math.random() * 3, from, 1000);
        const end = M.rotationAt(weights, sp, sp.duration, false);
        out.spins.push({ weights, sp, end, endLater: M.rotationAt(weights, sp, sp.duration + 5000, false), reduced: M.rotationAt(weights, sp, 700, true), start: M.rotationAt(weights, sp, 0, false), reducedEarly: M.rotationAt(weights, sp, 100, true) });
      }
      /* the animation never goes backwards and never overshoots */
      const w = [2, 1, 3, 1];
      const sp = M.planSpin(w, K.randInt, 4, 1.234, 5000);
      const track = [];
      for (let t = 0; t <= sp.duration; t += 40) track.push(M.rotationAt(w, sp, t, false));
      out.track = track; out.trackEnd = M.rotationAt(w, sp, sp.duration, false); out.trackFrom = sp.from;
      out.colours = [];
      for (let n = 2; n <= 100; n++) {
        const c = M.colourIndex(n);
        let bad = 0;
        for (let i = 0; i < n; i++) if (c[i] === c[(i + 1) % n]) bad++;
        out.colours.push(bad);
      }
      const meas = (s) => s.length * 10;
      out.fit = [M.fitText('Asha', 100, meas), M.fitText('A very long name indeed', 100, meas), M.fitText('Wonderful', 15, meas), M.fitText('Hi', 5, meas)];
      out.remove = [M.removeEntryLine('A\n\nB\nC', 1), M.removeEntryLine('A\nB\nA', 2), M.removeEntryLine('A\nB', 5), M.removeEntryLine('X', 0)];
      out.span = [M.sliceSpan([1, 3], 0), M.sliceSpan([1, 3], 1), M.sliceAt([1, 3], 0.2), M.sliceAt([1, 3], 0.26), M.pointerSlice([1, 1], -0.1), M.pointerSlice([1, 1], -3.5)];
      return out;
    });
    h.ok(r.parse[0].n === 'Asha' && r.parse[0].w === 3, 'wheel: "Asha*3" is Asha with weight 3');
    h.ok(r.parse[1].n === 'Ravi' && r.parse[1].w === 1, 'wheel: a plain name has weight 1');
    h.ok(r.parse[2].n === 'Meera' && r.parse[2].w === 50, 'wheel: weights stop at 50 and spaces around * are fine');
    h.ok(r.parse[3].n === '*3' && r.parse[3].w === 1, 'wheel: a weight with no name stays text');
    h.ok(r.parse[4].w === 1 && r.parse[5].n === 'A*B', 'wheel: *0 counts as 1, *B is part of the name');
    h.ok(r.list.join() === '4:3,4:1,5:2,40:1', 'wheel: lines parsed, blanks dropped, names cut to 40', r.list.join());
    h.ok(r.hundred === 100, 'wheel: at most 100 entries', String(r.hundred));
    const chi7 = h.chiSquare(r.c7);
    h.ok(chi7 < h.CHI_001[6], 'wheel: 7 entries each equally likely over 30 000 draws (chi² ' + chi7.toFixed(1) + ')');
    const chi2 = chiExpected(r.c2, [22500, 7500]);
    h.ok(chi2 < h.CHI_001[1], 'wheel: A*3 against B wins 3 : 1 over 30 000 draws (chi² ' + chi2.toFixed(1) + ', ' + r.c2.join('/') + ')');
    const chi3 = chiExpected(r.c3, [5000, 10000, 25000]);
    h.ok(chi3 < h.CHI_001[2], 'wheel: weights 1, 2, 5 win 1 : 2 : 5 over 40 000 draws (chi² ' + chi3.toFixed(1) + ')');

    /* where each of 1000 spins ends, by geometry written out again here */
    let outside = 0, wrongTurns = 0, badTime = 0, badReduced = 0, notAtRest = 0, centre = 0;
    for (const s of r.spins) {
      /* the pointer is at 3 o'clock; a wheel turned by θ shows its angle −θ there */
      const hit = sliceOfAngle(s.weights, -s.end);
      if (hit.i !== s.sp.winner) outside++;
      const width = hit.hi - hit.lo;
      if (!(hit.a > hit.lo + width * 0.09 && hit.a < hit.hi - width * 0.09)) centre++;
      if (s.end < s.sp.from + 3 * TAU - 1e-9 || s.end > s.sp.from + 9 * TAU) wrongTurns++;
      if (s.sp.duration < 3000 || s.sp.duration > 6000) badTime++;
      if (Math.abs(s.reduced - s.end) > 1e-9 || Math.abs(s.reducedEarly - s.sp.from) > 1e-9) badReduced++;
      if (s.endLater !== s.end || s.start !== s.sp.from) notAtRest++;
    }
    h.ok(outside === 0, 'wheel: all 1000 spins end with the pointer inside the winner’s slice', outside + ' outside');
    h.ok(centre === 0, 'wheel: the landing spot stays at least 9% inside the slice edge', centre + ' too close');
    h.ok(wrongTurns === 0, 'wheel: every spin makes 3 to 9 whole turns');
    h.ok(badTime === 0, 'wheel: spin time is 3 to 6 seconds');
    h.ok(badReduced === 0, 'wheel: with reduced motion the wheel jumps to the same result after 600 ms');
    h.ok(notAtRest === 0, 'wheel: the animation starts at its start angle and holds its end angle');
    let backwards = 0;
    for (let i = 1; i < r.track.length; i++) if (r.track[i] < r.track[i - 1] - 1e-12) backwards++;
    h.ok(backwards === 0 && r.track[0] === r.trackFrom && r.track.every((x) => x <= r.trackEnd + 1e-9), 'wheel: the spin only moves forward and slows to a stop');
    const speeds = [];
    for (let i = 1; i < r.track.length; i++) speeds.push(r.track[i] - r.track[i - 1]);
    h.ok(speeds[0] > speeds[Math.floor(speeds.length / 2)] && speeds[Math.floor(speeds.length / 2)] > speeds[speeds.length - 1], 'wheel: the ease-out is believable (fast, slower, slowest)');
    h.ok(r.colours.every((b) => b === 0), 'wheel: no two neighbouring slices share a colour for 2 to 100 entries', r.colours.join(''));
    h.ok(r.fit[0] === 'Asha' && r.fit[1].endsWith('…') && r.fit[1].length * 10 <= 100 && r.fit[2] === '' && r.fit[3] === '', 'wheel: text is kept, shortened with an ellipsis, or dropped when nothing fits', r.fit.join('|'));
    h.ok(r.remove.join('||') === 'A\n\nC||A\nB||A\nB||', 'wheel: removing an entry deletes exactly that line', JSON.stringify(r.remove));
    h.ok(r.span[0].join() === '0,0.25' && r.span[1].join() === '0.25,1' && r.span[2] === 0 && r.span[3] === 1 && r.span[4] === 0 && r.span[5] === 1, 'wheel: slice spans and the slice under the pointer', JSON.stringify(r.span));

    /* ---- the page ---- */
    const base = '[data-tool="spin-the-wheel"]';
    const hub = await h.open('/games/');
    await hub.evaluate(() => { window.__msgs = []; const c = new BroadcastChannel('mvr-games:spin-the-wheel'); c.onmessage = (e) => window.__msgs.push(e.data); window.__chan = c; });
    const tv = await h.openStage('spin-the-wheel');
    await page.bringToFront();
    await page.evaluate(() => { window.__ticks = []; const s = window.GameKit.sound; const real = s.tick; s.tick = function () { window.__ticks.push(performance.now()); return real.apply(s, arguments); }; });
    await setList(page, 'Asha\nRavi\nMeera\nGrandad\nNani');
    await h.sleep(250);
    let info = await page.evaluate((b) => ({ count: document.querySelector(b + ' .wheel-count').textContent, small: document.querySelector(b + ' .wheel-spin').disabled }), base);
    h.ok(/^5 entries/.test(info.count) && !info.small, 'wheel: five names are counted and Spin is ready', info.count);
    const px = await page.evaluate((b) => {
      const c = document.querySelector(b + ' canvas'); const g = c.getContext('2d');
      const d = g.getImageData(Math.round(c.width * 0.78), Math.round(c.height / 2), 1, 1).data;
      return { a: d[3], w: c.width, css: parseInt(c.style.width, 10) };
    }, base);
    h.ok(px.a === 255 && px.w === px.css * 1, 'wheel: the canvas is drawn at device resolution (1:1 here)', JSON.stringify(px));

    /* one message per spin; the TV ends on the same winner */
    await page.select(base + ' select', '3');
    await h.sleep(100);
    await hub.evaluate(() => { window.__msgs.length = 0; });
    await press(page, 'Space');
    await h.sleep(400);
    const busy = await page.evaluate((b) => ({ spin: document.querySelector(b + ' .wheel-spin').disabled, ro: document.querySelector(b + ' textarea').readOnly }), base);
    h.ok(busy.spin && busy.ro, 'wheel: Space starts a spin and locks the list while it turns');
    await h.sleep(3600);
    const done = await page.evaluate((b) => ({ win: document.querySelector(b + ' .wheel-win').textContent, hist: Array.from(document.querySelectorAll(b + ' .wheel-history li')).map((l) => l.textContent), live: (document.querySelector('.game-live') || {}).textContent }), base);
    h.ok(done.hist.length === 1 && done.win === done.hist[0] && ['Asha', 'Ravi', 'Meera', 'Grandad', 'Nani'].includes(done.win), 'wheel: the winner is announced and listed in the results', JSON.stringify(done));
    h.ok(/Winner: /.test(done.live || '') && done.live.indexOf(done.win) > 0, 'wheel: the winner is announced to screen readers (aria-live)', done.live);
    const msgs = await hub.evaluate(() => window.__msgs.filter((m) => m.k === 'state'));
    h.ok(msgs.length === 1 && msgs[0].s.spin && msgs[0].s.entries[msgs[0].s.spin.winner].n === done.win, 'wheel: the stage got exactly one message for the spin, naming the same winner', msgs.length + ' messages');
    const tvWin = await tv.evaluate(() => document.querySelector('.wheel-stage-win').textContent);
    h.ok(tvWin === done.win, 'wheel: the TV window ends on the same winner', tvWin + ' vs ' + done.win);
    const ticks = await page.evaluate(() => window.__ticks);
    let minGap = 1e9;
    for (let i = 1; i < ticks.length; i++) minGap = Math.min(minGap, ticks[i] - ticks[i - 1]);
    h.ok(ticks.length >= 8 && ticks.length <= 80 && minGap >= 40, 'wheel: ticks play on slice boundaries, rate-limited (' + ticks.length + ' ticks, shortest gap ' + Math.round(minGap) + ' ms)');
    const stopped = await page.evaluate((b) => !document.querySelector(b + ' .wheel-spin').disabled && document.querySelector(b + ' .wheel-spin').textContent.indexOf('Spin') === 0, base);
    h.ok(stopped, 'wheel: Spin is ready again after the result');

    /* joining late: a TV opened after the spin shows the winner at once */
    const late = await h.openStage('spin-the-wheel');
    await h.sleep(500);
    const lateWin = await late.evaluate(() => document.querySelector('.wheel-stage-win').textContent);
    h.ok(lateWin === done.win, 'wheel: a TV window opened afterwards shows the last winner', lateWin);
    await late.close();
    await page.bringToFront();

    /* reduced motion: no spin, the result fades in after a short pause */
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await clickButton(page, 'Clear results');
    await clickButton(page, 'Spin');
    await h.sleep(1100);
    const red = await page.evaluate((b) => ({ win: document.querySelector(b + ' .wheel-win').textContent, cls: document.querySelector(b + ' .wheel-win').className, hist: document.querySelectorAll(b + ' .wheel-history li').length }), base);
    h.ok(red.hist === 1 && red.win && /is-fade/.test(red.cls), 'wheel: with reduced motion the result shows within about a second and fades in', JSON.stringify(red));
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

    /* remove the winner: two messages for that spin (the spin, then the new list) */
    const before = await lines(page);
    await clickLabel(page, 'Remove the winner');
    await hub.evaluate(() => { window.__msgs.length = 0; });
    await clickButton(page, 'Spin');
    await h.sleep(3000 + 1500 + 700);
    const after = await lines(page);
    const histAfter = await page.evaluate((b) => Array.from(document.querySelectorAll(b + ' .wheel-history li')).map((l) => l.textContent), base);
    const w2 = histAfter[histAfter.length - 1];
    h.ok(after.length === before.length - 1 && after.indexOf(w2) < 0 && before.indexOf(w2) >= 0, 'wheel: the winner is taken off the list after the spin', before.join() + ' -> ' + after.join());
    const m2 = await hub.evaluate(() => window.__msgs.filter((m) => m.k === 'state'));
    h.ok(m2.length === 2 && m2[0].s.spin && !m2[1].s.spin && m2[1].s.entries.length === after.length && m2[1].s.last === w2, 'wheel: the stage hears the spin, then the list without the winner', m2.length + ' messages');
    const tvEntries = await tv.evaluate(() => document.querySelector('.wheel-stage-win').textContent);
    h.ok(tvEntries === w2, 'wheel: the TV keeps showing the last winner after the removal');
    /* spin the rest down: nobody comes up twice */
    const seen = new Set([w2]);
    let twice = 0;
    for (let i = 0; i < 3; i++) {
      await clickButton(page, 'Spin');
      await h.sleep(3000 + 1500 + 700);
      const hh = await page.evaluate((b) => Array.from(document.querySelectorAll(b + ' .wheel-history li')).map((l) => l.textContent), base);
      const last = hh[hh.length - 1];
      if (seen.has(last)) twice++;
      seen.add(last);
    }
    h.ok(twice === 0, 'wheel: with Remove ticked nobody came up twice in four spins', Array.from(seen).join());
    const left = await lines(page);
    const msgLeft = await page.evaluate((b) => document.querySelector(b + ' .wheel-msg').textContent, base);
    h.ok(left.length === 1 && /Only one entry is left/.test(msgLeft), 'wheel: with one entry left the page says so and does not spin', left.join() + ' / ' + msgLeft);
    const spinOff = await page.evaluate((b) => document.querySelector(b + ' .wheel-spin').disabled, base);
    h.ok(spinOff, 'wheel: Spin is off with fewer than two entries');
    await clickLabel(page, 'Remove the winner');

    /* presets, weights in the box, copy */
    await clickButton(page, 'Yes / No');
    await h.sleep(150);
    const yn = await lines(page);
    h.ok(yn.join() === 'Yes,No', 'wheel: the Yes / No list');
    await clickButton(page, '1 to 10');
    const ten = await lines(page);
    h.ok(ten.length === 10 && ten[9] === '10', 'wheel: the 1 to 10 list');
    await clickButton(page, 'Forfeits');
    const fo = await lines(page);
    h.ok(fo.length >= 8, 'wheel: a forfeits list of at least eight');
    await setList(page, 'A*3\nB');
    await h.sleep(100);
    const wc = await page.evaluate((b) => document.querySelector(b + ' .wheel-count').textContent, base);
    h.ok(/2 entries, 4 slices/.test(wc), 'wheel: A*3 and B is 2 entries and 4 slices', wc);

    /* 100 entries still draw and spin */
    await setList(page, Array.from({ length: 100 }, (_, i) => 'Person number ' + (i + 1)).join('\n'));
    await h.sleep(150);
    const hundred = await page.evaluate((b) => document.querySelector(b + ' .wheel-count').textContent, base);
    h.ok(/100 entries/.test(hundred), 'wheel: 100 entries are accepted', hundred);

    /* keep this list on this device */
    await setList(page, 'Kept one\nKept two');
    const kept = await clickLabel(page, 'Keep this list');
    await h.sleep(100);
    await page.reload({ waitUntil: 'load' });
    await h.sleep(300);
    const afterReload = await lines(page);
    h.ok(kept && afterReload.join() === 'Kept one,Kept two', 'wheel: a list is kept on the device only when asked', afterReload.join());
    await clickLabel(page, 'Keep this list');
    await page.reload({ waitUntil: 'load' });
    await h.sleep(300);
    const gone = await lines(page);
    const stored = await page.evaluate(() => localStorage.getItem('mvr-games-spin-the-wheel-v1') || '');
    h.ok(gone.length === 0 && stored.indexOf('Kept') < 0, 'wheel: unticking removes the saved list', stored);
    await page.evaluate(() => { try { localStorage.removeItem('mvr-games-spin-the-wheel-v1'); } catch (e) { /* none */ } });

    /* sharp on a 2x screen */
    const hi = await h.open('/games/spin-the-wheel/');
    await hi.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await hi.reload({ waitUntil: 'load' });
    await h.sleep(300);
    const dpr = await hi.evaluate((b) => { const c = document.querySelector(b + ' canvas'); return { w: c.width, css: parseInt(c.style.width, 10) }; }, base);
    h.ok(dpr.w === dpr.css * 2, 'wheel: on a 2x screen the canvas has twice the pixels', JSON.stringify(dpr));
    await hi.close();
    await tv.close();
    await hub.close();
  },
  landings: {
    'random-name-picker-wheel': async function (page, h) {
      const r = await page.evaluate(() => Array.from(document.querySelectorAll('[data-tool] label.game-check')).map((l) => l.textContent.trim() + '=' + l.querySelector('input').checked));
      h.ok(r.indexOf('Remove the winner after each spin=true') >= 0, 'wheel landing: the name picker opens with Remove the winner ticked', r.join());
    },
    'yes-or-no-wheel': async function (page, h) {
      const r = await page.evaluate(() => ({ v: document.querySelector('[data-tool] textarea').value, c: document.querySelector('[data-tool] .wheel-count').textContent }));
      h.ok(r.v === 'Yes\nNo' && /^2 entries/.test(r.c), 'wheel landing: the yes-or-no wheel opens with Yes and No', JSON.stringify(r));
    },
    'prize-wheel-for-party-or-class': async function (page, h) {
      const r = await page.evaluate(() => ({ v: document.querySelector('[data-tool] textarea').value.split('\n').length, c: document.querySelector('[data-tool] .wheel-count').textContent }));
      h.ok(r.v === 5 && /5 entries, 14 slices/.test(r.c), 'wheel landing: the prize wheel opens with five prizes in 14 slices', JSON.stringify(r));
    }
  }
};
