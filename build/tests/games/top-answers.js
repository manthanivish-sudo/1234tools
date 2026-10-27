/* The Top Answers Survey Game, for build/tests/games.js. The rules (strikes,
   the steal, who wins the points on the board) are worked out by hand from
   what the page says, then played through on the host page and the TV. */
'use strict';

const SLUG = 'top-answers';
const Q1 = { type: 'survey', prompt: 'Name something you take to the beach.', answer: [
  { text: 'Towel', points: 30 }, { text: 'Sun cream', points: 24, accept: ['Suncream', 'Sunscreen'] }, { text: 'Swimsuit', points: 18 },
  { text: 'Bucket and spade', points: 12 }, { text: 'Sunglasses', points: 9 }, { text: 'Beach umbrella', points: 7 }] };
const Q2 = { type: 'survey', prompt: 'Name a farm animal.', answer: [{ text: 'Cow', points: 40 }, { text: 'Pig', points: 30 }, { text: 'Sheep', points: 20 }, { text: 'Hen', points: 10, accept: ['Chicken'] }] };

module.exports = {
  check: async function (page, h) {
    /* the rules, by hand */
    const r = await page.evaluate((q1, q2) => {
      const M = window.GAME_TOOLS['top-answers'].maths;
      const out = {};
      let g = M.newGame(['A', 'B'], 2, 6);
      const g0 = JSON.stringify(g);
      out.start = [g.playing, g.phase, g.revealed.length, g.bank].join();
      const before = g;
      g = M.act(g, q1, { t: 'reveal', i: 0 });                 /* A finds Towel: 30 on the board */
      out.immutable = JSON.stringify(before) === g0 && g.bank === 30;
      out.noSwitch = M.act(g, q1, { t: 'switch' }).playing;    /* too late to switch: still A (0) */
      g = M.act(g, q1, { t: 'guess', found: -1 });              /* a wrong guess is a strike */
      g = M.act(g, q1, { t: 'strike' });
      out.two = [g.strikes, g.phase].join();
      g = M.act(g, q1, { t: 'strike' });
      out.steal = [g.strikes, g.phase].join();
      const missed = M.act(g, q1, { t: 'strike' });             /* steal missed: A keep 30 */
      out.missed = [missed.phase, missed.winner, missed.scores.join('/')].join();
      g = M.act(g, q1, { t: 'reveal', i: 2 });                 /* B steal with Swimsuit: 30 + 18 = 48 to B */
      out.stolen = [g.phase, g.winner, g.bank, g.scores.join('/')].join();
      const late = M.act(g, q1, { t: 'reveal', i: 5 });         /* after the round: shown, no points */
      out.late = [late.revealed[5], late.bank, late.scores.join('/')].join();
      out.noStrike = M.act(g, q1, { t: 'strike' }).strikes;     /* no strikes after the round */
      g = M.act(g, q1, { t: 'rest' });
      out.rest = g.revealed.join('');
      g = M.act(g, q1, { t: 'next', n: 4 });
      out.next = [g.qi, g.playing, g.phase, g.bank, g.strikes, g.revealed.length].join();
      const sw = M.act(g, q2, { t: 'switch' });
      out.sw = sw.playing;
      for (let i = 0; i < 4; i++) g = M.act(g, q2, { t: 'reveal', i });  /* B clear the board: 100 */
      out.clear = [g.phase, g.winner, g.scores.join('/')].join();
      g = M.act(g, q2, { t: 'next', n: 0 });
      out.end = g.phase;
      return out;
    }, Q1, Q2);
    h.ok(r.start === '0,play,6,0' && r.immutable, 'top answers: team 1 starts, six hidden answers, nothing on the board', r.start);
    h.ok(r.noSwitch === 0, 'top answers: the team cannot be switched after the first guess');
    h.ok(r.two === '2,play' && r.steal === '3,steal', 'top answers: three strikes hand over the steal', r.two + ' ' + r.steal);
    h.ok(r.missed === 'done,0,30/0', 'top answers: a missed steal leaves the points with the playing team', r.missed);
    h.ok(r.stolen === 'done,1,48,0/48', 'top answers: a steal takes the board plus the answer found (30 + 18)', r.stolen);
    h.ok(r.late === '2,48,0/48' && r.noStrike === 3, 'top answers: answers shown after the round score nothing', r.late);
    h.ok(r.rest === '121222', 'top answers: Reveal the rest shows the unfound answers', r.rest);
    h.ok(r.next === '1,1,play,0,0,4' && r.sw === 0, 'top answers: the next question swaps the playing team and clears the board', r.next);
    h.ok(r.clear === 'done,1,0/148' && r.end === 'end', 'top answers: clearing the board wins it; the game ends after the last question', r.clear + ' ' + r.end);

    /* building: the example question is labelled, a half-made question is named */
    await page.waitForFunction(() => { const x = document.querySelector('[data-tool="top-answers"]').topAnswers; return x && x.rec; });
    const b0 = await page.evaluate(() => ({ ok: (document.querySelector('.ta-build .qz-ok') || {}).textContent, ex: !document.querySelector('.ta-build .game-panel .game-msg').hidden && /made up/.test(document.querySelector('.ta-build .game-panel .game-msg').textContent) }));
    h.ok(b0.ok === '1 question — ready to play.' && b0.ex, 'top answers: a new game has one example question, labelled as made up', JSON.stringify(b0));
    await clickText(page, '.ta-build button', 'Add question');
    await h.sleep(100);
    const b1 = await page.evaluate(() => Array.from(document.querySelectorAll('.ta-build .qz-errors li')).map((l) => l.textContent));
    h.ok(b1[0] === 'Question 2: the question is empty.' && b1[1] === 'Question 2: a survey question needs 4 to 8 answers, each with points.', 'top answers: problems are named by question', b1.join(' | '));
    /* points typed out of order, then Sort by points */
    await page.evaluate(() => {
      const card = document.querySelectorAll('.ta-q')[1];
      const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
      set(card.querySelector('textarea'), 'Name a colour.');
      const texts = card.querySelectorAll('.ta-ans-text'), pts = card.querySelectorAll('.ta-ans-pts');
      ['Blue', 'Red', 'Green', 'Pink'].forEach((t, i) => { set(texts[i], t); set(pts[i], [10, 40, 30, 20][i]); });
    });
    await h.sleep(100);
    const b2 = await page.evaluate(() => (document.querySelector('.ta-build .qz-errors li') || {}).textContent);
    h.ok(/most popular first/.test(b2 || ''), 'top answers: points that go up are refused', b2);
    await clickText(page, '.ta-q:nth-child(2) button', 'Sort by points');
    await h.sleep(100);
    const b3 = await page.evaluate(() => ({ ok: (document.querySelector('.ta-build .qz-ok') || {}).textContent, order: Array.from(document.querySelectorAll('.ta-q')[1].querySelectorAll('.ta-ans-text')).map((i) => i.value).join() }));
    h.ok(b3.ok === '2 questions — ready to play.' && b3.order === 'Red,Green,Pink,Blue', 'top answers: Sort by points puts the most popular first', JSON.stringify(b3));

    /* play on the host page and the TV */
    await page.evaluate(async (q1, q2) => {
      await window.QuizCore.store.putQuiz({ id: 'ta-test', kind: 'survey', quiz: { v: 1, title: 'Survey test', rounds: [{ name: 'Questions', questions: [q1, q2] }] } });
      localStorage.setItem('mvr-games-top-answers-v1', JSON.stringify({ current: 'ta-test', tab: 1, teams: ['Red', 'Blue'] }));
    }, Q1, Q2);
    await page.reload({ waitUntil: 'load' });
    await h.sleep(500);
    const stage = await h.openStage(SLUG);
    await page.bringToFront();
    await clickText(page, '.qz-setup button', 'Start the game');
    await h.sleep(300);
    const tv = () => stage.evaluate(() => ({
      prompt: (document.querySelector('.st-ta-prompt') || {}).textContent,
      slots: Array.from(document.querySelectorAll('.st-ta-slot')).map((s) => s.querySelector('.st-ta-text').textContent + (s.classList.contains('is-late') ? '*' : '')).join('|'),
      bank: (document.querySelector('.st-ta-banknum') || {}).textContent,
      x: document.querySelectorAll('.st-ta-strikes i.is-on').length,
      big: (document.querySelector('.st-ta-x') || {}).textContent || '',
      turn: (document.querySelector('.st-ta-team.is-turn .st-ta-tname') || {}).textContent || '',
      status: (document.querySelector('.st-ta-status') || {}).textContent || '',
      body: document.querySelector('.game-stage-body').textContent
    }));
    let t = await tv();
    h.ok(t.prompt === Q1.prompt && t.slots === '|||||' && t.bank === '0' && /Red/.test(t.turn), 'top answers TV: the question, six hidden answers, Red to play', JSON.stringify(t).slice(0, 160));
    h.ok(!/Towel|Sun cream/.test(t.body), 'top answers TV: no answer shows before it is found');
    await page.keyboard.press('1');
    await page.type('.ta-guess-in', 'sunscreen');
    await page.keyboard.press('Enter');
    await h.sleep(250);
    t = await tv();
    h.ok(t.slots === 'Towel|Sun cream||||' && t.bank === '54', 'top answers TV: key 1 and a typed “sunscreen” reveal Towel and Sun cream (54)', t.slots + ' ' + t.bank);
    await page.type('.ta-guess-in', 'Kite');
    await page.keyboard.press('Enter');
    await h.sleep(150);
    t = await tv();
    h.ok(t.x === 1 && t.big === '✕', 'top answers TV: a wrong guess shows the big X and one strike', t.x + ' ' + t.big);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('x');
    await page.keyboard.press('x');
    await h.sleep(250);
    t = await tv();
    h.ok(t.x === 3 && /Blue can steal/.test(t.status) && /Blue/.test(t.turn), 'top answers TV: three strikes and Blue can steal', t.status);
    await page.keyboard.press('5');
    await h.sleep(200);
    const sc = () => page.evaluate(() => Array.from(document.querySelectorAll('.qz-teamrow')).map((x) => x.querySelector('.qz-team-name').textContent + ':' + x.querySelector('.qz-team-score').textContent).join());
    h.ok((await sc()) === 'Red:0,Blue:63', 'top answers: Blue steal with Sunglasses: 54 + 9', await sc());
    await page.keyboard.press('u');
    await h.sleep(150);
    await page.keyboard.press('x');
    await h.sleep(250);
    t = await tv();
    h.ok((await sc()) === 'Red:54,Blue:0' && /Red win 54/.test(t.status), 'top answers: Undo, then a missed steal leaves Red the 54', (await sc()) + ' ' + t.status);
    await clickText(page, '.qz-pres-ctl button', 'Reveal the rest');
    await h.sleep(250);
    t = await tv();
    h.ok(t.slots === 'Towel|Sun cream|Swimsuit*|Bucket and spade*|Sunglasses*|Beach umbrella*', 'top answers TV: Reveal the rest shows the others, marked as not found', t.slots);
    await page.keyboard.press('ArrowRight');
    await h.sleep(250);
    t = await tv();
    h.ok(t.prompt === Q2.prompt && t.slots === '|||' && /Blue/.test(t.turn) && t.x === 0, 'top answers TV: question 2, Blue to play, no strikes', JSON.stringify([t.prompt, t.turn, t.x]));
    for (const k of ['1', '2', '3', '4']) await page.keyboard.press(k);
    await h.sleep(200);
    h.ok((await sc()) === 'Red:54,Blue:100', 'top answers: Blue clear the board for 100', await sc());
    await page.keyboard.press('ArrowRight');
    await h.sleep(300);
    const fin = await stage.evaluate(() => ({ title: (document.querySelector('.st-title') || {}).textContent, win: (document.querySelector('.st-qz-score.is-win .st-qz-name') || {}).textContent }));
    h.ok(fin.title === 'Final scores' && fin.win === 'Blue', 'top answers TV: the final scores after the last question', JSON.stringify(fin));
    await stage.close();

    /* print */
    const pr = await page.evaluate((q1) => {
      const M = window.GAME_TOOLS['top-answers'].maths;
      const quiz = { v: 1, title: 'P', rounds: [{ name: 'Q', questions: [q1] }] };
      const host = M.printDoc(quiz, 'host'), sheet = M.printDoc(quiz, 'survey');
      return { host: /Towel — 30/.test(host.textContent) && /Beach umbrella — 7/.test(host.textContent), sheetLeak: /Towel|30/.test(sheet.textContent), lines: sheet.querySelectorAll('.qz-print-lines li').length };
    }, Q1);
    h.ok(pr.host, 'top answers print: the host’s sheet lists the answers and points');
    h.ok(!pr.sheetLeak && pr.lines === 6, 'top answers print: the survey sheet has the question and tally lines only', JSON.stringify(pr));

    /* ready-made survey questions: the button appears only when the pack index lists some */
    const noBtn = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.qz-top button')).find((x) => /Ready-made/.test(x.textContent)); return !b || b.hidden; });
    h.ok(noBtn, 'top answers: no ready-made button while no pack has survey questions');
    const pack = { v: 1, id: 'test-survey', title: 'Test Survey Pack', ages: '8+', region: 'global', count: 2, reviewed: null, sources: ['https://example.org/'],
      rounds: [{ name: 'Mixed', questions: [Object.assign({ source: 'https://example.org/q2' }, Q2), { type: 'text', prompt: 'Capital of Japan?', answer: 'Tokyo', source: 'https://example.org/jp' }] }] };
    const idx = { v: 1, packs: [{ id: 'test-survey', title: 'Test Survey Pack', ages: '8+', region: 'global', count: 2, types: { survey: 1, text: 1 }, reviewed: null }] };
    const pp = await h.open('/games/top-answers/');
    await pp.setBypassServiceWorker(true);
    await pp.setRequestInterception(true);
    pp.on('request', (req) => {
      const u = req.url();
      if (/\/games\/packs\/index\.json$/.test(u)) req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(idx) });
      else if (/\/games\/packs\/test-survey\.json$/.test(u)) req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(pack) });
      else req.continue();
    });
    await pp.reload({ waitUntil: 'load' });
    await h.sleep(600);
    await clickText(pp, '.qz-top button', 'Ready-made questions');
    await h.sleep(300);
    await clickText(pp, '.qz-pack-list button', 'Test Survey Pack');
    await h.sleep(500);
    const op = await pp.evaluate(() => ({ title: document.querySelector('.ta-build input[type=text]').value, qs: Array.from(document.querySelectorAll('.ta-q textarea')).map((x) => x.value).join('|'), msg: document.querySelector('.qz-top .game-msg').textContent }));
    h.ok(op.title === 'Test Survey Pack' && op.qs === Q2.prompt && /Opened the survey questions/.test(op.msg), 'top answers: a pack’s survey questions (and only those) open as a game', JSON.stringify(op));
    await pp.close();
  },
  landings: {
    'family-survey-game': async function (page, h) {
      await page.waitForFunction(() => { const x = document.querySelector('[data-tool="top-answers"]').topAnswers; return x && x.rec; });
      const r = await page.evaluate(() => ({ t: document.querySelector('.ta-build input[type=text]').value, teams: Array.from(document.querySelectorAll('.ta-team-in')).map((i) => i.value).join() }));
      h.ok(r.t === 'Family Survey Game' && r.teams === 'Kids,Grown-ups', 'top answers landing: the family game opens with Kids against Grown-ups', JSON.stringify(r));
    }
  }
};

async function clickText(page, sel, text) {
  const list = await page.$$(sel);
  for (const b of list) { if ((await b.evaluate((x) => x.textContent.trim())).indexOf(text) >= 0) { await b.click(); return true; } }
  throw new Error('no button "' + text + '" in ' + sel);
}
