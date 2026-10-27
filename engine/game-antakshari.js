/**
 * Antakshari Scorekeeper: the letter, the timer and the score. Nothing else.
 *
 * Teams take turns. Each turn has a letter: the last sound of the previous
 * song (the host taps or types it) or, when there is none, a random letter.
 * The team sings a song that begins with it, from memory, before the clock
 * runs out; the host presses "Song sung" and the team scores. This page has
 * no songs, lyrics, titles or audio: it keeps the letter, the clock and the
 * score, and shows them on the TV.
 *
 * The random letter is drawn with equal chance from the letters in play
 * (GameKit.randInt, the crypto generator with rejection sampling). It is not
 * weighted towards the letters songs most often start with. The host can
 * leave letters out; those that remain stay equally likely.
 *
 * A turn ends at a deadline fixed when it starts and every clock is read
 * against it, so a slow or hidden tab still ends the turn on time.
 */
(function () {
  'use strict';
  window.GAME_TOOLS = window.GAME_TOOLS || {};
  window.GAME_TOOLS['antakshari'] = {
    order: 12,
    title: 'Antakshari Scorekeeper',
    short: 'Antakshari',
    description: 'Run antakshari at a family party: a fair random letter in Hindi or English, a turn timer, rounds with your own rules, and team scores shown big on the TV. No songs, free, no sign-up.',
    keywords: ['antakshari', 'antakshari game', 'antakshari scorekeeper', 'antakshari letter generator', 'antakshari random letter', 'antakshari rules', 'antakshari timer', 'antakshari for family'],
    glyph: 'i-antakshari',
    glyphSvg: '<symbol id="i-antakshari" viewBox="0 0 24 24">\n  <rect x="9" y="2.8" width="6" height="11" rx="3"/>\n  <path d="M5.8 11.2a6.2 6.2 0 0 0 12.4 0"/>\n  <path d="M12 17.4v3.4M8.4 20.8h7.2" class="thin"/>\n</symbol>',
    scripts: ['/engine/game-kit.js', '/engine/game-antakshari.js'],
    privacy: 'The team names and scores stay on this device. The page plays no music and sends nothing anywhere; a game in progress is saved on this device so a refresh can carry on.',
    how: [
      'Choose how many teams (2 to 4), how long each turn lasts and how many points a song scores.',
      'Choose the letters in play, Hindi, English or both, and set a rule for each round, such as any song or songs from one decade.',
      'Press Start game. The first team and its letter appear.',
      'Press Show on TV for the big letter, the clock and the scores.',
      'Press Start timer (or N). The team sings a song that begins with the letter, from memory; the page plays no music.',
      'If the song was sung, press Song sung (or S). If the team cannot, wait for the clock or press Pass (or P).',
      'Tap the last sound of the song, or type it, and press Next team (or N). If you choose no letter, the next team gets a random one.',
      'After the last turn the winner is shown. Press Play again to start over.'
    ],
    manual: {
      setup: [
        'Choose 2 to 4 teams and, if you like, type their names separated by commas.',
        'Choose the time for each turn (30 to 90 seconds) and the points for each song.',
        'Choose Hindi letters, English letters or both. Type any letters you want left out.',
        'Choose the number of rounds and the rule for each one: any song, a decade, a film star, a singer, a theme or your own.',
        'Press Start game.'
      ],
      play: [
        'The team and its letter appear. If the letter is unfair, press New random letter (R) before the clock starts.',
        'Press Start timer (N). The team sings a song that starts with the letter.',
        'When the song has been sung, press Song sung (S) and the team scores. If time runs out, or you press Pass (P), nobody scores.',
        'Tap the last sound of the song in the letter grid, or type it, then press Next team (N).',
        'Made a mistake? Press Undo the points (or Give the points) before you press Next team.'
      ],
      tv: [
        'Press Show on TV (new window) and drag the new window to the TV or projector.',
        'On the TV window press Full screen. It shows the letter, the team, the clock, the round’s rule and the scores.',
        'Keep this page as the remote: all the buttons are here.'
      ],
      troubleshooting: [
        { q: 'I cannot type a Hindi letter.', a: 'Tap it in the letter grid instead; the grid shows every letter in play, including the vowels.' },
        { q: 'The TV window is blank.', a: 'Open it with Show on TV on this page and keep this page open: the TV window follows it.' },
        { q: 'I refreshed the page by mistake.', a: 'Open the game again and press Continue the last game. It returns to the start of the turn you were in, with the scores kept.' },
        { q: 'There is no sound.', a: 'Tick Sound in the set-up. Phones also stay quiet in silent mode.' }
      ]
    },
    uses: [
      ['Family evening', 'two teams, 45 seconds a turn and a round for each decade the grandparents love'],
      ['Wedding or kitty party', 'four tables as teams, the letter and the clock on the projector'],
      ['Road trip or school trip', 'two teams on one phone, no screen to share and no signal needed']
    ],
    tips: [
      'The random letter is equally likely to be any letter in play. It is not weighted towards the letters songs usually start with, so a hard letter can come up just as often as an easy one.',
      'If a letter is awkward, type it into “Leave out these letters” (for English you might leave out X, Q and Z). The letters that remain are still equally likely.',
      'The page holds no songs, lyrics or titles and plays nothing. The team sings from memory and the host decides whether the song counts.',
      'Rules are just the words you give each round, such as “Songs from one decade: 1990s”. They are shown on the TV; the game does not check them.',
      'The clock is read against the device’s own time, so a slow or hidden tab still ends the turn on time.',
      'Press New random letter (R) before the clock starts if the team and the host agree the letter is unfair. It is a fresh equal-chance draw each time.'
    ],
    faq: [
      { q: 'Does it play the songs?', a: 'No. There is no music, no lyrics and no list of song titles on the page. The game is only the letter, the clock and the score; your teams sing from memory.' },
      { q: 'How is the random letter chosen?', a: 'With equal chance from the letters in play, using your browser’s cryptographic random number generator. It is not weighted towards letters that songs usually start with.' },
      { q: 'Which letters are there?', a: 'Hindi: the 30 consonants from क to ह that words commonly start with (ङ, ञ and ण are left out), plus the 10 vowels if you tick Include vowels. English: A to Z. You can also choose both, and you can type letters to leave out.' },
      { q: 'How does the next letter work?', a: 'In antakshari the next team starts with the last sound of the previous song. After a song you tap that sound in the letter grid, or type it, and the next team gets it. If you choose none, the next team gets a random letter, whether or not the last team ran out of time.' },
      { q: 'Can I set my own rules?', a: 'Yes. Each round has a rule you choose: any song, songs from one decade, a film star, a singer, a theme or your own words. The rule is shown on the TV so everyone knows it; the host judges the songs.' },
      { q: 'How many teams can play?', a: 'Two to four, for up to 8 rounds. Each team has one to five turns in every round.' },
      { q: 'Does it work offline?', a: 'Yes. After the first visit it opens without a connection, and a game in progress is saved on this device so a refresh does not lose the scores.' }
    ],
    related: ['/games/scoreboard/', '/games/team-generator/', '/utilities/random-number-generator/'],
    landings: [
      {
        slug: 'antakshari-for-a-family-party',
        title: 'Antakshari for a Family Party',
        description: 'Everything an antakshari night needs except the songs: a fair random letter, a timer for every team, rounds with your own rules and scores big on the TV. Free, no sign-up.',
        lede: 'Two teams, a fair random letter in Hindi or English, 45 seconds a turn and three rounds with a rule each — letter, clock and scores on the TV.',
        preset: { teams: 2, secs: 45, points: 1, alphabet: 'hi', rounds: 3, turnsPer: 2, rules: [['any', ''], ['decade', '1990s'], ['theme', 'rain']] },
        about: [
          'Three rounds are set up for you: any song, songs from one decade and songs on a theme. Change the rules, the rounds or the clock before you press Start game.',
          'The page plays no music and holds no songs: the family sings, the host says whether the song counts, and the screen keeps the letter, the clock and the score.'
        ],
        faq: [
          { q: 'How do you play antakshari?', a: 'Teams take turns to sing a song that begins with the last sound of the previous song. A team that cannot, or runs out of time, misses its turn. This page supplies the letter, the clock and the score.' },
          { q: 'What if nobody can sing a song with the letter?', a: 'Press Pass, or let the clock run out. Nobody scores and the next team gets a fresh random letter unless you tap one.' }
        ]
      }
    ]
  };

  if (typeof document === 'undefined') return;
  const K = window.GameKit;
  const SLUG = 'antakshari';
  const MAX_TEAMS = 4, MAX_ROUNDS = 8;
  const STR = {
    teams: 'Number of teams', teamNames: 'Team names (optional, separated by commas)', secs: 'Time for each turn', points: 'Points for a song',
    alphabet: 'Letters in play', vowels: 'Include vowels in the random letter', leave: 'Leave out these letters (optional)',
    leaveHint: 'Type them together, such as XQZ. The rest stay equally likely.',
    rounds: 'Number of rounds', turnsPer: 'Turns for each team in a round', rules: 'Rule for each round', sound: 'Sound',
    start: 'Start game', resume: 'Continue the last game', startTimer: 'Start timer  (N)', random: 'New random letter  (R)',
    sung: 'Song sung  (S)', pass: 'Pass  (P)', pause: 'Pause  (Space)', carryOn: 'Carry on  (Space)', next: 'Next team  (N)',
    undo: 'Undo the points', give: 'Give the points', newGame: 'New game', sure: 'Tap again to leave this game', again: 'Play again'
  };
  const SECS = [30, 45, 60, 90];
  const POINTS = [1, 2, 5, 10];
  const RULES = [['any', 'Any song'], ['decade', 'Songs from one decade'], ['star', 'Songs of one film star'], ['singer', 'Songs of one singer'], ['theme', 'Songs on a theme'], ['own', 'My own rule']];
  const ALPHABETS = [['hi', 'Hindi letters'], ['en', 'English letters'], ['both', 'Hindi and English']];
  const el = K.el;

  /* ---------- the maths (pure; build/tests/games.js checks it) ---------- */

  const HI_CONS = Array.from('कखगघचछजझटठडढतथदधनपफबभमयरलवशषसह');
  const HI_VOW = Array.from('अआइईउऊएऐओऔ');
  const EN = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  /** The letters a random draw may give: the alphabet, the vowels if asked, minus the letters the host left out. */
  function letterSet(alphabet, vowels, leaveOut) {
    let set = [];
    if (alphabet === 'hi' || alphabet === 'both') set = set.concat(HI_CONS, vowels ? HI_VOW : []);
    if (alphabet === 'en' || alphabet === 'both') set = set.concat(EN);
    const out = new Set(Array.from(String(leaveOut || '').toUpperCase().replace(/\s+/g, '')));
    const left = set.filter((l) => !out.has(l.toUpperCase()));
    return left.length >= 2 ? left : set; /* leaving out everything is ignored */
  }
  /** The tap-grid: every letter of the alphabet chosen, vowels included. */
  function keypad(alphabet) {
    let set = [];
    if (alphabet === 'hi' || alphabet === 'both') set = set.concat(HI_CONS, HI_VOW);
    if (alphabet === 'en' || alphabet === 'both') set = set.concat(EN);
    return set;
  }
  /** A fair random letter from the set: equal chance for each. */
  function pickLetter(set, randInt) { return set[randInt(set.length)]; }
  /** What was typed → one letter with any vowel signs on it, upper-cased; '' when there is none. */
  function cleanLetter(s) {
    const m = /^\s*([\p{L}][\p{M}]*)/u.exec(String(s || ''));
    return m ? m[1].toUpperCase() : '';
  }
  function turnInfo(turn, teams, rounds, turnsPer) {
    return { team: turn % teams, round: Math.floor(turn / (teams * turnsPer)), over: turn >= teams * rounds * turnsPer };
  }
  function ruleText(rule) {
    const r = RULES.find((x) => x[0] === (rule && rule[0]));
    const d = String((rule && rule[1]) || '').trim();
    if (!r) return 'Any song';
    return r[0] === 'own' ? (d || 'My own rule') : r[1] + (d ? ': ' + d : '');
  }
  function remaining(endAt, now) { return Math.max(0, endAt - now); }
  function winners(scores) { const top = Math.max.apply(null, scores); return scores.map((s, i) => (s === top ? i : -1)).filter((i) => i >= 0); }
  function clock(ms) { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  window.GAME_TOOLS[SLUG].maths = { HI_CONS, HI_VOW, EN, letterSet, keypad, pickLetter, cleanLetter, turnInfo, ruleText, remaining, winners, clock };

  /* ---------- the big screen ---------- */

  function renderStage(body, s) {
    if (body.__raf) { cancelAnimationFrame(body.__raf); body.__raf = 0; }
    body.textContent = '';
    if (!s.phase || s.phase === 'setup') { body.appendChild(el('p', 'game-stage-wait', 'Antakshari will start here. Set the game up on the host screen.')); return; }
    const wrap = el('div', 'ak-stage');
    const tc = 'var(--t' + ((s.team % 8) + 1) + ')';
    if (s.phase === 'end') {
      wrap.appendChild(el('h1', 'st-title', 'Final scores'));
      wrap.appendChild(el('p', 'cg-st-line', s.winners.length === 1 ? s.winners[0] + ' win!' : 'A draw: ' + s.winners.join(' and ')));
    } else {
      wrap.appendChild(el('p', 'cg-st-sub', 'Round ' + s.round + ' of ' + s.rounds + ' · ' + s.rule));
      const name = el('h1', 'cg-st-team', s.teamName); name.style.color = tc; wrap.appendChild(name);
      if (s.phase === 'ready' || s.phase === 'turn' || s.phase === 'paused') {
        wrap.appendChild(el('p', 'cg-st-sub', 'Sing a song that starts with'));
        const L = el('p', 'ak-letter', s.letter); L.style.color = tc; wrap.appendChild(L);
      }
      if (s.phase === 'turn' || s.phase === 'paused') {
        const c = el('p', 'ak-clock' + (s.phase === 'paused' ? ' is-paused' : ''));
        wrap.appendChild(c);
        if (s.phase === 'paused') { c.textContent = clock(s.left); wrap.appendChild(el('p', 'cg-st-line', 'Paused')); }
        else {
          const tick = () => {
            const rem = remaining(s.endsAt, Date.now());
            c.textContent = clock(rem); c.classList.toggle('is-low', rem <= 10000);
            if (rem > 0) body.__raf = requestAnimationFrame(tick);
          };
          tick();
        }
      } else if (s.phase === 'between') {
        wrap.appendChild(el('p', 'cg-st-line', s.outcome === 'sung' ? 'Song sung! +' + s.gained + (s.gained === 1 ? ' point' : ' points') : (s.outcome === 'timeup' ? 'Time’s up!' : 'Passed')));
      } else if (s.phase === 'ready') wrap.appendChild(el('p', 'cg-st-sub', 'Get ready…'));
    }
    const list = el('ul', 'cg-scores');
    s.scores.forEach((t, i) => {
      const li = el('li', (s.phase === 'end' ? s.winners.indexOf(t.name) >= 0 : i === s.team) ? 'is-now' : '');
      li.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')');
      li.appendChild(el('span', 'cg-sc-name', t.name)); li.appendChild(el('b', 'cg-sc-n', String(t.score)));
      list.appendChild(li);
    });
    wrap.appendChild(list);
    body.appendChild(wrap);
  }

  /* ---------- the page ---------- */

  function mount(root, stage) {
    const io = root.querySelector('.tool-io');
    const store = K.store(SLUG, 1);
    const preset = K.preset(root);
    const saved = store.get({});
    const base = { teams: 2, names: '', secs: 45, points: 1, alphabet: 'hi', vowels: false, leave: '', rounds: 3, turnsPer: 2, rules: [['any', ''], ['any', ''], ['any', '']] };
    const opt = Object.assign(base, saved.opt || {}, preset);
    opt.secs = Math.max(3, Math.min(600, Number(opt.secs) || 45));
    let G = null, phase = 'setup', T = null, raf = 0, deadlineTimer = 0, ticker = 0, lastTickSec = -1, sureTimer = 0, chosen = '';

    /* ----- set-up ----- */
    const setup = el('section', 'game-panel ak-setup');
    setup.appendChild(el('h2', null, 'Set up the game'));
    const teamsIn = el('input'); teamsIn.type = 'number'; teamsIn.min = '2'; teamsIn.max = String(MAX_TEAMS); teamsIn.inputMode = 'numeric'; teamsIn.value = String(opt.teams);
    setup.appendChild(K.field(STR.teams, teamsIn).wrap);
    const namesIn = el('input'); namesIn.type = 'text'; namesIn.placeholder = 'Tigers, Lions'; namesIn.value = opt.names || '';
    setup.appendChild(K.field(STR.teamNames, namesIn).wrap);
    const secSeg = el('div', 'game-seg'); secSeg.setAttribute('role', 'group'); secSeg.setAttribute('aria-label', STR.secs);
    const secBtns = SECS.map((n) => { const b = K.button(n + ' seconds', null, () => { opt.secs = n; sync(); }); secSeg.appendChild(b); return [n, b]; });
    setup.appendChild(K.field(STR.secs, secSeg).wrap);
    const ptsSel = el('select');
    POINTS.forEach((p) => { const o = el('option', null, p + (p === 1 ? ' point' : ' points')); o.value = String(p); ptsSel.appendChild(o); });
    ptsSel.value = String(opt.points); if (!ptsSel.value) ptsSel.value = '1';
    setup.appendChild(K.field(STR.points, ptsSel).wrap);
    const alphaSel = el('select');
    ALPHABETS.forEach((a) => { const o = el('option', null, a[1]); o.value = a[0]; alphaSel.appendChild(o); });
    alphaSel.value = opt.alphabet; if (!alphaSel.value) alphaSel.value = 'hi';
    setup.appendChild(K.field(STR.alphabet, alphaSel).wrap);
    const vowIn = el('input'); vowIn.type = 'checkbox'; vowIn.checked = !!opt.vowels;
    const vowL = el('label', 'game-check'); vowL.appendChild(vowIn); vowL.appendChild(document.createTextNode(STR.vowels)); setup.appendChild(vowL);
    const leaveIn = el('input'); leaveIn.type = 'text'; leaveIn.placeholder = 'XQZ'; leaveIn.value = opt.leave || ''; leaveIn.autocapitalize = 'characters'; leaveIn.spellcheck = false;
    setup.appendChild(K.field(STR.leave, leaveIn, STR.leaveHint).wrap);
    const setMsg = el('p', 'game-msg'); setMsg.setAttribute('role', 'status'); setup.appendChild(setMsg);
    const roundsIn = el('input'); roundsIn.type = 'number'; roundsIn.min = '1'; roundsIn.max = String(MAX_ROUNDS); roundsIn.inputMode = 'numeric'; roundsIn.value = String(opt.rounds);
    setup.appendChild(K.field(STR.rounds, roundsIn).wrap);
    const turnsIn = el('input'); turnsIn.type = 'number'; turnsIn.min = '1'; turnsIn.max = '5'; turnsIn.inputMode = 'numeric'; turnsIn.value = String(opt.turnsPer);
    setup.appendChild(K.field(STR.turnsPer, turnsIn).wrap);
    const rulesBox = el('div', 'ak-rules'); rulesBox.appendChild(el('h3', 'ak-rules-h', STR.rules)); setup.appendChild(rulesBox);
    const ruleRows = [];
    function readRounds() { return Math.max(1, Math.min(MAX_ROUNDS, parseInt(roundsIn.value, 10) || 1)); }
    function buildRules() {
      const n = readRounds();
      const prev = ruleRows.map((r) => [r.sel.value, r.det.value]);
      while (ruleRows.length < n) {
        const i = ruleRows.length;
        const row = el('div', 'ak-rule');
        const sel = el('select'); sel.setAttribute('aria-label', 'Round ' + (i + 1) + ' rule');
        RULES.forEach((r) => { const o = el('option', null, r[1]); o.value = r[0]; sel.appendChild(o); });
        const det = el('input'); det.type = 'text'; det.maxLength = 40; det.placeholder = 'Details, such as 1990s'; det.setAttribute('aria-label', 'Round ' + (i + 1) + ' details');
        const src = (prev[i] || (opt.rules || [])[i] || ['any', '']);
        sel.value = src[0]; if (!sel.value) sel.value = 'any'; det.value = src[1] || '';
        row.appendChild(el('span', 'ak-rule-n', 'Round ' + (i + 1))); row.appendChild(sel); row.appendChild(det);
        rulesBox.appendChild(row);
        ruleRows.push({ row, sel, det });
      }
      ruleRows.forEach((r, i) => { r.row.hidden = i >= n; });
    }
    roundsIn.addEventListener('input', buildRules);
    const soundIn = el('input'); soundIn.type = 'checkbox'; soundIn.checked = K.sound.on;
    const soundL = el('label', 'game-check'); soundL.appendChild(soundIn); soundL.appendChild(document.createTextNode(STR.sound)); setup.appendChild(soundL);
    soundIn.addEventListener('change', () => { K.sound.on = soundIn.checked; });
    const goRow = el('div', 'game-row');
    const startB = K.button(STR.start, 'btn-primary game-big', () => startGame());
    const resumeB = K.button(STR.resume, 'btn-ghost', () => resumeGame()); resumeB.hidden = true;
    goRow.appendChild(startB); goRow.appendChild(resumeB); setup.appendChild(goRow);

    /* ----- the game ----- */
    const game = el('section', 'game-panel ak-game'); game.hidden = true;
    const ruleP = el('p', 'ak-rule-line');
    const status = el('p', 'game-msg'); status.setAttribute('role', 'status');
    const letterEl = el('p', 'ak-letter-host'); letterEl.setAttribute('aria-label', 'Letter');
    const clockEl = el('p', 'cg-clock-host'); clockEl.setAttribute('aria-hidden', 'true');
    const teamEl = el('h2', 'ak-team');
    game.appendChild(ruleP); game.appendChild(teamEl); game.appendChild(letterEl); game.appendChild(clockEl); game.appendChild(status);

    const readyActs = el('div', 'game-row');
    const startTimerB = K.button(STR.startTimer, 'btn-primary game-big', () => startTurn());
    const randomB = K.button(STR.random, 'btn-ghost', () => newLetter());
    readyActs.appendChild(startTimerB); readyActs.appendChild(randomB);
    const turnActs = el('div', 'game-row');
    const sungB = K.button(STR.sung, 'btn-primary game-big', () => sung());
    const passB = K.button(STR.pass, 'btn-ghost game-big', () => finishTurn('pass'));
    const pauseB = K.button(STR.pause, 'btn-ghost', () => togglePause());
    turnActs.appendChild(sungB); turnActs.appendChild(passB); turnActs.appendChild(pauseB);
    game.appendChild(readyActs); game.appendChild(turnActs);

    const between = el('div', 'ak-between');
    const outMsg = el('p', 'cg-between-msg');
    const undoB = K.button(STR.undo, 'btn-ghost', () => toggleAward());
    const padH = el('p', 'ak-pad-h', 'Last sound of the song? Tap it or type it, then press Next team. Leave it empty for a random letter.');
    const pad = el('div', 'ak-pad'); pad.setAttribute('role', 'group'); pad.setAttribute('aria-label', 'Letters');
    const typed = el('input'); typed.type = 'text'; typed.maxLength = 6; typed.setAttribute('aria-label', 'Type the last sound'); typed.placeholder = 'Type a letter'; typed.autocomplete = 'off'; typed.spellcheck = false;
    typed.addEventListener('input', () => { chosen = cleanLetter(typed.value); markPad(); updateNext(); });
    const nextB = K.button(STR.next, 'btn-primary game-big', () => nextTeam());
    [outMsg, undoB, padH, pad, K.field('Or type it', typed).wrap, nextB].forEach((x) => between.appendChild(x));
    game.appendChild(between);

    const endBox = el('div', 'cg-end');
    const endMsg = el('p', 'cg-between-msg'); const endList = el('ol', 'cg-final');
    const endRow = el('div', 'game-row');
    endRow.appendChild(K.button(STR.again, 'btn-primary', () => toSetup()));
    endBox.appendChild(endMsg); endBox.appendChild(endList); endBox.appendChild(endRow); game.appendChild(endBox);

    const scoreList = el('ul', 'cg-scores cg-scores-host'); game.appendChild(scoreList);
    const stageBox = el('div', 'cg-stagebox'); stageBox.appendChild(stage.bar()); game.appendChild(stageBox);
    const leaveRow = el('div', 'game-row cg-leave');
    const leaveB = K.button(STR.newGame, 'btn-ghost', () => {
      if (leaveB.dataset.sure === '1') { clearTimeout(sureTimer); toSetup(); return; }
      leaveB.dataset.sure = '1'; leaveB.textContent = STR.sure;
      sureTimer = setTimeout(() => { leaveB.dataset.sure = ''; leaveB.textContent = STR.newGame; }, 4000);
    });
    leaveRow.appendChild(leaveB); game.appendChild(leaveRow);
    io.appendChild(setup); io.appendChild(game);

    function sync() { secBtns.forEach(([n, b]) => b.setAttribute('aria-pressed', String(opt.secs === n))); }
    function readTeams() {
      const k = Math.max(2, Math.min(MAX_TEAMS, parseInt(teamsIn.value, 10) || 2));
      const typedNames = K.parseList(namesIn.value, { maxLen: 24 });
      return Array.from({ length: k }, (_, i) => typedNames[i] || ('Team ' + (i + 1)));
    }
    function readRules() { return ruleRows.slice(0, readRounds()).map((r) => [r.sel.value, r.det.value.trim().slice(0, 40)]); }
    function currentSet() { return letterSet(alphaSel.value, vowIn.checked, leaveIn.value); }
    function persistOpt() {
      const data = store.get({});
      data.opt = { teams: readTeams().length, names: namesIn.value, secs: opt.secs, points: Number(ptsSel.value), alphabet: alphaSel.value, vowels: vowIn.checked, leave: leaveIn.value, rounds: readRounds(), turnsPer: Math.max(1, Math.min(5, parseInt(turnsIn.value, 10) || 1)), rules: readRules() };
      store.set(data);
    }
    function savedGame() { const g = store.get({}).game; return g && g.teams && g.teams.length ? g : null; }
    function saveGame() {
      const data = store.get({});
      if (!G || phase === 'end') delete data.game;
      else data.game = G;
      store.set(data);
    }
    function refreshResume() { const g = savedGame(); resumeB.hidden = !g; if (g) resumeB.textContent = STR.resume + ' (turn ' + (g.turn + 1) + ')'; }

    /* ----- starting ----- */
    function begin(g) {
      G = g; T = null; phase = 'ready'; chosen = ''; pad.textContent = ''; typed.value = '';
      K.wakeLock(true);
      setup.hidden = true; game.hidden = false;
      leaveB.dataset.sure = ''; leaveB.textContent = STR.newGame;
      show(); saveGame(); publish();
    }
    function startGame() {
      K.sound.unlock();
      const set = currentSet();
      if (set.length < 2) { setMsg.textContent = 'Keep at least two letters in play.'; setMsg.className = 'game-msg is-warn'; return; }
      setMsg.textContent = ''; setMsg.className = 'game-msg';
      persistOpt();
      const teams = readTeams();
      begin({
        teams, scores: teams.map(() => 0), turn: 0, secs: opt.secs, points: Number(ptsSel.value), rounds: readRounds(),
        turnsPer: Math.max(1, Math.min(5, parseInt(turnsIn.value, 10) || 1)), rules: readRules(),
        alphabet: alphaSel.value, set, pad: keypad(alphaSel.value), letter: pickLetter(set, K.randInt)
      });
    }
    function resumeGame() { const g = savedGame(); if (g) begin(g); }
    function toSetup() {
      stopTimers(); phase = 'setup'; G = null; T = null;
      K.wakeLock(false); game.hidden = true; setup.hidden = false;
      saveGame(); refreshResume(); publish();
    }

    /* ----- the turn ----- */
    function stopTimers() { cancelAnimationFrame(raf); raf = 0; clearTimeout(deadlineTimer); deadlineTimer = 0; clearInterval(ticker); ticker = 0; }
    function info() { return turnInfo(G.turn, G.teams.length, G.rounds, G.turnsPer); }
    function newLetter() {
      if (phase !== 'ready') return;
      G.letter = pickLetter(G.set, K.randInt);
      K.sound.tick();
      show(); saveGame(); publish();
      K.announce(root, 'New letter: ' + G.letter);
    }
    function startTurn() {
      if (phase !== 'ready') return;
      K.sound.unlock();
      T = { endAt: performance.now() + G.secs * 1000, left: G.secs * 1000, gained: 0, outcome: '' };
      phase = 'turn'; lastTickSec = -1;
      show(); armDeadline(); loop(); publish();
      K.announce(root, G.teams[info().team] + ', your letter is ' + G.letter + '. ' + clock(G.secs * 1000) + ' on the clock.');
    }
    function armDeadline() { clearTimeout(deadlineTimer); deadlineTimer = setTimeout(checkDeadline, Math.max(0, T.endAt - performance.now()) + 5); }
    function checkDeadline() { if (phase === 'turn' && performance.now() >= T.endAt) finishTurn('timeup'); }
    function loop() {
      cancelAnimationFrame(raf);
      if (phase !== 'turn') return;
      if (!ticker) ticker = setInterval(paintClock, 250);
      paintClock();
      if (phase === 'turn') raf = requestAnimationFrame(loop);
    }
    function paintClock() {
      if (phase !== 'turn') return;
      const rem = remaining(T.endAt, performance.now());
      clockEl.textContent = clock(rem); clockEl.classList.toggle('is-low', rem <= 10000);
      const sec = Math.ceil(rem / 1000);
      if (sec <= 5 && sec > 0 && sec !== lastTickSec) { lastTickSec = sec; K.sound.tick(); }
      if (rem <= 0) finishTurn('timeup');
    }
    function togglePause() {
      if (phase === 'turn') { T.left = remaining(T.endAt, performance.now()); stopTimers(); phase = 'paused'; show(); publish(); }
      else if (phase === 'paused') { T.endAt = performance.now() + T.left; phase = 'turn'; show(); armDeadline(); loop(); publish(); }
    }
    function sung() { if (phase === 'turn' && performance.now() < T.endAt) finishTurn('sung'); }
    function finishTurn(outcome) {
      if (phase !== 'turn' && !(phase === 'paused' && outcome === 'pass')) return;
      stopTimers();
      const t = info().team;
      T.outcome = outcome; T.gained = outcome === 'sung' ? G.points : 0; T.team = t;
      G.scores[t] += T.gained;
      phase = 'between'; chosen = ''; typed.value = '';
      if (outcome === 'sung') K.sound.ding(); else K.sound.buzz();
      show(); saveGame(); publish();
      K.announce(root, outcome === 'sung' ? G.teams[t] + ' score ' + G.points + (G.points === 1 ? ' point.' : ' points.') : (outcome === 'timeup' ? 'Time is up.' : 'Passed.') + ' No points.');
    }
    function toggleAward() {
      if (phase !== 'between') return;
      const had = T.gained > 0;
      G.scores[T.team] += had ? -G.points : G.points;
      T.gained = had ? 0 : G.points;
      T.outcome = had ? 'pass' : 'sung';
      show(); saveGame(); publish();
    }
    function nextTeam() {
      if (phase !== 'between') return;
      const last = chosen;
      G.turn++;
      T = null;
      if (info().over) {
        phase = 'end'; K.wakeLock(false); K.sound.fanfare(); show(); saveGame(); publish(); refreshResume();
        const w = winners(G.scores);
        K.announce(root, w.length === 1 ? G.teams[w[0]] + ' win.' : 'A draw.');
        return;
      }
      G.letter = last || pickLetter(G.set, K.randInt);
      phase = 'ready'; chosen = ''; typed.value = '';
      show(); saveGame(); publish();
    }

    /* ----- drawing ----- */
    function markPad() {
      Array.from(pad.children).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.l === chosen)));
    }
    function updateNext() { nextB.textContent = chosen ? 'Next team: ' + chosen + '  (N)' : STR.next; }
    function buildPad() {
      pad.textContent = '';
      G.pad.forEach((l) => {
        const b = K.button(l, 'ak-key', () => { chosen = chosen === l ? '' : l; typed.value = ''; markPad(); updateNext(); });
        b.dataset.l = l; b.setAttribute('aria-pressed', 'false'); pad.appendChild(b);
      });
    }
    function renderScores() {
      const ti = info();
      scoreList.textContent = '';
      G.teams.forEach((n, i) => {
        const li = el('li', i === ti.team && phase !== 'end' ? 'is-now' : '');
        li.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')');
        li.appendChild(el('span', 'cg-sc-name', n)); li.appendChild(el('b', 'cg-sc-n', String(G.scores[i])));
        scoreList.appendChild(li);
      });
    }
    function show() {
      const p = phase, ti = info();
      readyActs.hidden = p !== 'ready';
      turnActs.hidden = !(p === 'turn' || p === 'paused');
      between.hidden = p !== 'between';
      endBox.hidden = p !== 'end';
      leaveRow.hidden = p === 'end';
      clockEl.hidden = !(p === 'turn' || p === 'paused');
      letterEl.hidden = !(p === 'ready' || p === 'turn' || p === 'paused');
      teamEl.hidden = p === 'end'; ruleP.hidden = p === 'end';
      renderScores();
      if (p !== 'end') {
        teamEl.textContent = G.teams[ti.team];
        teamEl.style.color = 'var(--t' + ((ti.team % 8) + 1) + ')';
        ruleP.textContent = 'Round ' + (ti.round + 1) + ' of ' + G.rounds + ' · ' + ruleText(G.rules[ti.round]);
        letterEl.textContent = G.letter;
      }
      if (p === 'ready') status.textContent = 'Sing a song that starts with ' + G.letter + '. Press Start timer when the team is ready.';
      else if (p === 'turn') { status.textContent = ''; sungB.textContent = 'Song sung: +' + G.points + '  (S)'; }
      else if (p === 'paused') { status.textContent = 'Paused.'; clockEl.textContent = clock(T.left); pauseB.textContent = STR.carryOn; sungB.disabled = true; }
      if (p === 'turn') { pauseB.textContent = STR.pause; sungB.disabled = false; }
      if (p === 'between') {
        status.textContent = '';
        outMsg.textContent = T.outcome === 'sung' ? G.teams[T.team] + ' scored ' + T.gained + (T.gained === 1 ? ' point.' : ' points.') : (T.outcome === 'timeup' ? 'Time’s up. ' : 'Passed. ') + 'No points.';
        undoB.textContent = T.gained > 0 ? STR.undo : STR.give;
        if (!pad.children.length) buildPad();
        markPad(); updateNext();
      }
      if (p === 'end') {
        const w = winners(G.scores);
        endMsg.textContent = w.length === 1 ? G.teams[w[0]] + ' win!' : 'A draw between ' + w.map((i) => G.teams[i]).join(' and ') + '.';
        endList.textContent = '';
        G.teams.map((n, i) => ({ n, s: G.scores[i], i })).sort((a, b) => b.s - a.s).forEach((x) => {
          const li = el('li', w.indexOf(x.i) >= 0 ? 'is-now' : ''); li.style.setProperty('--tc', 'var(--t' + ((x.i % 8) + 1) + ')');
          li.appendChild(el('span', 'cg-sc-name', x.n)); li.appendChild(el('b', 'cg-sc-n', String(x.s))); endList.appendChild(li);
        });
      }
    }
    function publish() {
      if (!G || phase === 'setup') { stage.update({ phase: 'setup' }); return; }
      const ti = info();
      const s = {
        phase, team: phase === 'end' ? -1 : ti.team, teamName: phase === 'end' ? '' : G.teams[ti.team], letter: G.letter,
        round: Math.min(ti.round + 1, G.rounds), rounds: G.rounds, rule: ruleText(G.rules[Math.min(ti.round, G.rounds - 1)]),
        scores: G.teams.map((n, i) => ({ name: n, score: G.scores[i] })), endsAt: 0, left: G.secs * 1000, outcome: '', gained: 0, winners: []
      };
      if (T) {
        if (phase === 'turn') s.endsAt = Date.now() + remaining(T.endAt, performance.now());
        if (phase === 'paused') s.left = T.left;
        if (phase === 'between') { s.outcome = T.outcome; s.gained = T.gained; s.letter = ''; }
      }
      if (phase === 'end') s.winners = winners(G.scores).map((i) => G.teams[i]);
      stage.update(s);
    }

    /* ----- keys ----- */
    function hotkey(key) {
      const k = String(key).toLowerCase();
      if (k === 'n') { if (phase === 'ready') startTurn(); else if (phase === 'between') nextTeam(); }
      else if (k === ' ') { if (phase === 'ready') startTurn(); else if (phase === 'turn' || phase === 'paused') togglePause(); else if (phase === 'between') nextTeam(); }
      else if (k === 's') sung();
      else if (k === 'p') finishTurn('pass');
      else if (k === 'r') newLetter();
    }
    stage.onKey = hotkey;
    document.addEventListener('keydown', (e) => {
      if (!G || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.key === ' ' && t && t.tagName === 'BUTTON') return;
      if (['n', 'N', ' ', 's', 'S', 'p', 'P', 'r', 'R'].indexOf(e.key) >= 0) { e.preventDefault(); hotkey(e.key); }
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { checkDeadline(); if (phase === 'turn') loop(); } });

    sync(); buildRules(); refreshResume(); publish();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-tool="' + SLUG + '"]');
    if (!root || !K) return;
    let host = null;
    const stage = K.stage({
      slug: SLUG, title: 'Antakshari', render: renderStage,
      onCommand: (m) => { if (m && m.type === 'key' && host && host.onKey) host.onKey(m.key); }
    });
    if (stage.isStage) return;
    host = stage;
    mount(root, stage);
  });
})();
