/* Live Poll: its rules against independent references, then a real session
   with every phone voting. Run by build/tests/live-rooms.js. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

/* largest remainder, written here from the definition */
function refPercents(c) {
  const total = c.reduce((a, b) => a + b, 0);
  if (!total) return c.map(() => 0);
  const base = c.map((x) => Math.floor(x * 100 / total));
  const rem = c.map((x, i) => ({ i, r: x * 100 / total - base[i] })).sort((a, b) => b.r - a.r || a.i - b.i);
  let left = 100 - base.reduce((a, b) => a + b, 0);
  for (const x of rem) { if (!left) break; base[x.i]++; left--; }
  return base;
}
const ALLOWED_T = new Set(['welcome', 'state', 'patch', 'count', 'host', 'closed', 'time', 'pong', 'error', 'full', 'locked']);
const POLL_KEYS = new Set(['k', 'id', 'q', 'o', 'ch', 'cl', 'rv']);

async function setForm(page, q, opts, flags) {
  await page.evaluate((q, opts, flags) => {
    const io = document.querySelector('[data-tool="live-poll"] .tool-io');
    const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    set(io.querySelector('input[type="text"]'), q);
    set(io.querySelector('textarea'), opts);
    io.querySelectorAll('label.game-check').forEach((l) => {
      const c = l.querySelector('input'), txt = l.textContent;
      for (const k in flags) if (txt.indexOf(k) >= 0 && c.checked !== flags[k]) c.click();
    });
  }, q, opts, flags);
}
const clickText = (page, text) => page.evaluate((text) => {
  const b = Array.from(document.querySelectorAll('[data-tool] .tool-io button')).find((x) => x.textContent.trim().startsWith(text));
  if (b) b.click();
  return !!b;
}, text);
const hostCounts = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.live-bars li strong')).map((s) => Number((s.textContent.split('·')[1] || '0').trim())));

module.exports = {
  async maths(page, h) {
    const { ok } = h;
    const r = await page.evaluate(() => {
      const M = window.ROOM_TOOLS['live-poll'].maths;
      const card = { o: ['a', 'b', 'c'], ch: 1 };
      const v = new Map();
      const steps = [M.vote(v, 'p1', 0, card), M.vote(v, 'p1', 0, card), M.vote(v, 'p1', 2, card), M.vote(v, 'p2', 3, card), M.vote(v, 'p2', 1.5, card), M.vote(v, 'p2', -1, card)];
      const fixed = { o: ['a', 'b'] }, v2 = new Map();
      const steps2 = [M.vote(v2, 'x', 1, fixed), M.vote(v2, 'x', 0, fixed), M.vote(v2, 'y', 0, Object.assign({ cl: 1 }, fixed))];
      const many = Array.from({ length: 14 }, (_, i) => 'Opt ' + i).join('\n');
      const rnd = [];
      for (let k = 0; k < 300; k++) { const n = 2 + (k % 9); const c = Array.from({ length: n }, (_, i) => (k * 7 + i * 13) % 11); rnd.push([c, M.percents(c)]); }
      return {
        steps, v: Array.from(v), steps2, v2: Array.from(v2),
        parsed: M.parseOptions('  Yes  \n\nno\nNO\n  Maybe   later \n'),
        many: M.parseOptions(many).length,
        long: M.parseOptions('x'.repeat(120))[0].length,
        tally: M.tally(new Map([['a', 0], ['b', 2], ['c', 2], ['d', 9]]), 3),
        third: M.percents([1, 1, 1]), zero: M.percents([0, 0]), rnd
      };
    });
    ok(JSON.stringify(r.steps) === JSON.stringify([true, false, true, false, false, false]), 'live-poll maths: first vote counts, same vote ignored, change allowed, bad options refused', JSON.stringify(r.steps));
    ok(JSON.stringify(r.v) === JSON.stringify([['p1', 2]]), 'live-poll maths: one vote per phone kept');
    ok(JSON.stringify(r.steps2) === JSON.stringify([true, false, false]) && JSON.stringify(r.v2) === JSON.stringify([['x', 1]]), 'live-poll maths: no change when changes are off; nothing when closed');
    ok(JSON.stringify(r.parsed) === JSON.stringify(['Yes', 'no', 'Maybe later']), 'live-poll maths: answers trimmed, blanks and repeats dropped', JSON.stringify(r.parsed));
    ok(r.many === 10 && r.long === 80, 'live-poll maths: at most 10 answers of 80 characters');
    ok(JSON.stringify(r.tally) === JSON.stringify([1, 0, 2]), 'live-poll maths: tally ignores out-of-range votes');
    ok(JSON.stringify(r.third) === JSON.stringify([34, 33, 33]) && JSON.stringify(r.zero) === JSON.stringify([0, 0]), 'live-poll maths: 1/1/1 gives 34/33/33');
    const bad = r.rnd.filter(([c, p]) => JSON.stringify(p) !== JSON.stringify(refPercents(c)) || (c.some(Boolean) && p.reduce((a, b) => a + b, 0) !== 100));
    ok(bad.length === 0, 'live-poll maths: 300 percentage sets match the largest-remainder reference and add to 100', bad[0] && JSON.stringify(bad[0]));
  },

  async flow(h) {
    const { ok, waitFor, sleep, phones } = h;
    const N = phones.length;
    const { page: host, code } = await h.startHost('live-poll', (p) => setForm(p, 'Best day for the team lunch?', 'Mon\nTue\nWed\nThu', { change: true, 'Hide results': true, 'Show results on phones': true }));
    if (!code) return;
    ok(await clickText(host, 'Ask this question'), 'live-poll: Ask this question');
    const joined = await h.joinAll(code);
    ok(joined === N, 'live-poll: ' + N + ' phones join by the # code', joined + '/' + N);
    ok(await waitFor(async () => (await h.hostCount(host)) === N, 10000), 'live-poll: the host counts ' + N + ' joined', String(await h.hostCount(host)));
    const cardShown = await Promise.all(phones.map((ph) => waitFor(() => ph.page.evaluate(() => document.querySelectorAll('#card .opt').length === 4), 8000)));
    ok(cardShown.every(Boolean), 'live-poll: every phone shows the four answers', cardShown.filter(Boolean).length + '/' + N);
    await h.clearFrames(phones);

    const want = [0, 0, 0, 0];
    await Promise.all(phones.map(async (ph) => { want[ph.i % 4]++; await ph.page.evaluate((k) => document.querySelectorAll('#card .opt')[k].click(), ph.i % 4); }));
    ok(await waitFor(async () => JSON.stringify(await hostCounts(host)) === JSON.stringify(want), 10000), 'live-poll: the host counts every vote right', JSON.stringify(await hostCounts(host)) + ' want ' + JSON.stringify(want));

    /* while hidden, phones get nothing about the results, and never a vote of anyone */
    let leaks = 0, odd = [];
    for (const ph of phones) {
      for (const f of await h.frames(ph)) {
        if (!ALLOWED_T.has(f.t)) odd.push(f.t);
        if ((f.t === 'state' || f.t === 'patch') && f.v) { if (f.v.rv) leaks++; Object.keys(f.v).forEach((k) => { if (!POLL_KEYS.has(k)) odd.push(k); }); }
        if (f.t === 'msg' || f.nick || (f.v && f.v.v !== undefined)) leaks++;
      }
    }
    ok(leaks === 0, 'live-poll: while results are hidden no phone receives any vote or total', String(leaks));
    ok(odd.length === 0, 'live-poll: phones receive only the documented frames and card keys', odd.slice(0, 5).join());

    /* the big screen */
    const stage = await h.open('/live/live-poll/?stage=1');
    const st = await waitFor(() => stage.evaluate((code) => {
      const c = document.querySelector('.st-join-code');
      return c && c.textContent.replace(/\D/g, '') === code && /Best day/.test(document.querySelector('.st-title').textContent) ? document.querySelector('.st-foot').textContent : null;
    }, code), 8000);
    ok(!!st && st.indexOf(String(N)) >= 0 && document_hidden_ok(st), 'live-poll: the big screen shows the code, the question and only the vote count while hidden', st);

    /* reveal: phones and the big screen get the totals */
    ok(await clickText(host, 'Reveal results'), 'live-poll: Reveal results');
    const got = await waitFor(async () => { for (const f of await h.frames(phones[N - 1])) if (f.v && f.v.rv) return f.v.rv; return null; }, 5000);
    ok(got && JSON.stringify(got.c) === JSON.stringify(want) && got.n === N, 'live-poll: after Reveal phones receive the totals', JSON.stringify(got));
    const bars = await waitFor(() => stage.evaluate(() => Array.from(document.querySelectorAll('.st-bars strong')).map((s) => s.textContent).join('|') || null), 5000);
    const pc = refPercents(want);
    ok(bars === want.map((c, i) => pc[i] + '% · ' + c).join('|'), 'live-poll: the big screen shows percentages and counts', bars);

    /* a dropped socket rejoins with the same id: the vote moves, the total stays */
    const before = await h.socketCount(phones[0]);
    await h.dropSocket(phones[0]);
    const back = await waitFor(async () => (await h.socketCount(phones[0])) > before && h.connected(phones[0]), 15000, 200);
    ok(!!back, 'live-poll: a phone whose socket drops reconnects by itself');
    await phones[0].page.evaluate(() => document.querySelectorAll('#card .opt')[1].click());
    want[0]--; want[1]++;
    ok(await waitFor(async () => JSON.stringify(await hostCounts(host)) === JSON.stringify(want), 8000), 'live-poll: after reconnecting, a new vote replaces the old one (total still ' + N + ')', JSON.stringify(await hostCounts(host)));
    /* a reload in the same tab rejoins too */
    await phones[1].page.reload({ waitUntil: 'load' });
    ok(await waitFor(() => phones[1].page.evaluate(() => !document.getElementById('s-room').hidden && document.querySelectorAll('#card .opt').length === 4), 15000), 'live-poll: a reloaded phone rejoins and shows the poll');
    await phones[1].page.evaluate(() => document.querySelectorAll('#card .opt')[3].click());
    want[1]--; want[3]++;
    ok(await waitFor(async () => JSON.stringify(await hostCounts(host)) === JSON.stringify(want), 8000), 'live-poll: after a reload the phone still has one vote', JSON.stringify(await hostCounts(host)));
    ok((await h.hostCount(host)) === N, 'live-poll: reconnects did not add people', String(await h.hostCount(host)));

    /* fill the room to 100 with plain sockets; the 101st phone is told it is full */
    const bots = await h.fillWithSockets(code, 100 - N);
    ok(await waitFor(async () => (await h.hostCount(host)) === 100, 15000), 'live-poll: the room fills to 100', String(await h.hostCount(host)));
    const extra = await h.newPhone();
    await extra.page.goto(h.BASE + '/join/?relay=' + encodeURIComponent(h.EP) + '#' + code, { waitUntil: 'load' });
    await extra.page.click('#go');
    const full = await waitFor(() => extra.page.evaluate(() => /session is full/.test(document.getElementById('code-msg').textContent) && document.getElementById('s-room').hidden), 10000);
    ok(!!full, 'live-poll: the 101st phone is told the session is full');
    await extra.ctx.close();
    bots.close();
    ok(await waitFor(async () => (await h.hostCount(host)) === N, 10000), 'live-poll: the count drops back when the extra sockets leave', String(await h.hostCount(host)));

    /* close voting reaches the phones */
    ok(await clickText(host, 'Close voting'), 'live-poll: Close voting');
    ok(await waitFor(() => phones[N - 1].page.evaluate(() => Array.from(document.querySelectorAll('#card .opt')).every((b) => b.disabled)), 5000), 'live-poll: closing disables the answers on phones');

    await h.endSession(host, 'live-poll', phones);
    ok(await waitFor(() => stage.evaluate(() => !document.querySelector('.st-join') || document.querySelector('.st-join').hidden), 5000), 'live-poll: the join code leaves the big screen when the session ends');
    /* CSV, made in the host's browser: the results stay after the session ends */
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-csv-'));
    const cdp = await host.createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
    ok(await clickText(host, 'Export CSV'), 'live-poll: Export CSV');
    const file = await waitFor(() => fs.readdirSync(dir).find((f) => /\.csv$/.test(f)), 8000);
    if (ok(!!file, 'live-poll: the CSV downloads')) {
      const rows = fs.readFileSync(path.join(dir, file), 'utf8').replace(/^﻿/, '').trim().split(/\r\n/).map((l) => l.split(','));
      ok(rows[0].join() === 'Question,Asked at,Answer,Votes,Percent' && rows.length === 5, 'live-poll: CSV has a header and a row per answer', rows.length + ' rows');
      ok(rows.slice(1).map((r) => Number(r[3])).join() === want.join(), 'live-poll: CSV votes match', rows.slice(1).map((r) => r[3]).join());
    }
    fs.rmSync(dir, { recursive: true, force: true });

    await stage.close();
    await host.close();
    await sleep(200);
  }
};
function document_hidden_ok(s) { return !/%/.test(s); }
