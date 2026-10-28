/* The Quiz Maker & Host and the shared quiz core (engine/game-quiz-core.js),
   for build/tests/games.js. Every expected value below is worked out by hand
   from the rules the page states, not taken from the engine's output. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

/* typed answers: [given, right answer, accepted variants, expected] */
const TEXT_CASES = [
  ['the beatles', 'The Beatles', [], true],          /* case */
  ['Beatles', 'The Beatles', [], true],              /* article dropped */
  ['an apple', 'Apple', [], true],
  ['Beatels', 'The Beatles', [], true],              /* swapped pair = 1 slip, 7 letters */
  ['Paris', 'Paris', [], true],
  ['Prais', 'Paris', [], true],                      /* 5 letters: 1 slip */
  ['Rome', 'Roma', [], false],                       /* 4 letters: no slips */
  ['São Paulo', 'Sao Paulo', [], true],              /* accents */
  ['ZOË', 'Zoe', [], true],
  ['Shakespeare!!', 'Shakespeare', [], true],        /* punctuation */
  ['Shakespear', 'Shakespeare', [], true],           /* 11 letters: 1 of 2 */
  ['Shakspar', 'Shakespeare', [], false],            /* 3 slips */
  ['Tchiakovksy', 'Tchaikovsky', [], true],          /* two swaps = 2 slips, 11 letters */
  ['Tchiakvoksy', 'Tchaikovsky', [], false],         /* 3 slips */
  ['Misisipi', 'Mississippi', [], false],            /* 3 missing letters */
  ['Mississipi', 'Mississippi', [], true],
  ['Tokio', 'Tokyo', ['Tokio'], true],               /* accepted variant */
  ['Kyoto', 'Tokyo', [], false],
  ['1067', '1066', [], false],                       /* digits exact */
  ['eight', '8', [], true],                          /* one-word number */
  ['Rock & Roll', 'Rock and Roll', [], true],
  ["O'Neill", 'ONeill', [], true],
  ['New York', 'new-york', [], true],
  ['', 'Paris', [], false]
];
/* numbers: [given, answer, tolerance, expected] */
const NUM_CASES = [
  ['1,066', 1066, 0, true], ['1 066', 1066, 0, true], ['1065', 1066, 0, false],
  ['47', 50, 3, true], ['46', 50, 3, false], ['53', 50, 3, true],
  ['twenty-one', 21, 0, true], ['a hundred and five', 105, 0, true], ['2.5 million', 2500000, 0, true],
  ['-3.5', -3.5, 0, true], ['about 8 legs', 8, 0, true], ['none', 8, 0, false]
];

function q(type, extra) { return Object.assign({ type: type, prompt: 'P ' + type + ' ' + Math.round(Math.random() * 1e9) }, extra); }

module.exports = {
  check: async function (page, h) {
    const core = await page.evaluate((T, N) => {
      const C = window.QuizCore;
      const out = {};
      out.text = T.map((c) => C.checkText(c[0], c[1], c[2]).ok);
      out.num = N.map((c) => C.checkNumber(c[0], c[1], c[2]).ok);
      out.closest = C.closest([{ team: 'A', value: '40' }, { team: 'B', value: '55' }, { team: 'C', value: '45' }], 50);
      out.mcq = [C.check({ type: 'mcq', options: ['x', 'y'], answer: 'y' }, 1).ok, C.check({ type: 'mcq', options: ['x', 'y'], answer: 'y' }, 0).ok, C.check({ type: 'tf', answer: false }, 'no').ok];
      out.order = C.check({ type: 'order', answer: ['a', 'b', 'c'] }, ['a', 'c', 'b']);
      /* speed bonus: 10 points, 20 s, answered at 5 s → 10 + round(10 × 0.5 × 0.75) = 14 */
      out.speed = C.pointsFor({ points: 10, time: 20 }, { ok: true, ms: 5000 }, { speed: true });
      out.slow = C.pointsFor({ points: 10, time: 20 }, { ok: true, ms: 25000 }, { speed: true });
      /* validator: one problem of each kind, each named by place */
      const bad = { v: 1, title: 'Bad', rounds: [
        { name: 'One', questions: [
          { type: 'mcq', prompt: 'Planet?', options: ['Mars', 'Venus', 'mars'], answer: 'Pluto' },
          { type: 'tf', prompt: 'Sky blue?', answer: 'yes' }] },
        { name: 'Two', questions: [{ type: 'number', prompt: 'Legs?', answer: 'eight' }, { type: 'picture', prompt: 'Who?', answer: 'Me' }] },
        { name: '', questions: [] }] };
      out.errors = C.validate(bad).errors;
      out.draftErrors = C.validate(bad, { draft: true }).errors.length;
      const pack = { v: 1, id: 'x-pack', title: 'X', ages: '8+', region: 'global', count: 1, reviewed: null, sources: [],
        rounds: [{ name: 'R', questions: [{ type: 'text', prompt: 'Capital of Japan?', answer: 'Tokyo', source: 'https://example.org/japan' }] }] };
      out.packStrict = C.validatePack(pack, { strict: true }).errors;
      out.packLoose = C.validatePack(pack).errors.length;
      /* the host engine: no answer in what the screens get; late answers refused; the joker doubles a round */
      let t = 1000;
      const quiz = { v: 1, title: 'G', rounds: [
        { name: 'R1', questions: [{ type: 'text', prompt: 'Capital of France?', answer: 'Paris', time: 10, points: 2 }, { type: 'number', prompt: 'Legs on a spider?', answer: 8 }] },
        { name: 'R2', questions: [{ type: 'tf', prompt: 'Ice floats.', answer: true }] }] };
      const g = C.createGame(quiz, { teams: ['Red', 'Blue', 'Green'], clock: () => t, closest: true });
      const pq = g.publicQuestion();
      out.pqKeys = Object.keys(pq).sort().join();
      out.pqLeak = JSON.stringify(pq).indexOf('Paris') >= 0;
      out.sub = [g.submit({ team: 'Red', value: 'paris', at: 3000 }).accepted, g.submit({ team: 'Blue', value: 'Pariss', at: 4000 }).accepted,
        g.submit({ team: 'Green', value: 'Paris', at: 11600 }).reason, g.submit({ team: 'Nobody', value: 'x' }).reason];
      g.reveal();
      out.afterReveal = g.submit({ team: 'Green', value: 'Paris', at: 3000 }).reason;
      g.next();
      g.submit({ team: 'Red', value: '10', at: t }); g.submit({ team: 'Blue', value: '7', at: t }); g.submit({ team: 'Green', value: '6', at: t });
      g.reveal(); /* closest: Blue (off by 1) */
      g.next();
      out.joker = g.playJoker('Green', 1).ok;
      g.mark('Green', true); g.mark('Red', true);
      out.jokerAgain = g.playJoker('Green', 0).ok; /* round 2 already scored with it */
      out.scores = g.standings().map((x) => x.name + ':' + x.score + ':' + x.rank).join();
      out.end = [g.next(), g.phase];
      return out;
    }, TEXT_CASES, NUM_CASES);
    const textBad = TEXT_CASES.filter((c, i) => core.text[i] !== c[3]).map((c) => c[0] + '→' + c[1]);
    h.ok(textBad.length === 0, 'quiz: typed answers match ' + TEXT_CASES.length + ' hand-worked cases', textBad.join(' | '));
    const numBad = NUM_CASES.filter((c, i) => core.num[i] !== c[3]).map((c) => c[0]);
    h.ok(numBad.length === 0, 'quiz: numbers match ' + NUM_CASES.length + ' hand-worked cases (tolerance, words, separators)', numBad.join(' | '));
    h.ok(core.closest.winners.join() === 'B,C' && core.closest.diff === 5, 'quiz: closest wins shares a tie', JSON.stringify(core.closest));
    h.ok(core.mcq.join() === 'true,false,true', 'quiz: multiple choice by index, true/false by word', core.mcq.join());
    h.ok(core.order.ok === false && core.order.right === 1, 'quiz: put-in-order counts the right places', JSON.stringify(core.order));
    h.ok(core.speed === 14 && core.slow === 10, 'quiz: speed bonus falls in a straight line', core.speed + ' ' + core.slow);
    const want = [
      'Round 1, question 1: the option “mars” appears twice.',
      'Round 1, question 1: the answer “Pluto” is not one of the options.',
      'Round 1, question 2: a true-or-false answer must be true or false.',
      'Round 2, question 1: the answer must be a number.',
      'Round 2, question 2: a picture question needs a picture.',
      'Round 3: the round needs a name.',
      'Round 3: the round has no questions.'
    ];
    h.ok(JSON.stringify(core.errors) === JSON.stringify(want), 'quiz: the validator names each problem by round and question', core.errors.join(' | '));
    h.ok(core.draftErrors === 6, 'quiz: a draft may wait for its picture', String(core.draftErrors));
    h.ok(core.packStrict.length === 1 && /reviewed/.test(core.packStrict[0]) && core.packLoose === 0, 'quiz: a pack needs its reviewed date for the build check', core.packStrict.join());
    h.ok(!/answer|accept|note/.test(core.pqKeys) && !core.pqLeak, 'quiz: the public question carries no answer', core.pqKeys);
    h.ok(core.sub.join() === 'true,true,late,team' && core.afterReveal === 'closed', 'quiz: answers {team, value, at}: late, unknown and after-reveal refused', core.sub.join() + ' ' + core.afterReveal);
    /* Red 2 (Paris) ; Blue 2 (typo) + 1 (closest) ; Green: R2 tf 1 doubled = 2 ; Red +1 → Blue 3, Red 3, Green 2 */
    h.ok(core.scores === 'Red:3:1,Blue:3:1,Green:2:3' || core.scores === 'Blue:3:1,Red:3:1,Green:2:3', 'quiz: totals with typo, closest wins and the joker', core.scores);
    h.ok(core.joker === true && core.jokerAgain === false, 'quiz: a joker cannot move once it has scored');
    h.ok(core.end[0] === false && core.end[1] === 'end', 'quiz: the game ends after the last question');

    step('share');
    /* share link round trip: compress → URL → decompress equals the quiz */
    const share = await page.evaluate(async () => {
      const C = window.QuizCore;
      const quiz = { v: 1, title: 'Share “test” — ü', rounds: [{ name: 'Mixed', questions: [
        { type: 'mcq', prompt: 'Which is a fruit?', options: ['Carrot', 'Apple', 'Leek'], answer: 'Apple', note: 'Apples grow on trees.' },
        { type: 'text', prompt: 'Capital of Japan?', answer: 'Tokyo', accept: ['Tokio'] },
        { type: 'number', prompt: 'Days in a leap year?', answer: 366, tolerance: 0, points: 2, time: 20 },
        { type: 'order', prompt: 'Smallest first', answer: ['Ant', 'Cat', 'Horse'] },
        { type: 'tf', prompt: 'The Sun is a star.', answer: true }] }] };
      for (let i = 0; i < 25; i++) quiz.rounds[0].questions.push({ type: 'text', prompt: 'Filler question number ' + i + ' about the long river?', answer: 'Answer ' + i });
      const code = await C.encodeShare(quiz);
      const url = location.origin + location.pathname + '#q=' + code;
      const back = await C.decodeShare(new URL(url).hash.slice(3));
      const big = { v: 1, title: 'Big', rounds: [{ name: 'R', questions: Array.from({ length: 61 }, (_, i) => ({ type: 'tf', prompt: 'Q' + i, answer: true })) }] };
      let bigErr = null; try { await C.encodeShare(big); } catch (e) { bigErr = e.message; }
      let cut = null; try { await C.decodeShare(code.slice(0, 40)); } catch (e) { cut = e.message; }
      return { same: JSON.stringify(back) === JSON.stringify(C.cleanQuiz(quiz)), z: code[0], len: code.length, json: JSON.stringify(quiz).length, bigErr, cut, code };
    });
    h.ok(share.same, 'quiz: share link round trip gives back the same quiz');
    h.ok(share.z === 'z' && share.len < share.json * 0.7, 'quiz: the link is deflate-raw compressed', share.len + ' chars for ' + share.json + ' of JSON');
    h.ok(/61 questions/.test(share.bigErr || ''), 'quiz: over 60 questions is refused with a reason', share.bigErr);
    h.ok(/cut short/.test(share.cut || ''), 'quiz: a cut-off link is reported, not opened', share.cut);

    step('open shared');
    /* opening a shared link asks first, then makes it a quiz on this device */
    const sp = await h.open('/games/quiz-maker/#q=' + share.code);
    await h.sleep(500);
    const asked = await sp.evaluate(() => { const a = document.querySelector('.qz-ask'); return a && !a.hidden ? a.textContent : ''; });
    h.ok(/Share “test”/.test(asked), 'quiz: a shared link asks before opening', asked.slice(0, 80));
    await clickText(sp, '.qz-ask button', 'Open it');
    await h.sleep(400);
    const opened = await sp.evaluate(() => ({ title: document.querySelector('.qz-build input[type=text]').value, hash: location.hash, cards: document.querySelectorAll('.qz-q').length }));
    h.ok(opened.title === 'Share “test” — ü' && opened.cards === 30 && opened.hash === '', 'quiz: the shared quiz opens in Build and the link is cleared', JSON.stringify(opened));
    await sp.close();

    step('build+upload');
    /* build in the page: add a picture question, upload a 2000 × 1000 PNG, reload: it is still there at 1600 × 800 */
    const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 2000; c.height = 1000; const x = c.getContext('2d'); x.fillStyle = '#3366cc'; x.fillRect(0, 0, 2000, 1000); x.fillStyle = '#ffcc00'; x.fillRect(200, 200, 600, 400); return c.toDataURL('image/png').split(',')[1]; });
    const file = path.join(os.tmpdir(), 'quiz-maker-test-' + process.pid + '.png');
    fs.writeFileSync(file, Buffer.from(png, 'base64'));
    await clickText(page, '.qz-top button', 'New quiz');
    await h.sleep(300);
    await page.select('.qz-add select', 'picture');
    await clickText(page, '.qz-add button', 'Add question');
    await h.sleep(300);
    const cards = await page.$$('.qz-q');
    const last = cards[cards.length - 1];
    const input = await last.$('.qz-pic input[type=file]');
    await input.uploadFile(file);
    let status = '';
    for (let i = 0; i < 40 && !/kept on this device/.test(status); i++) { await h.sleep(100); status = await last.$eval('.qz-pic .game-field-hint', (n) => n.textContent); }
    h.ok(/^1600 × 800 px/.test(status), 'quiz: a picture is made 1600 px on its long side', status);
    const id = await page.evaluate(() => document.querySelector('[data-tool="quiz-maker"]').quizMaker.flush().then(() => document.querySelector('[data-tool="quiz-maker"]').quizMaker.id));
    await page.reload({ waitUntil: 'load' });
    await h.sleep(600);
    const kept = await page.evaluate(async (qid) => {
      const C = window.QuizCore;
      const rec = await C.store.getQuiz(qid);
      const qs = rec.quiz.rounds[0].questions;
      const pic = qs[qs.length - 1].image;
      const blob = pic && await C.store.getPicture(pic.id);
      const bmp = blob && await createImageBitmap(blob);
      const thumb = document.querySelector('.qz-q:last-child .qz-thumb');
      return { cur: document.querySelector('[data-tool="quiz-maker"]').quizMaker.id === qid, w: bmp && bmp.width, h: bmp && bmp.height, thumb: !!thumb && !thumb.hidden && /^blob:/.test(thumb.src) };
    }, id);
    h.ok(kept.cur && kept.w === 1600 && kept.h === 800, 'quiz: the picture survives a reload in IndexedDB', JSON.stringify(kept));
    h.ok(kept.thumb, 'quiz: the picture shows again after the reload');
    fs.unlinkSync(file);

    step('reorder');
    /* keyboard reorder: Alt+↑ moves the picture question above the first one */
    const before = await page.evaluate(() => Array.from(document.querySelectorAll('.qz-q select')).map((s) => s.value).join());
    await page.focus('.qz-q:last-child .qz-up');
    await page.keyboard.down('Alt'); await page.keyboard.press('ArrowUp'); await page.keyboard.up('Alt');
    await h.sleep(150);
    const after = await page.evaluate(() => Array.from(document.querySelectorAll('.qz-q select')).map((s) => s.value).join());
    h.ok(before.split(',').reverse().join() === after, 'quiz: Alt+↑ reorders a question', before + ' → ' + after);

    step('host');
    /* host and TV: a known quiz, two teams, the reveal flow, the Scoreboard message */
    await page.evaluate(async () => {
      const C = window.QuizCore;
      await C.store.putQuiz({ id: 'host-test', kind: 'quiz', quiz: { v: 1, title: 'Host test', rounds: [
        { name: 'Starters', questions: [
          { type: 'mcq', prompt: 'Which colour is a ripe banana?', options: ['Blue', 'Yellow', 'Purple', 'Grey'], answer: 'Yellow', note: 'Bananas start green.' },
          { type: 'text', prompt: 'Which city is the capital of Italy?', answer: 'Rome', points: 2 }] },
        { name: 'Finale', questions: [{ type: 'number', prompt: 'How many days are in a week?', answer: 7 }] }] } });
      localStorage.setItem('mvr-games-quiz-maker-v1', JSON.stringify({ current: 'host-test', tab: 1, host: { teams: 'Red\nBlue', timer: '', joker: true, closest: false, board: true } }));
    });
    await page.reload({ waitUntil: 'load' });
    await h.sleep(500);
    step('host: reloaded');
    const stage = await h.openStage('quiz-maker');
    step('host: stage open');
    await stage.evaluate(() => { window.__pts = []; new BroadcastChannel('mvr-games:points').onmessage = (e) => window.__pts.push(e.data); });
    /* the host window must be the front tab again: puppeteer's element calls
       wait on a page in the background (the old hang in this check) */
    /* the real Scoreboard, open beside the host, takes the points */
    const board = await h.open('/games/scoreboard/');
    await h.sleep(300);
    const boardTotals = () => board.evaluate(() => Array.from(document.querySelectorAll('[data-tool="scoreboard"] .sb-total-n')).map((e) => Number(e.textContent)));
    const board0 = await boardTotals();
    await page.bringToFront();
    step('host: listening');
    await clickText(page, '.qz-setup button', 'Start the quiz');
    step('host: started');
    await h.sleep(300);
    const tv1 = await stage.evaluate(() => (document.querySelector('.st-qz-roundname') || {}).textContent);
    h.ok(tv1 === 'Starters', 'quiz host: the TV opens on the round title', tv1);
    await page.keyboard.press('Enter');
    await h.sleep(300);
    const tv2 = await stage.evaluate(() => ({ prompt: (document.querySelector('.st-qz-prompt') || {}).textContent, opts: document.querySelectorAll('.st-qz-opt').length, text: document.querySelector('.game-stage-body').textContent }));
    const pres = await page.evaluate(() => (document.querySelector('.qz-pres-ans') || {}).textContent || '');
    h.ok(tv2.prompt === 'Which colour is a ripe banana?' && tv2.opts === 4, 'quiz host: the TV shows the question and its options', JSON.stringify(tv2.prompt));
    h.ok(!/Bananas start green/.test(tv2.text) && !document_has_answer(tv2.text), 'quiz host: the TV shows no answer or note before Reveal');
    h.ok(/Yellow/.test(pres) && /Bananas start green/.test(pres), 'quiz host: the presenter view has the answer and the note before Reveal', pres);
    await page.keyboard.press('1'); /* Red right */
    await page.keyboard.press('r');
    await h.sleep(300);
    const tv3 = await stage.evaluate(() => ({ ans: (document.querySelector('.st-qz-answer') || {}).textContent, right: (document.querySelector('.st-qz-opt.is-right') || {}).textContent, note: (document.querySelector('.st-qz-note') || {}).textContent }));
    h.ok(/Yellow/.test(tv3.ans || '') && /Yellow/.test(tv3.right || '') && tv3.note === 'Bananas start green.', 'quiz host: Reveal shows the answer and the note on the TV', JSON.stringify(tv3));
    /* the next question: Blue's typed answer with a typo-free "rome" is marked by Reveal */
    await page.keyboard.press('ArrowRight');
    await page.waitForSelector('.qz-their[data-team="Blue"]', { timeout: 3000 });
    await page.type('.qz-their[data-team="Blue"]', 'rome');
    await page.$eval('.qz-pres-head', (x) => { if (document.activeElement) document.activeElement.blur(); x.click(); }); /* a DOM click: a mouse click can land on a moved link under load */
    await page.keyboard.press('r');
    await h.sleep(300);
    const sc = await page.evaluate(() => Array.from(document.querySelectorAll('.qz-teamrow')).map((r) => r.querySelector('.qz-team-name').textContent + ':' + r.querySelector('.qz-team-score').textContent).join());
    h.ok(sc === 'Red:1,Blue:2', 'quiz host: host marks and typed answers score (Red 1, Blue 2)', sc);
    await page.keyboard.press('s');
    await h.sleep(300);
    const tvScores = await stage.evaluate(() => Array.from(document.querySelectorAll('.st-qz-score')).map((r) => r.querySelector('.st-qz-name').textContent.trim() + ':' + r.querySelector('.st-qz-pts').textContent).join());
    h.ok(tvScores === 'Blue:2,Red:1', 'quiz host: Show scores puts the standings on the TV', tvScores);
    const pts = await stage.evaluate(() => window.__pts);
    h.ok(JSON.stringify(pts) === JSON.stringify([{ name: 'Red', points: 1, team: 1 }, { name: 'Blue', points: 2, team: 2 }]), 'quiz host: points go out as the Scoreboard’s {team (1-based), name, points}', JSON.stringify(pts));
    /* the Scoreboard's teams are not called Red and Blue, so it falls back to the position */
    const board1 = await boardTotals();
    const gained = board1.map((n, i) => n - (board0[i] || 0)).join();
    h.ok(/^1,2(,0)*$/.test(gained), 'quiz host: the real Scoreboard adds the points to teams 1 and 2', gained);
    await board.close();
    await page.keyboard.press('ArrowRight'); /* round 2 title */
    await page.keyboard.press('ArrowRight'); /* its question */
    await page.keyboard.press('ArrowRight'); /* end */
    await h.sleep(300);
    const fin = await stage.evaluate(() => ({ title: (document.querySelector('.st-title') || {}).textContent, win: (document.querySelector('.st-qz-score.is-win .st-qz-name') || {}).textContent }));
    h.ok(fin.title === 'Final scores' && /Blue/.test(fin.win || ''), 'quiz host: the end shows the final scores with the winner', JSON.stringify(fin));
    await stage.close();

    step('print');
    /* print: the three documents from the same quiz */
    const pr = await page.evaluate(() => {
      const M = window.GAME_TOOLS['quiz-maker'].maths;
      const quiz = { v: 1, title: 'P', rounds: [{ name: 'A', questions: [{ type: 'text', prompt: 'Q one?', answer: 'Secret one', note: 'N1' }, { type: 'mcq', prompt: 'Q two?', options: ['x', 'y'], answer: 'y' }] }, { name: 'B', questions: [{ type: 'tf', prompt: 'Q three?', answer: false }] }] };
      const qs = M.printDoc(quiz, 'questions'), as = M.printDoc(quiz, 'answers'), key = M.printDoc(quiz, 'key');
      return { qLeak: /Secret one/.test(qs.textContent), qOpts: /B\. y/.test(qs.textContent), lines: as.querySelectorAll('.qz-print-lines li').length, pages: as.querySelectorAll('.qz-print-page').length, key: /Secret one/.test(key.textContent) && /N1/.test(key.textContent) && /False/.test(key.textContent) };
    });
    h.ok(!pr.qLeak && pr.qOpts, 'quiz print: question sheets have the options and no answers');
    h.ok(pr.lines === 3 && pr.pages === 2, 'quiz print: answer sheets have a line per question, a page per round', pr.lines + ' lines, ' + pr.pages + ' pages');
    h.ok(pr.key, 'quiz print: the answer key has the answers and the notes');

    step('packs');
    /* the ready-made picker reads the pack index and opens a ready-made pack */
    await page.evaluate(() => { localStorage.setItem('mvr-games-quiz-maker-v1', JSON.stringify({ current: 'host-test', tab: 0 })); });
    await page.reload({ waitUntil: 'load' });
    await h.sleep(400);
    await clickText(page, '.qz-top button', 'Ready-made quiz');
    await h.sleep(500);
    await clickText(page, '.qz-pack-list button', 'Family Quiz (all ages)');
    await h.sleep(500);
    const pk = await page.evaluate(() => ({ cards: document.querySelectorAll('.qz-q').length, msg: document.querySelector('.qz-top .game-msg').textContent, ok: !!document.querySelector('.qz-ok') }));
    h.ok(pk.cards === 50 && /checked on 2026-10-27/.test(pk.msg) && pk.ok, 'quiz: a ready-made pack opens as a quiz that is ready to host', JSON.stringify(pk));
  },
  landings: {
    'family-quiz-night-maker': async function (page, h) {
      await h.sleep(400);
      const r = await page.evaluate(() => ({ t: document.querySelector('.qz-build input[type=text]').value, rounds: document.querySelectorAll('.qz-round').length }));
      h.ok(r.t === 'Family Quiz Night' && r.rounds === 4, 'quiz landing: family quiz night opens with four rounds', JSON.stringify(r));
    },
    'christmas-quiz-host': async function (page, h) {
      await h.sleep(400);
      const r = await page.evaluate(() => ({ t: document.querySelector('.qz-build input[type=text]').value, first: document.querySelector('.qz-round input').value }));
      h.ok(r.t === 'Christmas Quiz' && r.first === 'Christmas traditions', 'quiz landing: Christmas quiz opens with its rounds', JSON.stringify(r));
    },
    'picture-round-maker': async function (page, h) {
      await h.sleep(400);
      const r = await page.evaluate(() => ({ add: document.querySelector('.qz-add select').value, first: document.querySelector('.qz-q select').value }));
      h.ok(r.add === 'picture' && r.first === 'picture', 'quiz landing: the picture round starts with picture questions', JSON.stringify(r));
    }
  }
};

/* QZ_STEP=1 prints where the check is, to find a hang */
function step(s) { if (process.env.QZ_STEP) console.log('  quiz-maker step: ' + s); }
function document_has_answer(text) { return /✓|Answer\s*Yellow/.test(text); }
async function clickText(page, sel, text) {
  const list = await page.$$(sel);
  for (const b of list) { if ((await b.evaluate((x) => x.textContent.trim())).indexOf(text) === 0) { await b.evaluate((x) => x.click()); return true; } }
  throw new Error('no button "' + text + '" in ' + sel);
}
