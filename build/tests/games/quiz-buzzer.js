/* The Quiz Buzzer's own rules, for build/tests/games.js.
   Key and pointer events are made here with time stamps of our own choosing
   and dispatched in a different order from their times: the winner must follow
   the times. The expected winners are worked out in this file. */
'use strict';
const KEY = 'mvr-games-quiz-buzzer-v1';
const B = '[data-tool="quiz-buzzer"]';

/* keydown events with chosen time stamps (ms after a base taken in the page), dispatched in the order given */
const fire = (page, seq, keep) => page.evaluate((seq, keep) => {
  const base = keep && window.__base ? window.__base : performance.now() + 5;
  window.__base = base;
  seq.forEach((s) => {
    const ev = new KeyboardEvent('keydown', { key: s[0], bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'timeStamp', { value: base + s[1] });
    document.body.dispatchEvent(ev);
  });
  return performance.timeOrigin + base;
}, seq, !!keep);
const pads = (page) => page.evaluate((b) => Array.from(document.querySelectorAll(b + ' .bz-pad')).map((p) => ({ win: p.classList.contains('is-win'), later: p.classList.contains('is-later'), out: p.classList.contains('is-out'), tag: p.children[2].textContent, name: p.children[1].textContent, key: p.children[0].textContent })), B);
const order = (page) => page.evaluate((b) => Array.from(document.querySelectorAll(b + ' .bz-order-host li')).map((l) => l.textContent.replace(/\s+/g, ' ').trim()), B);
const statusText = (page) => page.evaluate((b) => document.querySelector(b + ' .bz-status').textContent, B);
const winIdx = async (page) => (await pads(page)).findIndex((p) => p.win);
const setVal = (page, sel, v) => page.evaluate((sel, v) => { const e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const hostBtn = (page, text) => page.evaluate((b, t) => { Array.from(document.querySelectorAll(b + ' .bz-host button')).find((x) => x.textContent.indexOf(t) === 0).click(); }, B, text);

module.exports = {
  check: async function (page, h) {
    /* ---- the rules ---- */
    const r = await page.evaluate(() => {
      const M = window.GAME_TOOLS['quiz-buzzer'].maths;
      const out = {};
      /* three presses, handled in the order 1, 0, 2 but made in the order 0, 1, 2 */
      let g = M.fresh();
      g = M.press(g, 1, 130); g = M.press(g, 0, 110); g = M.press(g, 2, 150);
      out.order = g.presses.map((p) => p.team); out.gaps = M.gaps(g); out.winner = M.winnerOf(g); out.phase = g.phase;
      /* the same team twice, and a tie in time */
      const again = M.press(g, 0, 105);
      out.dup = again === g;
      const tie = M.press(M.press(M.fresh(), 3, 50), 1, 50);
      out.tie = tie.presses.map((p) => p.team);
      /* wrong, correct, reset */
      const w = M.wrong(g);
      out.wrong = [w.phase, w.presses.length, w.locked.join(), M.press(w, 0, 200) === w, M.press(w, 2, 200).presses.length, M.winnerOf(M.press(w, 2, 200))];
      const c = M.correct(g);
      out.correct = [c.phase, c.verdict, M.press(c, 3, 300) === c, M.wrong(c) === c, M.correct(M.fresh()).phase];
      out.labels = [M.label(M.fresh(), 'off', 4), M.label(g, 'off', 4), M.label(g, 'running', 4), M.label(g, 'up', 4), M.label(c, 'off', 4), M.label({ phase: 'open', presses: [], locked: [0, 1, 2, 3], verdict: null }, 'off', 4)];
      out.keys = [M.normaliseKey('a'), M.normaliseKey(' 7 '), M.normaliseKey('ab'), M.normaliseKey(''), M.normaliseKey('#'), M.normaliseKey(null)];
      out.defaults = M.DEFAULT_KEYS.join('');
      /* 2000 shuffles of 6 presses: whatever the order they are handled in, the earliest time wins */
      let bad = 0, badGap = 0;
      for (let n = 0; n < 2000; n++) {
        const times = Array.from({ length: 6 }, () => Math.round(Math.random() * 5000) / 10);
        const idx = [0, 1, 2, 3, 4, 5];
        for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
        let s = M.fresh();
        idx.forEach((i) => { s = M.press(s, i, 1e9 + times[i]); });
        let best = 0;
        times.forEach((t, i) => { if (t < times[best] || (t === times[best] && i < best)) best = i; });
        if (M.winnerOf(s) !== best) bad++;
        const gp = M.gaps(s);
        if (gp.some((x, k) => Math.abs(x - (times[s.presses[k].team] - times[best])) > 1e-5) || gp[0] !== 0) badGap++;
      }
      out.bad = bad; out.badGap = badGap;
      return out;
    });
    h.ok(r.order.join() === '0,1,2' && r.gaps.join() === '0,20,40' && r.winner === 0 && r.phase === 'buzzed', 'buzzer: presses made in the order 0, 1, 2 win in that order however they were handled (gaps 0, 20, 40 ms)', r.order.join() + ' / ' + r.gaps.join());
    h.ok(r.dup === true && r.tie.join() === '1,3', 'buzzer: a team can press once, and a tie in time goes to the lower team number', String(r.tie));
    h.ok(r.wrong[0] === 'open' && r.wrong[1] === 0 && r.wrong[2] === '0' && r.wrong[3] === true && r.wrong[4] === 1 && r.wrong[5] === 2, 'buzzer: Wrong locks that team out, clears the list and reopens the rest', JSON.stringify(r.wrong));
    h.ok(r.correct[0] === 'done' && r.correct[1] === 'correct' && r.correct[2] === true && r.correct[3] === true && r.correct[4] === 'open', 'buzzer: after Correct nothing more counts; Correct and Wrong need a buzz', JSON.stringify(r.correct));
    h.ok(r.labels.join() === 'open,locked,answering,timeUp,correct,allOut', 'buzzer: the state words (open, locked, answering, time up, correct, all out)', r.labels.join());
    h.ok(r.keys.join('|') === 'A|7||||', 'buzzer: a key is one letter or digit', r.keys.join('|'));
    h.ok(r.defaults === 'ALQPZMXN', 'buzzer: default keys are A, L, Q, P, Z, M (then X, N)', r.defaults);
    h.ok(r.bad === 0 && r.badGap === 0, 'buzzer: in 2000 random shuffles of 6 presses the earliest time always won and the gaps were right', r.bad + ' wrong winners, ' + r.badGap + ' wrong gaps');

    /* ---- the page ---- */
    await page.evaluate((k) => { try { localStorage.removeItem(k); } catch (e) { /* none */ } }, KEY);
    await page.reload({ waitUntil: 'load' });
    await h.sleep(300);
    const hub = await h.open('/games/');
    await hub.evaluate(() => {
      window.__states = []; window.__points = [];
      const c = new BroadcastChannel('mvr-games:quiz-buzzer'); c.onmessage = (e) => { if (e.data && e.data.k === 'state') window.__states.push(e.data.s); };
      const p = new BroadcastChannel('mvr-games:points'); p.onmessage = (e) => window.__points.push(e.data);
      window.__c = c; window.__p = p;
    });
    const tv = await h.openStage('quiz-buzzer');
    await page.bringToFront();
    await page.evaluate(() => {
      window.__snd = { buzz: 0, ding: 0, wrong: 0 };
      const s = window.GameKit.sound;
      ['buzz', 'ding', 'wrong'].forEach((n) => { const real = s[n]; s[n] = function () { window.__snd[n]++; return real.apply(s, arguments); }; });
    });
    const snd = () => page.evaluate(() => window.__snd.buzz + '/' + window.__snd.ding + '/' + window.__snd.wrong);
    const lastState = () => hub.evaluate(() => window.__states[window.__states.length - 1]);
    h.ok((await pads(page)).map((p) => p.key).join('') === 'ALQP', 'buzzer: four teams with keys A, L, Q, P to start');

    /* A: L (30 ms), A (10 ms), Q (50 ms): handled in that order, A was first */
    await fire(page, [['l', 30], ['a', 10], ['q', 50]]);
    await h.sleep(200);
    let p = await pads(page);
    h.ok(p[0].win && p[1].later && p[2].later && !p[3].win && p[0].tag === 'FIRST', 'buzzer: the earliest time stamp wins (A at 10 ms beats L at 30 ms handled first)', JSON.stringify(p.map((x) => x.tag)));
    let o = await order(page);
    h.ok(o.join('|') === 'Team 1 — first|Team 2 +20 ms|Team 3 +40 ms', 'buzzer: the others are listed with their gaps in milliseconds', o.join('|'));
    h.ok((await snd()) === '1/0/0', 'buzzer: one buzz sound for the win, none for the later presses', await snd());
    const flash = await page.evaluate((b) => document.querySelector(b + ' .bz-main').classList.contains('is-flash'), B);
    h.ok(flash && /^LOCKED — Team 1/.test(await statusText(page)), 'buzzer: a flash, and the state says LOCKED with the team’s name (not colour alone)', await statusText(page));
    /* a team that has pressed cannot press again */
    await fire(page, [['a', 2]], true);
    o = await order(page);
    h.ok(o.length === 3 && o[0] === 'Team 1 — first', 'buzzer: a second press by the winner changes nothing', o.join('|'));
    /* a press made earlier but handled later takes the lead */
    await fire(page, [['p', -40]], true);
    p = await pads(page);
    o = await order(page);
    h.ok(p[3].win && p[0].later && o.join('|') === 'Team 4 — first|Team 1 +50 ms|Team 2 +70 ms|Team 3 +90 ms', 'buzzer: a press handled late but made earlier takes the lead', o.join('|'));
    await h.sleep(200);
    const st = await lastState();
    h.ok(st && st.label === 'locked' && st.winner.name === 'Team 4' && st.winner.key === 'P' && st.order.length === 4 && st.order[0].gap === 0, 'buzzer: the stage hears the winner and the order', JSON.stringify(st && st.winner));
    await h.sleep(150);
    const tvr = await tv.evaluate(() => ({ win: document.querySelector('.bz-win-name').textContent, state: document.querySelector('.bz-state').textContent, order: Array.from(document.querySelectorAll('.bz-order li')).map((l) => l.textContent).length, chips: document.querySelectorAll('.bz-chips li').length }));
    h.ok(tvr.win === 'Team 4' && tvr.state === 'LOCKED' && tvr.order === 3 && tvr.chips === 4, 'buzzer: the TV shows the winning team huge, the state and the order', JSON.stringify(tvr));
    /* Correct (C) */
    await fire(page, [['c', 0]]);
    h.ok(/^CORRECT — Team 4/.test(await statusText(page)) && (await snd()) === '1/1/0', 'buzzer: C marks it correct with the ding', (await statusText(page)) + ' ' + (await snd()));
    await fire(page, [['q', 1]]);
    p = await pads(page);
    h.ok(p[3].win && !p[2].win, 'buzzer: after Correct further presses change nothing');
    h.ok((await hub.evaluate(() => window.__points.length)) === 0, 'buzzer: no points are sent unless “Send points” is ticked');
    /* Reset (R) */
    await fire(page, [['r', 0]]);
    p = await pads(page);
    h.ok(p.every((x) => !x.win && !x.later && !x.out) && /^OPEN/.test(await statusText(page)), 'buzzer: R reopens everything');

    /* Wrong: lockout, then the others */
    await fire(page, [['a', 0], ['l', 15]]);
    await fire(page, [['w', 0]]);
    p = await pads(page);
    h.ok(p[0].out && p[0].tag === 'locked out' && !p[1].later && (await order(page)).length === 0 && /^OPEN/.test(await statusText(page)), 'buzzer: W locks the winner out, clears the list and reopens the rest', JSON.stringify(p.map((x) => x.tag)));
    await fire(page, [['a', 0]]);
    h.ok((await winIdx(page)) === -1, 'buzzer: a locked-out team cannot buzz');
    await fire(page, [['l', 0], ['q', 8]]);
    h.ok((await winIdx(page)) === 1 && (await snd()) === '3/1/1', 'buzzer: another team wins the reopened buzzer', (await snd()));
    await fire(page, [['w', 0], ['q', 0], ['w', 0], ['p', 0], ['w', 0]]);
    h.ok(/Every team is locked out/.test(await statusText(page)), 'buzzer: when every team is out the page says so', await statusText(page));
    await fire(page, [['r', 0]]);
    p = await pads(page);
    h.ok(p.every((x) => !x.out), 'buzzer: Reset lifts every lockout');

    /* the pads: pointerdown, several fingers, earliest wins; a click alone does not buzz */
    await page.evaluate((b) => {
      const padEls = document.querySelectorAll(b + ' .bz-pad');
      const base = performance.now() + 5;
      const down = (el, id, d) => { const ev = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: id === 1 }); Object.defineProperty(ev, 'timeStamp', { value: base + d }); el.dispatchEvent(ev); };
      down(padEls[2], 1, 40);   /* handled first, made later */
      down(padEls[1], 2, 12);   /* two fingers, the second made earlier */
    }, B);
    await h.sleep(150);
    p = await pads(page);
    h.ok(p[1].win && p[2].later && p[2].tag === '+28 ms', 'buzzer: two fingers on two pads at once: the earlier touch wins, the gap is listed', JSON.stringify(p.map((x) => x.tag)));
    const touch = await page.evaluate((b) => getComputedStyle(document.querySelector(b + ' .bz-pad')).touchAction, B);
    h.ok(touch === 'none', 'buzzer: pads take touch without scrolling or zooming (touch-action: none)', touch);
    await fire(page, [['r', 0]]);
    await page.evaluate((b) => { document.querySelectorAll(b + ' .bz-pad')[3].dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); }, B);
    h.ok((await winIdx(page)) === -1, 'buzzer: a mouse click alone does not buzz (pads answer pointerdown)');
    await page.evaluate((b) => { document.querySelectorAll(b + ' .bz-pad')[3].click(); }, B);
    h.ok((await winIdx(page)) === 3, 'buzzer: Enter or Space on a focused pad buzzes too (keyboard click)');
    await fire(page, [['r', 0]]);

    /* keys pressed on the TV window reach the host, with their own time */
    await tv.bringToFront();
    await tv.keyboard.press('q');
    await h.sleep(250);
    await page.bringToFront();
    h.ok((await winIdx(page)) === 2, 'buzzer: a key pressed on the TV window (Q) buzzes for its team', JSON.stringify((await pads(page)).map((x) => x.tag)));
    await tv.bringToFront();
    await tv.keyboard.press('r');
    await h.sleep(250);
    await page.bringToFront();
    h.ok((await winIdx(page)) === -1, 'buzzer: R pressed on the TV window resets the host');
    /* a forwarded press that was made EARLIER than a local one wins, whatever arrives first */
    const baseEpoch = await fire(page, [['l', 50]]);
    await hub.evaluate((at) => { const c = new BroadcastChannel('mvr-games:quiz-buzzer'); c.postMessage({ k: 'cmd', m: { type: 'key', key: 'A', code: 'KeyA', at: at } }); setTimeout(() => c.close(), 300); }, baseEpoch + 20);
    await h.sleep(250);
    p = await pads(page);
    h.ok(p[0].win && p[1].later && p[1].tag === '+30 ms', 'buzzer: a TV-window key made 30 ms before the host’s own press wins by its time stamp', JSON.stringify(p.map((x) => x.tag)));
    await fire(page, [['r', 0]]);

    /* the answer timer */
    await setVal(page, B + ' select', '5');
    await fire(page, [['a', 5]]);
    const wrong0 = Number((await snd()).split('/')[2]);
    const ans = await statusText(page);
    await h.sleep(300);
    const tvAns = await tv.evaluate(() => document.querySelector('.bz-state').textContent);
    h.ok(/^ANSWERING — Team 1 — [45] s/.test(ans) && /^ANSWERING/.test(tvAns), 'buzzer: the answer timer starts at the buzz, on the host and the TV', ans + ' | ' + tvAns);
    await h.sleep(5200);
    h.ok(/^TIME UP — Team 1/.test(await statusText(page)) && Number((await snd()).split('/')[2]) === wrong0 + 1, 'buzzer: at zero it says TIME UP and plays the low tone', (await statusText(page)) + ' ' + (await snd()));
    await fire(page, [['c', 0], ['r', 0]]);
    await fire(page, [['a', 0]]);
    await fire(page, [['r', 0]]);
    await h.sleep(400);
    h.ok(/^OPEN/.test(await statusText(page)), 'buzzer: Reset stops the answer timer');
    await setVal(page, B + ' select', '0');

    /* send points to the scoreboard */
    await page.evaluate((b) => { const c = document.querySelector(b + ' .game-check input[type=checkbox]'); c.click(); }, B);
    await page.evaluate((b) => {
      const names = document.querySelectorAll(b + ' .bz-setup-row input[type=text]');
      names[6].value = 'Owls'; names[6].dispatchEvent(new Event('change', { bubbles: true }));
    }, B);
    await page.evaluate((b) => { const pts = Array.from(document.querySelectorAll(b + ' input[type=number]')).find((x) => x.max === '100'); pts.value = '3'; pts.dispatchEvent(new Event('change', { bubbles: true })); }, B);
    await fire(page, [['p', 0], ['c', 0]]);
    await h.sleep(250);
    const sent = await hub.evaluate(() => window.__points);
    h.ok(sent.length === 1 && sent[0].team === 4 && sent[0].name === 'Owls' && sent[0].points === 3, 'buzzer: Correct sends { team, name, points } on mvr-games:points when ticked', JSON.stringify(sent));
    await fire(page, [['r', 0]]);

    /* keys: change, refuse R/C/W, refuse duplicates, keep on refresh */
    const keyIn = (i) => B + ' .bz-setup-row:nth-child(' + (i + 1) + ') .bz-key-in';
    await setVal(page, keyIn(0), 'g');
    let k = await page.evaluate((b) => Array.from(document.querySelectorAll(b + ' .bz-key-in')).map((x) => x.value).join(''), B);
    h.ok(k === 'GLQP', 'buzzer: a team’s key can be changed', k);
    await fire(page, [['a', 0]]);
    const nobuzz = await winIdx(page);
    await fire(page, [['g', 0]]);
    h.ok(nobuzz === -1 && (await winIdx(page)) === 0, 'buzzer: the new key buzzes and the old one no longer does');
    await fire(page, [['r', 0]]);
    await setVal(page, keyIn(1), 'r');
    let msg = await page.evaluate((b) => ({ m: document.querySelector(b + ' .bz-keymsg').textContent, v: document.querySelectorAll(b + ' .bz-key-in')[1].value }), B);
    h.ok(/host controls/.test(msg.m) && msg.v === 'L', 'buzzer: R, C and W are refused as team keys', JSON.stringify(msg));
    await setVal(page, keyIn(1), 'g');
    msg = await page.evaluate((b) => ({ m: document.querySelector(b + ' .bz-keymsg').textContent, v: document.querySelectorAll(b + ' .bz-key-in')[1].value }), B);
    h.ok(/already another team/.test(msg.m) && msg.v === 'L', 'buzzer: two teams cannot share a key', JSON.stringify(msg));
    await setVal(page, keyIn(1), '!');
    msg = await page.evaluate((b) => ({ m: document.querySelector(b + ' .bz-keymsg').textContent, v: document.querySelectorAll(b + ' .bz-key-in')[1].value }), B);
    h.ok(/one letter or digit/.test(msg.m) && msg.v === 'L', 'buzzer: a key must be a letter or a digit', JSON.stringify(msg));
    /* typing in a box is not a press */
    await page.evaluate((b) => { const i = document.querySelector(b + ' .bz-setup-row input[type=text]'); i.focus(); const ev = new KeyboardEvent('keydown', { key: 'l', bubbles: true }); i.dispatchEvent(ev); }, B);
    h.ok((await winIdx(page)) === -1, 'buzzer: typing in a name or key box does not buzz');
    /* teams 2..8 */
    await setVal(page, B + ' input[type=number]', '8');
    const eight = (await pads(page)).map((x) => x.key).join('');
    await setVal(page, B + ' input[type=number]', '1');
    const two = (await pads(page)).length;
    await setVal(page, B + ' input[type=number]', '30');
    const cap = (await pads(page)).length;
    h.ok(eight === 'GLQPZMXN' && two === 2 && cap === 8, 'buzzer: 2 to 8 teams, the extra keys are Z, M, X, N', eight + ' ' + two + ' ' + cap);
    await setVal(page, B + ' input[type=number]', '4');
    /* refresh keeps names, keys and settings */
    await page.reload({ waitUntil: 'load' });
    await h.sleep(300);
    const back = await page.evaluate((b) => ({ keys: Array.from(document.querySelectorAll(b + ' .bz-key-in')).map((x) => x.value).join(''), names: Array.from(document.querySelectorAll(b + ' .bz-setup-row input[type=text]:not(.bz-key-in)')).map((x) => x.value).join(), send: document.querySelector(b + ' .game-check input').checked, pts: Array.from(document.querySelectorAll(b + ' input[type=number]')).find((x) => x.max === '100').value }), B);
    h.ok(back.keys === 'GLQP' && /Owls/.test(back.names) && back.send === true && back.pts === '3', 'buzzer: keys and settings are kept on this device', JSON.stringify(back));
    await page.evaluate((k) => { try { localStorage.removeItem(k); } catch (e) { /* none */ } }, KEY);
    await tv.close(); await hub.close();
  },
  landings: {
    'buzzer-for-family-quiz-night': async function (page, h) {
      const r = await page.evaluate((b) => ({ pads: document.querySelectorAll(b + ' .bz-pad').length, send: document.querySelector(b + ' .game-check input').checked, timer: document.querySelector(b + ' select').value }), B);
      h.ok(r.pads === 4 && r.send === true && r.timer === '10', 'buzzer landing: the family quiz buzzer opens with four teams, points sent and a 10 second timer', JSON.stringify(r));
    }
  }
};
