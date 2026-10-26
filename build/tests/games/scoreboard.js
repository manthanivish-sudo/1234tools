/* The Quiz Scoreboard's own rules, for build/tests/games.js.
   The rules are checked against a sequence worked out by hand (below), and
   the CSV is read back with a small parser written here. */
'use strict';
const KEY = 'mvr-games-scoreboard-v1';

/* a CSV parser of our own: quoted fields, "" for a quote, CRLF rows */
function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const card = (i) => '[data-tool="scoreboard"] .sb-team[data-team="' + i + '"]';
const clickIn = (page, i, text) => page.evaluate((i, t) => {
  const b = Array.from(document.querySelectorAll('[data-tool="scoreboard"] .sb-team[data-team="' + i + '"] button')).find((x) => x.textContent.indexOf(t) === 0);
  b.click();
}, i, text);
const custom = (page, i, n) => page.evaluate((i, n) => {
  const c = document.querySelector('[data-tool="scoreboard"] .sb-team[data-team="' + i + '"]');
  const box = c.querySelector('.sb-custom input');
  box.value = String(n);
  Array.from(c.querySelectorAll('button')).find((x) => x.textContent === 'Add').click();
}, i, n);
const totalsOf = (page) => page.evaluate(() => Array.from(document.querySelectorAll('[data-tool="scoreboard"] .sb-total-n')).map((e) => e.textContent));
const press = async (page, key) => {
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press(key);
};
const topButton = (page, text) => page.evaluate((t) => {
  const b = Array.from(document.querySelectorAll('[data-tool="scoreboard"] .sb-top button, [data-tool="scoreboard"] .sb-sure button')).find((x) => x.textContent.replace(/\s+/g, ' ').indexOf(t) === 0);
  b.click();
}, text);

module.exports = {
  check: async function (page, h) {
    /* ---- the rules, by a sequence worked out by hand ---- */
    const r = await page.evaluate(() => {
      const M = window.GAME_TOOLS['scoreboard'].maths;
      const out = {};
      const H = M.history(M.initial(3));
      const start = JSON.stringify(H.now);
      const seq = [
        { t: 'add', team: 0, n: 5 },        /* t0 R1 5  */
        { t: 'add', team: 1, n: 1 },        /* t1 R1 1  */
        { t: 'add', team: 0, n: -1 },       /* t0 R1 4  */
        { t: 'joker', team: 1 },            /* t1 R1 1 x2 = 2 */
        { t: 'nextRound' },                 /* round 2 */
        { t: 'add', team: 0, n: 5 },        /* t0 R2 5  */
        { t: 'add', team: 1, n: 5 },        /* t1 R2 5  */
        { t: 'joker', team: 0 },            /* t0 R2 5 x2 = 10 */
        { t: 'add', team: 2, n: 7 },        /* t2 R2 7  */
        { t: 'joker', team: 1 },            /* refused: t1's joker is already spent in round 1 */
        { t: 'add', team: 2, n: -2 },       /* t2 R2 5  */
        { t: 'add', team: 2, n: 0 },        /* nothing */
        { t: 'add', team: 9, n: 1 }         /* no such team */
      ];
      out.changed = seq.map((a) => H.do(a));
      out.totals1 = M.totals(H.now); out.ranks1 = M.ranks(out.totals1);
      out.eff = [M.effective(H.now, 0, 0), M.effective(H.now, 1, 0), M.effective(H.now, 0, 1), M.effective(H.now, 2, 1)];
      out.jokers = H.now.teams.map((t) => t.joker);
      H.do({ t: 'add', team: 2, n: 2 });    /* t2 7: ties t1 */
      out.totals2 = M.totals(H.now); out.ranks2 = M.ranks(out.totals2); out.order2 = M.order(out.totals2);
      H.do({ t: 'joker', team: 0 });        /* withdrawn: t0 R2 5 */
      out.totals3 = M.totals(H.now); out.jokers3 = H.now.teams.map((t) => t.joker);
      H.do({ t: 'joker', team: 0 });        /* played again */
      out.totals4 = M.totals(H.now);
      out.depth = H.past.length;
      const end = JSON.stringify(H.now);
      let n = 0;
      while (H.undo()) n++;
      out.undone = n; out.backToStart = JSON.stringify(H.now) === start;
      while (H.redo()) n++;
      out.redoneAll = JSON.stringify(H.now) === end;
      H.undo(); H.do({ t: 'add', team: 0, n: 1 });
      out.redoCleared = H.redo();
      /* ranks with ties */
      out.tie = M.ranks([14, 7, 7, 3]); out.tieOrder = M.order([7, 14, 7, 3]);
      /* team count, new game */
      let s = M.initial(4);
      s = M.reduce(s, { t: 'rename', team: 0, name: '  Red   Rovers ' });
      s = M.reduce(s, { t: 'add', team: 0, n: 3 });
      const fewer = M.reduce(s, { t: 'teams', n: 2 });
      const more = M.reduce(s, { t: 'teams', n: 20 });
      const nope = M.reduce(s, { t: 'teams', n: 4 });
      const ng = M.reduce(s, { t: 'newGame' });
      out.teamsN = [fewer.teams.length, more.teams.length, nope === s, ng.teams[0].name, M.totals(ng).join(), ng.rounds.length];
      out.sanitise = [M.sanitise(null) === null, M.sanitise({ teams: [], rounds: [], scores: [] }) === null, JSON.stringify(M.sanitise({ teams: [{ name: '' }, { name: 'B', color: 99, joker: 7 }], rounds: ['x'], scores: [[1.6], ['z']], round: 5 }))];
      /* the csv, with awkward names */
      let c = M.initial(3);
      c = M.reduce(c, { t: 'rename', team: 0, name: 'Smith, "Jr"' });
      c = M.reduce(c, { t: 'rename', team: 1, name: '=1+1' });
      c = M.reduce(c, { t: 'add', team: 0, n: 4 });
      c = M.reduce(c, { t: 'joker', team: 0 });
      c = M.reduce(c, { t: 'nextRound' });
      c = M.reduce(c, { t: 'add', team: 1, n: 9 });
      c = M.reduce(c, { t: 'add', team: 0, n: -3 });
      out.csv = M.csv(c);
      return out;
    });
    h.ok(r.changed.join() === 'true,true,true,true,true,true,true,true,true,false,true,false,false', 'scoreboard: refused and empty changes make no undo step', r.changed.join());
    h.ok(r.totals1.join() === '14,7,5' && r.ranks1.join() === '1,2,3', 'scoreboard: the hand-worked totals 14, 7, 5 and ranks', r.totals1.join() + ' / ' + r.ranks1.join());
    h.ok(r.eff.join() === '4,2,10,5', 'scoreboard: a joker doubles that round only (4, 1x2=2, 5x2=10, 5)', r.eff.join());
    h.ok(r.jokers.join() === '1,0,' || JSON.stringify(r.jokers) === '[1,0,null]', 'scoreboard: the jokers sit on the rounds they were played in', JSON.stringify(r.jokers));
    h.ok(r.totals2.join() === '14,7,7' && r.ranks2.join() === '1,2,2' && r.order2.join() === '0,1,2', 'scoreboard: equal totals share a rank and keep team order', r.ranks2.join());
    h.ok(r.totals3.join() === '9,7,7' && JSON.stringify(r.jokers3) === '[null,0,null]' && r.totals4.join() === '14,7,7', 'scoreboard: playing the joker again takes it back, and again puts it back', r.totals3.join() + ' / ' + r.totals4.join());
    h.ok(r.undone === r.depth && r.backToStart && r.redoneAll, 'scoreboard: undoing every change returns the start and redo returns the end', r.undone + ' of ' + r.depth);
    h.ok(r.redoCleared === false, 'scoreboard: a new change clears redo');
    h.ok(r.tie.join() === '1,2,2,4' && r.tieOrder.join() === '1,0,2,3', 'scoreboard: ranks 1, 2, 2, 4 for 14, 7, 7, 3', r.tie.join());
    h.ok(r.teamsN[0] === 2 && r.teamsN[1] === 12 && r.teamsN[2] === true && r.teamsN[3] === 'Red Rovers' && r.teamsN[4] === '0,0,0,0' && r.teamsN[5] === 1, 'scoreboard: team count stays 2 to 12, a new game keeps names and clears scores', JSON.stringify(r.teamsN));
    h.ok(r.sanitise[0] && r.sanitise[1] && /"name":"Team 1"/.test(r.sanitise[2]) && /"color":7,"joker":null/.test(r.sanitise[2]) && /"scores":\[\[2\],\[0\]\]/.test(r.sanitise[2]), 'scoreboard: a saved game is checked and repaired when read back', r.sanitise[2]);
    const rows = parseCsv(r.csv);
    h.ok(rows[0].join('|') === 'Rank|Team|Round 1|Round 2|Joker round|Total', 'scoreboard: CSV columns', rows[0].join('|'));
    /* Smith: R1 4 x2 joker = 8, R2 -3 = 5 -> total 5? no: R2 is not the joker round, so -3 -> total 8-3 = 5; "=1+1" R2 9; Team 3 zero */
    h.ok(rows[1].join('|') === '1|\'=1+1|0|9|' + '|9' && rows[2].join('|') === '2|Smith, "Jr"|8|-3|Round 1|5' && rows[3].join('|') === '3|Team 3|0|0||0', 'scoreboard: CSV rows are in rank order with jokers doubled and awkward names quoted or defused', JSON.stringify(rows.slice(1)));

    /* ---- the page ---- */
    const base = '[data-tool="scoreboard"]';
    await page.evaluate((k) => { try { localStorage.removeItem(k); } catch (e) { /* none */ } }, KEY);
    await page.reload({ waitUntil: 'load' });
    await h.sleep(300);
    const hub = await h.open('/games/');
    const tv = await h.openStage('scoreboard');
    await page.bringToFront();
    const n0 = await page.evaluate((b) => document.querySelectorAll(b + ' .sb-team').length, base);
    h.ok(n0 === 4, 'scoreboard: opens with four teams', String(n0));
    await page.evaluate((b) => { const i = document.querySelector(b + ' input[type=number]'); i.value = '3'; i.dispatchEvent(new Event('change', { bubbles: true })); }, base);
    await h.sleep(150);
    h.ok((await page.evaluate((b) => document.querySelectorAll(b + ' .sb-team').length, base)) === 3, 'scoreboard: the team count box sets three teams');

    /* the same sequence, by clicks, custom boxes and keys */
    await clickIn(page, 0, '+5');
    await press(page, '2'); await page.keyboard.press('+');
    await press(page, '1'); await page.keyboard.press('-');
    await clickIn(page, 1, 'Play joker');
    let t = await totalsOf(page);
    h.ok(t.join() === '4,2,0', 'scoreboard: +5, key 2 then +, key 1 then −, and a joker give 4, 2, 0', t.join());
    await topButton(page, 'Next round');
    await clickIn(page, 0, '+5');
    await custom(page, 1, 5);
    await clickIn(page, 0, 'Play joker');
    await custom(page, 2, 7);
    t = await totalsOf(page);
    h.ok(t.join() === '14,7,7', 'scoreboard: round 2 with a custom box and a joker gives 14, 7, 7', t.join());
    await press(page, 'u');
    t = await totalsOf(page);
    h.ok(t.join() === '14,7,0', 'scoreboard: U undoes the last change', t.join());
    await press(page, 'y');
    t = await totalsOf(page);
    h.ok(t.join() === '14,7,7', 'scoreboard: Y redoes it', t.join());
    await press(page, '9');
    const picked = await page.evaluate((b) => Array.from(document.querySelectorAll(b + ' .sb-team')).findIndex((c) => c.classList.contains('is-sel')), base);
    h.ok(picked === 2, 'scoreboard: key 9 changes nothing with three teams (team 3 stays picked)', String(picked));
    const tab = await page.evaluate((b) => Array.from(document.querySelectorAll(b + ' .sb-table tbody tr')).map((tr) => Array.from(tr.children).map((c) => c.textContent.replace(/\s+/g, ' ').trim()).join('|')), base);
    h.ok(tab.join(';') === 'Team 1|4|10 ×2|14;Team 2|2 ×2|5|7;Team 3|0|7|7', 'scoreboard: the table shows each round, the doubled rounds marked, and the totals', tab.join(';'));

    /* the TV: ranks, order, and a smooth move when the order changes */
    await h.sleep(300);
    const tvRows = () => tv.evaluate(() => Array.from(document.querySelectorAll('.sb-row')).map((r) => r.children[0].textContent + ':' + r.children[1].textContent + ':' + r.children[3].textContent).join('|'));
    let tvr = await tvRows();
    h.ok(tvr === '1:Team 1:14|2:Team 2:7|2:Team 3:7', 'scoreboard: the TV leaderboard shows ranks, names and totals', tvr);
    await page.bringToFront();
    await custom(page, 2, 10);
    await h.sleep(130);
    const moving = await tv.evaluate(() => Array.from(document.querySelectorAll('.sb-row')).filter((r) => /transform/.test(r.style.transition)).length);
    tvr = await tvRows();
    h.ok(tvr === '1:Team 3:17|2:Team 1:14|3:Team 2:7' && moving >= 2, 'scoreboard: the TV re-orders the ranks and animates the move (FLIP)', tvr + ' moving ' + moving);
    await tv.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await h.sleep(900);
    await page.bringToFront();
    await clickIn(page, 1, '+5');
    await clickIn(page, 1, '+5');
    await h.sleep(130);
    const still = await tv.evaluate(() => Array.from(document.querySelectorAll('.sb-row')).filter((r) => /transform/.test(r.style.transition)).length);
    h.ok(still === 0, 'scoreboard: with reduced motion the TV re-orders without moving rows', String(still));
    await tv.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

    /* a key pressed on the TV window reaches the host */
    await page.bringToFront();
    const before = await totalsOf(page);
    await tv.keyboard.press('3');
    await tv.keyboard.press('+');
    await h.sleep(200);
    const after = await totalsOf(page);
    h.ok(+after[2] === +before[2] + 1, 'scoreboard: keys pressed on the TV window (3 then +) reach the host', before.join() + ' -> ' + after.join());

    /* points from the buzzer over BroadcastChannel('mvr-games:points') */
    const base3 = (await totalsOf(page)).map(Number);
    await hub.evaluate(() => {
      const c = new BroadcastChannel('mvr-games:points');
      c.postMessage({ team: 1, name: 'Team 2', points: 3 });     /* by name */
      c.postMessage({ team: 3, points: 2 });                      /* by position */
      c.postMessage({ team: 1, name: 'team 1', points: -1 });     /* name ignoring case */
      c.postMessage({ team: 1, name: 'Nobody', points: 4 });      /* unknown name falls back to position 1 */
      c.postMessage({ name: 'Team 1', points: 0 });               /* nothing */
      c.postMessage({ name: 'Team 1', points: 5000 });            /* too big */
      c.postMessage({ name: 'Team 1', points: 'lots' });          /* not a number */
      c.postMessage({ team: 7, points: 1 });                      /* no such team */
      c.postMessage('hello'); c.postMessage(null);
      setTimeout(() => c.close(), 300);
    });
    await h.sleep(500);
    const got = (await totalsOf(page)).map(Number);
    h.ok(got[0] === base3[0] + 2 * (4 - 1) && got[1] === base3[1] + 3 && got[2] === base3[2] + 2, 'scoreboard: the buzzer’s points channel adds points by name or position and ignores bad messages', base3.join() + ' -> ' + got.join());

    /* the timer counts from timestamps */
    await page.evaluate((b) => { const i = Array.from(document.querySelectorAll(b + ' input[type=number]')).find((x) => x.min === '5'); i.value = '5'; i.dispatchEvent(new Event('change', { bubbles: true })); }, base);
    await h.sleep(100);
    const clockText = () => page.evaluate((b) => document.querySelector(b + ' .sb-clock-host').textContent, base);
    h.ok((await clockText()) === '0:05', 'scoreboard: the timer is set to 5 seconds');
    await topButton(page, 'Start timer');
    await h.sleep(1700);
    const mid = await clockText();
    const tvClock = await tv.evaluate(() => (document.querySelector('.sb-clock') || {}).textContent);
    h.ok(mid === '0:03' || mid === '0:04', 'scoreboard: the timer shows the time left from the clock', mid);
    h.ok(tvClock === '0:03' || tvClock === '0:04' || tvClock === '0:05', 'scoreboard: the timer runs on the TV too', tvClock);
    await topButton(page, 'Pause timer');
    const paused = await clockText();
    await h.sleep(1100);
    h.ok((await clockText()) === paused, 'scoreboard: pausing holds the time', paused);
    await topButton(page, 'Start timer');
    await h.sleep(paused === '0:04' ? 4300 : 3300);
    const zero = await page.evaluate((b) => ({ c: document.querySelector(b + ' .sb-clock-host').textContent, btn: Array.from(document.querySelectorAll(b + ' .sb-top button')).some((x) => x.textContent === 'Start timer'), note: document.querySelector(b + ' .sb-note').textContent }), base);
    h.ok(zero.c === '0:00' && zero.btn && /Time is up/.test(zero.note), 'scoreboard: the timer reaches zero, stops and says so', JSON.stringify(zero));
    await topButton(page, 'Reset timer');
    h.ok((await clockText()) === '0:05', 'scoreboard: Reset timer goes back to the start');

    /* refresh keeps the game */
    const saved = await totalsOf(page);
    const names = await page.evaluate((b) => Array.from(document.querySelectorAll(b + ' .sb-team input[type=text]')).map((x) => x.value).join(), base);
    await page.evaluate((b) => { const i = document.querySelector(b + ' .sb-team[data-team="1"] input[type=text]'); i.value = 'The Owls'; i.dispatchEvent(new Event('change', { bubbles: true })); }, base);
    await page.reload({ waitUntil: 'load' });
    await h.sleep(300);
    const reloaded = await totalsOf(page);
    const names2 = await page.evaluate((b) => Array.from(document.querySelectorAll(b + ' .sb-team input[type=text]')).map((x) => x.value).join(), base);
    h.ok(reloaded.join() === saved.join() && names2 === names.replace('Team 2', 'The Owls'), 'scoreboard: a refresh keeps the scores, the rounds and the renamed team', saved.join() + ' / ' + names2);
    const rounds = await page.evaluate((b) => document.querySelectorAll(b + ' .sb-table thead th').length, base);
    h.ok(rounds === 4, 'scoreboard: the second round survives the refresh', String(rounds));
    /* the reloaded page is a new window: put the TV's view back to the host */
    await page.bringToFront();

    /* export */
    await page.evaluate(() => { window.__dl = null; window.GameKit.download = function (blob, name) { window.__dl = { blob: blob, name: name }; }; });
    await topButton(page, 'Export CSV');
    const dl = await page.evaluate(async () => (window.__dl ? { name: window.__dl.name, text: await window.__dl.blob.text(), bom: Array.from(new Uint8Array(await window.__dl.blob.arrayBuffer()).slice(0, 3)).join() } : null));
    const exp = dl ? parseCsv(dl.text.replace(/^﻿/, '')) : [];
    const expTotals = exp.slice(1).map((x) => x[x.length - 1]).sort().join();
    h.ok(dl && /^quiz-scores-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.name) && dl.bom === '239,187,191', 'scoreboard: Export CSV names the file by date and starts with a byte-order mark', dl && dl.name);
    h.ok(exp.length === 4 && expTotals === saved.slice().sort().join() && exp[1][exp[1].length - 1] === String(Math.max.apply(null, saved.map(Number))), 'scoreboard: the CSV holds every team’s total, best first', JSON.stringify(exp));

    /* new game asks first */
    await topButton(page, 'New game');
    const asks = await page.evaluate((b) => !document.querySelector(b + ' .sb-sure').hidden, base);
    await topButton(page, 'Keep playing');
    const same = await totalsOf(page);
    h.ok(asks && same.join() === saved.join(), 'scoreboard: New game asks first and Keep playing changes nothing', same.join());
    await topButton(page, 'New game');
    await topButton(page, 'Yes, new game');
    const fresh = await totalsOf(page);
    const names3 = await page.evaluate((b) => Array.from(document.querySelectorAll(b + ' .sb-team input[type=text]')).map((x) => x.value).join(), base);
    h.ok(fresh.every((x) => x === '0') && names3 === names2 && (await page.evaluate((b) => document.querySelectorAll(b + ' .sb-table thead th').length, base)) === 3, 'scoreboard: a new game clears scores and rounds, keeps the names', fresh.join() + ' ' + names3);
    await press(page, 'u');
    h.ok((await totalsOf(page)).join() === saved.join(), 'scoreboard: even a new game can be undone', (await totalsOf(page)).join());

    /* 2 to 12 teams, colours */
    await page.evaluate((b) => { const i = document.querySelector(b + ' input[type=number]'); i.value = '40'; i.dispatchEvent(new Event('change', { bubbles: true })); }, base);
    await h.sleep(150);
    const twelve = await page.evaluate((b) => document.querySelectorAll(b + ' .sb-team').length, base);
    await page.evaluate((b) => { const i = document.querySelector(b + ' input[type=number]'); i.value = '1'; i.dispatchEvent(new Event('change', { bubbles: true })); }, base);
    await h.sleep(150);
    const two = await page.evaluate((b) => document.querySelectorAll(b + ' .sb-team').length, base);
    h.ok(twelve === 12 && two === 2, 'scoreboard: the team count is held to 2..12', twelve + ' / ' + two);
    await page.select(card(0) + ' select', '5');
    await h.sleep(100);
    const col = await page.evaluate((b) => getComputedStyle(document.querySelector(b + ' .sb-team[data-team="0"] .sb-num')).backgroundColor, base);
    const wantCol = await page.evaluate(() => { const d = document.createElement('div'); d.style.color = getComputedStyle(document.querySelector('.game-tool')).getPropertyValue('--t6'); document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; });
    h.ok(col === wantCol, 'scoreboard: a team’s colour comes from the palette (Orange = --t6)', col + ' vs ' + wantCol);

    /* a damaged saved game falls back to a fresh one */
    await page.evaluate((k) => { localStorage.setItem(k, '{"game":{"teams":"x"}}'); }, KEY);
    await page.reload({ waitUntil: 'load' });
    await h.sleep(300);
    h.ok((await page.evaluate((b) => document.querySelectorAll(b + ' .sb-team').length, base)) === 4, 'scoreboard: a damaged saved game is ignored');

    await page.evaluate((k) => { try { localStorage.removeItem(k); } catch (e) { /* none */ } }, KEY);
    await tv.close(); await hub.close();
  },
  landings: {
    'quiz-night-scoreboard': async function (page, h) {
      const r = await page.evaluate(() => document.querySelectorAll('[data-tool="scoreboard"] .sb-team').length);
      h.ok(r === 4, 'scoreboard landing: quiz night opens with four teams', String(r));
      await page.evaluate((k) => { try { localStorage.removeItem(k); } catch (e) { /* none */ } }, KEY);
    },
    'classroom-points-tracker': async function (page, h) {
      const r = await page.evaluate(() => ({ n: document.querySelectorAll('[data-tool="scoreboard"] .sb-team').length, first: document.querySelector('[data-tool="scoreboard"] .sb-team input[type=text]').value }));
      h.ok(r.n === 6 && r.first === 'Group 1', 'scoreboard landing: the classroom tracker opens with six groups', JSON.stringify(r));
      await page.evaluate((k) => { try { localStorage.removeItem(k); } catch (e) { /* none */ } }, KEY);
    }
  }
};
