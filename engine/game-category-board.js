/**
 * Category Quiz Board, on the device.
 *
 * A board of 3 to 6 categories across and 3 to 6 rows down, worth 100, 200,
 * 300… points. The host picks a square, the TV (engine/game-kit.js's stage)
 * shows its question, Reveal shows the answer, the host gives the points to
 * the team that got it (and, if chosen, takes them off a team that got it
 * wrong), and the square greys out. One square, drawn at random when the
 * game starts (GameKit.randInt, every square equally likely), is the double:
 * the TV says so before its question and it scores twice. When every square
 * is used the TV shows the final scores.
 *
 * Boards are built and saved like quizzes, in the same IndexedDB store
 * (engine/game-quiz-core.js, kind 'board'): a board is a quiz whose rounds are
 * the categories and whose questions are the rows. Nothing is uploaded.
 */
(function () {
  'use strict';
  window.GAME_TOOLS = window.GAME_TOOLS || {};
  const spec = window.GAME_TOOLS['category-board'] = {
    order: 9,
    title: 'Category Quiz Board',
    short: 'Quiz Board',
    description: 'A quiz board of categories and points for the TV or the classroom projector: pick a square, reveal the answer, give the points to a team. One hidden double square. Build, save and print boards. Free, nothing uploaded.',
    keywords: ['quiz board', 'category quiz game', 'classroom review game', 'points quiz board', 'quiz board maker', 'review game for class', 'trivia board game on tv'],
    glyph: 'i-category-board',
    glyphSvg: '<symbol id="i-category-board" viewBox="0 0 24 24">\n  <rect x="2.6" y="3.4" width="18.8" height="17.2" rx="2.2"/>\n  <path d="M2.6 8.2h18.8M8.9 3.4v17.2M15.1 3.4v17.2M2.6 12.4h18.8M2.6 16.5h18.8" class="thin"/>\n  <rect x="10.4" y="13.6" width="3.2" height="1.8" rx=".5" class="fill"/>\n</symbol>',
    scripts: ['/engine/game-kit.js', '/engine/game-quiz-core.js', '/engine/game-category-board.js'],
    privacy: 'Your boards and the scores stay on this device: they are kept in this browser’s own storage and shown on your own screens. Nothing is uploaded.',
    how: [
      'Type a title for the board.',
      'Choose how many categories (across) and rows (down) the board has: 3 to 6 of each.',
      'Type a name for each category, then a question and its answer in each square. The page saves as you type.',
      'Press 2 Play, type the team names (one per line) and press Start the game.',
      'Press Show on TV and drag the new window to the TV or projector, then press Full screen there. With one screen, press Full screen here.',
      'Press a square on your page. The TV shows its question; your page also shows the answer.',
      'Press Reveal (or the R key) to show the answer on the TV.',
      'Press Right for the team that got it (or the team’s number key). Press it again to undo.',
      'Press Back to board (or B). The square greys out. When every square is used, the TV shows the final scores.',
      'To play again, press End game, then Start the game. A new double square is drawn.'
    ],
    manual: {
      setup: [
        'Press New board, type a title and choose the number of categories and rows.',
        'Type each category name, then a question and an answer in every square.',
        'Fix anything listed under the board (an empty question or answer) until it says ready to play.',
        'Press 2 Play and type the team names, one per line.'
      ],
      play: [
        'Press Start the game. A double square is hidden on the board.',
        'Let a team choose a category and value, and press that square.',
        'If it is the double, the TV says Double points first: press Show the question.',
        'Press Reveal (R), then Right (or the team’s number key) for the team that got it.',
        'Press Back to board (B). Show scores (S) puts the scores on the TV at any time.'
      ],
      tv: [
        'On the Play tab, press Show on TV. A new window opens with the board.',
        'Drag that window to the TV or projector, or cast that browser tab.',
        'Press Full screen in that window. Your own page stays the host’s view with the answers.',
        'With only one screen, press Full screen here; press Esc to come back.'
      ],
      troubleshooting: [
        { q: 'The TV window says it is waiting for the host.', a: 'Keep the host page open in the same browser on the same computer, and press a square or Show scores: the TV follows the host page.' },
        { q: 'Start the game does nothing.', a: 'The board has something to fix: an empty question or answer, or a category without a name. The list under the button names each one.' },
        { q: 'I gave the points to the wrong team.', a: 'While the square is open, press that team’s Right button again to take the points back. After Back to board, use that team’s −100 or +100 button under the board.' },
        { q: 'My board is gone.', a: 'Boards are kept in this browser on this device. A private window forgets them when it closes; use Export file to keep a copy.' }
      ]
    },
    uses: [
      ['Classroom review', 'five topics from the unit, easy to hard, played in teams before a test'],
      ['Family games night', 'categories for every age, with the youngest choosing first'],
      ['Club or office quiz', 'a quick board on the projector to start a meeting or a social']
    ],
    tips: [
      'Put the easy questions at the top: the rows are worth 100, 200, 300 and so on going down.',
      'The double square is drawn when you press Start the game, every square equally likely, and nobody sees which it is until it is picked — not even you.',
      'Tick “Take points off for a wrong answer” for a harder game: each team then gets a Wrong button as well as Right.',
      'Number keys 1 to 9 give the points to team 1 to 9, R reveals, B goes back to the board and S shows the scores.',
      'Print the board for a whiteboard version, and the host’s sheet with every question and answer.',
      'Changing the number of rows or categories keeps what you typed in the squares you hide, so you can change it back.'
    ],
    faq: [
      { q: 'Is anything uploaded?', a: 'No. The board, the questions and the scores are kept in this browser’s storage on this device and shown on your own screens. Export file saves a copy wherever you choose.' },
      { q: 'How is the double square chosen?', a: 'When you press Start the game, one square is drawn using your browser’s cryptographic random numbers, with every square equally likely. It stays hidden until a team picks it; then the TV says Double points and the square scores twice.' },
      { q: 'How big can the board be?', a: 'From 3 to 6 categories across and 3 to 6 rows down, so 9 to 36 squares. The rows are worth 100, 200, 300, 400, 500 and 600 points.' },
      { q: 'Can I take points off for a wrong answer?', a: 'Yes. Tick “Take points off for a wrong answer” before you start, and each team gets a Wrong button that takes off the square’s value (twice that on the double).' },
      { q: 'How do I show it on the classroom projector?', a: 'On the Play tab, press Show on TV, drag the new window to the projector and press Full screen there. Your laptop keeps the host’s view with the answers. With one screen, press Full screen here.' },
      { q: 'Can I reuse a board next year?', a: 'Yes. Boards are saved on this device under My boards; Export file saves a .json file you can keep or send, and Import file opens it on another device.' },
      { q: 'Does it work offline?', a: 'Yes. After the first visit the page opens without a connection, and your boards are kept on the device.' }
    ],
    related: ['/games/quiz-maker/', '/games/scoreboard/', '/games/team-generator/'],
    landings: [
      {
        slug: 'classroom-review-game-board',
        title: 'Classroom Review Game Board',
        description: 'A review game board for class: five topics, questions worth 100 to 500, teams and scores on the projector, one hidden double. Free, no sign-up, nothing uploaded.',
        lede: 'Five topics across, five questions down from easy to hard: the class picks a square, you reveal the answer and the scores are kept for you on the projector.',
        preset: { title: 'Class Review', categories: ['Topic 1', 'Topic 2', 'Topic 3', 'Topic 4', 'Topic 5'], rows: 5, teams: 'Team A\nTeam B\nTeam C\nTeam D' },
        about: [
          'The board opens with five topics and five rows to fill. Rename the topics after the parts of the unit, and write the questions from easy (100) to hard (500).',
          'Split the class into teams (the Team Generator can do it fairly), take turns to choose a square, and give the points on your laptop while the projector shows the question and then the answer.'
        ],
        faq: [
          { q: 'How long does a 25-square board take?', a: 'About 30 to 40 minutes with four teams, if each question gets up to a minute. A 3 × 3 board fits a 15-minute end-of-lesson review.' },
          { q: 'Can pupils see the answers on the projector before I reveal them?', a: 'No. The projector only shows the question until you press Reveal. The answer is on your own screen only.' }
        ]
      }
    ]
  };

  /* ---------- the rules, readable in Node ---------- */

  const MIN = 3, MAX = 6, STEP = 100;
  /** A square's value: row 0 is 100, row 1 is 200 … */
  function value(row) { return (row + 1) * STEP; }
  /** Square index (row-major: across, then down) → { col, row }. */
  function cellOf(idx, cols) { return { col: idx % cols, row: Math.floor(idx / cols) }; }
  /** The double square: one of rows × cols, each equally likely. */
  function drawDouble(cols, rows, randInt) { return randInt(cols * rows); }
  function clampSize(n) { n = Math.round(Number(n)); return n >= MIN && n <= MAX ? n : 5; }
  /** What a square is worth to a team: value, twice on the double, times the mark (+1 right, −1 wrong). */
  function cellPoints(idx, cols, dbl, mark) { return (mark || 0) * value(cellOf(idx, cols).row) * (idx === dbl ? 2 : 1); }
  /** Team totals from the marks: marks = { idx: [mark per team] }, plus any hand adjustments. */
  function scores(g) {
    const out = g.teams.map(function (t, i) { return (g.adjust && g.adjust[i]) || 0; });
    Object.keys(g.marks || {}).forEach(function (k) {
      const idx = Number(k);
      (g.marks[k] || []).forEach(function (m, t) { if (t < out.length) out[t] += cellPoints(idx, g.cols, g.dbl, m); });
    });
    return out;
  }
  /** Ranks with ties sharing a place (1, 1, 3). */
  function standings(g) {
    const s = scores(g);
    const list = g.teams.map(function (name, i) { return { name: name, score: s[i], i: i }; });
    list.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
    list.forEach(function (t, k) { t.rank = k && list[k - 1].score === t.score ? list[k - 1].rank : k + 1; });
    return list;
  }
  /** The board a game is played on: the first `cols` categories and their first `rows` questions. */
  function playable(quiz, cols, rows) {
    return { v: 1, title: quiz.title, rounds: quiz.rounds.slice(0, cols).map(function (r) { return { name: r.name, questions: r.questions.slice(0, rows) }; }) };
  }
  /** The core's “Round 2, question 3:” becomes “Category 2, 300:”. */
  function boardWords(msg) {
    return String(msg).replace(/^Round (\d+), question (\d+): /, function (m, c, r) { return 'Category ' + c + ', ' + value(Number(r) - 1) + ': '; })
      .replace(/^Round (\d+): the round needs a name\./, 'Category $1: the category needs a name.')
      .replace(/^Round (\d+): the round has no questions\./, 'Category $1: the category has no questions.')
      .replace(/the quiz needs a title/, 'the board needs a title');
  }

  if (typeof document === 'undefined') return;
  const K = window.GameKit, C = window.QuizCore;
  const SLUG = 'category-board';

  const STR = {
    untitled: 'My quiz board', cat: function (n) { return 'Category ' + n; },
    myBoards: 'My boards', newBoard: 'New board', importF: 'Import file', exportF: 'Export file', del: 'Delete board',
    tabs: ['Build', 'Play', 'Print'],
    title: 'Board title', cols: 'Categories (across)', rows: 'Rows (down)', catName: 'Category name',
    question: function (v) { return v + ' — question'; }, answer: 'Answer', note: 'Note for the host (optional)',
    saved: 'Saved on this device.', savedMem: 'This browser blocks storage: the board is kept until you close the page. Use Export file to keep it.',
    problems: function (n) { return n === 1 ? '1 thing to fix before playing:' : n + ' things to fix before playing:'; },
    ready: function (n) { return n + ' squares — ready to play.'; },
    imported: function (t) { return 'Opened “' + t + '” from the file as a new board.'; },
    importBad: 'That file is not a board or quiz this page can read.',
    delAsk: 'Delete this board from this device? This cannot be undone.', deleted: 'Board deleted.',
    teams: 'Teams (one per line, 2 to 9)', minus: 'Take points off for a wrong answer',
    start: 'Start the game', resume: 'Carry on the last game', fixFirst: 'Fix these first, on the Build tab:',
    pickSquare: 'Press a square to open its question.',
    dblHost: 'This is the double square: it scores twice.', showQ: 'Show the question  (Enter)',
    reveal: 'Reveal  (R)', back: 'Back to board  (B)', scores: 'Show scores  (S)', hideScores: 'Hide scores  (S)',
    endGame: 'End game', finish: 'Final scores',
    right: function (v) { return 'Right +' + v; }, wrong: function (v) { return 'Wrong −' + v; },
    adjust: 'Change a score by hand', plus: '+100', less: '−100',
    answerIs: 'Answer', noteIs: 'Note',
    used: 'used', squareLabel: function (cat, v, used) { return cat + ', ' + v + (used ? ' (used)' : ''); },
    opened: function (cat, v) { return cat + ' for ' + v + ' is open.'; },
    revealed: 'The answer is on the TV.',
    marked: function (name, d) { return name + (d > 0 ? ' +' + d : d < 0 ? ' ' + d : ' — mark taken off') + '.'; },
    ended: 'Every square is used: the final scores are on the TV.',
    printB: 'Print the board', printH: 'Print the host’s sheet',
    printHint: 'The board prints as a grid of categories and values for a whiteboard or wall; the host’s sheet has every question and answer.',
    tvWait: 'The board appears here when the host starts the game.',
    tvDouble: 'Double points!', tvScores: 'Scores', tvFinal: 'Final scores', tvFor: function (v) { return 'for ' + v; }
  };

  /* ---------- the big screen ---------- */

  function renderStage(body, s) {
    body.textContent = '';
    if (!s || !s.view || s.view === 'idle') { body.appendChild(K.el('p', 'game-stage-wait', STR.tvWait)); return; }
    const wrap = K.el('div', 'st-qz st-cb');
    if (s.view === 'scores' || s.view === 'end') {
      wrap.appendChild(K.el('h1', 'st-title', s.view === 'end' ? STR.tvFinal : STR.tvScores));
      const ol = K.el('ol', 'st-qz-scores');
      (s.scores || []).forEach(function (t) {
        const li = K.el('li', 'st-qz-score' + (s.view === 'end' && t.rank === 1 ? ' is-win' : ''));
        li.style.setProperty('--tc', 'var(--t' + ((t.i % 8) + 1) + ')');
        li.appendChild(K.el('span', 'st-qz-rank', String(t.rank)));
        li.appendChild(K.el('span', 'st-qz-name', t.name));
        li.appendChild(K.el('span', 'st-qz-pts', String(t.score)));
        ol.appendChild(li);
      });
      wrap.appendChild(ol);
      body.appendChild(wrap);
      return;
    }
    if (s.view === 'board') {
      wrap.appendChild(K.el('p', 'st-qz-meta', s.title));
      const grid = K.el('div', 'st-cb-grid');
      grid.style.setProperty('--cols', s.cats.length);
      s.cats.forEach(function (c, i) { const h = K.el('div', 'st-cb-cat', c); h.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')'); grid.appendChild(h); });
      for (let r = 0; r < s.rows; r++) {
        for (let c = 0; c < s.cats.length; c++) {
          const used = s.used.indexOf(r * s.cats.length + c) >= 0;
          grid.appendChild(K.el('div', 'st-cb-cell' + (used ? ' is-used' : ''), used ? '' : String(value(r))));
        }
      }
      wrap.appendChild(grid);
      body.appendChild(wrap);
      return;
    }
    if (s.view === 'double') {
      wrap.classList.add('is-round');
      wrap.appendChild(K.el('p', 'st-qz-meta', s.cat + ' · ' + STR.tvFor(s.value)));
      wrap.appendChild(K.el('h1', 'st-qz-roundname st-cb-double', STR.tvDouble));
      wrap.appendChild(K.el('p', 'st-cb-x2', s.value + ' × 2 = ' + (s.value * 2)));
      body.appendChild(wrap);
      return;
    }
    wrap.appendChild(K.el('p', 'st-qz-meta', s.cat + ' · ' + (s.dbl ? s.value + ' × 2' : String(s.value))));
    const p = K.el('h1', 'st-qz-prompt', s.prompt);
    const n = String(s.prompt || '').length;
    p.style.setProperty('--fs', (n < 50 ? 7 : n < 110 ? 5.6 : n < 220 ? 4.4 : 3.4) + 'vmin');
    wrap.appendChild(p);
    if (s.view === 'reveal') {
      const a = K.el('p', 'st-qz-answer');
      a.appendChild(K.el('span', 'st-qz-tag', STR.answerIs));
      a.appendChild(document.createTextNode(s.answer));
      wrap.appendChild(a);
      if (s.note) wrap.appendChild(K.el('p', 'st-qz-note', s.note));
    }
    body.appendChild(wrap);
  }

  /* ---------- printing ---------- */

  function printDoc(rec, kind) {
    const quiz = playable(rec.quiz, rec.cols, rec.rows);
    const box = K.el('div', 'qz-print cb-print');
    box.appendChild(K.el('h1', null, quiz.title || STR.untitled));
    if (kind === 'board') {
      const t = K.el('table', 'cb-print-board');
      const hr = K.el('tr');
      quiz.rounds.forEach(function (r) { hr.appendChild(K.el('th', null, r.name)); });
      t.appendChild(hr);
      for (let r = 0; r < rec.rows; r++) {
        const tr = K.el('tr');
        quiz.rounds.forEach(function () { tr.appendChild(K.el('td', null, String(value(r)))); });
        t.appendChild(tr);
      }
      box.appendChild(t);
      return box;
    }
    quiz.rounds.forEach(function (r) {
      const sec = K.el('section');
      sec.appendChild(K.el('h2', null, r.name));
      const ol = K.el('ol', 'cb-print-list');
      r.questions.forEach(function (q, i) {
        const li = K.el('li');
        li.appendChild(K.el('p', 'qz-print-q', value(i) + ' — ' + (q.prompt || '')));
        li.appendChild(K.el('p', 'qz-print-a', STR.answerIs + ': ' + (q.answer || '')));
        if (q.note) li.appendChild(K.el('p', 'qz-print-note', q.note));
        ol.appendChild(li);
      });
      sec.appendChild(ol);
      box.appendChild(sec);
    });
    return box;
  }

  /* ---------- the page ---------- */

  function mount(root, stage) {
    const io = root.querySelector('.tool-io');
    const prefs = K.store(SLUG, 1);
    const preset = K.preset(root);
    const P = Object.assign({ current: null, tab: 0, teams: preset.teams || 'Team 1\nTeam 2\nTeam 3', minus: false, game: null }, prefs.get({}));
    if (preset.teams) P.teams = preset.teams;
    let rec = null, persistent = true, saveT = 0, game = null, showScores = false;

    function persistPrefs() { prefs.set(P); }

    /* top bar */
    const top = K.el('section', 'game-panel qz-top');
    const pick = K.el('select'); pick.setAttribute('aria-label', STR.myBoards);
    const bar1 = K.el('div', 'game-row'); bar1.appendChild(K.field(STR.myBoards, pick).wrap);
    const file = K.el('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
    const bar2 = K.el('div', 'game-row');
    bar2.appendChild(K.button(STR.newBoard, 'btn-ghost', function () { newBoard(); }));
    bar2.appendChild(K.button(STR.importF, 'btn-ghost', function () { file.click(); }));
    bar2.appendChild(K.button(STR.exportF, 'btn-ghost', exportBoard));
    bar2.appendChild(K.button(STR.del, 'btn-ghost', deleteBoard));
    top.appendChild(bar1); top.appendChild(bar2); top.appendChild(file);
    const msg = K.el('p', 'game-msg'); msg.setAttribute('role', 'status'); top.appendChild(msg);
    io.appendChild(top);

    const tabs = K.el('div', 'game-seg qz-tabs'); tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'Mode');
    const tabB = STR.tabs.map(function (t, i) { const b = K.button((i + 1) + '  ' + t, null, function () { setTab(i); }); tabs.appendChild(b); return b; });
    io.appendChild(tabs);
    const panes = [K.el('div', 'qz-pane cb-build'), K.el('div', 'qz-pane cb-play'), K.el('div', 'qz-pane cb-printpane')];
    panes.forEach(function (p) { io.appendChild(p); });

    function say(text, warn) { msg.textContent = text; msg.className = 'game-msg' + (warn ? ' is-warn' : ''); K.announce(root, text); }

    /* ----- boards: saving and choosing ----- */
    function blankBoard(title, cats, rows) {
      const names = cats && cats.length ? cats.slice(0, MAX) : [STR.cat(1), STR.cat(2), STR.cat(3), STR.cat(4), STR.cat(5)];
      const n = clampSize(rows || 5);
      return {
        id: C.newId('b'), kind: 'board', cols: Math.max(MIN, names.length), rows: n,
        quiz: { v: 1, title: title || STR.untitled, rounds: names.map(function (name) { return { name: name, questions: blanks(n) }; }) }
      };
    }
    function blanks(n) { const out = []; for (let i = 0; i < n; i++) out.push({ type: 'text', prompt: '', answer: '' }); return out; }
    /** Every category and row the size asks for exists (hidden ones are kept). */
    function fill() {
      const q = rec.quiz;
      while (q.rounds.length < rec.cols) q.rounds.push({ name: STR.cat(q.rounds.length + 1), questions: [] });
      q.rounds.forEach(function (r) { while (r.questions.length < rec.rows) r.questions.push({ type: 'text', prompt: '', answer: '' }); });
    }
    function save(now) {
      clearTimeout(saveT);
      const go = function () { C.store.putQuiz(rec).then(function () { refreshPick(); saveLine.textContent = STR.saved; }).catch(function () { persistent = false; saveLine.textContent = STR.savedMem; }); };
      if (now) go(); else saveT = setTimeout(go, 400);
      checkBoard();
    }
    function refreshPick() {
      return C.store.listQuizzes('board').then(function (list) {
        pick.textContent = '';
        list.forEach(function (r) { const o = K.el('option', null, r.title || STR.untitled); o.value = r.id; pick.appendChild(o); });
        if (rec) pick.value = rec.id;
      });
    }
    function useRec(r) {
      rec = r; rec.cols = clampSize(rec.cols); rec.rows = clampSize(rec.rows); fill();
      P.current = r.id; persistPrefs();
      if (game && game.id !== r.id) game = null;
      renderBuild(); renderPlay(); refreshPick();
    }
    function newBoard(title, cats, rows) {
      return C.store.putQuiz(blankBoard(title, cats, rows)).then(function (saved) { useRec(saved); setTab(0); return saved; });
    }
    pick.addEventListener('change', function () { C.store.getQuiz(pick.value).then(function (r) { if (r) useRec(r); }); });
    function exportBoard() {
      C.exportFile(playable(rec.quiz, rec.cols, rec.rows), 'board').then(function (data) {
        const name = (rec.quiz.title || 'board').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'board';
        K.download(new Blob([JSON.stringify(data)], { type: 'application/json' }), name + '.board.json');
      });
    }
    file.addEventListener('change', function () {
      const f = file.files && file.files[0];
      file.value = '';
      if (!f) return;
      f.text().then(function (t) { return C.importFile(t); }).then(function (res) {
        const rounds = res.quiz.rounds.filter(function (r) { return r.questions.length; }).slice(0, MAX);
        if (!rounds.length) throw new Error('empty');
        const rows = clampSize(Math.min(MAX, Math.max(MIN, Math.max.apply(null, rounds.map(function (r) { return r.questions.length; })))));
        const r = { id: C.newId('b'), kind: 'board', cols: Math.max(MIN, rounds.length), rows: rows, quiz: { v: 1, title: res.quiz.title, rounds: rounds } };
        return C.store.putQuiz(r).then(function (saved) { useRec(saved); setTab(0); say(STR.imported(saved.quiz.title)); });
      }).catch(function () { say(STR.importBad, true); });
    });
    function deleteBoard() {
      if (!window.confirm(STR.delAsk)) return;
      C.store.deleteQuiz(rec.id).then(function () { return C.store.listQuizzes('board'); }).then(function (list) {
        say(STR.deleted);
        if (list.length) return C.store.getQuiz(list[0].id).then(useRec);
        return newBoard();
      });
    }

    /* ----- Build ----- */
    const build = panes[0];
    const head = K.el('section', 'game-panel');
    const titleIn = K.el('input'); titleIn.type = 'text'; titleIn.maxLength = 120;
    titleIn.addEventListener('input', function () { rec.quiz.title = titleIn.value; save(); });
    head.appendChild(K.field(STR.title, titleIn).wrap);
    const sizes = K.el('div', 'game-row');
    function sizeSel(label, key) {
      const s = K.el('select');
      for (let n = MIN; n <= MAX; n++) { const o = K.el('option', null, String(n)); o.value = String(n); s.appendChild(o); }
      s.addEventListener('change', function () { rec[key] = clampSize(s.value); fill(); renderBuild(); save(); });
      sizes.appendChild(K.field(label, s).wrap);
      return s;
    }
    const colSel = sizeSel(STR.cols, 'cols'), rowSel = sizeSel(STR.rows, 'rows');
    head.appendChild(sizes);
    const saveLine = K.el('p', 'game-msg qz-saved', '');
    head.appendChild(saveLine);
    const checkBox = K.el('div', 'qz-check');
    head.appendChild(checkBox);
    build.appendChild(head);
    const cats = K.el('div', 'qz-rounds cb-cats');
    build.appendChild(cats);

    function checkBoard() {
      const v = C.validate(playable(rec.quiz, rec.cols, rec.rows));
      checkBox.textContent = '';
      if (v.ok) { checkBox.appendChild(K.el('p', 'game-msg qz-ok', STR.ready(rec.cols * rec.rows))); return v; }
      checkBox.appendChild(K.el('p', 'game-msg is-warn', STR.problems(v.errors.length)));
      const ul = K.el('ul', 'qz-errors');
      v.errors.slice(0, 8).forEach(function (e) { ul.appendChild(K.el('li', null, boardWords(e))); });
      checkBox.appendChild(ul);
      return v;
    }
    function renderBuild() {
      titleIn.value = rec.quiz.title;
      colSel.value = String(rec.cols); rowSel.value = String(rec.rows);
      cats.textContent = '';
      rec.quiz.rounds.slice(0, rec.cols).forEach(function (r, ci) {
        const sec = K.el('section', 'game-panel qz-round cb-cat');
        sec.style.setProperty('--tc', 'var(--t' + ((ci % 8) + 1) + ')');
        const name = K.el('input'); name.type = 'text'; name.maxLength = 40; name.value = r.name;
        name.addEventListener('input', function () { r.name = name.value; save(); });
        sec.appendChild(K.field(STR.catName + ' ' + (ci + 1), name).wrap);
        const ol = K.el('ol', 'qz-qs');
        r.questions.slice(0, rec.rows).forEach(function (q, ri) {
          const li = K.el('li', 'qz-q cb-sq');
          const pr = K.el('textarea', 'qz-prompt'); pr.rows = 2; pr.maxLength = 500; pr.value = q.prompt || '';
          pr.addEventListener('input', function () { q.prompt = pr.value; save(); });
          li.appendChild(K.field(STR.question(value(ri)), pr).wrap);
          const an = K.el('input', 'cb-answer'); an.type = 'text'; an.maxLength = 200; an.value = q.answer || '';
          an.addEventListener('input', function () { q.answer = an.value; save(); });
          li.appendChild(K.field(STR.answer, an).wrap);
          const nt = K.el('input'); nt.type = 'text'; nt.maxLength = 500; nt.value = q.note || '';
          nt.addEventListener('input', function () { if (nt.value) q.note = nt.value; else delete q.note; save(); });
          li.appendChild(K.field(STR.note, nt).wrap);
          ol.appendChild(li);
        });
        sec.appendChild(ol);
        cats.appendChild(sec);
      });
      checkBoard();
    }

    /* ----- Play ----- */
    const play = panes[1];
    const setup = K.el('section', 'game-panel qz-setup');
    const live = K.el('section', 'game-panel qz-live cb-live'); live.hidden = true;
    play.appendChild(setup); play.appendChild(live);
    play.appendChild(stage.bar());

    function cat(idx) { return rec.quiz.rounds[cellOf(idx, game.cols).col].name; }
    function qOf(idx) { const c = cellOf(idx, game.cols); return rec.quiz.rounds[c.col].questions[c.row]; }
    function valOf(idx) { return value(cellOf(idx, game.cols).row); }

    function renderPlay() {
      setup.textContent = '';
      setup.appendChild(K.el('h2', null, rec.quiz.title || STR.untitled));
      const teams = K.el('textarea'); teams.rows = 4; teams.value = P.teams;
      teams.addEventListener('input', function () { P.teams = teams.value; persistPrefs(); });
      setup.appendChild(K.field(STR.teams, teams).wrap);
      const c = K.el('input'); c.type = 'checkbox'; c.checked = !!P.minus;
      c.addEventListener('change', function () { P.minus = c.checked; persistPrefs(); });
      const l = K.el('label', 'game-check'); l.appendChild(c); l.appendChild(document.createTextNode(STR.minus));
      setup.appendChild(l);
      const row = K.el('div', 'game-row');
      row.appendChild(K.button(STR.start, 'btn-primary game-big', function () { startGame(null); }));
      if (P.game && P.game.id === rec.id) row.appendChild(K.button(STR.resume, 'btn-ghost', function () { startGame(P.game); }));
      setup.appendChild(row);
      setup.appendChild(K.el('div', 'qz-check'));
      setup.hidden = !!game; live.hidden = !game;
      if (game) renderLive();
    }
    function startGame(saved) {
      K.sound.unlock();
      const errs = setup.querySelector('.qz-check');
      errs.textContent = '';
      const v = C.validate(playable(rec.quiz, rec.cols, rec.rows));
      if (!v.ok) {
        errs.appendChild(K.el('p', 'game-msg is-warn', STR.fixFirst));
        const ul = K.el('ul', 'qz-errors'); v.errors.slice(0, 8).forEach(function (e) { ul.appendChild(K.el('li', null, boardWords(e))); }); errs.appendChild(ul);
        return;
      }
      if (saved) game = JSON.parse(JSON.stringify(saved));
      else {
        let names = K.parseList(P.teams, { lines: true, max: 9, maxLen: 30 });
        if (names.length < 1) names = ['Team 1', 'Team 2'];
        game = { id: rec.id, cols: rec.cols, rows: rec.rows, teams: names, minus: !!P.minus, dbl: drawDouble(rec.cols, rec.rows, K.randInt), used: [], marks: {}, adjust: [], open: null, phase: 'board' };
      }
      showScores = false;
      K.wakeLock(true);
      keep(); renderPlay(); publish();
    }
    function keep() { P.game = game ? JSON.parse(JSON.stringify(game)) : null; persistPrefs(); }
    function publish() {
      if (!game) { stage.update({ view: 'idle' }); return; }
      if (showScores || game.phase === 'end') { stage.update({ view: game.phase === 'end' ? 'end' : 'scores', scores: standings(game) }); return; }
      if (game.phase === 'board') {
        stage.update({ view: 'board', title: rec.quiz.title, cats: rec.quiz.rounds.slice(0, game.cols).map(function (r) { return r.name; }), rows: game.rows, used: game.used.slice() });
        return;
      }
      const idx = game.open, q = qOf(idx);
      if (game.phase === 'double') { stage.update({ view: 'double', cat: cat(idx), value: valOf(idx) }); return; }
      const st = { view: game.phase, cat: cat(idx), value: valOf(idx), dbl: idx === game.dbl, prompt: q.prompt };
      if (game.phase === 'reveal') { st.answer = q.answer; st.note = q.note || ''; }
      stage.update(st);
    }
    function openSquare(idx) {
      if (!game || game.phase === 'end' || game.used.indexOf(idx) >= 0) return;
      if (game.open !== null && game.open !== idx) closeSquare(true);
      game.open = idx;
      game.phase = idx === game.dbl ? 'double' : 'question';
      if (!game.marks[idx]) game.marks[idx] = game.teams.map(function () { return 0; });
      if (game.phase === 'double') K.sound.fanfare(); else K.sound.ding();
      showScores = false;
      keep(); renderLive(); publish();
      K.announce(root, game.phase === 'double' ? STR.dblHost : STR.opened(cat(idx), valOf(idx)));
    }
    function showQuestion() { if (game && game.phase === 'double') { game.phase = 'question'; keep(); renderLive(); publish(); } }
    function doReveal() {
      if (!game || game.open === null) return;
      if (game.phase === 'double') { showQuestion(); return; }
      if (game.phase !== 'question') return;
      game.phase = 'reveal'; K.sound.ding();
      keep(); renderLive(); publish();
      K.announce(root, STR.revealed);
    }
    function closeSquare(quiet) {
      if (!game || game.open === null) return;
      if (game.used.indexOf(game.open) < 0) game.used.push(game.open);
      game.open = null; game.phase = 'board';
      if (game.used.length >= game.cols * game.rows) { game.phase = 'end'; K.sound.fanfare(); K.announce(root, STR.ended); }
      if (quiet) return;
      keep(); renderLive(); publish();
    }
    function markTeam(t, m) {
      if (!game || game.open === null || game.phase === 'double' || !game.teams[t]) return;
      const marks = game.marks[game.open];
      const before = marks[t];
      marks[t] = before === m ? 0 : m;
      const d = cellPoints(game.open, game.cols, game.dbl, marks[t]) - cellPoints(game.open, game.cols, game.dbl, before);
      if (marks[t] === 1) K.sound.ding(); else if (marks[t] === -1) K.sound.wrong();
      keep(); renderLive(); if (showScores) publish();
      K.announce(root, STR.marked(game.teams[t], d));
    }
    function adjustTeam(t, d) {
      game.adjust[t] = (game.adjust[t] || 0) + d;
      keep(); renderLive(); if (showScores || game.phase === 'end') publish();
      K.announce(root, STR.marked(game.teams[t], d));
    }
    function renderLive() {
      live.textContent = '';
      if (!game) return;
      const s = scores(game);
      const headP = K.el('p', 'game-msg cb-status');
      live.appendChild(headP);
      if (game.phase === 'end') headP.textContent = STR.ended;
      else if (game.open === null) headP.textContent = STR.pickSquare;
      else headP.textContent = cat(game.open) + ' · ' + valOf(game.open) + (game.open === game.dbl && game.phase !== 'double' ? ' × 2' : '');

      if (game.open !== null) {
        const q = qOf(game.open), val = valOf(game.open) * (game.open === game.dbl ? 2 : 1);
        if (game.phase === 'double') live.appendChild(K.el('p', 'qz-pres-q cb-dbl', STR.dblHost));
        live.appendChild(K.el('p', 'qz-pres-q', q.prompt));
        const ans = K.el('div', 'qz-pres-ans' + (game.phase === 'reveal' ? ' is-shown' : ''));
        ans.appendChild(K.el('strong', null, STR.answerIs + ': '));
        ans.appendChild(document.createTextNode(q.answer));
        if (q.note) ans.appendChild(K.el('p', 'game-field-hint', STR.noteIs + ': ' + q.note));
        live.appendChild(ans);
        const ctl = K.el('div', 'game-row qz-pres-ctl');
        if (game.phase === 'double') ctl.appendChild(K.button(STR.showQ, 'btn-primary game-big', showQuestion));
        else if (game.phase === 'question') ctl.appendChild(K.button(STR.reveal, 'btn-primary game-big', doReveal));
        ctl.appendChild(K.button(STR.back, game.phase === 'reveal' ? 'btn-primary game-big' : 'btn-ghost', function () { closeSquare(false); }));
        live.appendChild(ctl);
        const tl = K.el('div', 'qz-teams');
        game.teams.forEach(function (name, t) {
          const row = K.el('div', 'qz-teamrow');
          row.style.setProperty('--tc', 'var(--t' + ((t % 8) + 1) + ')');
          row.appendChild(K.el('span', 'qz-team-name', name));
          row.appendChild(K.el('span', 'qz-team-score', String(s[t])));
          if (game.phase !== 'double') {
            const m = game.marks[game.open][t];
            const b = K.button((t < 9 ? (t + 1) + '  ' : '') + (m === 1 ? '✓ ' : '') + STR.right(val), 'btn-ghost qz-mark cb-right' + (m === 1 ? ' is-on' : ''), function () { markTeam(t, 1); });
            b.setAttribute('aria-pressed', String(m === 1));
            b.setAttribute('aria-label', name + ': ' + STR.right(val));
            row.appendChild(b);
            if (game.minus) {
              const w = K.button((m === -1 ? '✗ ' : '') + STR.wrong(val), 'btn-ghost qz-mark cb-wrong' + (m === -1 ? ' is-on' : ''), function () { markTeam(t, -1); });
              w.setAttribute('aria-pressed', String(m === -1));
              w.setAttribute('aria-label', name + ': ' + STR.wrong(val));
              row.appendChild(w);
            }
          }
          tl.appendChild(row);
        });
        live.appendChild(tl);
      } else {
        /* the host's board */
        const grid = K.el('div', 'cb-board');
        grid.style.setProperty('--cols', game.cols);
        rec.quiz.rounds.slice(0, game.cols).forEach(function (r, i) { const h = K.el('div', 'cb-board-cat', r.name); h.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')'); grid.appendChild(h); });
        for (let r = 0; r < game.rows; r++) {
          for (let c = 0; c < game.cols; c++) {
            const idx = r * game.cols + c, used = game.used.indexOf(idx) >= 0;
            const b = K.button(used ? '' : String(value(r)), 'cb-sq-btn' + (used ? ' is-used' : ''), function () { openSquare(idx); });
            b.dataset.idx = String(idx);
            b.setAttribute('aria-label', STR.squareLabel(rec.quiz.rounds[c].name, value(r), used));
            if (used) b.disabled = true;
            grid.appendChild(b);
          }
        }
        live.appendChild(grid);
        const tl = K.el('div', 'qz-teams');
        game.teams.forEach(function (name, t) {
          const row = K.el('div', 'qz-teamrow');
          row.style.setProperty('--tc', 'var(--t' + ((t % 8) + 1) + ')');
          row.appendChild(K.el('span', 'qz-team-name', name));
          row.appendChild(K.el('span', 'qz-team-score', String(s[t])));
          const minus = K.button(STR.less, 'btn-ghost cb-adj', function () { adjustTeam(t, -STEP); });
          minus.setAttribute('aria-label', name + ': ' + STR.less);
          const plus = K.button(STR.plus, 'btn-ghost cb-adj', function () { adjustTeam(t, STEP); });
          plus.setAttribute('aria-label', name + ': ' + STR.plus);
          row.appendChild(minus); row.appendChild(plus);
          tl.appendChild(row);
        });
        live.appendChild(tl);
      }
      const foot = K.el('div', 'game-row');
      foot.appendChild(K.button(showScores ? STR.hideScores : STR.scores, 'btn-ghost', function () { showScores = !showScores; renderLive(); publish(); }));
      if (game.phase !== 'end') foot.appendChild(K.button(STR.finish, 'btn-ghost', function () { closeSquare(true); game.phase = 'end'; K.sound.fanfare(); keep(); renderLive(); publish(); }));
      foot.appendChild(K.button(STR.endGame, 'btn-ghost', function () { game = null; keep(); K.wakeLock(false); renderPlay(); publish(); }));
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
      if (key === 'r' || key === 'R') { doReveal(); return true; }
      if (key === 'Enter' && game.phase === 'double') { showQuestion(); return true; }
      if ((key === 'b' || key === 'B') && game.open !== null) { closeSquare(false); return true; }
      if (key === 's' || key === 'S') { showScores = !showScores; renderLive(); publish(); return true; }
      if (/^[1-9]$/.test(key) && game.open !== null) { markTeam(Number(key) - 1, 1); return true; }
      return false;
    }
    stage.onKey = hostKey;

    /* ----- Print ----- */
    const pPanel = K.el('section', 'game-panel');
    const pRow = K.el('div', 'game-row');
    [['board', STR.printB], ['host', STR.printH]].forEach(function (x) { pRow.appendChild(K.button(x[1], 'btn-ghost', function () { doPrint(x[0]); })); });
    pPanel.appendChild(pRow);
    pPanel.appendChild(K.el('p', 'game-msg', STR.printHint));
    panes[2].appendChild(pPanel);
    function doPrint(kind) {
      const old = document.querySelector('.qz-print'); if (old) old.remove();
      const box = printDoc(rec, kind);
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
        return C.store.listQuizzes('board').then(function (list) {
          const mine = list.filter(function (x) { return x.title === preset.title; })[0];
          if (mine) return C.store.getQuiz(mine.id).then(useRec);
          return newBoard(preset.title, preset.categories, preset.rows);
        });
      }
      if (r && r.kind === 'board') { useRec(r); return; }
      return C.store.listQuizzes('board').then(function (list) {
        if (list.length) return C.store.getQuiz(list[0].id).then(useRec);
        return newBoard();
      });
    }).then(function () {
      setTab(preset.title ? 0 : (P.tab | 0));
      saveLine.textContent = persistent ? STR.saved : STR.savedMem;
      publish();
    });
    root.categoryBoard = { get game() { return game; }, get rec() { return rec; }, flush: function () { clearTimeout(saveT); return C.store.putQuiz(rec); } };
  }

  spec.maths = { value: value, cellOf: cellOf, drawDouble: drawDouble, cellPoints: cellPoints, scores: scores, standings: standings, playable: playable, boardWords: boardWords, printDoc: printDoc };

  document.addEventListener('DOMContentLoaded', function () {
    const root = document.querySelector('[data-tool="' + SLUG + '"]');
    if (!root || !K || !C) return;
    let host = null;
    const stage = K.stage({
      slug: SLUG,
      title: 'Quiz board',
      render: renderStage,
      onCommand: function (m) { if (m && m.type === 'key' && host && host.onKey) host.onKey(m.key); }
    });
    if (stage.isStage) return;
    host = stage;
    mount(root, stage);
  });
})();
