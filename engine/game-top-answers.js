/**
 * Top Answers Survey Game, on the device.
 *
 * Two teams guess the most popular answers to a survey question ("name
 * something you take to the beach"). The answers, 4 to 8 of them with their
 * points, most popular first, are hidden on the TV (engine/game-kit.js's
 * stage). The host reveals an answer when the playing team names it — by
 * pressing it, its number key, or typing the guess, which engine/
 * game-quiz-core.js checks (spelling slips and "the"/"a" forgiven). A wrong
 * guess is a strike: a big X on the TV and a buzz. Three strikes and the
 * other team gets one guess to steal every point on the board. Scores are
 * kept for both teams across the questions.
 *
 * Questions are typed by the host (kept in the quiz store as kind 'survey'),
 * or taken from a ready-made pack's survey questions when the pack index
 * lists any. The game rules are the pure function `act` on spec.maths.
 * Nothing is uploaded.
 */
(function () {
  'use strict';
  window.GAME_TOOLS = window.GAME_TOOLS || {};
  const spec = window.GAME_TOOLS['top-answers'] = {
    order: 10,
    title: 'Top Answers Survey Game',
    short: 'Top Answers',
    description: 'A family survey game for the TV: hidden answers with points, reveal them as teams guess, three strikes and the other team can steal. Type your own questions. Free, no sign-up, nothing uploaded.',
    keywords: ['survey game', 'family survey game', 'top answers game', 'guess the top answers', 'party survey game', 'survey game for tv', 'classroom survey game'],
    glyph: 'i-top-answers',
    glyphSvg: '<symbol id="i-top-answers" viewBox="0 0 24 24">\n  <rect x="2.6" y="3.4" width="18.8" height="17.2" rx="2.2"/>\n  <path d="M6 8h8.4M6 12h7M6 16h5.2" class="thin"/>\n  <circle cx="17.6" cy="8" r=".95" class="fill"/>\n  <circle cx="17.6" cy="12" r=".95" class="fill"/>\n  <circle cx="17.6" cy="16" r=".95" class="fill"/>\n</symbol>',
    scripts: ['/engine/game-kit.js', '/engine/game-quiz-core.js', '/engine/game-top-answers.js'],
    privacy: 'Your questions, answers and the scores stay on this device: they are kept in this browser’s own storage and shown on your own screens. Nothing is uploaded.',
    how: [
      'Type a title, then a question that asks for an answer many people would give, like “Name something you take to the beach”.',
      'Type 4 to 8 answers with their points, the most popular first. Press Sort by points if they are out of order.',
      'Press Add question for the next one. The page saves as you type.',
      'Press 2 Play, type the two team names and press Start the game.',
      'Press Show on TV and drag the new window to the TV, then press Full screen there. With one screen, press Full screen here.',
      'When the playing team names an answer on the board, press that answer (or its number key, 1 to 8). Or type their guess and press Check.',
      'When the guess is not on the board, press Strike (or the X key). The TV shows a big X and your device buzzes.',
      'After three strikes the other team has one guess to steal. Press the answer if they find one, or Steal missed.',
      'Press Reveal the rest to show the answers nobody found, then Next question (→).',
      'After the last question the TV shows the final scores. Press End game, then Start the game, to play again.'
    ],
    manual: {
      setup: [
        'Type a title for the game.',
        'Type a question and 4 to 8 answers, each with its points, most popular first.',
        'Add more questions with Add question; fix anything listed until it says ready to play.',
        'Press 2 Play and type the two team names.'
      ],
      play: [
        'Press Start the game. The TV shows the question and numbered hidden answers.',
        'Press an answer (or its number key) when the playing team names it; the points go on the board.',
        'Press Strike (X) for a wrong guess. Three strikes and the other team can steal.',
        'For the steal: press the answer they name, or Steal missed. The points on the board go to the winner.',
        'Press Reveal the rest, then Next question (→). Undo (U) takes back the last press.'
      ],
      tv: [
        'On the Play tab, press Show on TV. A new window opens.',
        'Drag that window to the TV or projector, or cast that browser tab.',
        'Press Full screen in that window. Your page keeps the answers for you only.',
        'With only one screen, press Full screen here; press Esc to come back.'
      ],
      troubleshooting: [
        { q: 'Start the game does nothing.', a: 'A question has something to fix: fewer than 4 answers, an answer without points, or points that go up instead of down. The list under the button names each one.' },
        { q: 'I pressed the wrong answer or a strike by mistake.', a: 'Press Undo (or the U key). Each press undoes one more step.' },
        { q: 'A typed guess was not found but it is right.', a: 'Press the answer on your page to reveal it anyway, and add the other spelling in that answer’s “Also accept” box for next time.' },
        { q: 'There is no sound.', a: 'Sound plays on the host’s device (not the TV window), after your first press on the page. Check that the device is not muted.' }
      ]
    },
    uses: [
      ['Family get-together', 'kids against grown-ups, with questions everyone can answer'],
      ['Party or office social', 'two teams, a few questions surveyed among the guests beforehand'],
      ['Classroom', 'a survey of the class (“name a fruit”) played back as a game the next day']
    ],
    tips: [
      'The best questions have many possible answers: “Name something you find in a kitchen”, not “What is the capital of France?”.',
      'For real points, ask the question to 20 to 100 people first (Print has a survey sheet) and count how many gave each answer.',
      'A typed guess matches the answer or any “Also accept” spelling, ignoring capitals, accents, “the” and “a”, and one slip in a word of five letters or more.',
      'If the stealing team names a hidden answer, they take every point on the board plus that answer; if not, the playing team keeps the board.',
      'Number keys 1 to 8 reveal answers, X is a strike, U undoes, S shows the scores and → goes to the next question.',
      'The playing team starts with team 1 and swaps every question; press Switch team before the first guess to change it.'
    ],
    faq: [
      { q: 'Is anything uploaded?', a: 'No. Your questions and the scores are kept in this browser’s storage on this device and shown on your own screens.' },
      { q: 'Where do the points come from?', a: 'From you. The example question has made-up points; change them to your own guesses, or ask a group of people first and use how many gave each answer. Print has a survey sheet for that.' },
      { q: 'How does stealing work?', a: 'After three strikes the other team talks it over and gives one answer. If it is on the board, they win every point revealed so far plus that answer. If not, the team that was playing wins the points on the board.' },
      { q: 'How many answers can a question have?', a: '4 to 8, each with its points, most popular first. The TV shows them numbered, hidden until they are found.' },
      { q: 'Can more than two teams play?', a: 'The game is made for two teams, because the steal goes to the other team. For more teams, take turns in pairs or keep a running total in the Scoreboard.' },
      { q: 'How do I show it on the TV?', a: 'On the Play tab, press Show on TV, drag the new window to the TV or projector (or cast that tab) and press Full screen there. Your page keeps the answers. With one screen, press Full screen here.' },
      { q: 'Does it work offline?', a: 'Yes. After the first visit the page opens without a connection, and your questions are kept on the device.' }
    ],
    related: ['/games/quiz-maker/', '/games/scoreboard/', '/games/quiz-buzzer/'],
    landings: [
      {
        slug: 'family-survey-game',
        title: 'Family Survey Game for the TV',
        description: 'Play a survey game with the family on the TV: hidden answers with points, three strikes, a steal round and the scores kept. Type your own questions. Free, nothing uploaded.',
        lede: 'Kids against grown-ups: guess the most popular answers, reveal them on the TV one by one, and steal the points after three strikes.',
        preset: { title: 'Family Survey Game', teams: ['Kids', 'Grown-ups'] },
        about: [
          'The game opens with the teams set to Kids and Grown-ups and one example question. Write questions the whole family can answer, and ask a few friends or relatives beforehand to get the points.',
          'On the night, show the board on the TV, let each team take a turn, and press the answers as they are found. Three strikes hand the other team one guess to steal the points.'
        ],
        faq: [
          { q: 'How many questions make a good game?', a: 'Five to eight questions take 20 to 40 minutes. End with a question that has big points so the game stays open to the last round.' },
          { q: 'Can young children play?', a: 'Yes. Pick questions about everyday things (“name a farm animal”) and let them call out answers; you press the answers, so nobody needs to read or type.' }
        ]
      }
    ]
  };

  /* ---------- the rules, readable in Node ---------- */

  const STRIKES = 3;
  /** A fresh state for question qi; the playing team swaps every question. */
  function round(g, qi, n) {
    return Object.assign({}, g, { qi: qi, playing: qi % 2, revealed: new Array(n).fill(0), strikes: 0, phase: qi >= g.total ? 'end' : 'play', bank: 0, winner: null, stealMissed: false, xAt: g.xAt || 0 });
  }
  function newGame(teams, total, firstAnswers) {
    return round({ teams: teams.slice(0, 2), scores: [0, 0], total: total }, 0, firstAnswers || 0);
  }
  /** revealed[i]: 0 hidden, 1 found in play (scores), 2 shown after the round (no points). */
  function award(g, team) { const s = g.scores.slice(); s[team] += g.bank; return Object.assign(g, { scores: s, winner: team, phase: 'done' }); }
  /**
   * The game's rules as one function: act(state, question, action) → a new
   * state (the old one is left alone, so Undo is the previous state).
   * Actions: { t: 'reveal', i } | { t: 'strike' } | { t: 'guess', found: i or -1 }
   * | { t: 'switch' } | { t: 'rest' } | { t: 'next', n } (n = answers on the next question).
   */
  function act(state, q, a) {
    const g = JSON.parse(JSON.stringify(state));
    const pts = function (i) { return q.answer[i].points; };
    if (a.t === 'guess') return act(state, q, a.found >= 0 ? { t: 'reveal', i: a.found } : { t: 'strike' });
    if (a.t === 'switch') { if (g.phase === 'play' && !g.strikes && g.revealed.every(function (r) { return !r; })) g.playing = 1 - g.playing; return g; }
    if (a.t === 'reveal') {
      if (g.revealed[a.i] || a.i < 0 || a.i >= g.revealed.length) return g;
      if (g.phase === 'play') {
        g.revealed[a.i] = 1; g.bank += pts(a.i);
        if (g.revealed.every(Boolean)) award(g, g.playing);
      } else if (g.phase === 'steal') {
        g.revealed[a.i] = 1; g.bank += pts(a.i);
        award(g, 1 - g.playing);
      } else if (g.phase === 'done') g.revealed[a.i] = 2;
      return g;
    }
    if (a.t === 'strike') {
      if (g.phase === 'play') {
        g.strikes++; g.xAt++;
        if (g.strikes >= STRIKES) g.phase = 'steal';
      } else if (g.phase === 'steal') { g.xAt++; g.stealMissed = true; award(g, g.playing); }
      return g;
    }
    if (a.t === 'rest') { if (g.phase === 'done') g.revealed = g.revealed.map(function (r) { return r || 2; }); return g; }
    if (a.t === 'next') { if (g.phase !== 'done') return g; return round(g, g.qi + 1, a.n || 0); }
    return g;
  }

  if (typeof document === 'undefined') return;
  const K = window.GameKit, C = window.QuizCore;
  const SLUG = 'top-answers';

  const STR = {
    untitled: 'My survey game', myGames: 'My survey games', newSet: 'New game', packs: 'Ready-made questions',
    del: 'Delete game', tabs: ['Build', 'Play', 'Print'],
    title: 'Title', question: function (n) { return 'Question ' + n; }, answerN: function (n) { return 'Answer ' + n; }, pointsN: 'Points', accept: 'Also accept (split by commas)',
    addAns: 'Add answer', delAns: 'Remove answer', sort: 'Sort by points', addQ: 'Add question', delQ: 'Delete question',
    up: 'Move up', down: 'Move down',
    example: { prompt: 'Name something you take to the beach.', answers: [['Towel', 30], ['Sun cream', 24], ['Swimsuit', 18], ['Bucket and spade', 12], ['Sunglasses', 9], ['Beach umbrella', 7]] },
    exampleNote: 'The first question is an example and its points are made up: change them, or ask 20 to 100 people first and count their answers.',
    saved: 'Saved on this device.', savedMem: 'This browser blocks storage: the game is kept until you close the page.',
    problems: function (n) { return n === 1 ? '1 thing to fix before playing:' : n + ' things to fix before playing:'; },
    ready: function (n) { return n + (n === 1 ? ' question' : ' questions') + ' — ready to play.'; },
    delAsk: 'Delete this survey game from this device? This cannot be undone.', deleted: 'Deleted.',
    packsLoading: 'Loading the ready-made questions…', packsNone: 'There are no ready-made survey questions yet. Type your own, or ask a group of people first.',
    packLine: function (p) { return p.title + ' — ' + p.types.survey + ' survey questions'; },
    packOpened: function (p) { return 'Opened the survey questions from “' + p.title + '” as a game of your own.'; }, packFailed: function (m) { return 'That pack could not be opened: ' + m; },
    teamA: 'Team 1', teamB: 'Team 2', start: 'Start the game', resume: 'Carry on the last game', fixFirst: 'Fix these first, on the Build tab:',
    playing: function (t) { return t + ' to play'; }, stealing: function (t) { return t + ' can steal: one guess'; },
    won: function (t, n) { return t + ' win ' + n + ' points.'; }, strikesOf: function (n) { return 'Strikes: ' + n + ' of 3'; },
    board: function (n) { return 'On the board: ' + n; },
    guess: 'Their guess', check: 'Check', strike: 'Strike  (X)', stealMiss: 'Steal missed  (X)', switchT: 'Switch team  (T)',
    rest: 'Reveal the rest', next: 'Next question  (→)', finish: 'Final scores  (→)', undo: 'Undo  (U)',
    scores: 'Show scores  (S)', hideScores: 'Hide scores  (S)', endGame: 'End game',
    notFound: function (g) { return '“' + g + '” is not on the board: strike.'; }, found: function (t, p) { return t + ' — ' + p + ' points.'; },
    struck: function (n) { return 'Strike ' + n + '.'; }, ended: 'That was the last question: the final scores are on the TV.',
    printH: 'Print the host’s sheet', printS: 'Print a survey sheet',
    printHint: 'The survey sheet lists the questions with space to tally what people answer, so you can find the real points before the game.',
    tally: 'Answers and tally marks:',
    tvWait: 'The board appears here when the host starts the game.', tvScores: 'Scores', tvFinal: 'Final scores', tvBank: 'On the board'
  };

  /* ---------- the big screen ---------- */

  let lastX = 0;
  function renderStage(body, s) {
    body.textContent = '';
    if (!s || !s.view || s.view === 'idle') { body.appendChild(K.el('p', 'game-stage-wait', STR.tvWait)); return; }
    const wrap = K.el('div', 'st-qz st-ta');
    if (s.view === 'scores' || s.view === 'end') {
      wrap.appendChild(K.el('h1', 'st-title', s.view === 'end' ? STR.tvFinal : STR.tvScores));
      const ol = K.el('ol', 'st-qz-scores');
      s.teams.map(function (t, i) { return { name: t.name, score: t.score, i: i }; }).sort(function (a, b) { return b.score - a.score || a.i - b.i; }).forEach(function (t, k, arr) {
        const rank = k && arr[k - 1].score === t.score ? 1 : k + 1;
        const li = K.el('li', 'st-qz-score' + (s.view === 'end' && rank === 1 ? ' is-win' : ''));
        li.style.setProperty('--tc', 'var(--t' + (t.i + 1) + ')');
        li.appendChild(K.el('span', 'st-qz-rank', String(rank)));
        li.appendChild(K.el('span', 'st-qz-name', t.name));
        li.appendChild(K.el('span', 'st-qz-pts', String(t.score)));
        ol.appendChild(li);
      });
      wrap.appendChild(ol);
      body.appendChild(wrap);
      return;
    }
    wrap.appendChild(K.el('p', 'st-qz-meta', s.meta));
    wrap.appendChild(K.el('h1', 'st-qz-prompt st-ta-prompt', s.prompt));
    const ol = K.el('ol', 'st-ta-slots' + (s.slots.length > 4 ? ' is-two' : ''));
    ol.style.setProperty('--rows', Math.ceil(s.slots.length / 2));
    s.slots.forEach(function (x, i) {
      const li = K.el('li', 'st-ta-slot' + (x ? ' is-open' : '') + (x && x.late ? ' is-late' : ''));
      li.appendChild(K.el('b', 'st-ta-n', String(i + 1)));
      li.appendChild(K.el('span', 'st-ta-text', x ? x.text : ''));
      li.appendChild(K.el('span', 'st-ta-pts', x ? String(x.points) : ''));
      ol.appendChild(li);
    });
    wrap.appendChild(ol);
    const foot = K.el('div', 'st-ta-foot');
    s.teams.forEach(function (t, i) {
      const d = K.el('div', 'st-ta-team' + (s.turn === i ? ' is-turn' : ''));
      d.style.setProperty('--tc', 'var(--t' + (i + 1) + ')');
      d.appendChild(K.el('span', 'st-ta-tname', (s.turn === i ? '▶ ' : '') + t.name));
      d.appendChild(K.el('span', 'st-ta-tpts', String(t.score)));
      foot.appendChild(d);
      if (i === 0) {
        const mid = K.el('div', 'st-ta-bank');
        mid.appendChild(K.el('span', 'st-qz-tag', STR.tvBank));
        mid.appendChild(K.el('span', 'st-ta-banknum', String(s.bank)));
        const xs = K.el('span', 'st-ta-strikes'); xs.setAttribute('aria-label', STR.strikesOf(s.strikes));
        for (let k = 0; k < 3; k++) xs.appendChild(K.el('i', k < s.strikes ? 'is-on' : '', '✕'));
        mid.appendChild(xs);
        foot.appendChild(mid);
      }
    });
    wrap.appendChild(foot);
    if (s.status) wrap.appendChild(K.el('p', 'st-qz-note st-ta-status', s.status));
    body.appendChild(wrap);
    /* a new strike: the big X over the board, once, for a moment */
    if (s.xAt && s.xAt !== lastX) {
      lastX = s.xAt;
      if (Date.now() - (s.xWhen || 0) < 1500) {
        const big = K.el('div', 'st-ta-x');
        big.setAttribute('aria-hidden', 'true');
        big.textContent = '✕'.repeat(Math.max(1, Math.min(3, s.xCount || 1)));
        body.appendChild(big);
        setTimeout(function () { big.remove(); }, 1400);
      }
    }
  }

  /* ---------- printing ---------- */

  function printDoc(quiz, kind) {
    const box = K.el('div', 'qz-print ta-print');
    box.appendChild(K.el('h1', null, quiz.title || STR.untitled));
    const ol = K.el('ol');
    surveyQs(quiz).forEach(function (q) {
      const li = K.el('li');
      li.appendChild(K.el('p', 'qz-print-q', q.prompt));
      if (kind === 'host') {
        const ul = K.el('ol', 'qz-print-opts');
        q.answer.forEach(function (a) { ul.appendChild(K.el('li', null, a.text + ' — ' + a.points)); });
        li.appendChild(ul);
      } else {
        li.appendChild(K.el('p', 'qz-print-a', STR.tally));
        const lines = K.el('ul', 'qz-print-lines');
        for (let i = 0; i < 6; i++) lines.appendChild(K.el('li'));
        li.appendChild(lines);
      }
      ol.appendChild(li);
    });
    box.appendChild(ol);
    return box;
  }
  function surveyQs(quiz) { const out = []; (quiz.rounds || []).forEach(function (r) { (r.questions || []).forEach(function (q) { if (q.type === 'survey') out.push(q); }); }); return out; }
  function words(msg) { return String(msg).replace(/^Round 1, question (\d+): /, 'Question $1: ').replace(/the quiz needs a title/, 'the game needs a title').replace(/^Round 1: the round has no questions\./, 'Add a question.'); }

  /* ---------- the page ---------- */

  function mount(root, stage) {
    const io = root.querySelector('.tool-io');
    const prefs = K.store(SLUG, 1);
    const preset = K.preset(root);
    const P = Object.assign({ current: null, tab: 0, teams: preset.teams || [STR.teamA, STR.teamB], game: null }, prefs.get({}));
    if (preset.teams) P.teams = preset.teams.slice(0, 2);
    let rec = null, persistent = true, saveT = 0, game = null, history = [], showScores = false, xWhen = 0;
    function persistPrefs() { prefs.set(P); }
    function qs() { return rec.quiz.rounds[0].questions; }

    /* top bar */
    const top = K.el('section', 'game-panel qz-top');
    const pick = K.el('select'); pick.setAttribute('aria-label', STR.myGames);
    const bar1 = K.el('div', 'game-row'); bar1.appendChild(K.field(STR.myGames, pick).wrap);
    const bar2 = K.el('div', 'game-row');
    bar2.appendChild(K.button(STR.newSet, 'btn-ghost', function () { newSet(); }));
    const bPacks = K.button(STR.packs, 'btn-ghost', togglePacks); bPacks.hidden = true;
    bar2.appendChild(bPacks);
    bar2.appendChild(K.button(STR.del, 'btn-ghost', deleteSet));
    top.appendChild(bar1); top.appendChild(bar2);
    const msg = K.el('p', 'game-msg'); msg.setAttribute('role', 'status'); top.appendChild(msg);
    const packs = K.el('div', 'qz-packs'); packs.hidden = true; top.appendChild(packs);
    io.appendChild(top);
    const tabs = K.el('div', 'game-seg qz-tabs'); tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'Mode');
    const tabB = STR.tabs.map(function (t, i) { const b = K.button((i + 1) + '  ' + t, null, function () { setTab(i); }); tabs.appendChild(b); return b; });
    io.appendChild(tabs);
    const panes = [K.el('div', 'qz-pane ta-build'), K.el('div', 'qz-pane ta-play'), K.el('div', 'qz-pane ta-printpane')];
    panes.forEach(function (p) { io.appendChild(p); });
    function say(text, warn) { msg.textContent = text; msg.className = 'game-msg' + (warn ? ' is-warn' : ''); K.announce(root, text); }

    /* ----- saving, choosing ----- */
    function exampleQ() { return { type: 'survey', prompt: STR.example.prompt, answer: STR.example.answers.map(function (a) { return { text: a[0], points: a[1] }; }) }; }
    function blankSet(title) { return { id: C.newId('s'), kind: 'survey', quiz: { v: 1, title: title || STR.untitled, rounds: [{ name: 'Questions', questions: [exampleQ()] }] } }; }
    function save(now) {
      clearTimeout(saveT);
      const go = function () { C.store.putQuiz(rec).then(function () { refreshPick(); saveLine.textContent = STR.saved; }).catch(function () { persistent = false; saveLine.textContent = STR.savedMem; }); };
      if (now) go(); else saveT = setTimeout(go, 400);
      checkSet();
    }
    function refreshPick() {
      return C.store.listQuizzes('survey').then(function (list) {
        pick.textContent = '';
        list.forEach(function (r) { const o = K.el('option', null, (r.title || STR.untitled) + ' (' + r.count + ')'); o.value = r.id; pick.appendChild(o); });
        if (rec) pick.value = rec.id;
      });
    }
    function useRec(r) {
      rec = r;
      if (!rec.quiz.rounds.length) rec.quiz.rounds.push({ name: 'Questions', questions: [] });
      P.current = r.id; persistPrefs();
      if (game && P.game && P.game.id !== r.id) game = null;
      renderBuild(); renderPlay(); refreshPick();
    }
    function newSet(title) { return C.store.putQuiz(blankSet(title)).then(function (saved) { useRec(saved); setTab(0); return saved; }); }
    pick.addEventListener('change', function () { C.store.getQuiz(pick.value).then(function (r) { if (r) { game = null; useRec(r); } }); });
    function deleteSet() {
      if (!window.confirm(STR.delAsk)) return;
      C.store.deleteQuiz(rec.id).then(function () { return C.store.listQuizzes('survey'); }).then(function (list) {
        say(STR.deleted);
        if (list.length) return C.store.getQuiz(list[0].id).then(useRec);
        return newSet();
      });
    }
    /* the ready-made button appears only when a pack has survey questions */
    function surveyPacks() { return C.loadPackIndex().then(function (list) { return list.filter(function (p) { return p.types && p.types.survey > 0; }); }); }
    surveyPacks().then(function (list) { bPacks.hidden = !list.length; }).catch(function () { bPacks.hidden = true; });
    function togglePacks() {
      if (!packs.hidden) { packs.hidden = true; return; }
      packs.hidden = false; packs.textContent = '';
      packs.appendChild(K.el('p', 'game-msg', STR.packsLoading));
      surveyPacks().then(function (list) {
        packs.textContent = '';
        if (!list.length) { packs.appendChild(K.el('p', 'game-msg is-warn', STR.packsNone)); return; }
        const ul = K.el('ul', 'qz-pack-list');
        list.forEach(function (p) {
          const li = K.el('li');
          li.appendChild(K.button(STR.packLine(p), 'btn-ghost qz-pack', function () { openPack(p); }));
          ul.appendChild(li);
        });
        packs.appendChild(ul);
      }).catch(function () { packs.textContent = ''; packs.appendChild(K.el('p', 'game-msg is-warn', STR.packsNone)); });
    }
    function openPack(p) {
      C.loadPack(p.id).then(function (pack) {
        packs.hidden = true;
        const list = surveyQs(pack).map(C.cleanQuestion);
        if (!list.length) throw new Error(STR.packsNone);
        const r = { id: C.newId('s'), kind: 'survey', quiz: { v: 1, title: pack.title, rounds: [{ name: 'Questions', questions: list }] } };
        return C.store.putQuiz(r).then(function (saved) { useRec(saved); setTab(0); say(STR.packOpened(pack)); });
      }).catch(function (e) { say(STR.packFailed(e.message), true); });
    }

    /* ----- Build ----- */
    const build = panes[0];
    const head = K.el('section', 'game-panel');
    const titleIn = K.el('input'); titleIn.type = 'text'; titleIn.maxLength = 120;
    titleIn.addEventListener('input', function () { rec.quiz.title = titleIn.value; save(); });
    head.appendChild(K.field(STR.title, titleIn).wrap);
    const exampleLine = K.el('p', 'game-msg', STR.exampleNote); head.appendChild(exampleLine);
    const saveLine = K.el('p', 'game-msg qz-saved', ''); head.appendChild(saveLine);
    const checkBox = K.el('div', 'qz-check'); head.appendChild(checkBox);
    build.appendChild(head);
    const list = K.el('ol', 'qz-qs ta-qs'); build.appendChild(list);
    const addRow = K.el('div', 'game-row');
    addRow.appendChild(K.button(STR.addQ, 'btn-primary', function () {
      qs().push({ type: 'survey', prompt: '', answer: [0, 1, 2, 3].map(function () { return { text: '', points: 0 }; }) });
      renderBuild(); save();
      const last = list.lastElementChild && list.lastElementChild.querySelector('textarea'); if (last) last.focus();
    }));
    build.appendChild(addRow);

    function checkSet() {
      const v = C.validate(rec.quiz);
      checkBox.textContent = '';
      exampleLine.hidden = !(qs()[0] && qs()[0].prompt === STR.example.prompt);
      if (v.ok) { checkBox.appendChild(K.el('p', 'game-msg qz-ok', STR.ready(qs().length))); return v; }
      checkBox.appendChild(K.el('p', 'game-msg is-warn', STR.problems(v.errors.length)));
      const ul = K.el('ul', 'qz-errors'); v.errors.slice(0, 8).forEach(function (e) { ul.appendChild(K.el('li', null, words(e))); }); checkBox.appendChild(ul);
      return v;
    }
    function renderBuild() {
      titleIn.value = rec.quiz.title;
      list.textContent = '';
      qs().forEach(function (q, qi) {
        const li = K.el('li', 'qz-q ta-q');
        const pr = K.el('textarea', 'qz-prompt'); pr.rows = 2; pr.maxLength = 300; pr.value = q.prompt;
        pr.addEventListener('input', function () { q.prompt = pr.value; save(); });
        li.appendChild(K.field(STR.question(qi + 1), pr).wrap);
        const ans = K.el('div', 'ta-answers');
        q.answer.forEach(function (a, ai) {
          const row = K.el('div', 'ta-ans');
          const t = K.el('input', 'ta-ans-text'); t.type = 'text'; t.maxLength = 60; t.value = a.text;
          t.addEventListener('input', function () { a.text = t.value; save(); });
          const p = K.el('input', 'ta-ans-pts'); p.type = 'number'; p.min = '0'; p.max = '1000'; p.inputMode = 'numeric'; p.value = String(a.points);
          p.addEventListener('input', function () { a.points = p.value === '' ? NaN : Number(p.value); save(); });
          const ac = K.el('input', 'ta-ans-acc'); ac.type = 'text'; ac.maxLength = 120; ac.value = (a.accept || []).join(', ');
          ac.addEventListener('input', function () { const l = ac.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean); if (l.length) a.accept = l; else delete a.accept; save(); });
          row.appendChild(K.field(STR.answerN(ai + 1), t).wrap);
          row.appendChild(K.field(STR.pointsN, p).wrap);
          row.appendChild(K.field(STR.accept, ac).wrap);
          if (q.answer.length > 4) {
            const x = K.button('✕', 'btn-ghost qz-icon', function () { q.answer.splice(ai, 1); renderBuild(); save(); });
            x.setAttribute('aria-label', STR.delAns + ' ' + (ai + 1)); x.title = STR.delAns;
            row.appendChild(x);
          }
          ans.appendChild(row);
        });
        li.appendChild(ans);
        const acts = K.el('div', 'game-row');
        if (q.answer.length < 8) acts.appendChild(K.button(STR.addAns, 'btn-ghost', function () { q.answer.push({ text: '', points: 0 }); renderBuild(); save(); }));
        acts.appendChild(K.button(STR.sort, 'btn-ghost ta-sort', function () { q.answer.sort(function (x, y) { return (Number(y.points) || 0) - (Number(x.points) || 0); }); renderBuild(); save(); }));
        const up = K.button('↑', 'btn-ghost qz-icon', function () { if (qi) { qs().splice(qi - 1, 0, qs().splice(qi, 1)[0]); renderBuild(); save(); } });
        up.setAttribute('aria-label', STR.up); up.title = STR.up; up.disabled = qi === 0;
        const dn = K.button('↓', 'btn-ghost qz-icon', function () { if (qi < qs().length - 1) { qs().splice(qi + 1, 0, qs().splice(qi, 1)[0]); renderBuild(); save(); } });
        dn.setAttribute('aria-label', STR.down); dn.title = STR.down; dn.disabled = qi === qs().length - 1;
        acts.appendChild(up); acts.appendChild(dn);
        acts.appendChild(K.button(STR.delQ, 'btn-ghost', function () { qs().splice(qi, 1); renderBuild(); save(); }));
        li.appendChild(acts);
        list.appendChild(li);
      });
      checkSet();
    }

    /* ----- Play ----- */
    const play = panes[1];
    const setup = K.el('section', 'game-panel qz-setup');
    const live = K.el('section', 'game-panel qz-live ta-live'); live.hidden = true;
    play.appendChild(setup); play.appendChild(live);
    play.appendChild(stage.bar());

    function renderPlay() {
      setup.textContent = '';
      setup.appendChild(K.el('h2', null, rec.quiz.title || STR.untitled));
      const row1 = K.el('div', 'game-row');
      [0, 1].forEach(function (i) {
        const t = K.el('input', 'ta-team-in'); t.type = 'text'; t.maxLength = 30; t.value = P.teams[i] || '';
        t.addEventListener('input', function () { P.teams[i] = t.value; persistPrefs(); });
        row1.appendChild(K.field(i ? STR.teamB : STR.teamA, t).wrap);
      });
      setup.appendChild(row1);
      const row = K.el('div', 'game-row');
      row.appendChild(K.button(STR.start, 'btn-primary game-big', function () { startGame(null); }));
      if (P.game && P.game.id === rec.id && P.game.state) row.appendChild(K.button(STR.resume, 'btn-ghost', function () { startGame(P.game.state); }));
      setup.appendChild(row);
      setup.appendChild(K.el('div', 'qz-check'));
      setup.hidden = !!game; live.hidden = !game;
      if (game) renderLive();
    }
    function startGame(saved) {
      K.sound.unlock();
      const errs = setup.querySelector('.qz-check'); errs.textContent = '';
      const v = C.validate(rec.quiz);
      if (!v.ok) {
        errs.appendChild(K.el('p', 'game-msg is-warn', STR.fixFirst));
        const ul = K.el('ul', 'qz-errors'); v.errors.slice(0, 8).forEach(function (e) { ul.appendChild(K.el('li', null, words(e))); }); errs.appendChild(ul);
        return;
      }
      const names = [0, 1].map(function (i) { return (P.teams[i] || '').trim().slice(0, 30) || (i ? STR.teamB : STR.teamA); });
      game = saved ? JSON.parse(JSON.stringify(saved)) : newGame(names, qs().length, qs()[0].answer.length);
      history = []; showScores = false;
      K.wakeLock(true);
      keep(); renderPlay(); publish();
    }
    function keep() { P.game = game ? { id: rec.id, state: game } : null; persistPrefs(); }
    function curQ() { return qs()[game.qi]; }
    function status() {
      const t = game.teams;
      if (game.phase === 'end') return STR.ended;
      if (game.phase === 'done') return STR.won(t[game.winner], game.bank);
      if (game.phase === 'steal') return STR.stealing(t[1 - game.playing]);
      return STR.playing(t[game.playing]);
    }
    function publish() {
      if (!game) { stage.update({ view: 'idle' }); return; }
      const teams = game.teams.map(function (n, i) { return { name: n, score: game.scores[i] }; });
      if (showScores || game.phase === 'end') { stage.update({ view: game.phase === 'end' ? 'end' : 'scores', teams: teams }); return; }
      const q = curQ();
      stage.update({
        view: 'board', meta: STR.question(game.qi + 1) + ' / ' + game.total, prompt: q.prompt,
        slots: game.revealed.map(function (r, i) { return r ? { text: q.answer[i].text, points: q.answer[i].points, late: r === 2 } : null; }),
        teams: teams, turn: game.phase === 'steal' ? 1 - game.playing : game.phase === 'play' ? game.playing : -1,
        bank: game.bank, strikes: game.strikes, status: game.phase === 'done' || game.phase === 'steal' ? status() : '',
        xAt: game.xAt, xCount: game.phase === 'done' && game.stealMissed ? 1 : game.strikes, xWhen: xWhen
      });
    }
    function apply(a, sound) {
      if (!game) return;
      const before = game;
      const after = act(game, curQ(), a);
      if (JSON.stringify(after) === JSON.stringify(before)) return false;
      history.push(before); if (history.length > 200) history.shift();
      game = after;
      if (game.xAt !== before.xAt) { xWhen = Date.now(); K.sound.buzz(); }
      else if (sound) sound();
      if (game.phase === 'done' && before.phase !== 'done') K.sound.fanfare();
      keep(); renderLive(); publish();
      return true;
    }
    function reveal(i) {
      const q = curQ();
      if (apply({ t: 'reveal', i: i }, K.sound.ding)) K.announce(root, STR.found(q.answer[i].text, q.answer[i].points));
    }
    function strike() { if (apply({ t: 'strike' })) K.announce(root, game.phase === 'done' ? status() : STR.struck(game.strikes)); }
    function next() {
      if (!game || game.phase !== 'done') return;
      const nq = qs()[game.qi + 1];
      apply({ t: 'next', n: nq ? nq.answer.length : 0 });
      if (game.phase === 'end') { K.sound.fanfare(); K.announce(root, STR.ended); }
    }
    function undo() { if (!history.length) return; game = history.pop(); keep(); renderLive(); publish(); }
    function checkGuess(inp) {
      const g = inp.value.trim(); if (!g) return;
      const r = C.check(curQ(), g);
      const i = r.ok && !game.revealed[r.index] ? r.index : -1;
      inp.value = '';
      if (i >= 0) reveal(i);
      else { say(STR.notFound(g)); strike(); }
    }
    function renderLive() {
      live.textContent = '';
      if (!game) return;
      const t = game.teams;
      const head = K.el('div', 'qz-pres-head');
      head.appendChild(K.el('p', 'game-msg ta-status', status()));
      if (game.phase !== 'end') head.appendChild(K.el('p', 'game-msg', STR.strikesOf(game.strikes) + ' · ' + STR.board(game.bank)));
      live.appendChild(head);
      if (game.phase !== 'end') {
        const q = curQ();
        live.appendChild(K.el('p', 'qz-pres-q', STR.question(game.qi + 1) + ': ' + q.prompt));
        const ol = K.el('ol', 'ta-host-slots');
        q.answer.forEach(function (a, i) {
          const r = game.revealed[i];
          const b = K.button((i + 1) + '  ' + a.text + ' — ' + a.points, 'btn-ghost ta-slot' + (r ? ' is-on' : ''), function () { reveal(i); });
          b.setAttribute('aria-pressed', String(!!r));
          if (r) b.textContent = '✓ ' + b.textContent;
          const li = K.el('li'); li.appendChild(b); ol.appendChild(li);
        });
        live.appendChild(ol);
        if (game.phase === 'play' || game.phase === 'steal') {
          const gRow = K.el('div', 'game-row ta-guess');
          const inp = K.el('input', 'ta-guess-in'); inp.type = 'text'; inp.maxLength = 60; inp.setAttribute('aria-label', STR.guess); inp.placeholder = STR.guess;
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); checkGuess(inp); } });
          gRow.appendChild(inp);
          gRow.appendChild(K.button(STR.check, 'btn-ghost', function () { checkGuess(inp); }));
          live.appendChild(gRow);
        }
      }
      const ctl = K.el('div', 'game-row qz-pres-ctl');
      if (game.phase === 'play') ctl.appendChild(K.button(STR.strike, 'btn-primary game-big ta-strike', strike));
      if (game.phase === 'steal') ctl.appendChild(K.button(STR.stealMiss, 'btn-primary game-big ta-strike', strike));
      if (game.phase === 'play' && !game.strikes && game.revealed.every(function (r) { return !r; })) ctl.appendChild(K.button(STR.switchT, 'btn-ghost', function () { apply({ t: 'switch' }); }));
      if (game.phase === 'done') {
        if (game.revealed.some(function (r) { return !r; })) ctl.appendChild(K.button(STR.rest, 'btn-ghost', function () { apply({ t: 'rest' }, K.sound.ding); }));
        ctl.appendChild(K.button(game.qi + 1 >= game.total ? STR.finish : STR.next, 'btn-primary game-big', next));
      }
      if (history.length) ctl.appendChild(K.button(STR.undo, 'btn-ghost', undo));
      live.appendChild(ctl);
      const tl = K.el('div', 'qz-teams');
      t.forEach(function (name, i) {
        const row = K.el('div', 'qz-teamrow');
        row.style.setProperty('--tc', 'var(--t' + (i + 1) + ')');
        row.appendChild(K.el('span', 'qz-team-name', name));
        row.appendChild(K.el('span', 'qz-team-score', String(game.scores[i])));
        tl.appendChild(row);
      });
      live.appendChild(tl);
      const foot = K.el('div', 'game-row');
      foot.appendChild(K.button(showScores ? STR.hideScores : STR.scores, 'btn-ghost', function () { showScores = !showScores; renderLive(); publish(); }));
      foot.appendChild(K.button(STR.endGame, 'btn-ghost', function () { game = null; history = []; keep(); K.wakeLock(false); renderPlay(); publish(); }));
      live.appendChild(foot);
    }
    document.addEventListener('keydown', function (e) {
      if (!game || P.tab !== 1 || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
      if (t && t.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
      if (hostKey(e.key)) e.preventDefault();
    });
    function hostKey(key) {
      if (!game) return false;
      if (/^[1-8]$/.test(key) && game.phase !== 'end') { if (Number(key) <= curQ().answer.length) reveal(Number(key) - 1); return true; }
      if (key === 'x' || key === 'X') { strike(); return true; }
      if (key === 'u' || key === 'U') { undo(); return true; }
      if (key === 't' || key === 'T') { apply({ t: 'switch' }); return true; }
      if (key === 'ArrowRight') { next(); return true; }
      if (key === 's' || key === 'S') { showScores = !showScores; renderLive(); publish(); return true; }
      return false;
    }
    stage.onKey = hostKey;

    /* ----- Print ----- */
    const pPanel = K.el('section', 'game-panel');
    const pRow = K.el('div', 'game-row');
    [['host', STR.printH], ['survey', STR.printS]].forEach(function (x) { pRow.appendChild(K.button(x[1], 'btn-ghost', function () { doPrint(x[0]); })); });
    pPanel.appendChild(pRow);
    pPanel.appendChild(K.el('p', 'game-msg', STR.printHint));
    panes[2].appendChild(pPanel);
    function doPrint(kind) {
      const old = document.querySelector('.qz-print'); if (old) old.remove();
      const box = printDoc(rec.quiz, kind);
      document.body.appendChild(box);
      document.documentElement.classList.add('qz-printing');
      const done = function () { window.removeEventListener('afterprint', done); document.documentElement.classList.remove('qz-printing'); box.remove(); };
      window.addEventListener('afterprint', done);
      window.print();
    }

    function setTab(i) {
      P.tab = i; persistPrefs();
      tabB.forEach(function (b, j) { b.setAttribute('aria-pressed', String(i === j)); });
      panes.forEach(function (p, j) { p.hidden = i !== j; });
      if (i === 1) renderPlay();
    }

    /* ----- start ----- */
    C.store.persistent().then(function (ok) {
      persistent = ok;
      return P.current ? C.store.getQuiz(P.current) : null;
    }).then(function (r) {
      if (preset.title) {
        if (r && r.quiz.title === preset.title) { useRec(r); return; }
        return C.store.listQuizzes('survey').then(function (list) {
          const mine = list.filter(function (x) { return x.title === preset.title; })[0];
          if (mine) return C.store.getQuiz(mine.id).then(useRec);
          return newSet(preset.title);
        });
      }
      if (r && r.kind === 'survey') { useRec(r); return; }
      return C.store.listQuizzes('survey').then(function (list) {
        if (list.length) return C.store.getQuiz(list[0].id).then(useRec);
        return newSet();
      });
    }).then(function () {
      setTab(preset.title ? 0 : (P.tab | 0));
      saveLine.textContent = persistent ? STR.saved : STR.savedMem;
      publish();
    });
    root.topAnswers = { get game() { return game; }, get rec() { return rec; }, flush: function () { clearTimeout(saveT); return C.store.putQuiz(rec); } };
  }

  spec.maths = { act: act, newGame: newGame, printDoc: printDoc, words: words, STRIKES: STRIKES };

  document.addEventListener('DOMContentLoaded', function () {
    const root = document.querySelector('[data-tool="' + SLUG + '"]');
    if (!root || !K || !C) return;
    let host = null;
    const stage = K.stage({
      slug: SLUG,
      title: 'Top Answers',
      render: renderStage,
      onCommand: function (m) { if (m && m.type === 'key' && host && host.onKey) host.onKey(m.key); }
    });
    if (stage.isStage) return;
    host = stage;
    mount(root, stage);
  });
})();
