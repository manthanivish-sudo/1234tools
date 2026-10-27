/**
 * Dumb Charades Generator: words to act out, a turn timer, points, and the
 * word shown on the actor's screen only.
 *
 * The decks are in engine/game-charades-words.js. A game is a sequence of
 * turns, one team after another. In a turn the host presses Start, the word
 * appears on this screen only, and the team's actor acts it out; "Got it"
 * scores and brings the next word, "Skip" brings the next word for no points
 * (a limited number of times). When the time is up the host checks the
 * words, can fix a mistake, and passes to the next team.
 *
 * Fairness: the words come from a shuffled copy of the deck, shuffled by a
 * seeded generator (GameKit.seeded) from the game code, and are dealt in
 * that order, so none comes up twice in a game and the same code with the
 * same settings gives the same order — which is what lets a game carry on
 * after the page is refreshed. The code is made with the crypto generator.
 *
 * Time: a turn ends at a deadline fixed when it starts, and every clock is
 * worked out from the device's clock against that deadline, so a slow or
 * hidden tab still ends the turn on time.
 *
 * The big screen is sent the team, the clock deadline, the counts and the
 * scores. It is never sent the word.
 */
(function () {
  'use strict';
  window.GAME_TOOLS = window.GAME_TOOLS || {};
  window.GAME_TOOLS['charades-generator'] = {
    order: 11,
    title: 'Dumb Charades Generator',
    short: 'Charades',
    description: 'Dumb charades for the whole family: Bollywood and Hollywood films, animals, actions, jobs and more. A timer for each team, points, and the word kept off the TV. Free, no sign-up.',
    keywords: ['dumb charades', 'dumb charades generator', 'bollywood dumb charades movie names', 'charades word generator', 'charades ideas', 'charades ideas for kids', 'charades game online', 'dumb charades words'],
    glyph: 'i-charades-generator',
    glyphSvg: '<symbol id="i-charades-generator" viewBox="0 0 24 24">\n  <path d="M4.2 4.5h15.6v7a7.8 7.8 0 0 1-15.6 0z"/>\n  <circle cx="9" cy="10" r="1.2" class="fill"/>\n  <circle cx="15" cy="10" r="1.2" class="fill"/>\n  <path d="M8.6 14.2c1 1.3 2 1.9 3.4 1.9s2.4-.6 3.4-1.9" class="thin"/>\n</symbol>',
    scripts: ['/engine/game-kit.js', '/engine/game-charades-words.js', '/engine/game-charades-generator.js'],
    privacy: 'The words are built into the page and the game is worked out on this device; nothing is uploaded. A game in progress is saved on this device so a refresh can carry on, and words you type yourself are saved only if you tick “Keep my words on this device”.',
    how: [
      'Pick a word deck, such as Bollywood films or Animals, and how hard the words may be.',
      'Choose how many teams, how long each turn lasts and how many skips a turn allows.',
      'Press Start game. The first team’s name appears.',
      'Press Show on TV if you want the clock and the scores on the big screen. The word is never sent there.',
      'Give the phone to the team’s actor and press Start turn (or N). The word appears on this screen only.',
      'The actor acts the word out without speaking. When the team guesses it, press Got it (or G). To change the word, press Skip (or S).',
      'When the time is up, tap any word that was marked wrongly, then press Next team (or N).',
      'After the last turn the final scores appear. Press New game to play again.'
    ],
    manual: {
      setup: [
        'Pick a deck. Film decks show the year of the film to the actor as a clue.',
        'Choose Easy, Easy and medium, or All to set how hard the words may be.',
        'Set the number of teams and, if you like, type their names separated by commas.',
        'Choose 60, 90 or 120 seconds, and how many skips each turn allows.',
        'Tick “Cover the word until it is held” if the phone will be passed round, then press Start game.'
      ],
      play: [
        'Give the phone to the team’s actor and press Start turn (N).',
        'The actor reads the word and acts it out without speaking or pointing at letters.',
        'When the team says the right word, press Got it (G). Press Skip (S) to swap a word you cannot act.',
        'When the clock reaches zero, check the list and tap a word to change it between “got it” and “missed”.',
        'Press Next team (N). After the last turn the winner is shown.'
      ],
      tv: [
        'Press Show on TV (new window) and drag the new window to the TV or projector.',
        'On the TV window press Full screen. The TV shows the clock, the team, the tally and the scores.',
        'Keep this page as the remote and keep the screen to yourself: the word is only on this page.',
        'With one screen and no actor’s phone, use Full screen here only between turns, so nobody sees a word.'
      ],
      troubleshooting: [
        { q: 'The TV window is blank.', a: 'Open the game in a second window with Show on TV on this page. The TV window follows this page, so keep this page open.' },
        { q: 'I refreshed the page in the middle of a game.', a: 'Open the game again and press Continue the last game. It resumes at the start of the turn you were in, with the scores kept.' },
        { q: 'A word came up that nobody knows.', a: 'Press Skip. If the turn has no skips left, the word stays until the time runs out, so choose more skips (or Unlimited) before the next game.' },
        { q: 'There is no sound.', a: 'Tick Sound in the set-up. Phones also stay quiet in silent mode.' }
      ]
    },
    uses: [
      ['Family evening', 'two teams of cousins, Bollywood films and a 90 second clock, with the clock on the TV'],
      ['Kids’ party', 'easy words, 120 seconds and five skips so nobody is stuck on a word'],
      ['Diwali or Christmas', 'the festival decks, played round the room with the phone passed from actor to actor']
    ],
    tips: [
      'Words are dealt from a shuffled deck, so none comes up twice in a game. The game code shown above the clock fixes the order: the same code, deck, level and words gives the same order again.',
      'Turns are timed against the clock of your device, not by counting seconds, so a slow or hidden tab still finishes the turn on time.',
      'Cover mode keeps the word hidden until you press and hold the button (or hold H on a keyboard), so a phone can be passed round the room without everybody seeing the word.',
      'Harder words score more is optional: easy words score 1, medium 2 and hard 3. Without it every correct word scores 1.',
      'Skips cost no points, but each turn has a limit. Choose Unlimited if you would rather not count them.',
      'After the buzzer, tap a word in the list to change it between got it and missed; the team’s score changes with it.',
      'The page lists every word in the chosen deck under “See every word in this deck”. That spoils the game, so use it to check the deck, not during a turn.'
    ],
    faq: [
      { q: 'Does the word show on the TV?', a: 'No. The TV window is sent the team, the clock, the number of words got and the scores. The word, its difficulty and the film year stay on the page you control.' },
      { q: 'Which films are in the film decks?', a: 'Well-known family-friendly Bollywood, Hollywood and English-language films, mostly rated U, UA or PG, plus widely known classics. Each deck has more than 150, each with a difficulty, and the year of release is shown to the actor as a clue.' },
      { q: 'What other decks are there?', a: 'Animals, actions, jobs, objects, easy words for kids, Christmas and Diwali, each with at least 80 words.' },
      { q: 'Can I use my own words?', a: 'Yes. Choose My own words and type one per line, up to 300 words of up to 60 characters. They are kept on this device only if you tick Keep my words on this device.' },
      { q: 'Can the same word come up twice?', a: 'Not in one game. The deck is shuffled once and dealt in order. If you use up every word in a small deck, the page tells you and shuffles it again.' },
      { q: 'Can I play with just one phone?', a: 'Yes. Turn on Cover the word until it is held and pass the phone to the actor: the word shows only while the actor holds the button down.' },
      { q: 'Does it work offline and can I carry on after a refresh?', a: 'Yes to both. After the first visit the page opens without a connection, and a game in progress is saved on this device so Continue the last game picks up at the start of your turn. A game that uses typed words is only saved if you ticked Keep my words on this device.' }
    ],
    related: ['/utilities/random-number-generator/', '/utilities/dice-roller/'],
    landings: [
      {
        slug: 'bollywood-dumb-charades-movie-names',
        title: 'Bollywood Dumb Charades Movie Names',
        description: 'Bollywood film names for dumb charades, picked at random with a timer for each team and the film kept off the TV. Easy, medium and hard titles. Free, no sign-up.',
        lede: 'Pick two teams, press Start and the Bollywood film appears on the actor’s screen only — the clock and the scores go on the TV.',
        preset: { deck: 'bollywood', level: 3, secs: 90, skips: 3 },
        about: [
          'The Bollywood deck holds more than 150 well-known family films, from classics such as Sholay to recent hits, each marked easy, medium or hard. Start with Easy and medium if the group is mixed, or All for a film-buff crowd.',
          'The year of the film is shown to the actor as a clue. Each turn is 90 seconds with three skips; change both in the set-up before you start.'
        ],
        faq: [
          { q: 'How do I play Bollywood dumb charades?', a: 'One person from the team acts out the film name without speaking while their team guesses before the clock runs out. A correct guess scores a point and brings the next film.' },
          { q: 'Are the film names only for family audiences?', a: 'The deck is chosen to be family friendly: well-known films mostly rated U or UA, so grandparents and children can join in.' }
        ]
      },
      {
        slug: 'charades-ideas-for-kids',
        title: 'Charades Ideas for Kids',
        description: 'Easy charades words for children: animals, actions, things and characters, with a two-minute timer and plenty of skips. Free, no sign-up, runs in your browser.',
        lede: 'Easy words for young players — animals, things to do and favourite characters — with 120 seconds a turn and five skips so nobody gets stuck.',
        preset: { deck: 'kids', level: 1, secs: 120, skips: 5 },
        about: [
          'The kids’ deck is made of easy words, and Easy is already chosen. Children act animals and actions best, so start there before trying films.',
          'Turn on Cover the word until it is held if the phone is passed round, so the other children cannot see the word.'
        ],
        faq: [
          { q: 'What age is charades good for?', a: 'Children from about five can act animals and simple actions. Older children and adults can move on to the film decks.' },
          { q: 'Can the grown-ups play too?', a: 'Yes. Mix the generations in each team and keep the kids’ deck on Easy so the youngest can guess and act.' }
        ]
      }
    ]
  };

  if (typeof document === 'undefined') return;
  const K = window.GameKit;
  const SLUG = 'charades-generator';
  const MAX_TEAMS = 6, MAX_CUSTOM = 300;
  const STR = {
    chooseDeck: 'Word deck', own: 'My own words', ownHint: 'One word or phrase per line, up to 300. At least 5.',
    level: 'How hard may the words be?', levels: ['Easy', 'Easy and medium', 'All'],
    teams: 'Number of teams', teamNames: 'Team names (optional, separated by commas)',
    secs: 'Time for each turn', skips: 'Skips in each turn', rounds: 'Turns for each team',
    harder: 'Harder words score more (1, 2 or 3 points)', cover: 'Cover the word until it is held',
    keep: 'Keep my words on this device', sound: 'Sound', code: 'Game code (optional)',
    codeHint: 'The same code with the same deck gives the same order of words.',
    start: 'Start game', resume: 'Continue the last game',
    startTurn: 'Start turn  (N)', got: 'Got it  (G)', skip: 'Skip  (S)', pause: 'Pause  (P)', resumeTurn: 'Carry on  (P)',
    next: 'Next team  (N)', hold: 'Press and hold to see the word  (H)', newGame: 'New game', sure: 'Tap again to leave this game',
    again: 'Play again'
  };
  const SECS = [60, 90, 120];
  const SKIPS = [[0, 'None'], [1, '1'], [3, '3'], [5, '5'], [-1, 'Unlimited']];
  const el = K.el;

  /* ---------- the maths (pure; build/tests/games.js checks it) ---------- */

  /** A deck's three strings → [{ w, d, y }] (word, difficulty 1–3, year or null). */
  function parseDeck(deck) {
    const out = [];
    [1, 2, 3].forEach((d) => {
      String(deck['d' + d] || '').split('|').forEach((s) => {
        s = s.trim(); if (!s) return;
        let y = null;
        const m = /^(.*)@(\d{4})$/.exec(s);
        if (m) { s = m[1]; y = Number(m[2]); }
        out.push({ w: s, d, y });
      });
    });
    return out;
  }
  /** Typed words, one per line, repeats dropped; every one counts as medium. */
  function parseCustom(text) {
    const seen = new Set();
    return K.parseList(text, { lines: true, max: MAX_CUSTOM, maxLen: 60 })
      .filter((w) => { const k = w.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .map((w) => ({ w, d: 2, y: null }));
  }
  /** The words a level allows: 1 easy only, 2 easy and medium, 3 all. */
  function pool(items, level) { return items.filter((i) => i.d <= level); }
  /** The order a seed deals n words in. */
  function orderFor(seed, n) { return K.seeded(seed).shuffle(Array.from({ length: n }, (_, i) => i)); }
  const orders = new Map();
  function orderCached(seed, n) {
    const k = seed + '#' + n;
    if (!orders.has(k)) { if (orders.size > 8) orders.clear(); orders.set(k, orderFor(seed, n)); }
    return orders.get(k);
  }
  /** The word dealt at position pos of a game: pass 0 is the first shuffle of the pool, and when the pool is used up it is shuffled again (pass 1, ...). */
  function wordAt(items, seed, pos) {
    const n = items.length, pass = Math.floor(pos / n);
    return items[orderCached(seed + '/' + pass, n)[pos % n]];
  }
  function turnInfo(turn, teams, rounds) {
    return { team: turn % teams, round: Math.floor(turn / teams) + 1, over: turn >= teams * rounds };
  }
  function remaining(endAt, now) { return Math.max(0, endAt - now); }
  function points(item, harder) { return harder ? item.d : 1; }
  function winners(scores) {
    const top = Math.max.apply(null, scores);
    return scores.map((s, i) => (s === top ? i : -1)).filter((i) => i >= 0);
  }
  function clock(ms) {
    const s = Math.ceil(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  window.GAME_TOOLS[SLUG].maths = { parseDeck, parseCustom, pool, orderFor, wordAt, turnInfo, remaining, points, winners, clock };

  const DECKS = ((window.GAME_WORDS || {}).charades || { decks: [] }).decks;
  const deckById = (id) => DECKS.find((d) => d.id === id);

  /* ---------- the big screen: never given the word ---------- */

  function renderStage(body, s) {
    if (body.__raf) { cancelAnimationFrame(body.__raf); body.__raf = 0; }
    body.textContent = '';
    if (!s.phase || s.phase === 'setup') {
      body.appendChild(el('p', 'game-stage-wait', 'Dumb charades will start here. Set the game up on the host screen.'));
      return;
    }
    const wrap = el('div', 'cg-stage');
    const tc = 'var(--t' + ((s.team % 8) + 1) + ')';
    if (s.phase === 'end') {
      wrap.appendChild(el('h1', 'st-title', 'Final scores'));
      wrap.appendChild(el('p', 'cg-st-line', s.winners.length === 1 ? s.winners[0] + ' win!' : 'A draw: ' + s.winners.join(' and ')));
    } else {
      wrap.appendChild(el('p', 'cg-st-sub', s.deck + ' · Turn ' + s.turnNo + ' of ' + s.totalTurns));
      const name = el('h1', 'cg-st-team', s.teamName);
      name.style.color = tc;
      wrap.appendChild(name);
      if (s.phase === 'ready') {
        wrap.appendChild(el('p', 'cg-st-line', 'is up next'));
        wrap.appendChild(el('p', 'cg-st-sub', 'The actor sees the word on their own screen.'));
      } else if (s.phase === 'between') {
        wrap.appendChild(el('p', 'cg-st-line', 'Time’s up! ' + s.got + (s.got === 1 ? ' word' : ' words') + ' · ' + s.gained + (s.gained === 1 ? ' point' : ' points')));
      } else {
        const c = el('p', 'cg-clock' + (s.phase === 'paused' ? ' is-paused' : ''));
        wrap.appendChild(c);
        wrap.appendChild(el('p', 'cg-st-line', 'Got it: ' + s.got + (s.skipsLeft < 0 ? '' : ' · Skips left: ' + s.skipsLeft) + (s.phase === 'paused' ? ' · Paused' : '')));
        if (s.phase === 'turn') {
          const tick = () => {
            const rem = remaining(s.endsAt, Date.now());
            c.textContent = clock(rem);
            c.classList.toggle('is-low', rem <= 10000);
            if (rem > 0) body.__raf = requestAnimationFrame(tick);
          };
          tick();
        } else c.textContent = clock(s.left);
      }
    }
    const list = el('ul', 'cg-scores');
    s.scores.forEach((t, i) => {
      const li = el('li', i === s.team && s.phase !== 'end' ? 'is-now' : (s.phase === 'end' && s.winners.indexOf(t.name) >= 0 ? 'is-now' : ''));
      li.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')');
      li.appendChild(el('span', 'cg-sc-name', t.name));
      li.appendChild(el('b', 'cg-sc-n', String(t.score)));
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
    const base = { deck: DECKS[0] ? DECKS[0].id : 'bollywood', level: 2, teams: 2, names: '', secs: 90, skips: 3, rounds: 3, harder: false, cover: false };
    const opt = Object.assign(base, saved.opt || {}, preset);
    opt.secs = Math.max(3, Math.min(600, Number(opt.secs) || 90));
    let G = null, phase = 'setup', T = null, items = [], raf = 0, deadlineTimer = 0, ticker = 0, lastTickSec = -1, sureTimer = 0;

    /* ----- set-up panel ----- */
    const setup = el('section', 'game-panel cg-setup');
    setup.appendChild(el('h2', null, 'Set up the game'));
    const deckSel = el('select');
    DECKS.forEach((d) => { const o = el('option', null, d.name); o.value = d.id; deckSel.appendChild(o); });
    const ownOpt = el('option', null, STR.own); ownOpt.value = 'custom'; deckSel.appendChild(ownOpt);
    deckSel.value = opt.deck === 'custom' || deckById(opt.deck) ? opt.deck : base.deck;
    setup.appendChild(K.field(STR.chooseDeck, deckSel).wrap);

    const ownBox = el('div', 'cg-own');
    const ownText = el('textarea');
    ownText.placeholder = 'Mango lassi\nThe school bus\nDancing at a wedding';
    ownText.spellcheck = false;
    ownText.value = saved.keepWords && saved.words ? saved.words : '';
    const ownF = K.field('Your words', ownText, STR.ownHint);
    ownBox.appendChild(ownF.wrap);
    const keepIn = el('input'); keepIn.type = 'checkbox'; keepIn.checked = !!saved.keepWords;
    const keepL = el('label', 'game-check'); keepL.appendChild(keepIn); keepL.appendChild(document.createTextNode(STR.keep));
    ownBox.appendChild(keepL);
    setup.appendChild(ownBox);

    const lvlSeg = el('div', 'game-seg'); lvlSeg.setAttribute('role', 'group'); lvlSeg.setAttribute('aria-label', STR.level);
    const lvlBtns = STR.levels.map((t, i) => { const b = K.button(t, null, () => { opt.level = i + 1; syncSeg(); info(); }); lvlSeg.appendChild(b); return b; });
    setup.appendChild(K.field(STR.level, lvlSeg).wrap);
    const poolMsg = el('p', 'game-msg'); poolMsg.setAttribute('role', 'status');
    setup.appendChild(poolMsg);

    const teamsIn = el('input'); teamsIn.type = 'number'; teamsIn.min = '2'; teamsIn.max = String(MAX_TEAMS); teamsIn.inputMode = 'numeric'; teamsIn.value = String(opt.teams);
    setup.appendChild(K.field(STR.teams, teamsIn).wrap);
    const namesIn = el('input'); namesIn.type = 'text'; namesIn.placeholder = 'Tigers, Lions'; namesIn.value = opt.names || '';
    setup.appendChild(K.field(STR.teamNames, namesIn).wrap);

    const secSeg = el('div', 'game-seg'); secSeg.setAttribute('role', 'group'); secSeg.setAttribute('aria-label', STR.secs);
    const secBtns = SECS.map((n) => { const b = K.button(n + ' seconds', null, () => { opt.secs = n; syncSeg(); }); secSeg.appendChild(b); return [n, b]; });
    setup.appendChild(K.field(STR.secs, secSeg).wrap);
    const skipSel = el('select');
    SKIPS.forEach((s) => { const o = el('option', null, s[1]); o.value = String(s[0]); skipSel.appendChild(o); });
    skipSel.value = String(opt.skips);
    if (skipSel.value !== String(opt.skips)) skipSel.value = '3';
    setup.appendChild(K.field(STR.skips, skipSel).wrap);
    const roundsIn = el('input'); roundsIn.type = 'number'; roundsIn.min = '1'; roundsIn.max = '10'; roundsIn.inputMode = 'numeric'; roundsIn.value = String(opt.rounds);
    setup.appendChild(K.field(STR.rounds, roundsIn).wrap);

    function check(label, on) {
      const i = el('input'); i.type = 'checkbox'; i.checked = !!on;
      const l = el('label', 'game-check'); l.appendChild(i); l.appendChild(document.createTextNode(label));
      setup.appendChild(l); return i;
    }
    const harderIn = check(STR.harder, opt.harder);
    const coverIn = check(STR.cover, opt.cover);
    const soundIn = check(STR.sound, K.sound.on);
    soundIn.addEventListener('change', () => { K.sound.on = soundIn.checked; });
    const codeIn = el('input'); codeIn.type = 'text'; codeIn.maxLength = 16; codeIn.autocapitalize = 'characters'; codeIn.spellcheck = false;
    setup.appendChild(K.field(STR.code, codeIn, STR.codeHint).wrap);

    const setupMsg = el('p', 'game-msg'); setupMsg.setAttribute('role', 'status');
    setup.appendChild(setupMsg);
    const goRow = el('div', 'game-row');
    const startB = K.button(STR.start, 'btn-primary game-big', () => startGame());
    const resumeB = K.button(STR.resume, 'btn-ghost', () => resumeGame());
    resumeB.hidden = true;
    goRow.appendChild(startB); goRow.appendChild(resumeB);
    setup.appendChild(goRow);

    const browse = el('details', 'cg-browse');
    browse.appendChild(el('summary', null, 'See every word in this deck (spoils the game)'));
    const browseBody = el('div', 'cg-browse-body');
    browse.appendChild(browseBody);
    setup.appendChild(browse);

    /* ----- game panel ----- */
    const game = el('section', 'game-panel cg-game'); game.hidden = true;
    const head = el('div', 'cg-head');
    const headTitle = el('h2', 'cg-title');
    const codeP = el('p', 'cg-code game-msg');
    head.appendChild(headTitle); head.appendChild(codeP);
    game.appendChild(head);
    const status = el('p', 'game-msg cg-status'); status.setAttribute('role', 'status'); game.appendChild(status);
    const scoreList = el('ul', 'cg-scores cg-scores-host');
    const stageBox = el('div', 'cg-stagebox'); stageBox.appendChild(stage.bar());

    const clockEl = el('p', 'cg-clock-host'); clockEl.setAttribute('aria-hidden', 'true');
    const wordBox = el('div', 'cg-wordbox');
    const wordEl = el('p', 'cg-word');
    const metaEl = el('p', 'cg-meta');
    const holdB = el('button', 'btn-ghost cg-hold', STR.hold); holdB.type = 'button';
    wordBox.appendChild(holdB); wordBox.appendChild(wordEl); wordBox.appendChild(metaEl);
    const tally = el('p', 'game-msg cg-tally');
    const acts = el('div', 'game-row cg-acts');
    const gotB = K.button(STR.got, 'btn-primary game-big cg-got', () => gotIt());
    const skipB = K.button(STR.skip, 'btn-ghost game-big', () => skipWord());
    const pauseB = K.button(STR.pause, 'btn-ghost', () => togglePause());
    acts.appendChild(gotB); acts.appendChild(skipB); acts.appendChild(pauseB);
    const turnBox = el('div', 'cg-turn'); [clockEl, wordBox, tally, acts].forEach((x) => turnBox.appendChild(x));
    game.appendChild(turnBox);

    const readyBox = el('div', 'cg-ready');
    const readyMsg = el('p', 'cg-ready-msg');
    const startTurnB = K.button(STR.startTurn, 'btn-primary game-big', () => startTurn());
    readyBox.appendChild(readyMsg); readyBox.appendChild(startTurnB);
    game.appendChild(readyBox);

    const betweenBox = el('div', 'cg-between');
    const betweenMsg = el('p', 'cg-between-msg');
    const betweenList = el('ul', 'cg-log');
    const nextB = K.button(STR.next, 'btn-primary game-big', () => nextTeam());
    betweenBox.appendChild(betweenMsg); betweenBox.appendChild(betweenList); betweenBox.appendChild(nextB);
    game.appendChild(betweenBox);

    const endBox = el('div', 'cg-end');
    const endList = el('ol', 'cg-final');
    const endMsg = el('p', 'cg-between-msg');
    const endRow = el('div', 'game-row');
    const copyB = K.button('Copy the scores', 'btn-copy', () => {
      if (!G) return;
      K.copy(G.teams.map((n, i) => n + ': ' + G.scores[i]).join('\n')).then(() => { copyB.textContent = 'Copied'; copyB.classList.add('ok'); setTimeout(() => { copyB.textContent = 'Copy the scores'; copyB.classList.remove('ok'); }, 1600); });
    });
    const againB = K.button(STR.again, 'btn-primary', () => toSetup());
    endRow.appendChild(againB); endRow.appendChild(copyB);
    endBox.appendChild(endMsg); endBox.appendChild(endList); endBox.appendChild(endRow);
    game.appendChild(endBox);

    game.appendChild(scoreList); game.appendChild(stageBox);
    const leaveRow = el('div', 'game-row cg-leave');
    const leaveB = K.button(STR.newGame, 'btn-ghost', () => {
      if (leaveB.dataset.sure === '1') { clearTimeout(sureTimer); toSetup(); return; }
      leaveB.dataset.sure = '1'; leaveB.textContent = STR.sure;
      sureTimer = setTimeout(() => { leaveB.dataset.sure = ''; leaveB.textContent = STR.newGame; }, 4000);
    });
    leaveRow.appendChild(leaveB);
    game.appendChild(leaveRow);

    io.appendChild(setup); io.appendChild(game);

    /* ----- set-up behaviour ----- */
    function syncSeg() {
      lvlBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(opt.level === i + 1)));
      secBtns.forEach(([n, b]) => b.setAttribute('aria-pressed', String(opt.secs === n)));
    }
    function deckItems() {
      if (deckSel.value === 'custom') return parseCustom(ownText.value);
      const d = deckById(deckSel.value);
      return d ? parseDeck(d) : [];
    }
    function info() {
      const custom = deckSel.value === 'custom';
      ownBox.hidden = !custom;
      const all = deckItems();
      const n = pool(all, custom ? 3 : opt.level).length;
      lvlSeg.closest('.game-field').hidden = custom;
      poolMsg.textContent = custom ? all.length + (all.length === 1 ? ' word' : ' words') + ' typed.' : n + ' of ' + all.length + ' words are in play.';
      if (browse.open) fillBrowse();
    }
    function fillBrowse() {
      browseBody.textContent = '';
      const all = deckItems();
      const d = deckById(deckSel.value);
      const ul = el('ul', 'cg-browse-list');
      all.forEach((i) => ul.appendChild(el('li', null, i.w + (i.y ? ' (' + i.y + ')' : '') + (d ? ' · ' + ['easy', 'medium', 'hard'][i.d - 1] : ''))));
      browseBody.appendChild(ul);
      if (!all.length) browseBody.appendChild(el('p', 'game-msg', 'Nothing to show yet.'));
    }
    browse.addEventListener('toggle', () => { if (browse.open) fillBrowse(); });
    deckSel.addEventListener('change', () => { opt.deck = deckSel.value; info(); });
    ownText.addEventListener('input', info);

    function readTeams() {
      const k = Math.max(2, Math.min(MAX_TEAMS, parseInt(teamsIn.value, 10) || 2));
      const typed = K.parseList(namesIn.value, { maxLen: 24 });
      return Array.from({ length: k }, (_, i) => typed[i] || ('Team ' + (i + 1)));
    }
    function persistOpt() {
      const data = store.get({});
      data.opt = { deck: deckSel.value, level: opt.level, teams: readTeams().length, names: namesIn.value, secs: opt.secs, skips: Number(skipSel.value), rounds: Math.max(1, Math.min(10, parseInt(roundsIn.value, 10) || 3)), harder: harderIn.checked, cover: coverIn.checked };
      data.keepWords = keepIn.checked;
      if (keepIn.checked) data.words = ownText.value.slice(0, 20000); else delete data.words;
      store.set(data);
    }
    function savedGame() { const g = store.get({}).game; return g && g.seed && g.teams && g.teams.length ? g : null; }
    function saveGame() {
      const data = store.get({});
      if (!G || phase === 'end' || (G.deckId === 'custom' && !keepIn.checked)) delete data.game;
      else data.game = { seed: G.seed, deckId: G.deckId, level: G.level, teams: G.teams, rounds: G.rounds, secs: G.secs, skips: G.skips, harder: G.harder, cover: G.cover, turn: G.turn, scores: G.scores, pos: G.pos, words: G.deckId === 'custom' ? G.words : undefined };
      store.set(data);
    }

    /* ----- starting, resuming, leaving ----- */
    function itemsFor(g) {
      const all = g.deckId === 'custom' ? parseCustom(g.words || '') : parseDeck(deckById(g.deckId) || { d1: '' });
      return pool(all, g.deckId === 'custom' ? 3 : g.level);
    }
    function begin(g) {
      G = g; items = itemsFor(g);
      phase = 'ready'; T = null;
      K.wakeLock(true);
      setup.hidden = true; game.hidden = false;
      leaveB.dataset.sure = ''; leaveB.textContent = STR.newGame;
      headTitle.textContent = (g.deckId === 'custom' ? STR.own : (deckById(g.deckId) || {}).name);
      codeP.textContent = 'Game code ' + g.seed;
      show();
      saveGame();
      publish();
    }
    function startGame() {
      K.sound.unlock();
      const custom = deckSel.value === 'custom';
      const all = deckItems();
      const level = custom ? 3 : opt.level;
      if (pool(all, level).length < 5) { setupMsg.textContent = custom ? 'Type at least 5 different words, one per line.' : 'That deck has too few words at this level.'; setupMsg.className = 'game-msg is-warn'; return; }
      setupMsg.textContent = ''; setupMsg.className = 'game-msg';
      persistOpt();
      const teams = readTeams();
      const code = K.cleanSeed(codeIn.value);
      begin({
        seed: code || K.newSeed(6), deckId: deckSel.value, level: level, teams: teams,
        rounds: Math.max(1, Math.min(10, parseInt(roundsIn.value, 10) || 3)),
        secs: opt.secs, skips: Number(skipSel.value), harder: harderIn.checked, cover: coverIn.checked,
        words: custom ? ownText.value.slice(0, 20000) : undefined,
        turn: 0, scores: teams.map(() => 0), pos: 0
      });
    }
    function resumeGame() {
      const g = savedGame();
      if (!g) return;
      begin(Object.assign({}, g));
    }
    function toSetup() {
      stopTimers();
      phase = 'setup'; G = null; T = null;
      K.wakeLock(false);
      game.hidden = true; setup.hidden = false;
      saveGame();
      refreshResume();
      publish();
    }
    function refreshResume() {
      const g = savedGame();
      resumeB.hidden = !g;
      if (g) resumeB.textContent = STR.resume + ' (turn ' + (g.turn + 1) + ')';
    }

    /* ----- the turn ----- */
    function stopTimers() { cancelAnimationFrame(raf); raf = 0; clearTimeout(deadlineTimer); deadlineTimer = 0; clearInterval(ticker); ticker = 0; }
    function teamName() { return G.teams[turnInfo(G.turn, G.teams.length, G.rounds).team]; }
    function draw() {
      const w = wordAt(items, G.seed, G.pos);
      if (G.pos >= items.length && G.pos % items.length === 0) { status.textContent = 'Every word in this deck has been used, so it has been shuffled again.'; }
      G.pos++;
      return w;
    }
    function startTurn() {
      if (phase !== 'ready') return;
      K.sound.unlock();
      T = { endAt: performance.now() + G.secs * 1000, left: G.secs * 1000, log: [], skipsLeft: G.skips, current: null, held: false, paused: false };
      T.current = draw();
      phase = 'turn';
      lastTickSec = -1;
      status.textContent = status.textContent.indexOf('shuffled again') >= 0 ? status.textContent : '';
      show();
      armDeadline();
      loop();
      K.announce(root, teamName() + ', your turn. ' + clock(G.secs * 1000) + ' on the clock.');
      publish();
    }
    function armDeadline() {
      clearTimeout(deadlineTimer);
      deadlineTimer = setTimeout(checkDeadline, Math.max(0, T.endAt - performance.now()) + 5);
    }
    function checkDeadline() {
      if (phase === 'turn' && performance.now() >= T.endAt) finishTurn();
    }
    /* the display follows the deadline: animation frames when the page is in view, a timer when it is not (a page behind the TV window gets no frames) */
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
      clockEl.textContent = clock(rem);
      clockEl.classList.toggle('is-low', rem <= 10000);
      const sec = Math.ceil(rem / 1000);
      if (sec <= 5 && sec > 0 && sec !== lastTickSec) { lastTickSec = sec; K.sound.tick(); }
      if (rem <= 0) finishTurn();
    }
    function turnPoints() { return T.log.reduce((s, x) => s + (x.got ? points(x.item, G.harder) : 0), 0); }
    function gotIt() {
      if (phase !== 'turn' || performance.now() >= T.endAt) return;
      T.log.push({ item: T.current, got: true });
      K.sound.ding();
      T.current = draw(); T.held = false;
      renderWord(); renderTally();
      K.announce(root, 'Got it. ' + T.log.filter((x) => x.got).length + ' so far.');
      publish();
    }
    function skipWord() {
      if (phase !== 'turn' || performance.now() >= T.endAt) return;
      if (T.skipsLeft === 0) return;
      T.log.push({ item: T.current, got: false });
      if (T.skipsLeft > 0) T.skipsLeft--;
      T.current = draw(); T.held = false;
      renderWord(); renderTally();
      publish();
    }
    function togglePause() {
      if (phase === 'turn') {
        T.left = remaining(T.endAt, performance.now()); T.paused = true;
        stopTimers(); phase = 'paused';
        wordEl.textContent = ''; metaEl.textContent = '';
        show(); publish();
      } else if (phase === 'paused') {
        T.endAt = performance.now() + T.left; T.paused = false; phase = 'turn';
        show(); armDeadline(); loop(); publish();
      }
    }
    function finishTurn() {
      if (phase !== 'turn') return;
      stopTimers();
      const pts = turnPoints();
      const ti = turnInfo(G.turn, G.teams.length, G.rounds);
      G.scores[ti.team] += pts;
      T.gained = pts; T.team = ti.team;
      phase = 'between';
      K.sound.buzz();
      wordEl.textContent = '';
      show();
      const got = T.log.filter((x) => x.got).length;
      K.announce(root, 'Time is up. ' + G.teams[ti.team] + ' got ' + got + (got === 1 ? ' word' : ' words') + ' for ' + pts + (pts === 1 ? ' point.' : ' points.'));
      saveGame();
      publish();
    }
    function nextTeam() {
      if (phase !== 'between') return;
      G.turn++;
      T = null;
      if (turnInfo(G.turn, G.teams.length, G.rounds).over) {
        phase = 'end'; K.wakeLock(false); K.sound.fanfare(); show();
        const w = winners(G.scores);
        K.announce(root, w.length === 1 ? G.teams[w[0]] + ' win.' : 'A draw.');
        saveGame(); publish(); refreshResume();
        return;
      }
      phase = 'ready';
      status.textContent = '';
      show(); saveGame(); publish();
    }
    function fixWord(entry) {
      if (phase !== 'between') return;
      entry.got = !entry.got;
      const d = points(entry.item, G.harder) * (entry.got ? 1 : -1);
      G.scores[T.team] += d; T.gained += d;
      renderBetween(); renderScores(); saveGame(); publish();
    }

    /* ----- drawing the host's screen ----- */
    function renderScores() {
      const ti = G && turnInfo(G.turn, G.teams.length, G.rounds);
      scoreList.textContent = '';
      G.teams.forEach((n, i) => {
        const li = el('li', ti && !ti.over && i === ti.team && phase !== 'end' ? 'is-now' : '');
        li.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')');
        li.appendChild(el('span', 'cg-sc-name', n));
        const live = (phase === 'turn' || phase === 'paused') && i === ti.team ? turnPoints() : 0;
        li.appendChild(el('b', 'cg-sc-n', String(G.scores[i] + live)));
        scoreList.appendChild(li);
      });
    }
    function renderWord() {
      const w = T && T.current;
      if (!w) { wordEl.textContent = ''; metaEl.textContent = ''; return; }
      const covered = G.cover && !T.held;
      holdB.hidden = !G.cover;
      wordEl.textContent = covered ? '' : w.w;
      wordEl.classList.toggle('is-covered', covered);
      wordEl.setAttribute('aria-live', G.cover ? 'off' : 'polite');
      const bits = [];
      if (!covered) {
        if (w.y) bits.push('Film from ' + w.y);
        if (G.harder) bits.push(w.d + (w.d === 1 ? ' point' : ' points'));
      }
      metaEl.textContent = bits.join(' · ');
    }
    function renderTally() {
      const got = T.log.filter((x) => x.got).length;
      tally.textContent = 'Got it: ' + got + (G.skips < 0 ? '' : ' · Skips left: ' + T.skipsLeft);
      skipB.disabled = T.skipsLeft === 0;
      renderScores();
    }
    function renderBetween() {
      const got = T.log.filter((x) => x.got).length;
      betweenMsg.textContent = 'Time’s up! ' + G.teams[T.team] + ' got ' + got + (got === 1 ? ' word' : ' words') + ': ' + T.gained + (T.gained === 1 ? ' point.' : ' points.');
      betweenList.textContent = '';
      T.log.forEach((x) => {
        const li = el('li');
        const b = K.button('', 'cg-log-btn' + (x.got ? ' is-got' : ''), () => fixWord(x));
        b.setAttribute('aria-pressed', String(x.got));
        b.appendChild(el('span', 'cg-log-mark', x.got ? 'Got it' : 'Missed'));
        b.appendChild(document.createTextNode(' ' + x.item.w));
        b.title = 'Tap to change';
        li.appendChild(b);
        betweenList.appendChild(li);
      });
      if (!T.log.length) betweenList.appendChild(el('li', 'game-msg', 'No words this turn.'));
    }
    function show() {
      const p = phase;
      turnBox.hidden = !(p === 'turn' || p === 'paused');
      readyBox.hidden = p !== 'ready';
      betweenBox.hidden = p !== 'between';
      endBox.hidden = p !== 'end';
      leaveRow.hidden = p === 'end';
      renderScores();
      const ti = turnInfo(G.turn, G.teams.length, G.rounds);
      if (p === 'ready') {
        readyMsg.textContent = G.teams[ti.team] + ', you are up (round ' + ti.round + ' of ' + G.rounds + '). Give the phone to your actor, then press Start turn.';
        startTurnB.focus({ preventScroll: true });
      } else if (p === 'turn' || p === 'paused') {
        pauseB.textContent = p === 'paused' ? STR.resumeTurn : STR.pause;
        gotB.disabled = skipB.disabled = p === 'paused';
        if (p === 'turn') { renderWord(); renderTally(); } else { clockEl.textContent = clock(T.left); tally.textContent = 'Paused. The word is hidden until you carry on.'; }
      } else if (p === 'between') {
        renderBetween();
        nextB.focus({ preventScroll: true });
      } else if (p === 'end') {
        const w = winners(G.scores);
        endMsg.textContent = w.length === 1 ? G.teams[w[0]] + ' win!' : 'A draw between ' + w.map((i) => G.teams[i]).join(' and ') + '.';
        endList.textContent = '';
        G.teams.map((n, i) => ({ n, s: G.scores[i], i })).sort((a, b) => b.s - a.s).forEach((x) => {
          const li = el('li', w.indexOf(x.i) >= 0 ? 'is-now' : ''); li.style.setProperty('--tc', 'var(--t' + ((x.i % 8) + 1) + ')');
          li.appendChild(el('span', 'cg-sc-name', x.n)); li.appendChild(el('b', 'cg-sc-n', String(x.s)));
          endList.appendChild(li);
        });
      }
    }

    /* ----- what the TV is told (never the word) ----- */
    function publish() {
      if (!G || phase === 'setup') { stage.update({ phase: 'setup' }); return; }
      const ti = turnInfo(G.turn, G.teams.length, G.rounds);
      const deck = G.deckId === 'custom' ? STR.own : (deckById(G.deckId) || {}).name;
      const s = {
        phase: phase, deck: deck, team: phase === 'end' ? -1 : ti.team, teamName: phase === 'end' ? '' : G.teams[ti.team],
        turnNo: Math.min(G.turn + 1, G.teams.length * G.rounds), totalTurns: G.teams.length * G.rounds,
        scores: G.teams.map((n, i) => ({ name: n, score: G.scores[i] })),
        got: 0, gained: 0, skipsLeft: G.skips, endsAt: 0, left: G.secs * 1000, winners: []
      };
      if (T) {
        s.got = T.log.filter((x) => x.got).length;
        s.skipsLeft = T.skipsLeft;
        if (phase === 'turn') s.endsAt = Date.now() + remaining(T.endAt, performance.now());
        if (phase === 'paused') s.left = T.left;
        if (phase === 'between') s.gained = T.gained;
      }
      if (phase === 'end') s.winners = winners(G.scores).map((i) => G.teams[i]);
      stage.update(s);
    }

    /* ----- keys, cover mode ----- */
    function hotkey(key) {
      const k = String(key).toLowerCase();
      if (k === 'n' || k === ' ') { if (phase === 'ready') startTurn(); else if (phase === 'between') nextTeam(); }
      else if (k === 'g' || k === 'arrowright') gotIt();
      else if (k === 's' || k === 'arrowleft') skipWord();
      else if (k === 'p') togglePause();
    }
    stage.onKey = hotkey;
    document.addEventListener('keydown', (e) => {
      if (!G || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.key === 'h' || e.key === 'H') { if (phase === 'turn' && G.cover && !e.repeat) { T.held = true; renderWord(); } return; }
      if (e.key === ' ' && t && t.tagName === 'BUTTON') return;
      if (['n', 'N', ' ', 'g', 'G', 's', 'S', 'p', 'P'].indexOf(e.key) >= 0 && !e.repeat) { e.preventDefault(); hotkey(e.key); }
    });
    document.addEventListener('keyup', (e) => {
      if ((e.key === 'h' || e.key === 'H') && phase === 'turn' && G && G.cover) { T.held = false; renderWord(); }
    });
    const hold = (on) => () => { if (phase === 'turn' && G.cover) { T.held = on; renderWord(); } };
    holdB.addEventListener('pointerdown', (e) => { e.preventDefault(); try { holdB.setPointerCapture(e.pointerId); } catch (x) { /* older browsers: the button still works while the pointer stays on it */ } hold(true)(); });
    ['pointerup', 'pointercancel', 'pointerleave', 'blur'].forEach((ev) => holdB.addEventListener(ev, hold(false)));
    holdB.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); hold(true)(); } });
    holdB.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') hold(false)(); });
    holdB.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { checkDeadline(); if (phase === 'turn') loop(); }
      else if (T) T.held = false;
    });

    /* ----- first paint ----- */
    syncSeg();
    info();
    refreshResume();
    publish();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-tool="' + SLUG + '"]');
    if (!root || !K) return;
    let host = null;
    const stage = K.stage({
      slug: SLUG,
      title: 'Dumb Charades',
      render: renderStage,
      onCommand: (m) => { if (m && m.type === 'key' && host && host.onKey) host.onKey(m.key); }
    });
    if (stage.isStage) return;
    host = stage;
    mount(root, stage);
  });
})();
