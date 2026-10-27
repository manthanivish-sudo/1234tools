/* The Category Quiz Board, for build/tests/games.js. Expected values are
   worked out by hand from the rules the page states (rows worth 100, 200, …;
   the double scores twice; a wrong answer takes the value off when chosen),
   and the double square's draw is held to a uniform distribution by
   chi-square, not to the engine's own output. */
'use strict';

const SLUG = 'category-board';

module.exports = {
  check: async function (page, h) {
    /* the rules */
    const m = await page.evaluate(() => {
      const M = window.GAME_TOOLS['category-board'].maths, K = window.GameKit;
      const out = {};
      out.values = [0, 1, 2, 3, 4, 5].map(M.value).join();
      out.cell = [M.cellOf(0, 5), M.cellOf(7, 5), M.cellOf(24, 5)].map((c) => c.col + ':' + c.row).join();
      /* the double: 5 × 5 board, 50 000 draws; and a 3 × 6 board */
      const c25 = new Array(25).fill(0);
      for (let i = 0; i < 50000; i++) c25[M.drawDouble(5, 5, K.randInt)]++;
      const c18 = new Array(18).fill(0);
      for (let i = 0; i < 36000; i++) c18[M.drawDouble(3, 6, K.randInt)]++;
      out.c25 = c25; out.c18 = c18;
      /* a 3 × 3 game, double on square 4 (middle column, 200):
         square 0 (100): Red right +100, Blue wrong −100
         square 4 (200, double): Blue right +400
         square 8 (300): Red wrong −300
         hand adjustment: Red +100
         → Red 100 − 300 + 100 = −100 ; Blue −100 + 400 = 300 */
      const g = { teams: ['Red', 'Blue'], cols: 3, rows: 3, dbl: 4, marks: { 0: [1, -1], 4: [0, 1], 8: [-1, 0] }, adjust: [100] };
      out.scores = M.scores(g).join();
      out.stand = M.standings(g).map((t) => t.name + ':' + t.rank).join();
      out.tie = M.standings({ teams: ['A', 'B', 'C'], cols: 3, dbl: 0, marks: { 1: [1, 1, 0] } }).map((t) => t.name + t.rank).join();
      out.words = [M.boardWords('Round 2, question 3: the answer is empty.'), M.boardWords('Round 1: the round needs a name.')];
      return out;
    });
    h.ok(m.values === '100,200,300,400,500,600', 'board: rows are worth 100 to 600', m.values);
    h.ok(m.cell === '0:0,2:1,4:4', 'board: squares are numbered across, then down', m.cell);
    const chi25 = h.chiSquare(m.c25), chi18 = h.chiSquare(m.c18);
    h.ok(chi25 < h.CHI_001[24], 'board: the double square is drawn uniformly on a 5 × 5 board (chi² ' + chi25.toFixed(1) + ')');
    h.ok(chi18 < h.CHI_001[17], 'board: the double square is drawn uniformly on a 3 × 6 board (chi² ' + chi18.toFixed(1) + ')');
    h.ok(m.scores === '-100,300', 'board: right, wrong, the double and a hand change add up', m.scores);
    h.ok(m.stand === 'Blue:1,Red:2' && m.tie === 'A1,B1,C3', 'board: standings share a tied place', m.stand + ' ' + m.tie);
    h.ok(m.words[0] === 'Category 2, 300: the answer is empty.' && m.words[1] === 'Category 1: the category needs a name.', 'board: problems are named by category and value', m.words.join(' | '));

    /* a new board names its empty squares */
    await page.waitForFunction(() => document.querySelector('[data-tool="category-board"]').categoryBoard.rec);
    const empty = await page.evaluate(() => Array.from(document.querySelectorAll('.cb-build .qz-errors li')).map((l) => l.textContent));
    h.ok(empty[0] === 'Category 1, 100: the question is empty.', 'board: an empty board lists what to fill', empty[0]);

    /* building: 3 × 3, typed in the page, kept after a reload */
    const typeIn = async (sel, i, text) => { const els = await page.$$(sel); await els[i].focus(); await els[i].evaluate((x) => x.select()); await els[i].type(text); };
    await typeIn('.cb-cat > .game-field input', 4, 'Zebra');
    await page.select('.cb-build .game-row select', '3');
    await page.evaluate(() => { const s = document.querySelectorAll('.cb-build .game-row select')[1]; s.value = '3'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await h.sleep(100);
    const shape = await page.evaluate(() => ({ cats: document.querySelectorAll('.cb-cat').length, sq: document.querySelectorAll('.cb-sq').length }));
    h.ok(shape.cats === 3 && shape.sq === 9, 'board: 3 categories × 3 rows shows 9 squares to fill', JSON.stringify(shape));
    await typeIn('.cb-cat > .game-field input', 0, 'Animals');
    await typeIn('.cb-sq textarea', 0, 'Which animal says moo?');
    await typeIn('.cb-sq .cb-answer', 0, 'A cow');
    await page.evaluate(() => document.querySelector('[data-tool="category-board"]').categoryBoard.flush());
    await h.sleep(500);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('[data-tool="category-board"]').categoryBoard.rec);
    const kept = await page.evaluate(() => ({ name: document.querySelector('.cb-cat > .game-field input').value, q: document.querySelector('.cb-sq textarea').value, a: document.querySelector('.cb-sq .cb-answer').value, sq: document.querySelectorAll('.cb-sq').length }));
    h.ok(kept.name === 'Animals' && kept.q === 'Which animal says moo?' && kept.a === 'A cow' && kept.sq === 9, 'board: what was typed is still there after a reload', JSON.stringify(kept));
    /* the fifth category was hidden, not lost: five across brings its name back */
    await page.select('.cb-build .game-row select', '5');
    const fifth = await page.evaluate(() => (document.querySelectorAll('.cb-cat > .game-field input')[4] || {}).value);
    h.ok(fifth === 'Zebra', 'board: a smaller board keeps the hidden squares for later', fifth);

    /* play: a known 3 × 3 board, two teams, minus on */
    await page.evaluate(async () => {
      const C = window.QuizCore;
      const cat = (name, k) => ({ name, questions: [1, 2, 3].map((i) => ({ type: 'text', prompt: name + ' question ' + i + '?', answer: name + ' answer ' + i, note: k && i === 1 ? 'Note ' + name : undefined })) });
      await C.store.putQuiz({ id: 'board-test', kind: 'board', cols: 3, rows: 3, quiz: { v: 1, title: 'Board test', rounds: [cat('Alpha', true), cat('Beta'), cat('Gamma')] } });
      localStorage.setItem('mvr-games-category-board-v1', JSON.stringify({ current: 'board-test', tab: 1, teams: 'Red\nBlue', minus: true }));
    });
    await page.reload({ waitUntil: 'load' });
    await h.sleep(500);
    const stage = await h.openStage(SLUG);
    await page.bringToFront();
    await clickText(page, '.qz-setup button', 'Start the game');
    await h.sleep(300);
    const dbl = await page.evaluate(() => document.querySelector('[data-tool="category-board"]').categoryBoard.game.dbl);
    const tv1 = await stage.evaluate(() => ({ cats: Array.from(document.querySelectorAll('.st-cb-cat')).map((c) => c.textContent).join(), cells: Array.from(document.querySelectorAll('.st-cb-cell')).map((c) => c.textContent).join() }));
    h.ok(tv1.cats === 'Alpha,Beta,Gamma' && tv1.cells === '100,100,100,200,200,200,300,300,300', 'board play: the TV shows the categories and values', JSON.stringify(tv1));
    h.ok(Number.isInteger(dbl) && dbl >= 0 && dbl < 9, 'board play: a double square is drawn among the 9', String(dbl));

    /* a plain square: Beta for 200 is square 4, unless that is the double */
    const plain = dbl === 4 ? 3 : 4;
    const pc = plain % 3, pr = Math.floor(plain / 3), pv = (pr + 1) * 100, pname = ['Alpha', 'Beta', 'Gamma'][pc];
    await page.click('.cb-sq-btn[data-idx="' + plain + '"]');
    await h.sleep(300);
    const tv2 = await stage.evaluate(() => ({ p: (document.querySelector('.st-qz-prompt') || {}).textContent, ans: !!document.querySelector('.st-qz-answer'), body: document.querySelector('.game-stage-body').textContent }));
    const hostAns = await page.evaluate(() => (document.querySelector('.qz-pres-ans') || {}).textContent || '');
    h.ok(tv2.p === pname + ' question ' + (pr + 1) + '?' && !tv2.ans && tv2.body.indexOf(pname + ' answer') < 0, 'board play: the TV shows the question and not the answer', JSON.stringify(tv2.p));
    h.ok(hostAns.indexOf(pname + ' answer ' + (pr + 1)) >= 0, 'board play: the host sees the answer before Reveal', hostAns);
    await page.keyboard.press('1');
    await page.keyboard.press('r');
    await h.sleep(300);
    const tv3 = await stage.evaluate(() => (document.querySelector('.st-qz-answer') || {}).textContent || '');
    h.ok(tv3.indexOf(pname + ' answer ' + (pr + 1)) >= 0, 'board play: Reveal (R) shows the answer on the TV', tv3);
    await page.keyboard.press('b');
    await h.sleep(300);
    const after1 = await page.evaluate((i) => ({ dis: document.querySelector('.cb-sq-btn[data-idx="' + i + '"]').disabled, scores: Array.from(document.querySelectorAll('.qz-teamrow')).map((r) => r.querySelector('.qz-team-score').textContent).join() }), plain);
    const tvUsed = await stage.evaluate((i) => document.querySelectorAll('.st-cb-cell')[i].classList.contains('is-used'), plain);
    h.ok(after1.dis && tvUsed, 'board play: Back to board (B) greys the square out on both screens');
    h.ok(after1.scores === pv + ',0', 'board play: key 1 gave Red the square’s value', after1.scores);

    /* the double: the TV says so first, then the question; Blue wrong takes off twice the value */
    const dv = (Math.floor(dbl / 3) + 1) * 100;
    await page.click('.cb-sq-btn[data-idx="' + dbl + '"]');
    await h.sleep(300);
    const tv4 = await stage.evaluate(() => ({ big: (document.querySelector('.st-cb-double') || {}).textContent, x2: (document.querySelector('.st-cb-x2') || {}).textContent, prompt: !!document.querySelector('.st-qz-prompt') }));
    h.ok(tv4.big === 'Double points!' && tv4.x2 === dv + ' × 2 = ' + (dv * 2) && !tv4.prompt, 'board play: the double square is announced before its question', JSON.stringify(tv4));
    await page.keyboard.press('Enter');
    await h.sleep(300);
    h.ok(await stage.evaluate(() => !!document.querySelector('.st-qz-prompt')), 'board play: Enter shows the double’s question');
    await clickText(page, '.cb-wrong', '−' + (dv * 2), 1);
    await h.sleep(200);
    await page.keyboard.press('b');
    await h.sleep(200);
    const sc2 = await page.evaluate(() => Array.from(document.querySelectorAll('.qz-teamrow .qz-team-score')).map((e) => e.textContent).join());
    h.ok(sc2 === pv + ',' + (-2 * dv), 'board play: a wrong answer on the double takes off twice the value', sc2);
    await page.keyboard.press('s');
    await h.sleep(300);
    const tvS = await stage.evaluate(() => Array.from(document.querySelectorAll('.st-qz-score')).map((r) => r.querySelector('.st-qz-name').textContent + ':' + r.querySelector('.st-qz-pts').textContent).join());
    h.ok(tvS === 'Red:' + pv + ',Blue:' + (-2 * dv), 'board play: Show scores (S) puts the standings on the TV', tvS);
    await page.keyboard.press('s');

    /* every other square, then the final scores */
    for (let i = 0; i < 9; i++) {
      if (i === plain || i === dbl) continue;
      await page.click('.cb-sq-btn[data-idx="' + i + '"]');
      await h.sleep(60);
      await page.keyboard.press('b');
      await h.sleep(60);
    }
    await h.sleep(300);
    const fin = await stage.evaluate(() => ({ title: (document.querySelector('.st-title') || {}).textContent, win: (document.querySelector('.st-qz-score.is-win .st-qz-name') || {}).textContent }));
    h.ok(fin.title === 'Final scores' && fin.win === 'Red', 'board play: the last square ends on the final scores', JSON.stringify(fin));
    await stage.close();

    /* print */
    const pr2 = await page.evaluate(() => {
      const M = window.GAME_TOOLS['category-board'].maths;
      const rec = document.querySelector('[data-tool="category-board"]').categoryBoard.rec;
      const b = M.printDoc(rec, 'board'), hs = M.printDoc(rec, 'host');
      return { rows: b.querySelectorAll('tr').length, th: b.querySelectorAll('th').length, leak: /question|answer/.test(b.textContent), host: /Gamma answer 3/.test(hs.textContent) && /Note Alpha/.test(hs.textContent) };
    });
    h.ok(pr2.rows === 4 && pr2.th === 3 && !pr2.leak, 'board print: the board is the categories and values only', JSON.stringify(pr2));
    h.ok(pr2.host, 'board print: the host’s sheet has every answer and note');
  },
  landings: {
    'classroom-review-game-board': async function (page, h) {
      await page.waitForFunction(() => { const r = document.querySelector('[data-tool="category-board"]').categoryBoard; return r && r.rec; });
      const r = await page.evaluate(() => ({ t: document.querySelector('.cb-build input[type=text]').value, cats: Array.from(document.querySelectorAll('.cb-cat > .game-field input')).map((i) => i.value).join(), sq: document.querySelectorAll('.cb-sq').length }));
      h.ok(r.t === 'Class Review' && r.cats === 'Topic 1,Topic 2,Topic 3,Topic 4,Topic 5' && r.sq === 25, 'board landing: the classroom board opens with five topics and 25 squares', JSON.stringify(r));
    }
  }
};

async function clickText(page, sel, text, nth) {
  const list = await page.$$(sel);
  let seen = 0;
  for (const b of list) {
    if ((await b.evaluate((x) => x.textContent.trim())).indexOf(text) >= 0 && seen++ === (nth || 0)) { await b.click(); return true; }
  }
  throw new Error('no button "' + text + '" in ' + sel);
}
