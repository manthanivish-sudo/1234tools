/* Live Rating Scale: ratings, the average and the spread against values
   worked out here, then a real session. Run by build/tests/live-rooms.js. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

function ref(values, lo, hi) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n);
  const h = new Array(hi - lo + 1).fill(0);
  values.forEach((v) => h[v - lo]++);
  return { n, mean, sd, min: Math.min(...values), max: Math.max(...values), h };
}
const one = (x) => (Math.round(x * 10) / 10).toFixed(1);
const facts = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.live-facts dd')).map((d) => d.textContent));
const clickText = (page, text) => page.evaluate((text) => {
  const b = Array.from(document.querySelectorAll('[data-tool] .tool-io button')).find((x) => x.textContent.trim().startsWith(text));
  if (b) b.click();
  return !!b;
}, text);
const rateOn = (ph, sel, i) => ph.page.evaluate((sel, i) => { const b = document.querySelectorAll(sel)[i]; if (!b || b.disabled) return false; b.click(); return true; }, sel, i);

module.exports = {
  async maths(page, h) {
    const { ok } = h;
    const r = await page.evaluate(() => {
      const M = window.ROOM_TOOLS['rating-scale'].maths;
      const stars = { s: 'stars' }, ten = { s: 'slider' };
      const m = new Map();
      const steps = [M.rate(m, 'a', 0, stars), M.rate(m, 'a', 1, stars), M.rate(m, 'a', 1, stars), M.rate(m, 'a', 5, stars), M.rate(m, 'b', 6, stars), M.rate(m, 'b', 3.5, stars), M.rate(m, 'b', '4', stars), M.rate(m, 'c', 2, Object.assign({ cl: 1 }, stars))];
      const m2 = new Map();
      const steps2 = [M.rate(m2, 'a', 0, ten), M.rate(m2, 'b', 10, ten), M.rate(m2, 'c', 11, ten)];
      const sets = [];
      for (let k = 1; k < 40; k++) {
        const vals = Array.from({ length: k }, (_, i) => (i * 7 + k * 3) % 11);
        const mm = new Map(vals.map((v, i) => ['p' + i, v]));
        sets.push([vals, M.summary(mm, 'ten')]);
      }
      return { steps, m: Array.from(m), steps2, sets, empty: M.summary(new Map(), 'stars') };
    });
    ok(JSON.stringify(r.steps) === JSON.stringify([false, true, false, true, false, false, false, false]) && JSON.stringify(r.m) === JSON.stringify([['a', 5]]), 'rating-scale maths: 1-5 whole stars only, one rating per phone, the latest kept, nothing when closed', JSON.stringify(r.steps));
    ok(JSON.stringify(r.steps2) === JSON.stringify([true, true, false]), 'rating-scale maths: the slider takes 0 to 10');
    const bad = r.sets.filter(([vals, s]) => { const e = ref(vals, 0, 10); return Math.abs(e.mean - s.mean) > 1e-9 || Math.abs(e.sd - s.sd) > 1e-9 || e.min !== s.min || e.max !== s.max || JSON.stringify(e.h) !== JSON.stringify(s.h); });
    ok(bad.length === 0, 'rating-scale maths: 39 sets of ratings: mean, standard deviation, range and histogram match the reference', bad[0] && JSON.stringify(bad[0]));
    ok(r.empty.n === 0 && r.empty.h.length === 5, 'rating-scale maths: no ratings, an empty five-bar histogram');
  },

  async flow(h) {
    const { ok, waitFor, sleep, phones } = h;
    const N = phones.length;
    const { page: host, code } = await h.startHost('rating-scale', async (p) => {
      await p.evaluate(() => {
        const io = document.querySelector('[data-tool="rating-scale"] .tool-io');
        const ins = io.querySelectorAll('input[type="text"]');
        const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
        set(ins[0], 'How useful was this session?'); set(ins[1], 'Not useful'); set(ins[2], 'Very useful');
        io.querySelector('.game-seg button').click();
        io.querySelectorAll('label.game-check').forEach((l) => { const c = l.querySelector('input'); const want = /phones/.test(l.textContent); if (c.checked !== want) c.click(); });
      });
    });
    if (!code) return;
    ok(await clickText(host, 'Ask for ratings'), 'rating-scale: Ask for ratings');
    ok((await h.joinAll(code)) === N, 'rating-scale: ' + N + ' phones join');
    ok(await waitFor(() => Promise.all(phones.map((ph) => ph.page.evaluate(() => document.querySelectorAll('#card .star').length === 5))).then((a) => a.every(Boolean)), 8000), 'rating-scale: every phone shows five stars');
    await h.clearFrames(phones);

    const vals = phones.map((ph) => (ph.i % 5) + 1);
    const done = await Promise.all(phones.map((ph) => rateOn(ph, '#card .star', vals[ph.i] - 1)));
    ok(done.every(Boolean), 'rating-scale: every phone rates');
    let e = ref(vals, 1, 5);
    const want = () => [one(e.mean) + ' / 5', '± ' + one(e.sd), e.min + '–' + e.max, String(e.n)];
    ok(await waitFor(async () => JSON.stringify(await facts(host)) === JSON.stringify(want()), 8000), 'rating-scale: the host shows the right average, spread, range and count', JSON.stringify(await facts(host)) + ' want ' + JSON.stringify(want()));
    const rv = await waitFor(async () => { let last = null; for (const f of await h.frames(phones[N - 1])) if (f.v && f.v.rv) last = f.v.rv; return last && last.n === N ? last : null; }, 5000);
    ok(rv && rv.a === one(e.mean) && JSON.stringify(rv.h) === JSON.stringify(e.h), 'rating-scale: phones receive the average and histogram (results on phones)', JSON.stringify(rv));
    let other = 0;
    for (const ph of phones) for (const f of await h.frames(ph)) if (f.t === 'msg' || (f.v && (f.v.v !== undefined || f.v.ratings))) other++;
    ok(other === 0, 'rating-scale: no phone receives anyone else\'s rating');

    /* a changed rating replaces the old one; a reconnect does not add one */
    await rateOn(phones[0], '#card .star', 4);
    vals[0] = 5;
    const before = await h.socketCount(phones[1]);
    await h.dropSocket(phones[1]);
    ok(await waitFor(async () => (await h.socketCount(phones[1])) > before && h.connected(phones[1]), 15000, 200), 'rating-scale: a dropped phone reconnects');
    await rateOn(phones[1], '#card .star', 0);
    vals[1] = 1;
    e = ref(vals, 1, 5);
    ok(await waitFor(async () => JSON.stringify(await facts(host)) === JSON.stringify(want()), 8000), 'rating-scale: re-rating and reconnecting keep one rating per phone', JSON.stringify(await facts(host)) + ' want ' + JSON.stringify(want()));

    const stage = await h.open('/live/rating-scale/?stage=1');
    const big = await waitFor(() => stage.evaluate(() => { const s = document.querySelector('.st-rate-avg strong'); return s ? [s.textContent, document.querySelectorAll('.st-hist-col').length, document.querySelector('.st-ends') ? document.querySelector('.st-ends').textContent : ''] : null; }), 8000);
    ok(big && big[0] === one(e.mean) && big[1] === 5 && /Not useful/.test(big[2]), 'rating-scale: the big screen shows the average, five bars and the end words', JSON.stringify(big));

    /* a second question on 0-10 buttons */
    await host.evaluate(() => {
      const io = document.querySelector('[data-tool="rating-scale"] .tool-io');
      const q = io.querySelector('input[type="text"]');
      q.value = 'How likely are you to recommend it?'; q.dispatchEvent(new Event('change', { bubbles: true }));
      io.querySelectorAll('.game-seg button')[1].click();
    });
    ok(await clickText(host, 'Ask for ratings'), 'rating-scale: ask a second question');
    ok(await waitFor(() => phones[4].page.evaluate(() => document.querySelectorAll('#card .tens button').length === 11), 8000), 'rating-scale: phones show 0 to 10');
    const vals2 = phones.map((ph) => (ph.i * 3) % 11);
    await Promise.all(phones.map((ph) => rateOn(ph, '#card .tens button', vals2[ph.i])));
    const e2 = ref(vals2, 0, 10);
    ok(await waitFor(async () => (await facts(host))[0] === one(e2.mean) + ' / 10' && (await facts(host))[3] === String(N), 8000), 'rating-scale: the 0-10 average is right', JSON.stringify(await facts(host)) + ' want ' + one(e2.mean));
    ok(await clickText(host, 'Close'), 'rating-scale: Close');
    ok(await waitFor(() => phones[7].page.evaluate(() => Array.from(document.querySelectorAll('#card .tens button')).every((b) => b.disabled)), 5000), 'rating-scale: closing disables the buttons on phones');

    await h.endSession(host, 'rating-scale', phones);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-csv-'));
    const cdp = await host.createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
    ok(await clickText(host, 'Export CSV'), 'rating-scale: Export CSV');
    const file = await waitFor(() => fs.readdirSync(dir).find((f) => /\.csv$/.test(f)), 8000);
    if (ok(!!file, 'rating-scale: the CSV downloads')) {
      const rows = fs.readFileSync(path.join(dir, file), 'utf8').replace(/^﻿/, '').trim().split(/\r\n/);
      ok(rows.length === 1 + 5 + 11, 'rating-scale: CSV has a row per value of both questions', String(rows.length));
      const first = rows.slice(1, 6).map((l) => Number(l.split(',').slice(-4)[0]));
      ok(first.join() === e.h.join(), 'rating-scale: CSV counts match', first.join());
    }
    fs.rmSync(dir, { recursive: true, force: true });
    await stage.close();
    await host.close();
    await sleep(200);
  }
};
