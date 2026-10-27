/* Live Presentation: its rules against independent references, the reused
   word-cloud / rating / Q&A slides on the big screen, then a real session
   with every phone following a six-slide deck. Run by build/tests/live-rooms.js. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const ALLOWED_T = new Set(['welcome', 'state', 'patch', 'count', 'host', 'closed', 'time', 'pong', 'error', 'full', 'locked', 'direct']);
const CARD_KEYS = new Set(['k', 'id', 'q', 'o', 'm', 'ch', 'cl', 'rv', 'e', 'l', 'n', 's', 'lo', 'hi', 'qs', 'up', 'ap']);
const DECK = {
  title: 'Test deck',
  slides: [
    { t: 'mc', q: 'Capital of France?', o: ['Paris', 'Rome', 'Madrid', 'Berlin'], a: [0], m: 1, ch: true, hide: true },
    { t: 'mc', q: 'Pick up to two fruits', o: ['Apple', 'Banana', 'Cherry', 'Date'], a: [], m: 2, ch: true, hide: true },
    { t: 'oe', q: 'One idea for next time', ch: true, hide: false },
    { t: 'quiz', q: 'What is 2 + 2?', o: ['3', '4', '5', '22'], a: [1], secs: 40, hide: true },
    { t: 'quiz', q: 'Which is a mammal?', o: ['Shark', 'Whale', 'Trout', 'Eel'], a: [1], secs: 40, hide: false },
    { t: 'lb', q: 'Leaderboard' },
    { t: 'info', q: 'Thank you!', body: 'That is the end.' }
  ]
};
/* the points rule written from the brief: 1000 at once, 500 at the deadline, linear, 0 when wrong */
const refPoints = (right, el, lim) => (right ? Math.round(1000 - 500 * Math.min(1, Math.max(0, el / lim))) : 0);

const live = (page, fn, ...a) => page.evaluate(new Function('a', 'const X = document.querySelector(\'[data-tool="live-presentation"]\')._live; return (' + fn + ')(X, ...a);'), a);
const hostCounts = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.deck-out .live-bars li strong')).map((s) => Number((s.textContent.split('·')[1] || '0').trim())));
const press = async (page, key) => { await page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }); await page.keyboard.press(key); };
const phoneQ = (ph) => ph.page.evaluate(() => { const h = document.querySelector('#card h2'); return h ? h.textContent : ''; });

module.exports = {
  async maths(page, h) {
    const { ok, waitFor } = h;
    const r = await page.evaluate(() => {
      const M = window.ROOM_TOOLS['live-presentation'].maths, S = window.ROOM_TOOLS['live-presentation'].SAMPLE;
      const single = { o: ['a', 'b', 'c'], m: 1, ch: true }, v = new Map();
      const s1 = [M.mcVote(v, 'p', 0, single), M.mcVote(v, 'p', 0, single), M.mcVote(v, 'p', 2, single), M.mcVote(v, 'q', 3, single), M.mcVote(v, 'q', [0], single), M.mcVote(v, 'q', 1, Object.assign({ cl: 1 }, single))];
      const multi = { o: ['a', 'b', 'c', 'd'], m: 2, ch: false }, w = new Map();
      const s2 = [M.mcVote(w, 'x', [2, 0], multi), M.mcVote(w, 'x', [1], multi), M.mcVote(w, 'y', [0, 1, 2], multi), M.mcVote(w, 'y', [1, 1], multi), M.mcVote(w, 'y', 1, multi), M.mcVote(w, 'y', [], multi), M.mcVote(w, 'y', [3], multi)];
      const deck = M.cleanDeck(S);
      const again = M.cleanDeck(JSON.parse(JSON.stringify(deck)));
      const packed = M.unpack(M.pack({ a: new Map([['k', new Set([1, 2])]]), b: [new Map([[1, { c: new Map() }]])] }));
      return {
        s1, v: Array.from(v), s2, w: Array.from(w),
        tally: M.tally(new Map([['a', [0, 2]], ['b', [2]], ['c', 1], ['d', 9]]), 3),
        shareM: M.share([2, 1, 1], 2, true), shareS: M.share([1, 1, 1], 3, false),
        pts: [M.points(true, 0, 20000), M.points(true, 20000, 20000), M.points(true, 10000, 20000), M.points(true, 30000, 20000), M.points(false, 0, 20000), M.points(true, -50, 20000), M.points(true, 4321, 15000)],
        ranks: M.standings(new Map([['a', { nick: 'Ann', p: 900, ct: 5000 }], ['b', { nick: 'Bob', p: 1500, ct: 9000 }], ['c', { nick: 'Cat', p: 900, ct: 3000 }], ['e', { nick: 'Eve', p: 900, ct: 3000 }], ['d', { nick: 'Dev', p: 100 }]])).map((x) => x.nick + x.r),
        secs: [M.secs(4321), M.secs(0), M.secs(12049)],
        deckOk: !!deck && deck.slides.length === S.slides.length, round: JSON.stringify(deck) === JSON.stringify(again),
        bad: [M.cleanDeck(null), M.cleanDeck({}), M.cleanDeck({ slides: [{ t: 'nope' }] }), M.cleanDeck('x')],
        fixed: M.cleanDeck({ slides: [{ t: 'quiz', q: 'Q', o: ['only'], a: [5], secs: 999 }, { t: 'mc', o: 'A\nB\nb\nC', a: [2, 9], m: 7 }, { t: 'wc', n: 9 }, { t: 'lb' }] }),
        many: M.cleanDeck({ slides: Array.from({ length: 70 }, () => ({ t: 'info', q: 'x' })) }).slides.length,
        diff: [M.diff({ a: 1, b: { c: 1, d: 2 }, e: 1 }, { a: 1, b: { c: 2, d: 2 }, f: [1] }), M.diff({ a: [1] }, { a: [1] })],
        packed: [packed.a instanceof Map, packed.a.get('k') instanceof Set, packed.a.get('k').has(2), packed.b[0].get(1).c instanceof Map]
      };
    });
    ok(JSON.stringify(r.s1) === JSON.stringify([true, false, true, false, false, false]) && JSON.stringify(r.v) === JSON.stringify([['p', 2]]), 'live-presentation maths: one answer per phone, a change allowed, bad and closed answers refused', JSON.stringify(r.s1));
    ok(JSON.stringify(r.s2) === JSON.stringify([true, false, false, false, false, false, true]) && JSON.stringify(r.w) === JSON.stringify([['x', [0, 2]], ['y', [3]]]), 'live-presentation maths: choose up to two — sorted, no repeats, no more than the maximum, no change when changes are off', JSON.stringify(r.s2) + ' ' + JSON.stringify(r.w));
    ok(JSON.stringify(r.tally) === JSON.stringify([1, 1, 2]), 'live-presentation maths: a two-answer vote counts for both answers; out-of-range ignored', JSON.stringify(r.tally));
    ok(JSON.stringify(r.shareM) === JSON.stringify([100, 50, 50]) && JSON.stringify(r.shareS) === JSON.stringify([34, 33, 33]), 'live-presentation maths: multi-choice percent of people; single choice adds to 100');
    const wantPts = [refPoints(true, 0, 20000), refPoints(true, 20000, 20000), refPoints(true, 10000, 20000), 500, 0, 1000, refPoints(true, 4321, 15000)];
    ok(JSON.stringify(r.pts) === JSON.stringify(wantPts) && r.pts[0] === 1000 && r.pts[1] === 500 && r.pts[2] === 750, 'live-presentation maths: quiz points 1000 → 500 linear, 0 when wrong, clamped', JSON.stringify(r.pts));
    ok(JSON.stringify(r.ranks) === JSON.stringify(['Bob1', 'Cat2', 'Eve2', 'Ann4', 'Dev5']), 'live-presentation maths: standings by points; equal points go to the lower correct-answer time; rank shared only when both are equal', JSON.stringify(r.ranks));
    ok(JSON.stringify(r.secs) === JSON.stringify(['4.3', '0.0', '12.0']), 'live-presentation maths: times shown in seconds with one decimal', JSON.stringify(r.secs));
    ok(r.deckOk && r.round, 'live-presentation maths: the sample deck cleans and round-trips through JSON unchanged');
    ok(r.bad.every((x) => x === null), 'live-presentation maths: a file that is not a deck is refused');
    const f = r.fixed && r.fixed.slides;
    ok(!!f && f[0].o.length === 2 && JSON.stringify(f[0].a) === '[0]' && f[0].secs === 120 && JSON.stringify(f[1].o) === '["A","B","C"]' && JSON.stringify(f[1].a) === '[2]' && f[1].m === 3 && f[2].n === 3 && f[3].q === 'Leaderboard', 'live-presentation maths: an imported slide is cleaned to its limits', JSON.stringify(f));
    ok(r.many === 50, 'live-presentation maths: a deck holds at most 50 slides');
    ok(JSON.stringify(r.diff[0]) === JSON.stringify({ b: { c: 2 }, f: [1], e: null }) && r.diff[1] === null, 'live-presentation maths: the merge patch between two cards', JSON.stringify(r.diff));
    ok(r.packed.every(Boolean), 'live-presentation maths: results with Maps and Sets survive the save for Reopen');

    /* editing: add, move, duplicate, delete; saved on this computer */
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
    await page.reload({ waitUntil: 'load' });
    const ed = await page.evaluate(async () => {
      const io = document.querySelector('[data-tool="live-presentation"] .tool-io');
      const rows = () => Array.from(io.querySelectorAll('.deck-list .deck-pick-text span')).map((s) => s.textContent);
      const first = rows();
      const sel = io.querySelector('.deck-add select'); sel.value = 'oe';
      Array.from(io.querySelectorAll('.deck-add button')).find((b) => b.textContent === 'Add').click();
      const q = io.querySelector('.deck-form input.deck-q'); q.value = 'Brand new question'; q.dispatchEvent(new Event('input')); q.dispatchEvent(new Event('change'));
      const afterAdd = rows();
      io.querySelectorAll('.deck-list .deck-row')[1].querySelector('[aria-label^="Move up"]').click();
      const afterUp = rows();
      io.querySelectorAll('.deck-list .deck-row')[0].querySelector('[aria-label^="Duplicate"]').click();
      const afterDup = rows();
      const del = () => io.querySelectorAll('.deck-list .deck-row')[1].querySelector('[aria-label^="Delete"]');
      del().click(); const armed = rows().length; del().click();
      const afterDel = rows();
      await new Promise((r) => setTimeout(r, 400));
      return { first, afterAdd, afterUp, afterDup, armed, afterDel, stored: localStorage.getItem('mvr-games-live-presentation-v1') };
    });
    ok(ed.first.length === 6 && ed.first[1] === 'Which planet is closest to the Sun?', 'live-presentation: starts from the sample deck the first time', JSON.stringify(ed.first));
    ok(ed.afterAdd.length === 7 && ed.afterAdd[1] === 'Brand new question', 'live-presentation: Add puts a new slide after the selected one and edits it inline', JSON.stringify(ed.afterAdd));
    ok(ed.afterUp[0] === 'Brand new question', 'live-presentation: Move up reorders the slides');
    ok(ed.afterDup.length === 8 && ed.afterDup[1] === 'Brand new question', 'live-presentation: Duplicate copies a slide');
    ok(ed.armed === 8 && ed.afterDel.length === 7, 'live-presentation: Delete asks for a second press, then deletes');
    ok(!!ed.stored && JSON.parse(ed.stored).deck.slides.length === 7, 'live-presentation: the deck is saved on this computer as it is edited');
    await page.reload({ waitUntil: 'load' });
    const kept = await page.evaluate(() => document.querySelectorAll('[data-tool="live-presentation"] .deck-list .deck-row').length);
    ok(kept === 7, 'live-presentation: the edited deck is still there after a reload', String(kept));
    /* deck file: the JSON written by Save deck file opens back to the same deck */
    const rt = await live(page, (X) => { const before = X.deckJson(); X.setDeck(JSON.parse(before)); return [before, X.deckJson()]; });
    ok(rt[0] === rt[1], 'live-presentation: Save deck file → Open deck file round trip is exact');

    /* word cloud, rating and Q&A slides: the other tools' counting and big screen, loaded on demand */
    const lib = await live(page, (X) => {
      X.setDeck({ slides: [{ t: 'wc', q: 'Words please', n: 2 }, { t: 'rt', q: 'Rate it', s: 'stars' }, { t: 'qa', q: 'Questions?', up: true }] });
      X.present();
      return true;
    });
    const stage = await h.open('/live/live-presentation/?stage=1');
    await waitFor(() => page.evaluate(() => !!(window.ROOM_TOOLS['word-cloud'] && window.ROOM_TOOLS['word-cloud'].render && window.ROOM_TOOLS['audience-qa'] && window.ROOM_TOOLS['rating-scale'])), 8000);
    await live(page, (X) => { const id = X.R()[X.deck().slides[0].id].cid; ['sun', 'sea', 'Sun', 'rain'].forEach((w, i) => X.msg({ id: 'p' + (i % 3), at: Date.now(), v: { q: id, v: w } })); X.go(0, true); });
    const cloud = await waitFor(() => stage.evaluate(() => { const t = Array.from(document.querySelectorAll('.st-cloud text')).map((x) => x.textContent); return t.length ? t.join('|') : null; }), 8000);
    ok(lib && !!cloud && /sun/i.test(cloud) && /sea/.test(cloud), 'live-presentation: a word-cloud slide counts words and draws the cloud on the big screen', cloud);
    await live(page, (X) => { X.go(1); const id = X.R()[X.deck().slides[1].id].cid; [5, 4, 4].forEach((v, i) => X.msg({ id: 'p' + i, at: Date.now(), v: { q: id, v } })); });
    const avg = await waitFor(() => stage.evaluate(() => { const a = document.querySelector('.st-rate-avg strong'); return a ? a.textContent : null; }), 8000);
    ok(avg === '4.3', 'live-presentation: a rating slide shows the average on the big screen', avg);
    await live(page, (X) => { X.go(2); const id = X.R()[X.deck().slides[2].id].cid; X.msg({ id: 'p0', at: Date.now(), v: { q: id, ask: 'When is lunch?' } }); X.msg({ id: 'p1', at: Date.now(), v: { q: id, ask: 'Where are the slides?' } }); X.msg({ id: 'p2', at: Date.now(), v: { q: id, up: '2', on: 1 } }); });
    const qa = await waitFor(() => stage.evaluate(() => { const t = Array.from(document.querySelectorAll('.st-qa li .st-qa-t')).map((x) => x.textContent); return t.length === 2 ? t.join('|') : null; }), 8000);
    ok(qa === 'Where are the slides?|When is lunch?', 'live-presentation: a Q&A slide ranks questions by upvotes on the big screen', qa);
    await stage.close();
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
  },

  async flow(h) {
    const { ok, waitFor, sleep, phones } = h;
    const N = phones.length;
    const { page: host, code } = await h.startHost('live-presentation', async (p) => {
      await live(p, (X, d) => { X.setDeck(d); X.present(); }, DECK);
    });
    if (!code) return;
    const joined = await h.joinAll(code);
    ok(joined === N, 'live-presentation: ' + N + ' phones join by the # code', joined + '/' + N);
    const first = await Promise.all(phones.map((ph) => waitFor(() => ph.page.evaluate(() => document.querySelectorAll('#card .opt').length === 4 && /Capital of France/.test(document.querySelector('#card h2').textContent)), 10000)));
    ok(first.every(Boolean), 'live-presentation: every phone shows slide 1 (lazy deck card)', first.filter(Boolean).length + '/' + N);
    await h.clearFrames(phones);
    const stage = await h.open('/live/live-presentation/?stage=1');

    /* slide 1: single choice with a correct answer, results hidden until R */
    const want = [0, 0, 0, 0];
    await Promise.all(phones.map(async (ph) => { want[ph.i % 4]++; await ph.page.evaluate((k) => document.querySelectorAll('#card .opt')[k].click(), ph.i % 4); }));
    ok(await waitFor(async () => JSON.stringify(await hostCounts(host)) === JSON.stringify(want), 10000), 'live-presentation: the host counts every vote on slide 1', JSON.stringify(await hostCounts(host)));
    const cnt = await host.evaluate(() => document.querySelector('.deck-count').textContent);
    ok(cnt === N + ' of ' + N + ' answered', 'live-presentation: the remote shows "N of N answered"', cnt);
    const sent = await phones[3].page.evaluate(() => document.querySelector('#card .msg').textContent);
    ok(/Your answer was sent/.test(sent), 'live-presentation: a phone says its answer was sent', sent);
    const hiddenStage = await waitFor(() => stage.evaluate(() => { const f = document.querySelector('.st-foot'); return f && /answered/.test(f.textContent) ? f.textContent + '|' + document.querySelectorAll('.st-bars li.is-right').length + '|' + /%/.test(document.querySelector('.st-bars').textContent) : null; }), 8000);
    ok(hiddenStage === N + ' answered|0|false', 'live-presentation: while hidden the big screen shows only the count, no ticks or percentages', hiddenStage);
    let leaks = 0; const odd = [];
    for (const ph of phones) for (const f of await h.frames(ph)) {
      if (!ALLOWED_T.has(f.t)) odd.push(f.t);
      if ((f.t === 'state' || f.t === 'patch') && f.v) { if (f.v.rv) leaks++; Object.keys(f.v).forEach((k) => { if (!CARD_KEYS.has(k)) odd.push(k); }); }
      if (f.t === 'msg' || f.t === 'direct' || f.nick) leaks++;
    }
    ok(leaks === 0, 'live-presentation: while hidden no phone receives a total, a correct answer or anyone’s vote', String(leaks));
    ok(odd.length === 0, 'live-presentation: phones receive only the documented frames and card keys', odd.slice(0, 5).join());
    await press(host, 'r');
    const rv = await waitFor(async () => { for (const f of await h.frames(phones[N - 1])) if (f.v && f.v.rv) return f.v.rv; return null; }, 5000);
    ok(rv && JSON.stringify(rv.c) === JSON.stringify(want) && rv.n === N && JSON.stringify(rv.a) === '[0]', 'live-presentation: R sends phones the counts and the correct answer', JSON.stringify(rv));
    const verdicts = await Promise.all(phones.map((ph) => waitFor(() => ph.page.evaluate(() => { const m = document.querySelector('#card .msg'); return m && /Correct!|Not this time/.test(m.textContent) ? m.textContent : null; }), 5000)));
    ok(verdicts.every((v, i) => v === (i % 4 === 0 ? 'Correct!' : 'Not this time.')), 'live-presentation: each phone is told “Correct!” or “Not this time” for its own choice', verdicts.slice(0, 4).join(' / '));
    const shown = await waitFor(() => stage.evaluate(() => { const r = document.querySelector('.st-bars li.is-right'); return r ? Array.from(document.querySelectorAll('.st-bars strong')).map((s) => s.textContent).join('|') + '|' + r.querySelector('.st-bar-label').textContent : null; }), 5000);
    const pc = want.map((c) => c * 100 / N);
    ok(shown && shown.endsWith('|Paris') && shown.split('|').slice(0, 4).every((t, i) => t.endsWith('· ' + want[i]) && Math.abs(parseInt(t, 10) - pc[i]) <= 1), 'live-presentation: after R the big screen shows counts, percentages and ticks Paris', shown);

    /* Next: every phone switches to slide 2 (choose up to two) */
    await press(host, 'ArrowRight');
    const sw2 = await Promise.all(phones.map((ph) => waitFor(async () => /two fruits/.test(await phoneQ(ph)), 6000)));
    ok(sw2.every(Boolean), 'live-presentation: → switches every phone to slide 2', sw2.filter(Boolean).length + '/' + N);
    const want2 = [0, 0, 0, 0];
    await Promise.all(phones.map(async (ph) => {
      const a = ph.i % 4, b = (ph.i + 1) % 4;
      want2[a]++; want2[b]++;
      await ph.page.evaluate((a, b, extra) => { const o = document.querySelectorAll('#card .opt'); o[a].click(); o[b].click(); if (extra) o[(b + 1) % 4].click(); document.querySelector('#card .pri').click(); }, a, b, ph.i === 0);
    }));
    ok(await waitFor(async () => JSON.stringify(await hostCounts(host)) === JSON.stringify(want2), 10000), 'live-presentation: two answers per phone counted (a third tap is refused)', JSON.stringify(await hostCounts(host)) + ' want ' + JSON.stringify(want2));
    const stageFoot2 = await waitFor(() => stage.evaluate(() => { const t = document.querySelector('.st-title'); return t && /two fruits/.test(t.textContent) && !/%/.test(document.querySelector('.st-bars').textContent) ? document.querySelector('.st-foot').textContent : null; }), 5000);
    ok(stageFoot2 === N + ' answered', 'live-presentation: slide 2 is hidden by default on the big screen', stageFoot2);

    /* Back: phones return to slide 1 with its kept results */
    await press(host, 'ArrowLeft');
    const back = await Promise.all(phones.map((ph) => waitFor(() => ph.page.evaluate(() => /Capital of France/.test(document.querySelector('#card h2').textContent) && /Correct!|Not this time/.test(document.querySelector('#card .msg').textContent)), 6000)));
    ok(back.every(Boolean), 'live-presentation: ← takes every phone back to slide 1 with its revealed result', back.filter(Boolean).length + '/' + N);
    ok(JSON.stringify(await hostCounts(host)) === JSON.stringify(want), 'live-presentation: slide 1 kept its counts');
    await press(host, 'ArrowRight');
    await press(host, 'ArrowRight');

    /* slide 3: open answers on a wall; the presenter hides one */
    ok((await Promise.all(phones.map((ph) => waitFor(() => ph.page.evaluate(() => !!document.querySelector('#card textarea')), 6000)))).every(Boolean), 'live-presentation: phones show the open-answer box');
    await Promise.all(phones.map((ph) => ph.page.evaluate((i) => { const t = document.querySelector('#card textarea'); t.value = 'Idea number ' + i; t.dispatchEvent(new Event('input')); document.querySelector('#card .pri').click(); }, ph.i)));
    const wall = await waitFor(() => stage.evaluate((n) => { const l = document.querySelectorAll('.deck-wall li'); return l.length === n ? l.length : null; }, N), 10000);
    ok(wall === N, 'live-presentation: the big screen shows a wall of ' + N + ' answers', String(wall));
    await host.evaluate(() => Array.from(document.querySelectorAll('.deck-resp li')).find((li) => /Idea number 7$/.test(li.textContent.replace(/(Hide|Show)$/, ''))).querySelector('button').click());
    ok(await waitFor(() => stage.evaluate((n) => document.querySelectorAll('.deck-wall li').length === n - 1 && !Array.from(document.querySelectorAll('.deck-wall li')).some((l) => l.textContent === 'Idea number 7'), N), 5000), 'live-presentation: the presenter hides one answer from the wall');
    await phones[5].page.evaluate(() => { const t = document.querySelector('#card textarea'); t.value = 'Changed my mind'; t.dispatchEvent(new Event('input')); document.querySelector('#card .pri').click(); });
    ok(await waitFor(() => stage.evaluate(() => Array.from(document.querySelectorAll('.deck-wall li')).some((l) => l.textContent === 'Changed my mind') && !Array.from(document.querySelectorAll('.deck-wall li')).some((l) => l.textContent === 'Idea number 5')), 5000), 'live-presentation: a phone may change its open answer while voting is open');

    /* slide 4: the quiz — hidden until R, then each phone gets its own points and time */
    await h.clearFrames(phones);
    await press(host, 'ArrowRight');
    ok((await Promise.all(phones.map((ph) => waitFor(async () => /2 \+ 2/.test(await phoneQ(ph)) && await ph.page.evaluate(() => /s left/.test(document.querySelector('#card .hint').textContent)), 6000)))).every(Boolean), 'live-presentation: the quiz reaches every phone with a countdown');
    ok(!!(await waitFor(() => stage.evaluate(() => { const c = document.querySelector('.deck-clock'); return c && /s left/.test(c.textContent); }), 5000)), 'live-presentation: the big screen counts down');
    const right = (i) => i % 3 !== 2;
    await Promise.all(phones.map((ph) => ph.page.evaluate((k) => document.querySelectorAll('#card .opt')[k].click(), right(ph.i) ? 1 : 0)));
    ok(await waitFor(() => host.evaluate(() => document.querySelector('.deck-clock-line').textContent === '' && /Results are hidden/.test(document.querySelector('.deck-remote .game-msg').textContent)), 8000), 'live-presentation: the quiz closes when everyone has answered');
    await sleep(600);
    let qleak = 0;
    for (const ph of phones) for (const f of await h.frames(ph)) if (f.t === 'direct' || (f.v && f.v.rv)) qleak++;
    ok(qleak === 0, 'live-presentation: a hidden quiz sends no answer and no points before R', String(qleak));
    const hiddenQ = await stage.evaluate(() => document.querySelectorAll('.st-bars li.is-right').length + '|' + /%/.test(document.querySelector('.st-bars').textContent));
    ok(hiddenQ === '0|false', 'live-presentation: the big screen keeps the quiz answer hidden until R', hiddenQ);
    /* every phone's direct messages since the last reset */
    async function collect(ms) {
      await sleep(ms);
      for (const ph of phones) ph._fr = (ph._fr || []).concat(await h.frames(ph));
      return phones.map((ph) => ph._fr.filter((f) => f.t === 'direct').map((f) => f.v));
    }
    phones.forEach((ph) => { ph._fr = []; });
    await press(host, 'r');
    const perPhone = await collect(1500);
    ok(perPhone.every((d) => d.length === 1), 'live-presentation: each phone gets exactly one points message', perPhone.map((d) => d.length).join(''));
    const d1 = perPhone.map((d) => d[0] || {});
    const okPts = d1.every((d, i) => (right(i) ? d.p >= 500 && d.p <= 1000 : d.p === 0) && d.t === d.p && d.of === N);
    ok(okPts, 'live-presentation: each phone’s points are its own (500-1000 when right, 0 when wrong), total and of ' + N, JSON.stringify(d1.slice(0, 3)));
    ok(d1.every((d) => Number.isInteger(d.ms) && d.ms >= 0 && d.ms < 40000 && d.tm === d.ms), 'live-presentation: each phone’s answer time (ms from the question’s start, relay clock) is recorded and totalled', JSON.stringify(d1.slice(0, 2)));
    /* expected order: points, then the lower time of right answers */
    const ct1 = d1.map((d, i) => (right(i) ? d.ms : 0));
    const rankOf = (P, CT, i) => 1 + P.filter((p, j) => p > P[i] || (p === P[i] && CT[j] < CT[i])).length;
    ok(d1.every((d, i) => d.r === rankOf(d1.map((x) => x.t), ct1, i)), 'live-presentation: each phone’s rank follows points, then the faster right answers', d1.map((d) => d.r).join());
    ok(new Set(d1.map((d) => JSON.stringify(d))).size > 1, 'live-presentation: the points messages differ from phone to phone (one each, not one broadcast)', d1.slice(0, 6).map((d) => d.p).join());
    const phoneScore = await waitFor(() => phones[0].page.evaluate(() => { const t = Array.from(document.querySelectorAll('#card p')).map((p) => p.textContent).join(' | '); return /Total/.test(t) ? t : null; }), 5000);
    ok(/Correct!/.test(phoneScore) && /\+\d+ points in \d+\.\d s/.test(phoneScore) && /Total \d+ points · \d+ of \d+ · \d+\.\d s answering/.test(phoneScore), 'live-presentation: a phone shows “Correct!”, its points, its time and its total', phoneScore);
    const qShown = await waitFor(() => stage.evaluate(() => { const r = document.querySelector('.st-bars li.is-right'); return r ? r.querySelector('.st-bar-label').textContent + '|' + r.querySelector('strong').textContent : null; }), 5000);
    const nRight = phones.filter((ph) => right(ph.i)).length;
    ok(qShown && qShown.startsWith('4|') && qShown.endsWith('· ' + nRight), 'live-presentation: after R the big screen ticks the right answer with its count', qShown);
    /* by itself, a few seconds later: the top 5 with points and time */
    const nickOf = (i) => 'Phone ' + (i + 1);
    const sec = (ms) => (Math.round(ms / 100) / 10).toFixed(1);
    const order1 = d1.map((d, i) => i).sort((a, b) => d1[a].r - d1[b].r || nickOf(a).localeCompare(nickOf(b)));
    const top5 = await waitFor(() => stage.evaluate(() => { const t = document.querySelector('.st-title'); const li = Array.from(document.querySelectorAll('.deck-lb li')); return t && t.textContent === 'Top 5' && li.length === 5 ? li.map((l) => l.querySelector('span').textContent + '=' + l.querySelector('strong').textContent + '=' + l.querySelector('small').textContent) : null; }), 8000);
    const want5 = order1.slice(0, 5).map((i) => nickOf(i) + '=' + d1[i].t + ' pts=' + sec(d1[i].tm) + ' s');
    ok(JSON.stringify(top5) === JSON.stringify(want5), 'live-presentation: the top 5 appear by themselves after the reveal, in tie-break order, with points and time', JSON.stringify(top5) + ' want ' + JSON.stringify(want5));
    ok(await host.evaluate(() => /top 5/.test(document.querySelector('.deck-remote .game-msg').textContent)), 'live-presentation: the remote says the top 5 are showing');

    /* slide 5: the last quiz question (results not hidden): revealed at once, then the winner */
    phones.forEach((ph) => { ph._fr = []; });
    await h.clearFrames(phones);
    await press(host, 'ArrowRight');
    ok((await Promise.all(phones.map((ph) => waitFor(async () => /mammal/.test(await phoneQ(ph)), 6000)))).every(Boolean), 'live-presentation: Next after the top 5 moves every phone to the next question');
    const right2 = (i) => i % 2 === 0;
    await Promise.all(phones.map((ph) => ph.page.evaluate((k) => document.querySelectorAll('#card .opt')[k].click(), right2(ph.i) ? 1 : 2)));
    const auto = await waitFor(() => stage.evaluate(() => { const r = document.querySelector('.st-bars li.is-right'); return r ? r.querySelector('.st-bar-label').textContent : null; }), 8000);
    ok(auto === 'Whale', 'live-presentation: a quiz question without “hide” reveals as soon as everyone has answered', auto);
    const win = await waitFor(() => stage.evaluate(() => { const p = document.querySelector('.deck-podium.is-win'); const w = document.querySelector('.deck-winner.is-win'); return p && w ? Array.from(p.querySelectorAll('.deck-step')).map((x) => x.className.replace('deck-step is-', '') + ':' + x.querySelector('.deck-step-nick').textContent + ':' + x.querySelector('.deck-step-pts').textContent).join('|') + '|' + w.textContent : null; }), 9000);
    const perPhone2 = await collect(800);
    const fin = perPhone2.map((d) => d.find((x) => x.fin) || null);
    ok(fin.every(Boolean), 'live-presentation: at the end of the quiz each phone gets its final place', fin.filter(Boolean).length + '/' + N);
    const tot = fin.map((d) => (d ? d.t : 0));
    const winners = fin.map((d, i) => (d && d.r === 1 ? i : -1)).filter((i) => i >= 0);
    ok(winners.length >= 1 && winners.every((i) => tot[i] === Math.max(...tot)), 'live-presentation: the winner has the most points', winners.join());
    const w0 = winners[0];
    ok(!!win && win.indexOf('1:' + nickOf(w0) + ':' + tot[w0] + ' pts · ' + sec(fin[w0].tm) + ' s') >= 0 && /^2:.*\|1:.*\|3:/.test(win) && win.endsWith('Winner: ' + nickOf(w0)), 'live-presentation: the big screen shows the podium and names the winner with points and time', win);
    const css = await stage.evaluate(() => ['is-3', 'is-2', 'is-1'].map((k) => parseFloat(getComputedStyle(document.querySelector('.deck-podium.is-win .deck-step.' + k)).animationDelay)));
    ok(css[0] < css[1] && css[1] < css[2], 'live-presentation: the podium reveals third, then second, then the winner', css.join());
    const phoneWin = await waitFor(() => phones[w0].page.evaluate(() => { const t = document.getElementById('card').textContent; return /You won!/.test(t) ? t : null; }), 5000);
    ok(!!phoneWin, 'live-presentation: the winner’s phone says “You won!”');
    const loser = fin.findIndex((d) => d && d.r > 1);
    const phoneLose = await waitFor(() => phones[loser].page.evaluate(() => { const m = /You finished (\d+) of (\d+)/.exec(document.getElementById('card').textContent); return m ? m[1] + '/' + m[2] : null; }), 5000);
    ok(phoneLose === fin[loser].r + '/' + N, 'live-presentation: every other phone shows its own final place', phoneLose);
    const q2 = perPhone2.map((d) => d.find((x) => !x.fin && x.ms !== undefined) || d.find((x) => x.ms !== undefined));
    ok(fin.every((d, i) => q2[i] && d.tm === d1[i].ms + q2[i].ms), 'live-presentation: total time is the sum of each answer’s time', JSON.stringify(fin[0]));

    /* slide 6: the leaderboard; the last one is a podium, phones get their place */
    await press(host, 'ArrowRight');
    const lb = await waitFor(() => stage.evaluate(() => { const r = document.querySelectorAll('.deck-podium .deck-step').length + document.querySelectorAll('.deck-lb li').length; return r >= 10 ? r : null; }), 6000);
    ok(lb === 10, 'live-presentation: the leaderboard shows the top 10 (a podium for the last one)', String(lb));
    const top = await stage.evaluate(() => document.querySelector('.deck-step.is-1 .deck-step-pts').textContent);
    ok(top.indexOf(Math.max(...tot) + ' pts · ') === 0, 'live-presentation: first place has the most points', top + ' vs ' + Math.max(...tot));
    const place = await Promise.all(phones.slice(0, 6).map((ph) => waitFor(() => ph.page.evaluate(() => { const m = document.querySelector('#card .msg.ok'); return m && /You won!|You finished/.test(m.textContent) ? m.textContent : null; }), 6000)));
    ok(place.every((p, i) => p && (fin[i].r === 1 ? /^You won!/.test(p) : p.indexOf('You finished ' + fin[i].r + ' of ' + N + ' with ' + tot[i] + ' points') === 0)), 'live-presentation: each phone shows its own place on the final leaderboard', place[1]);

    /* slide 7: content — phones look at the screen */
    await press(host, 'ArrowRight');
    ok((await Promise.all(phones.map((ph) => waitFor(() => ph.page.evaluate(() => /Look at the screen/.test(document.getElementById('card').textContent) && /Thank you/.test(document.getElementById('card').textContent)), 6000)))).every(Boolean), 'live-presentation: a content slide tells phones to look at the screen');
    ok(!!(await waitFor(() => stage.evaluate(() => { const t = document.querySelector('.deck-info-title'); return t && t.textContent === 'Thank you!'; }), 5000)), 'live-presentation: the big screen shows the heading slide');
    const loadedDeck = await phones[0].page.evaluate(() => performance.getEntriesByType('resource').some((e) => /room-join-deck\.js/.test(e.name)));
    ok(loadedDeck, 'live-presentation: phones fetched the deck cards (room-join-deck.js) only when a deck slide came');

    /* reload the presenter's page and Reopen: same slide, same results */
    const csvBefore = JSON.stringify(await live(host, (X) => X.csvRows()));
    await sleep(700);
    const savedPos = await host.evaluate(() => { try { return JSON.parse(sessionStorage.getItem('mvr-live:live-presentation')).saved.pos; } catch (e) { return 'none'; } });
    await host.reload({ waitUntil: 'load' });
    const resume = await waitFor(() => host.evaluate(() => { const b = document.querySelector('.live-resume button'); if (b) b.click(); return !!b; }), 5000);
    ok(resume, 'live-presentation: after a reload the page offers to reopen the session');
    const code2 = await waitFor(() => host.evaluate(() => { const c = document.querySelector('[data-live-code]'); const t = c ? c.textContent.replace(/\D/g, '') : ''; return /^\d{6}$/.test(t) ? t : null; }), 15000);
    ok(code2 === code, 'live-presentation: Reopen keeps the code', code2 + ' vs ' + code);
    const after = await live(host, (X) => ({ pos: X.pos(), mode: X.mode(), csv: JSON.stringify(X.csvRows()) }));
    ok(after.pos === 6 && after.mode === 'present', 'live-presentation: Reopen comes back on the same slide in present mode', JSON.stringify([after.pos, after.mode, savedPos]));
    ok(after.csv === csvBefore, 'live-presentation: Reopen keeps every slide’s results');
    await press(host, 'ArrowLeft');
    ok((await Promise.all(phones.map((ph) => waitFor(() => ph.page.evaluate(() => /Leaderboard/.test(document.querySelector('#card h2').textContent)), 8000)))).every(Boolean), 'live-presentation: after Reopen, ← still moves every phone');

    /* CSV */
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-csv-'));
    const cdp = await host.createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
    ok(await host.evaluate(() => { const b = Array.from(document.querySelectorAll('.deck-remote button')).find((x) => x.textContent === 'Export CSV'); if (b) b.click(); return !!b; }), 'live-presentation: Export CSV');
    const file = await waitFor(() => fs.readdirSync(dir).find((f) => /\.csv$/.test(f)), 8000);
    if (ok(!!file, 'live-presentation: the CSV downloads')) {
      const text = fs.readFileSync(path.join(dir, file), 'utf8').replace(/^﻿/, '');
      const rows = text.trim().split(/\r\n/).map((l) => l.split(','));
      ok(rows[0].join() === 'Slide,Type,Question,Answer or response,Count,Percent,Correct,Nickname,Points,Rank,Time (s)', 'live-presentation: CSV header', rows[0].join());
      const s1 = rows.filter((r) => r[0] === '1');
      ok(s1.map((r) => r[4]).join() === want.join() && s1[0][6] === 'yes' && s1[1][6] === '', 'live-presentation: CSV slide 1 counts and the correct mark', s1.map((r) => r[4] + r[6]).join());
      ok(rows.filter((r) => r[0] === '2').map((r) => r[4]).join() === want2.join(), 'live-presentation: CSV slide 2 counts');
      ok(rows.filter((r) => r[0] === '3').length === N && text.indexOf('Changed my mind') > 0, 'live-presentation: CSV has every open answer', String(rows.filter((r) => r[0] === '3').length));
      const ans = rows.filter((r) => r[1] === 'Quiz answer');
      const a4 = ans.filter((r) => r[0] === '4'), a5 = ans.filter((r) => r[0] === '5');
      const pIdx = (nick) => Number(nick.replace('Phone ', '')) - 1;
      const sec1 = (ms) => (Math.round(ms / 100) / 10).toFixed(1);
      ok(a4.length === N && a5.length === N && a4.every((r) => r[6] === (right(pIdx(r[7])) ? 'right' : 'wrong') && Number(r[8]) === d1[pIdx(r[7])].p && r[10] === sec1(d1[pIdx(r[7])].ms)), 'live-presentation: CSV has every contestant’s answer per quiz question: answer, right/wrong, points, time', a4.slice(0, 2).map((r) => r.join(' ')).join(' / '));
      const totals = rows.filter((r) => r[1] === 'Quiz total');
      ok(totals.length === N && totals.every((r) => /^Phone \d+$/.test(r[7])) && Number(totals[0][8]) === Math.max(...tot) && totals[0][9] === '1' && totals.every((r) => r[10] === sec1(fin[pIdx(r[7])].tm)), 'live-presentation: CSV has the quiz scores by nickname, best first, with total time', totals.slice(0, 2).map((r) => r.join(' ')).join(' / '));
    }
    fs.rmSync(dir, { recursive: true, force: true });

    await h.endSession(host, 'live-presentation', phones);
    await stage.close();
    await host.close();
    await sleep(200);
  }
};
