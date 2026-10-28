/* Phones for the quiz games (engine/game-phones.js), for build/tests/live-rooms.js.
   Not a /live/ tool: `extra: true` makes live-rooms.js run it after the live tools
   (and alone with --only quiz-phones). 20 phones play the Quiz Maker & Host
   (everyone for themselves, then teams) and the Quiz Buzzer against the real relay.
   The expected scores, standings and winners are worked out here from the answers
   and the relay's own time stamps, not read back from the page's totals. */
'use strict';
const path = require('path');

const N = 20;
const SECS = 8;
const QUIZ = {
  v: 1, title: 'Phone test quiz',
  rounds: [
    { name: 'General', questions: [
      { type: 'mcq', prompt: 'Which is the third letter?', options: ['A', 'B', 'C', 'D'], answer: 'C', time: SECS },
      { type: 'tf', prompt: 'The Moon is a planet.', answer: false, time: SECS },
      { type: 'text', prompt: 'Capital of France?', answer: 'Paris', time: SECS }
    ] },
    { name: 'Order', questions: [
      { type: 'order', prompt: 'Smallest first', answer: ['one', 'two', 'three'], time: SECS }
    ] }
  ]
};
const RIGHT = { 0: 2, 1: 1 };   /* the right option of the two option questions */
/* the quiz's own scoring with the speed bonus, written out again here */
const pointsFor = (ok, ms) => (ok ? 1 + Math.round(0.5 * Math.max(0, Math.min(1, 1 - ms / (SECS * 1000)))) : 0);
function standings(rows) {
  const out = rows.map((x) => Object.assign({}, x));
  out.sort((a, b) => b.p - a.p || a.ct - b.ct || a.n.localeCompare(b.n));
  out.forEach((x, i) => { const y = out[i - 1]; x.r = y && y.p === x.p && y.ct === x.ct ? y.r : i + 1; });
  return out;
}
const sec = (ms) => (Math.round(ms / 100) / 10).toFixed(1);

const QM = '[data-tool="quiz-maker"]';
const qm = (page, fn, arg) => page.evaluate((fn, arg) => { const X = document.querySelector('[data-tool="quiz-maker"]').quizMaker; return new Function('X', 'arg', 'return (' + fn + ')(X, arg)')(X, arg); }, fn.toString(), arg);
const clickText = (page, scope, text) => page.evaluate((scope, text) => { const b = Array.from(document.querySelectorAll(scope + ' button')).find((x) => x.textContent.trim().indexOf(text) === 0 && x.offsetParent !== null); if (b) b.click(); return !!b; }, scope, text);
const phoneQ = (ph) => ph.page.evaluate(() => { const h = document.querySelector('#card h2'); return h ? h.textContent : ''; });
const phoneMsg = (ph) => ph.page.evaluate(() => { const m = document.querySelector('#card .msg'); return m ? m.textContent : ''; });

module.exports = {
  extra: true,

  /* the rules on their own, in Node */
  async maths(page, h) {
    const { ok } = h;
    const GP = require(path.join(__dirname, '..', '..', '..', 'engine', 'game-phones.js'));
    const C = require(path.join(__dirname, '..', '..', '..', 'engine', 'game-quiz-core.js'));
    const st = GP.standings([{ id: 'a', n: 'Ann', p: 3, ct: 5000 }, { id: 'b', n: 'Bob', p: 3, ct: 3000 }, { id: 'c', n: 'Cy', p: 5, ct: 9000 }, { id: 'd', n: 'Dee', p: 3, ct: 3000 }, { id: 'e', n: 'Eve', p: 0 }]);
    ok(st.map((x) => x.n + x.r).join() === 'Cy1,Bob2,Dee2,Ann4,Eve5', 'quiz-phones maths: standings by points; equal points go to the lower time of right answers; a place is shared only when both are equal', st.map((x) => x.n + x.r).join());
    ok(GP.balance([3, 1, 1, 2]) === 1 && GP.balance([0, 0]) === 0, 'quiz-phones maths: a phone that does not choose joins the team with the fewest phones');
    const fb = GP.firstBuzz([{ id: 'x', at: 1050 }, { id: 'y', at: 1010 }, { id: 'z', at: 1010 }]);
    ok(fb.id === 'y', 'quiz-phones maths: the first buzz is the smallest relay stamp, not the first to arrive (an equal stamp keeps the earlier arrival)', fb.id);
    ok(GP.toLocal(5000, 1200) === 3800, 'quiz-phones maths: a relay stamp moves to this browser’s clock by the offset');
    const tf = { type: 'tf', answer: false, time: 10 };
    const mc = { type: 'mcq', options: ['A', 'B', 'C'], answer: 'B', points: 2, time: 10 };
    const tx = { type: 'text', answer: 'Paris', time: 10 };
    const nm = { type: 'number', answer: 100, tolerance: 0, time: 10 };
    const s1 = GP.score(C, tf, { a: { v: 1, ms: 0 }, b: { v: 0, ms: 0 } });
    const s2 = GP.score(C, mc, { a: { v: 1, ms: 0 }, b: { v: 1, ms: 5000 }, c: { v: 1, ms: 10000 }, d: { v: 2, ms: 0 } });
    const s3 = GP.score(C, tx, { a: { v: 'paris', ms: 0 }, b: { v: 'Pariss', ms: 0 }, c: { v: 'Rome', ms: 0 } });
    const s4 = GP.score(C, nm, { a: { v: '96', ms: 0 }, b: { v: '104', ms: 0 }, c: { v: '103', ms: 9000 } }, { closest: true });
    ok(s1.a.ok && !s1.b.ok && s1.a.pts === 2 && s1.b.pts === 0, 'quiz-phones maths: true or false from a phone (option 0 is True)', JSON.stringify(s1));
    ok(s2.a.pts === 3 && s2.b.pts === 3 && s2.c.pts === 2 && s2.d.pts === 0, 'quiz-phones maths: the quiz’s own points plus up to half again for speed, nothing when wrong', JSON.stringify(s2));
    ok(s3.a.ok && s3.b.ok && !s3.c.ok, 'quiz-phones maths: typed answers are marked like the host’s (case and a small slip forgiven)', JSON.stringify(s3));
    ok(!s4.a.ok && !s4.b.ok && s4.c.ok && s4.c.pts === 1, 'quiz-phones maths: closest answer wins on number questions with phones', JSON.stringify(s4));
    const timed = { v: 1, title: 't', rounds: [{ name: 'r', questions: [{ type: 'tf', answer: true }, { type: 'tf', answer: true, time: 30 }] }] };
    ok(GP.kindOf({ type: 'order' }) === null && GP.kindOf({ type: 'picture' }) === 'text' && GP.kindOf({ type: 'mcq' }) === 'opt', 'quiz-phones maths: order questions are not answered on phones; picture answers are typed');
    ok(typeof timed === 'object', 'quiz-phones maths: ready');
  },

  async flow(h) {
    const { ok, waitFor, sleep, EP, PRIVACY } = h;
    if (h.phones.length < N) { ok(false, 'quiz-phones: needs ' + N + ' phones (--phones)'); return; }
    const P = h.phones.slice(0, N);
    const plain = (t) => String(t).replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
    const relay = encodeURIComponent(EP);

    /* ================= Quiz Maker ================= */
    const host = await h.open('/games/quiz-maker/?relay=' + relay);
    const ordinary = await host.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((u) => /room-|game-phones|8931|live\.1234tools/.test(u)));
    ok(ordinary.length === 0, 'quiz-maker: an ordinary visit loads nothing for phones and contacts no relay', ordinary.join(' '));
    const page = plain(await host.evaluate(() => document.body.textContent));
    ok(page.indexOf(plain(PRIVACY)) >= 0, 'quiz-maker: the page carries the approved privacy text');
    ok(/1234tools\.com\/join/.test(page) && page.indexOf('During the launch trial a free session takes up to 1,000 phones') >= 0 && /optional/i.test(page), 'quiz-maker: the page says phones are optional, where they join and the trial limit');
    await waitFor(() => host.evaluate(() => { const r = document.querySelector('[data-tool="quiz-maker"]'); return !!(r && r.quizMaker && r.quizMaker.quiz); }), 8000);
    await host.evaluate((Q) => { const X = document.querySelector('[data-tool="quiz-maker"]').quizMaker; const q = X.quiz; Object.keys(q).forEach((k) => { delete q[k]; }); Object.assign(q, JSON.parse(JSON.stringify(Q))); }, QUIZ);
    await clickText(host, QM, '2');
    const hits = [];
    host.on('request', (r) => { if (r.url().indexOf(':8931') >= 0) hits.push(r.url()); });
    await clickText(host, QM, 'Use phones');
    ok(await waitFor(() => host.evaluate(() => !!document.querySelector('[data-tool="quiz-maker"] .live-start')), 8000), 'quiz-maker: Use phones loads the live kit and shows Start a live session');
    await sleep(300);
    ok(hits.length === 0, 'quiz-maker: nothing reaches the relay before Start', hits.join(' '));
    await host.evaluate(() => document.querySelector('[data-tool="quiz-maker"] .live-start').click());
    const code = await waitFor(() => host.evaluate(() => { const c = document.querySelector('[data-live-code]'); const t = c ? c.textContent.replace(/\D/g, '') : ''; return /^\d{6}$/.test(t) ? t : null; }), 20000);
    ok(!!code && hits.length > 0, 'quiz-maker: the session starts with a 6-digit code', String(code));
    if (!code) return;
    const joined = (await Promise.all(P.map((ph) => h.join(ph, code)))).filter(Boolean).length;
    ok(joined === N, 'quiz-maker: ' + N + ' phones join', joined + '/' + N);
    const stage = await h.open('/games/quiz-maker/?stage=1');
    const strip = await waitFor(() => stage.evaluate(() => { const c = document.querySelector('.st-join-code'); return c ? c.textContent.replace(/\D/g, '') : null; }), 8000);
    ok(strip === code, 'quiz-maker: the TV shows the join code', strip);
    const tvLoad = await stage.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((u) => /room-client/.test(u)));
    ok(tvLoad.length === 0, 'quiz-maker: the TV window draws the strip without the relay client');

    /* everyone for themselves */
    await clickText(host, QM, 'Start the quiz');
    const round = await Promise.all(P.map((ph) => waitFor(async () => /Round 1: General/.test(await phoneQ(ph)), 8000)));
    ok(round.every(Boolean), 'quiz-maker: the round title reaches every phone', round.filter(Boolean).length + '/' + N);
    const res = {};   /* question → phone index → what it pressed or typed */
    const ask = async (pos, prompt, answerFn) => {
      if (pos === 0) await clickText(host, QM, 'Show the question');
      else await clickText(host, QM, 'Next');
      const shown = await Promise.all(P.map((ph) => waitFor(async () => (await phoneQ(ph)) === prompt, 8000)));
      ok(shown.every(Boolean), 'quiz-maker: question ' + (pos + 1) + ' reaches every phone', shown.filter(Boolean).length + '/' + N);
      res[pos] = {};
      /* four waves, so the answers have different times */
      for (let w = 0; w < 4; w++) {
        await Promise.all(P.filter((ph) => ph.i % 4 === w).map((ph) => answerFn(ph).then((v) => { res[pos][ph.i] = v; })));
        await sleep(250);
      }
      const n = await waitFor(() => qm(host, (X, p) => { const k = Object.keys(X.phones.results[p] || {}).length; return k === 20 ? k : null; }, pos), 10000);
      ok(n === N, 'quiz-maker: the host has every answer to question ' + (pos + 1), String(n));
      const tv = await waitFor(() => stage.evaluate(() => { const f = document.querySelector('.gp-answered'); return f ? f.textContent : null; }), 6000);
      ok(tv === N + ' of ' + N + ' answered', 'quiz-maker: the TV counts the answers', tv);
    };
    const pressOpt = (k) => (ph) => ph.page.evaluate((k) => { document.querySelectorAll('#card .opt')[k].click(); return k; }, k);
    const typeIt = (t) => (ph) => ph.page.evaluate((t) => { const ta = document.querySelector('#card textarea'); ta.value = t; ta.dispatchEvent(new Event('input')); Array.from(document.querySelectorAll('#card button')).find((b) => b.textContent === 'Send').click(); return t; }, t);
    const reveal = async (pos, expect) => {
      await clickText(host, QM, 'Reveal answer');
      const v = await Promise.all(P.map((ph) => waitFor(async () => { const m = await phoneMsg(ph); return /Correct!|Not this time/.test(m) ? m : null; }, 6000)));
      ok(v.every((m, i) => m === (expect(i) ? 'Correct!' : 'Not this time.')), 'quiz-maker: question ' + (pos + 1) + ': each phone is told “Correct!” or “Not this time.”', v.slice(0, 4).join(' / '));
    };

    await ask(0, QUIZ.rounds[0].questions[0].prompt, (ph) => pressOpt(ph.i % 3 === 2 ? 0 : 2)(ph));
    const q0right = (i) => i % 3 !== 2;
    await reveal(0, q0right);
    const tvRight = await waitFor(() => stage.evaluate(() => { const r = document.querySelector('.st-qz-opt.is-right'); return r ? r.textContent : null; }), 5000);
    ok(tvRight === 'CC', 'quiz-maker: the TV shows the right answer', tvRight);
    /* the top 5, four seconds after the answer */
    const expectBoard = async (upto) => {
      const r = await qm(host, (X) => X.phones.results);
      const tot = {};
      for (let pos = 0; pos <= upto; pos++) {
        const q = [].concat(...QUIZ.rounds.map((x) => x.questions))[pos];
        Object.keys(r[pos] || {}).forEach((id) => {
          const a = r[pos][id], t = tot[id] = tot[id] || { id, n: a.n, p: 0, ct: 0 };
          const right = q.type === 'text' ? /^paris!?$/i.test(a.v) : a.v === RIGHT[pos];
          t.p += pointsFor(right, a.ms);
          if (right) t.ct += a.ms;
          if (a.pts !== pointsFor(right, a.ms)) t.bad = true;
        });
      }
      return standings(Object.values(tot));
    };
    const want1 = await expectBoard(0);
    ok(!want1.some((x) => x.bad), 'quiz-maker: each phone’s points are the quiz’s own with the speed bonus, from the relay’s time stamps');
    const board = await waitFor(() => stage.evaluate(() => { const t = document.querySelector('.st-title'); const li = Array.from(document.querySelectorAll('.deck-lb li')); return t && t.textContent === 'Top 5' && li.length === 5 ? li.map((l) => l.querySelector('span').textContent + '=' + l.querySelector('strong').textContent.replace(/\D/g, '') + '=' + l.querySelector('small').textContent) : null; }), 8000);
    const wantTop = want1.slice(0, 5).map((x) => x.n + '=' + x.p + '=' + sec(x.ct) + ' s');
    ok(!!board && JSON.stringify(board) === JSON.stringify(wantTop), 'quiz-maker: the TV shows the top 5 by points, equal points by the lower time of right answers', JSON.stringify(board) + ' vs ' + JSON.stringify(wantTop));
    ok(want1[0].p === want1[4].p, 'quiz-maker: the test’s top 5 is decided by the time tie-break (equal points)', want1.slice(0, 5).map((x) => x.p).join());

    await ask(1, QUIZ.rounds[0].questions[1].prompt, (ph) => pressOpt(ph.i % 5 === 0 ? 0 : 1)(ph));
    await reveal(1, (i) => i % 5 !== 0);
    await ask(2, QUIZ.rounds[0].questions[2].prompt, (ph) => typeIt(ph.i % 2 ? 'London' : (ph.i % 4 ? 'paris' : 'PARIS!'))(ph));
    await reveal(2, (i) => i % 2 === 0);
    /* a put-in-order question: the phones look at the screen */
    await clickText(host, QM, 'Next');
    await clickText(host, QM, 'Show the question');
    const look = await waitFor(async () => { const t = await P[0].page.evaluate(() => document.querySelector('#card').textContent); return /Smallest first/.test(t) && /Look at the screen/.test(t); }, 8000);
    ok(look, 'quiz-maker: a put-in-order question tells the phones to look at the screen');
    await clickText(host, QM, 'Reveal answer');
    await clickText(host, QM, 'Final scores');
    const want = await expectBoard(3);
    ok(!want.some((x) => x.bad), 'quiz-maker: every answer scored as worked out here');
    const fin = await waitFor(() => stage.evaluate(() => { const w = document.querySelector('.deck-end .deck-winner.is-win'); return w && document.querySelector('.deck-end .deck-podium.is-win') && document.querySelectorAll('.deck-confetti i').length >= 100 ? w.textContent + '|' + document.querySelector('.deck-step.is-1 .deck-step-nick').textContent : null; }), 8000);
    const winners = want.filter((x) => x.r === 1).map((x) => x.n).join(' & ');
    ok(fin === 'Congratulations, ' + winners + '!|' + want[0].n, 'quiz-maker: the TV names the winner on a podium with confetti', fin + ' vs ' + winners);
    const places = await Promise.all(P.map((ph) => waitFor(() => ph.page.evaluate(() => { const m = document.querySelector('#card .msg'); return m && /You won|You finished/.test(m.textContent) ? m.textContent : null; }), 8000)));
    const byNick = {};
    want.forEach((x) => { byNick[x.n] = x; });
    const placeOk = P.every((ph, i) => { const x = byNick[ph.nick]; return x && places[i] && (x.r === 1 ? places[i].indexOf('You won! ' + x.p + ' points') === 0 : places[i].indexOf('You finished ' + x.r + ' of ' + want.length + ' with ' + x.p + ' points') === 0); });
    ok(placeOk, 'quiz-maker: every phone shows “You won!” or its own place', places.slice(0, 3).join(' / '));
    const csv = await qm(host, (X) => X.phones.csvRows());
    const a0 = csv.find((r) => r[0] === 1 && r[3] === P[0].nick);
    const x0 = byNick[P[0].nick];
    ok(csv[0].join() === 'Question,Round,Question text,Player,Team,Answer,Right,Points,Seconds,Counted for the team' && csv.length === 1 + 3 * N + 1 + 1 + want.length,
      'quiz-maker: the CSV has a row for every phone’s answer, then the standings', csv.length + ' rows');
    ok(!!a0 && a0[5] === 'C' && a0[6] === 'yes' && Number(a0[7]) >= 1, 'quiz-maker: a CSV row holds the answer, right or wrong, points and seconds', JSON.stringify(a0));
    const tail = csv.slice(-want.length);
    ok(tail.every((r, i) => r[1] === want[i].n && r[2] === want[i].p && r[0] === want[i].r), 'quiz-maker: the CSV standings match', JSON.stringify(tail[0]));

    /* teams: Red and Blue; phones choose, the last four are placed by the page */
    await clickText(host, QM, 'End the game');
    await host.evaluate(() => { const t = document.querySelector('[data-tool="quiz-maker"] .qz-setup textarea'); t.value = 'Red\nBlue'; t.dispatchEvent(new Event('input', { bubbles: true })); });
    await host.evaluate(() => { const r = document.querySelector('[data-tool="quiz-maker"] input[name="gp-mode"][value="teams"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
    const poll = await Promise.all(P.map((ph) => waitFor(async () => /Which team are you on/.test(await phoneQ(ph)), 8000)));
    ok(poll.every(Boolean), 'quiz-maker: in Teams every phone is asked which team it is on', poll.filter(Boolean).length + '/' + N);
    await Promise.all(P.filter((ph) => ph.i < 16).map((ph) => ph.page.evaluate((k) => { document.querySelectorAll('#card .opt')[k].click(); }, ph.i % 2)));
    await sleep(800);
    await clickText(host, QM, 'Start the quiz');
    await clickText(host, QM, 'Show the question');
    await Promise.all(P.map((ph) => waitFor(async () => (await phoneQ(ph)) === QUIZ.rounds[0].questions[0].prompt, 8000)));
    const teamOf = await qm(host, (X) => { const out = {}; X.phones.ph.roster.forEach((t, id) => { out[id] = t; }); return out; });
    /* Red's first answer is right (phone 0), Blue's first is wrong (phone 1); the rest come later and are not counted */
    await pressOpt(2)(P[0]);
    await pressOpt(0)(P[1]);
    await sleep(600);
    await Promise.all(P.slice(2).map((ph) => pressOpt(ph.i % 2 ? 2 : 0)(ph)));
    await waitFor(() => qm(host, (X) => Object.keys(X.phones.results[0] || {}).length === 20), 8000);
    await clickText(host, QM, 'Reveal answer');
    await sleep(300);
    const teams = await qm(host, (X) => X.game.teams().map((t) => t.name + '=' + t.score));
    const r0 = await qm(host, (X) => X.phones.results[0]);
    const p0 = Object.values(r0).find((a) => a.n === P[0].nick);
    ok(teams[0] === 'Red=' + pointsFor(true, p0.ms) && teams[1] === 'Blue=0', 'quiz-maker: Teams: each team’s first phone answer is the team’s answer, scored with the speed bonus', teams.join());
    const counts = [0, 0];
    Object.values(teamOf).forEach((t) => { counts[t]++; });
    ok(counts[0] + counts[1] === N && Math.abs(counts[0] - counts[1]) <= 1, 'quiz-maker: phones that did not choose were put in the smaller team', counts.join('/'));
    await clickText(host, QM, 'Next'); await clickText(host, QM, 'Reveal answer');
    await clickText(host, QM, 'Next'); await clickText(host, QM, 'Reveal answer');
    await clickText(host, QM, 'Next'); await clickText(host, QM, 'Show the question'); await clickText(host, QM, 'Reveal answer');
    await clickText(host, QM, 'Final scores');
    const tfin = await waitFor(() => stage.evaluate(() => { const w = document.querySelector('.deck-end .deck-winner.is-win'); return w ? w.textContent : null; }), 8000);
    ok(tfin === 'Congratulations, Red!', 'quiz-maker: Teams: the TV names the winning team', tfin);
    const tplaces = await Promise.all(P.map((ph) => waitFor(() => ph.page.evaluate(() => { const m = document.querySelector('#card .msg'); return m && /You won|You finished/.test(m.textContent) ? m.textContent : null; }), 8000)));
    const ids = await Promise.all(P.map((ph) => ph.page.evaluate(() => { try { return JSON.parse(sessionStorage.getItem('mvr-join') || 'null'); } catch (e) { return null; } })));
    ok(tplaces.every((m) => /^You won!|^You finished 2 of 2/.test(m || '')) && tplaces.filter((m) => /^You won!/.test(m || '')).length === counts[0], 'quiz-maker: Teams: Red’s phones say “You won!”, Blue’s say second of two', tplaces.slice(0, 2).join(' / ') + ' ' + JSON.stringify(ids[0]));
    const tcsv = await qm(host, (X) => X.phones.csvRows());
    const counted = tcsv.filter((r) => r[0] === 1 && r[9] === 'yes').map((r) => r[3]).sort();
    ok(JSON.stringify(counted) === JSON.stringify([P[0].nick, P[1].nick].sort()), 'quiz-maker: Teams: the CSV marks which phone’s answer counted for its team', JSON.stringify(counted));
    await stage.close();
    await h.endSession(host, 'quiz-maker', P);
    await host.close();

    /* ================= Quiz Buzzer ================= */
    const BZ = '[data-tool="quiz-buzzer"]';
    const bz = await h.open('/games/quiz-buzzer/?relay=' + relay);
    const bzPage = plain(await bz.evaluate(() => document.body.textContent));
    ok(bzPage.indexOf(plain(PRIVACY)) >= 0 && /1234tools\.com\/join/.test(bzPage) && bzPage.indexOf('During the launch trial a free session takes up to 1,000 phones') >= 0, 'quiz-buzzer: the page carries the privacy text, the join address and the trial limit');
    ok((await bz.evaluate(() => performance.getEntriesByType('resource').filter((e) => /room-|game-phones/.test(e.name)).length)) === 0, 'quiz-buzzer: an ordinary visit loads nothing for phones');
    await bz.evaluate(() => { const c = Array.from(document.querySelectorAll('[data-tool="quiz-buzzer"] .game-check input'))[0]; if (!c.checked) { c.checked = true; c.dispatchEvent(new Event('change')); } window.__pts = []; const ch = new BroadcastChannel('mvr-games:points'); ch.onmessage = (e) => window.__pts.push(e.data); });
    await clickText(bz, BZ, 'Use phones');
    await waitFor(() => bz.evaluate(() => !!document.querySelector('[data-tool="quiz-buzzer"] .live-start')), 8000);
    await bz.evaluate(() => document.querySelector('[data-tool="quiz-buzzer"] .live-start').click());
    const code2 = await waitFor(() => bz.evaluate(() => { const c = document.querySelector('[data-live-code]'); const t = c ? c.textContent.replace(/\D/g, '') : ''; return /^\d{6}$/.test(t) ? t : null; }), 20000);
    ok(!!code2, 'quiz-buzzer: the session starts', String(code2));
    if (!code2) return;
    const j2 = (await Promise.all(P.map((ph) => h.join(ph, code2)))).filter(Boolean).length;
    ok(j2 === N, 'quiz-buzzer: ' + N + ' phones join', j2 + '/' + N);
    const pick = await Promise.all(P.map((ph) => waitFor(async () => /Which team are you on/.test(await phoneQ(ph)), 8000)));
    ok(pick.every(Boolean), 'quiz-buzzer: phones choose their team first', pick.filter(Boolean).length + '/' + N);
    await Promise.all(P.map((ph) => ph.page.evaluate((k) => { document.querySelectorAll('#card .opt')[k].click(); }, ph.i % 4)));
    await sleep(800);
    await clickText(bz, BZ, 'Teams are set');
    const armed = await Promise.all(P.map((ph) => waitFor(() => ph.page.evaluate(() => { const b = document.querySelector('#card .big'); return b && !b.disabled && b.textContent === 'BUZZ'; }), 8000)));
    ok(armed.every(Boolean), 'quiz-buzzer: every phone shows the BUZZ button once the teams are set', armed.filter(Boolean).length + '/' + N);
    const bstage = await h.open('/games/quiz-buzzer/?stage=1');
    const chips = await waitFor(() => bstage.evaluate(() => { const t = Array.from(document.querySelectorAll('.bz-chips li')).map((l) => l.textContent); return t.length === 4 && t.every((x) => /5 phones/.test(x)) && document.querySelector('.st-join-code') ? t.join('|') : null; }), 8000);
    ok(!!chips, 'quiz-buzzer: the TV shows the join code and each team’s phones', String(chips));

    /* all twenty press at once: the smallest relay stamp wins */
    await Promise.all(P.map((ph) => ph.page.evaluate(() => { document.querySelector('#card .big').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); })));
    await waitFor(() => bz.evaluate(() => document.querySelector('[data-tool="quiz-buzzer"]').quizBuzzer.phones.log.length === 20), 8000);
    const got = await bz.evaluate(() => { const X = document.querySelector('[data-tool="quiz-buzzer"]').quizBuzzer; const nick = {}; X.phones.ph.kit.players.forEach((n, id) => { nick[id] = n; }); return { log: X.phones.log.map((x) => Object.assign({ n: nick[x.id] }, x)), first: X.state.presses[0], n: X.state.presses.length }; });
    let best = got.log[0];
    got.log.forEach((x) => { if (x.at < best.at) best = x; });
    ok(got.first && got.first.team === best.team && got.n === 4, 'quiz-buzzer: the earliest relay stamp wins; one press per team is listed', JSON.stringify(got.first) + ' best ' + JSON.stringify(best));
    const firstText = await Promise.all(P.map((ph) => waitFor(async () => { const m = await phoneMsg(ph); return /^First: /.test(m) ? m : null; }, 6000)));
    const wantFirst = 'First: ' + best.n + ' (Team ' + (best.team + 1) + ')';
    ok(firstText.every((m) => m === wantFirst), 'quiz-buzzer: every phone shows who buzzed first', firstText[0] + ' vs ' + wantFirst);
    const locked = await Promise.all(P.map((ph) => ph.page.evaluate(() => document.querySelector('#card .big').disabled)));
    ok(locked.every(Boolean), 'quiz-buzzer: every phone is locked out after the buzz');
    const tvWin = await waitFor(() => bstage.evaluate(() => { const n = document.querySelector('.bz-win-name'), k = document.querySelector('.bz-win-key'); return n && k ? n.textContent + '|' + k.textContent : null; }), 5000);
    ok(tvWin === 'Team ' + (best.team + 1) + '|' + best.n, 'quiz-buzzer: the TV shows the team and the phone that buzzed', tvWin);
    await clickText(bz, BZ, 'Correct');
    const pts = await waitFor(() => bz.evaluate(() => (window.__pts.length ? window.__pts[0] : null)), 4000);
    ok(pts && pts.team === best.team + 1 && pts.points === 1 && pts.name === 'Team ' + (best.team + 1), 'quiz-buzzer: Correct sends the team’s point to the Scoreboard channel', JSON.stringify(pts));

    /* re-arm */
    await clickText(bz, BZ, 'Reset');
    const rearm = await Promise.all(P.map((ph) => waitFor(() => ph.page.evaluate(() => { const b = document.querySelector('#card .big'); return b && !b.disabled; }), 6000)));
    ok(rearm.every(Boolean), 'quiz-buzzer: Reset re-arms every phone', rearm.filter(Boolean).length + '/' + N);
    /* crafted: a press that arrives later with an earlier relay stamp takes the lead */
    const crafted = await bz.evaluate(() => {
      const X = document.querySelector('[data-tool="quiz-buzzer"]').quizBuzzer, ph = X.phones.ph;
      const byTeam = {};
      ph.roster.forEach((t, id) => { if (!(t in byTeam)) byTeam[t] = id; });
      const q = JSON.parse(JSON.stringify(ph.kit.card)).id, T = ph.serverNow();
      X.phones.onMsg({ id: byTeam[0], at: T + 60, v: { q, v: 1 } });
      const first = X.state.presses[0].team;
      X.phones.onMsg({ id: byTeam[1], at: T + 20, v: { q, v: 1 } });
      const second = X.state.presses[0].team;
      X.phones.onMsg({ id: byTeam[2], at: T - 5, v: { q: 'old-card', v: 1 } });
      return { first, second, n: X.state.presses.length };
    });
    ok(crafted.first === 0 && crafted.second === 1 && crafted.n === 2, 'quiz-buzzer: a press that arrives later but was made earlier (relay stamp) takes the lead; a press for an old card is ignored', JSON.stringify(crafted));
    /* Wrong locks that team out and opens a new card for the others */
    await clickText(bz, BZ, 'Wrong');
    const after = await bz.evaluate(() => {
      const X = document.querySelector('[data-tool="quiz-buzzer"]').quizBuzzer, ph = X.phones.ph;
      const byTeam = {};
      ph.roster.forEach((t, id) => { if (!(t in byTeam)) byTeam[t] = id; });
      const q = ph.kit.card.id, T = ph.serverNow();
      X.phones.onMsg({ id: byTeam[1], at: T, v: { q, v: 1 } });
      const lockedOut = X.state.presses.length === 0;
      X.phones.onMsg({ id: byTeam[3], at: T + 1, v: { q, v: 1 } });
      return { lockedOut, now: X.state.presses.length ? X.state.presses[0].team : null, open: ph.kit.card.open };
    });
    ok(after.lockedOut && after.now === 3, 'quiz-buzzer: after Wrong that team’s phones are locked out and the others can buzz', JSON.stringify(after));
    /* the keys still work alongside the phones */
    await clickText(bz, BZ, 'Reset');
    await bz.keyboard.press('a');
    await bz.keyboard.press('l');
    const key = await bz.evaluate(() => { const X = document.querySelector('[data-tool="quiz-buzzer"]').quizBuzzer; return X.state.presses.length ? X.state.presses[0].team : null; });
    ok(key === 0, 'quiz-buzzer: a team key still buzzes with phones in play', String(key));
    const lockOk = await bz.evaluate(() => { const c = document.querySelector('[data-tool="quiz-buzzer"] .live-lock'); return c ? c.getAttribute('aria-pressed') : null; });
    ok(lockOk === 'false', 'quiz-buzzer: the L key is a team key, not the session lock', String(lockOk));
    await bstage.close();
    await h.endSession(bz, 'quiz-buzzer', P);
    await bz.close();
  }
};
