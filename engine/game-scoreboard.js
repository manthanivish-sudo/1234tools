/**
 * Quiz Scoreboard: 2 to 12 teams, rounds, jokers, undo, a timer and a big
 * leaderboard for the TV.
 *
 * The rules (pure, on spec.maths, checked by build/tests/games/scoreboard.js):
 *   - points go into the CURRENT round of a team; a team's total is the sum of
 *     its rounds;
 *   - a team's joker, played once, doubles that team's points in the round it
 *     was played (minus points too); play it again in the same round to take it
 *     back; once the game has moved on it cannot be played again;
 *   - ranks are competition ranks: 1, 2, 2, 4 for 14, 7, 7, 3 points;
 *   - every recorded change can be undone and redone (up to 300 steps).
 *
 * The game is kept on this device (GameKit.store) so a refresh keeps it, and
 * the results export as CSV. Nothing is uploaded.
 *
 * Points from the Quiz Buzzer. This page listens on
 * BroadcastChannel('mvr-games:points'). The buzzer posts
 *     { team: <1-based position of the team, a whole number>,
 *       name: <the team's name>, points: <a whole number, not 0> }
 * (the same shape is documented in engine/game-quiz-buzzer.js). The team is
 * matched by name first (ignoring case), then by position; the points go into
 * the current round. It only works while both pages are open in the same
 * browser on this device.
 */
(function () {
  'use strict';
  window.GAME_TOOLS = window.GAME_TOOLS || {};
  window.GAME_TOOLS['scoreboard'] = {
    order: 6,
    title: 'Quiz Scoreboard',
    short: 'Quiz Scoreboard',
    description: 'Keep score for a quiz night or a class: up to 12 teams, rounds, a joker for each team, undo and redo, a round timer and a big leaderboard for the TV. Free, no sign-up, kept on your device.',
    keywords: ['quiz scoreboard', 'quiz score keeper', 'online scoreboard', 'quiz night scoreboard', 'points tracker', 'classroom points tracker', 'team score counter', 'pub quiz scoring'],
    glyph: 'i-scoreboard',
    glyphSvg: '<symbol id="i-scoreboard" viewBox="0 0 24 24">\n  <rect x="2.6" y="4.4" width="18.8" height="15.2" rx="2.4"/>\n  <path d="M12 4.4v15.2M2.6 9.6h18.8" class="thin"/>\n  <path d="M5.6 13.6h3.4M5.6 16.6h2M15 13.6h3.4M15 16.6h3.4" class="thin"/>\n  <circle cx="7.3" cy="7" r=".9" class="fill"/>\n  <circle cx="16.7" cy="7" r=".9" class="fill"/>\n</symbol>',
    scripts: ['/engine/game-kit.js', '/engine/game-scoreboard.js'],
    privacy: 'The team names and scores stay on this device. They are kept in this browser so a refresh does not lose the game, and nothing is uploaded; “New game” clears the scores.',
    how: [
      'Choose how many teams are playing and type their names. Each team has a colour; the name is always shown too.',
      'Press +1, +5 or −1 for a team, or type any number of points and press Add. Press Next round when the round is over.',
      'Play a joker for a team to double its points in that round. Use Undo (U) if you slip.',
      'Press Show on TV for a big leaderboard that re-orders as the scores change. Export the results as a CSV file when the quiz ends.'
    ],
    uses: [
      ['Family quiz night', 'four teams, six rounds, a joker each, and the leaderboard on the TV'],
      ['Classroom', 'points for tables or houses across the week, kept on the teacher’s device'],
      ['Pub or club quiz', 'up to 12 teams with the totals and the round-by-round scores in one table']
    ],
    tips: [
      'Keys: 1 to 9 pick a team, + and − change the picked team by one point, U undoes and Y redoes. They work when no box is being typed in, and on the TV window’s keyboard too.',
      'A joker doubles that team’s points in the round it is played, including minus points. Press the joker button again in the same round to take it back. A played joker can be taken back only while you are scoring the round it was played in.',
      'Points always go into the round shown in “Scoring round”. To fix an earlier round, choose it from the list; new points go there until you press Next round.',
      'Equal totals share a rank: 14, 7, 7 and 3 points are ranked 1st, 2nd, 2nd and 4th. On the TV, ties keep the order of the teams on this page.',
      'The timer counts down from the clock, so it stays right even if the page is busy. It makes a buzz at zero but does not stop the scoring.',
      'The game is saved on this device after every change, so a refresh or a closed tab does not lose it. “New game” asks first, keeps the team names and colours, and clears the scores and rounds.',
      'With the Quiz Buzzer open in the same browser, tick its “send points” box and a correct answer adds points here, to the team with the same name, in the current round.'
    ],
    faq: [
      { q: 'How does the joker work?', a: 'Each team has one joker. Playing it doubles that team’s points in the round you are scoring, and the table marks the round with ×2. Playing it again in the same round takes it back; while you are scoring a different round a played joker cannot be moved.' },
      { q: 'Can I undo a mistake?', a: 'Yes. Undo (or the U key) takes back the last change and Redo (Y) puts it back. Points, jokers, new rounds, team changes and a new game can all be undone, up to 300 steps back. Closing the page forgets the undo list but keeps the scores.' },
      { q: 'How do I show the scores on the TV?', a: 'Press Show on TV to open the leaderboard in a new window, drag it to the TV or projector (or cast that browser tab) and press Full screen there. This page stays your remote. With one screen, press Full screen here. The ranks re-order smoothly whenever the scores change.' },
      { q: 'Will I lose the scores if I refresh the page?', a: 'No. The game is saved in your browser after every change and comes back when you reopen the page on the same device. It is not sent anywhere, so it will not appear on another device.' },
      { q: 'Can I get the results as a spreadsheet?', a: 'Yes. Export CSV downloads a file with one row per team: rank, team, each round’s score (jokers already doubled), the joker round and the total. It opens in any spreadsheet.' },
      { q: 'How many teams and rounds can I have?', a: 'From 2 to 12 teams and up to 50 rounds. Changing the number of teams keeps the teams that remain; teams removed from the end take their scores with them, and Undo brings them back.' },
      { q: 'Can the buzzer add the points for me?', a: 'Yes, when the Quiz Buzzer and this scoreboard are open in the same browser. In the buzzer, tick “Send points to the scoreboard”; pressing Correct then adds the points to the team of the same name here, in the current round.' }
    ],
    related: ['/utilities/random-number-generator/', '/time/countdown-timer/', '/utilities/dice-roller/'],
    landings: [
      {
        slug: 'quiz-night-scoreboard',
        title: 'Quiz Night Scoreboard',
        description: 'A free scoreboard for a family or pub quiz: four teams, rounds, a joker per team, undo, a round timer and a leaderboard for the TV. Nothing to install, nothing uploaded.',
        lede: 'Four teams ready to go: tap to add points, play a joker, move on a round, and put the ranked leaderboard on the TV.',
        preset: { teams: 4 },
        about: [
          'The scoreboard starts with four teams. Change the number if you have more, type the team names, and score each round with +1, +5, −1 or any number you type.',
          'Open the Quiz Buzzer for the quick-fire round, tick its box to send points, and a correct answer scores here by itself. Export CSV at the end for the winners’ list.'
        ],
        faq: [
          { q: 'How many teams does a quiz night need?', a: 'Three to six teams of three to five people keeps everyone involved and the scoring quick. This scoreboard takes up to 12.' },
          { q: 'Can I run it without a connection?', a: 'Yes. After the first visit it opens offline, and your game is saved on the device, so a venue with no signal is fine.' }
        ]
      },
      {
        slug: 'classroom-points-tracker',
        title: 'Classroom Points Tracker',
        description: 'Track house or table points in class: six groups, rounds for each lesson or day, undo, a timer and a big leaderboard for the board. Free, kept on your device.',
        lede: 'Six groups to start, points one tap at a time, a new round for each lesson, and the leaderboard on the classroom board.',
        preset: { teams: 6, prefix: 'Group' },
        about: [
          'The tracker opens with six groups, named Group 1 to Group 6; rename them to your tables or houses. Use a round for each lesson, day or topic, and the table shows each group’s points round by round.',
          'The game stays on the computer until you press New game, so Friday’s totals are still there on Monday. Nothing is uploaded, and no pupil names are needed.'
        ],
        faq: [
          { q: 'Is anything about my pupils stored online?', a: 'No. Group names and points stay in the browser on that computer and are never uploaded. You can use house or table names instead of pupils’ names.' },
          { q: 'Can I take points away?', a: 'Yes. Use −1, or type a negative number in the points box and press Add. Undo takes back the last change.' }
        ]
      }
    ]
  };

  if (typeof document === 'undefined') return;
  const K = window.GameKit;
  const SLUG = 'scoreboard';
  const MIN_TEAMS = 2, MAX_TEAMS = 12, MAX_ROUNDS = 50, MAX_UNDO = 300, MAX_POINTS = 100000;
  const COLOURS = ['Gold', 'Sky', 'Pink', 'Green', 'Purple', 'Orange', 'Blue', 'Silver'];
  const CHANNEL = 'mvr-games:points';

  /* every user-facing string lives here so the Hindi wave can translate them */
  const STR = {
    gameHeading: 'The game',
    teams: 'Teams',
    scoringRound: 'Scoring round',
    roundName: 'Round name',
    nextRound: 'Next round',
    undo: 'Undo  (U)',
    redo: 'Redo  (Y)',
    csv: 'Export CSV',
    newGame: 'New game',
    sure: 'Start a new game? This clears every score and round (the team names stay).',
    yes: 'Yes, new game',
    no: 'Keep playing',
    timer: 'Round timer',
    seconds: 'Seconds',
    start: 'Start timer',
    pause: 'Pause timer',
    resetTimer: 'Reset timer',
    timesUp: 'Time is up',
    keys: 'Keys: 1 to 9 pick a team, + and − change it, U undo, Y redo.',
    teamsHeading: 'Teams',
    tableHeading: 'Scores by round',
    add: 'Add',
    custom: 'Points to add',
    joker: 'Play joker',
    jokerBack: 'Joker played (tap to take back)',
    jokerUsed: 'Joker used',
    total: 'Total',
    round: 'This round',
    colour: 'Colour',
    teamName: 'Team name',
    saved: 'Saved on this device.',
    fromBuzzer: 'From the buzzer: ',
    empty: 'No teams yet.',
    waitTv: 'The scores will appear here.'
  };

  /* ---------- the rules (pure; build/tests/games/scoreboard.js checks them) ---------- */

  const clone = (s) => JSON.parse(JSON.stringify(s));
  function initial(n, prefix) {
    n = Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, Math.round(n) || 4));
    const p = (prefix || 'Team').slice(0, 20);
    return {
      v: 1, round: 0, rounds: ['Round 1'],
      teams: Array.from({ length: n }, (_, i) => ({ name: p + ' ' + (i + 1), color: i % 8, joker: null })),
      scores: Array.from({ length: n }, () => [0])
    };
  }
  const cleanName = (s, max, dflt) => (String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max)) || dflt;
  const cleanInt = (n) => { n = Math.round(Number(n)); return isFinite(n) ? Math.max(-MAX_POINTS, Math.min(MAX_POINTS, n)) : 0; };
  /** A state read from storage, checked and repaired; null when it is not a game. */
  function sanitise(o) {
    if (!o || typeof o !== 'object' || !Array.isArray(o.teams) || !Array.isArray(o.rounds) || !Array.isArray(o.scores)) return null;
    if (o.teams.length < MIN_TEAMS || o.teams.length > MAX_TEAMS || !o.rounds.length || o.rounds.length > MAX_ROUNDS) return null;
    const rounds = o.rounds.map((r, i) => cleanName(r, 30, 'Round ' + (i + 1)));
    const teams = o.teams.map((t, i) => ({
      name: cleanName(t && t.name, 30, 'Team ' + (i + 1)),
      color: Math.max(0, Math.min(7, (t && t.color | 0) || 0)),
      joker: t && Number.isInteger(t.joker) && t.joker >= 0 && t.joker < rounds.length ? t.joker : null
    }));
    const scores = teams.map((_, i) => rounds.map((_r, r) => cleanInt(o.scores[i] && o.scores[i][r])));
    return { v: 1, round: Math.max(0, Math.min(rounds.length - 1, o.round | 0)), rounds, teams, scores };
  }
  /** One change. Returns a new state, or the same one when nothing changed. */
  function reduce(s, a) {
    const n = clone(s);
    const T = n.teams.length;
    switch (a.t) {
      case 'add': {
        if (!(a.team >= 0 && a.team < T)) return s;
        const p = cleanInt(a.n);
        if (!p) return s;
        n.scores[a.team][n.round] += p;
        return n;
      }
      case 'joker': {
        if (!(a.team >= 0 && a.team < T)) return s;
        const t = n.teams[a.team];
        if (t.joker === null) t.joker = n.round;
        else if (t.joker === n.round) t.joker = null;
        else return s;
        return n;
      }
      case 'nextRound':
        if (n.rounds.length >= MAX_ROUNDS) return s;
        n.rounds.push('Round ' + (n.rounds.length + 1));
        n.scores.forEach((row) => row.push(0));
        n.round = n.rounds.length - 1;
        return n;
      case 'pick':
        if (!(a.round >= 0 && a.round < n.rounds.length) || a.round === n.round) return s;
        n.round = a.round;
        return n;
      case 'roundName': {
        const name = cleanName(a.name, 30, 'Round ' + (n.round + 1));
        if (name === n.rounds[n.round]) return s;
        n.rounds[n.round] = name;
        return n;
      }
      case 'rename': {
        if (!(a.team >= 0 && a.team < T)) return s;
        const name = cleanName(a.name, 30, 'Team ' + (a.team + 1));
        if (name === n.teams[a.team].name) return s;
        n.teams[a.team].name = name;
        return n;
      }
      case 'colour': {
        if (!(a.team >= 0 && a.team < T) || !(a.color >= 0 && a.color < 8) || n.teams[a.team].color === a.color) return s;
        n.teams[a.team].color = a.color | 0;
        return n;
      }
      case 'teams': {
        const want = Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, Math.round(a.n) || T));
        if (want === T) return s;
        while (n.teams.length > want) { n.teams.pop(); n.scores.pop(); }
        while (n.teams.length < want) {
          const i = n.teams.length;
          n.teams.push({ name: (a.prefix || 'Team') + ' ' + (i + 1), color: i % 8, joker: null });
          n.scores.push(n.rounds.map(() => 0));
        }
        return n;
      }
      case 'newGame': {
        const f = initial(T);
        f.teams.forEach((t, i) => { t.name = n.teams[i].name; t.color = n.teams[i].color; });
        return f;
      }
      default: return s;
    }
  }
  const effective = (s, t, r) => (s.scores[t][r] || 0) * (s.teams[t].joker === r ? 2 : 1);
  function totals(s) { return s.teams.map((_, t) => s.rounds.reduce((sum, _r, r) => sum + effective(s, t, r), 0)); }
  /** Competition ranks (1, 2, 2, 4) for a list of totals. */
  function ranks(tot) { return tot.map((x) => 1 + tot.filter((y) => y > x).length); }
  /** Team indexes, best first; ties keep the teams' own order. */
  function order(tot) { return tot.map((_, i) => i).sort((a, b) => tot[b] - tot[a] || a - b); }
  /** A spreadsheet cell: text is quoted, and a leading = + - @ is defused. */
  function cell(text) {
    let t = String(text);
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
    return '"' + t.replace(/"/g, '""') + '"';
  }
  function csv(s) {
    const tot = totals(s), rk = ranks(tot);
    const rows = [['Rank', 'Team'].map(cell).concat(s.rounds.map(cell), [cell('Joker round'), cell('Total')]).join(',')];
    order(tot).forEach((t) => {
      const tm = s.teams[t];
      rows.push([String(rk[t]), cell(tm.name)].concat(
        s.rounds.map((_r, r) => String(effective(s, t, r))),
        [tm.joker === null ? '""' : cell(s.rounds[tm.joker]), String(tot[t])]).join(','));
    });
    return rows.join('\r\n') + '\r\n';
  }
  /** The history of a game: record each change, undo and redo. */
  function history(start) {
    const h = { now: start, past: [], future: [] };
    h.do = function (a) {
      const next = reduce(h.now, a);
      if (next === h.now) return false;
      h.past.push(h.now); if (h.past.length > MAX_UNDO) h.past.shift();
      h.future = []; h.now = next;
      return true;
    };
    h.undo = function () { if (!h.past.length) return false; h.future.push(h.now); h.now = h.past.pop(); return true; };
    h.redo = function () { if (!h.future.length) return false; h.past.push(h.now); h.now = h.future.pop(); return true; };
    return h;
  }
  window.GAME_TOOLS[SLUG].maths = { initial, sanitise, reduce, effective, totals, ranks, order, csv, history, cell };

  /* ---------- the big screen ---------- */

  const clock = (ms) => { const s = Math.ceil(Math.max(0, ms) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const timerLeft = (t) => (t.running ? Math.max(0, t.endAt - Date.now()) : t.left);
  const views = new WeakMap();
  function renderStage(body, s) {
    let v = views.get(body);
    if (!v || !body.contains(v.rows)) {
      body.textContent = '';
      const head = K.el('div', 'sb-head');
      const title = K.el('h1', 'st-title sb-title');
      const tm = K.el('p', 'sb-clock');
      tm.setAttribute('aria-hidden', 'true');
      head.appendChild(title); head.appendChild(tm);
      const rows = K.el('div', 'sb-rows');
      body.appendChild(head); body.appendChild(rows);
      v = { title: title, clock: tm, rows: rows, els: new Map(), tick: 0 };
      views.set(body, v);
    }
    v.state = s;
    if (!s.teams || !s.teams.length) { v.rows.textContent = ''; v.els.clear(); v.title.textContent = STR.waitTv; v.clock.textContent = ''; return; }
    v.title.textContent = s.round || 'Scores';
    const n = s.teams.length;
    v.rows.style.setProperty('--fs', Math.max(2.2, Math.min(7, 74 / n / 1.45)).toFixed(2) + 'vmin');
    /* first positions, for the FLIP move */
    const first = new Map();
    v.els.forEach((el, id) => first.set(id, el.getBoundingClientRect().top));
    const seen = new Set();
    s.teams.forEach((t) => {
      seen.add(t.id);
      let el = v.els.get(t.id);
      if (!el) {
        el = K.el('div', 'sb-row');
        el.appendChild(K.el('span', 'sb-rank'));
        el.appendChild(K.el('span', 'sb-name'));
        el.appendChild(K.el('span', 'sb-joker'));
        el.appendChild(K.el('span', 'sb-total'));
        v.els.set(t.id, el);
      }
      el.style.setProperty('--tc', 'var(--t' + (t.color + 1) + ')');
      el.children[0].textContent = t.rank;
      el.children[1].textContent = t.name;
      el.children[2].textContent = t.joker ? '×2' : '';
      el.children[3].textContent = t.total;
      el.classList.toggle('is-lead', t.rank === 1 && t.total !== 0);
      v.rows.appendChild(el);   /* appending in rank order is the re-ordering */
    });
    v.els.forEach((el, id) => { if (!seen.has(id)) { el.remove(); v.els.delete(id); } });
    if (!K.reducedMotion()) {
      v.els.forEach((el, id) => {
        if (!first.has(id)) return;
        const dy = first.get(id) - el.getBoundingClientRect().top;
        if (Math.abs(dy) < 1) return;
        el.style.transition = 'none';
        el.style.transform = 'translateY(' + dy + 'px)';
        void el.offsetHeight;
        el.style.transition = 'transform .55s cubic-bezier(.2,.8,.2,1)';
        el.style.transform = '';
        clearTimeout(el._flip);
        el._flip = setTimeout(() => { el.style.transition = ''; }, 700);
      });
    }
    /* the timer, from the clock */
    clearInterval(v.tick);
    const t = s.timer;
    if (!t || (!t.running && t.left >= t.total * 1000)) { v.clock.textContent = ''; v.clock.className = 'sb-clock'; return; }
    const paint = () => {
      const left = timerLeft(t);
      v.clock.textContent = clock(left);
      v.clock.className = 'sb-clock' + (left === 0 ? ' is-zero' : (left < 10000 && t.running ? ' is-low' : ''));
      if (!t.running || left === 0) clearInterval(v.tick);
    };
    paint();
    if (t.running) v.tick = setInterval(paint, 200);
  }

  /* ---------- the page ---------- */

  function mount(root, stage) {
    const io = root.querySelector('.tool-io');
    const store = K.store(SLUG, 1);
    const preset = K.preset(root);
    const savedGame = sanitise(store.get({}).game);
    const hist = history(savedGame || initial(preset.teams || 4, preset.prefix));
    let sel = 0, built = 0;
    const timer = { secs: 30, left: 30000, endAt: 0, running: false };
    let timerTick = 0;
    const S = () => hist.now;

    /* ---- the game panel ---- */
    const top = K.el('section', 'game-panel sb-top');
    top.appendChild(K.el('h2', null, STR.gameHeading));
    const grid = K.el('div', 'sb-controls');
    const nTeams = K.el('input'); nTeams.type = 'number'; nTeams.min = String(MIN_TEAMS); nTeams.max = String(MAX_TEAMS); nTeams.inputMode = 'numeric';
    grid.appendChild(K.field(STR.teams + ' (' + MIN_TEAMS + '–' + MAX_TEAMS + ')', nTeams).wrap);
    const rsel = K.el('select');
    grid.appendChild(K.field(STR.scoringRound, rsel).wrap);
    const rname = K.el('input'); rname.type = 'text'; rname.maxLength = 30;
    grid.appendChild(K.field(STR.roundName, rname).wrap);
    top.appendChild(grid);
    const nextB = K.button(STR.nextRound, 'btn-primary', () => act({ t: 'nextRound' }));
    const undoB = K.button(STR.undo, 'btn-ghost', undo);
    const redoB = K.button(STR.redo, 'btn-ghost', redo);
    const csvB = K.button(STR.csv, 'btn-ghost', exportCsv);
    const newB = K.button(STR.newGame, 'btn-ghost', () => { sure.hidden = false; yesB.focus(); });
    const row1 = K.el('div', 'game-row');
    [nextB, undoB, redoB, csvB, newB].forEach((b) => row1.appendChild(b));
    top.appendChild(row1);
    const sure = K.el('div', 'sb-sure');
    sure.hidden = true;
    sure.setAttribute('role', 'alertdialog'); sure.setAttribute('aria-label', STR.newGame);
    sure.appendChild(K.el('p', null, STR.sure));
    const yesB = K.button(STR.yes, 'btn-primary', () => { sure.hidden = true; act({ t: 'newGame' }); resetTimer(); });
    const noB = K.button(STR.no, 'btn-ghost', () => { sure.hidden = true; newB.focus(); });
    const sr = K.el('div', 'game-row'); sr.appendChild(yesB); sr.appendChild(noB); sure.appendChild(sr);
    top.appendChild(sure);

    /* the timer */
    const tbox = K.el('div', 'sb-timer');
    const secs = K.el('input'); secs.type = 'number'; secs.min = '5'; secs.max = '3600'; secs.inputMode = 'numeric'; secs.value = String(timer.secs);
    const tf = K.field(STR.timer + ' — ' + STR.seconds, secs);
    const clockEl = K.el('p', 'sb-clock-host', clock(timer.left));
    clockEl.setAttribute('aria-hidden', 'true');
    const goB = K.button(STR.start, 'btn-ghost', toggleTimer);
    const rstB = K.button(STR.resetTimer, 'btn-ghost', resetTimer);
    tbox.appendChild(tf.wrap); tbox.appendChild(clockEl);
    const trow = K.el('div', 'game-row'); trow.appendChild(goB); trow.appendChild(rstB);
    tbox.appendChild(trow);
    top.appendChild(tbox);
    top.appendChild(K.el('p', 'game-field-hint', STR.keys));
    const note = K.el('p', 'game-msg sb-note');
    note.setAttribute('role', 'status');
    top.appendChild(note);
    top.appendChild(stage.bar());

    /* ---- the teams ---- */
    const teamsPanel = K.el('section', 'game-panel');
    teamsPanel.appendChild(K.el('h2', null, STR.teamsHeading));
    const cards = K.el('div', 'sb-cards');
    teamsPanel.appendChild(cards);

    /* ---- the table ---- */
    const tablePanel = K.el('section', 'game-panel');
    tablePanel.appendChild(K.el('h2', null, STR.tableHeading));
    const wrap = K.el('div', 'sb-table-wrap');
    const table = K.el('table', 'sb-table');
    wrap.appendChild(table);
    tablePanel.appendChild(wrap);

    io.appendChild(top); io.appendChild(teamsPanel); io.appendChild(tablePanel);

    /* ---- building and painting ---- */
    const els = [];
    function build() {
      cards.textContent = '';
      els.length = 0;
      S().teams.forEach((_, i) => {
        const card = K.el('section', 'sb-team');
        card.dataset.team = String(i);
        const hd = K.el('div', 'sb-team-head');
        const num = K.el('span', 'sb-num', String(i + 1));
        const name = K.el('input'); name.type = 'text'; name.maxLength = 30; name.setAttribute('aria-label', STR.teamName + ' ' + (i + 1));
        name.addEventListener('change', () => act({ t: 'rename', team: i, name: name.value }));
        const col = K.el('select'); col.setAttribute('aria-label', STR.colour + ' — team ' + (i + 1));
        COLOURS.forEach((c, k) => { const o = K.el('option', null, c); o.value = String(k); col.appendChild(o); });
        col.addEventListener('change', () => act({ t: 'colour', team: i, color: Number(col.value) }));
        hd.appendChild(num); hd.appendChild(name); hd.appendChild(col);
        const sc = K.el('div', 'sb-score');
        const total = K.el('strong', 'sb-total-n', '0');
        const rnd = K.el('span', 'sb-round-n');
        sc.appendChild(total); sc.appendChild(rnd);
        const bt = K.el('div', 'sb-btns');
        [['−1', -1], ['+1', 1], ['+5', 5]].forEach((p) => {
          const b = K.button(p[0], 'btn-ghost sb-pt' + (p[1] > 0 ? ' is-plus' : ''), () => { sel = i; act({ t: 'add', team: i, n: p[1] }); });
          b.setAttribute('aria-label', (p[1] > 0 ? 'Add ' : 'Take away ') + Math.abs(p[1]) + (Math.abs(p[1]) === 1 ? ' point' : ' points') + ' — team ' + (i + 1));
          bt.appendChild(b);
        });
        const cu = K.el('div', 'sb-custom');
        const box = K.el('input'); box.type = 'number'; box.inputMode = 'numeric'; box.placeholder = '10'; box.setAttribute('aria-label', STR.custom + ' — team ' + (i + 1));
        const addB = K.button(STR.add, 'btn-ghost', () => { sel = i; const v = cleanInt(box.value); if (v) { act({ t: 'add', team: i, n: v }); box.value = ''; } });
        box.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addB.click(); } });
        cu.appendChild(box); cu.appendChild(addB);
        const jk = K.button(STR.joker, 'btn-ghost sb-joker-b', () => { sel = i; act({ t: 'joker', team: i }); });
        card.appendChild(hd); card.appendChild(sc); card.appendChild(bt); card.appendChild(cu); card.appendChild(jk);
        card.addEventListener('pointerdown', () => { if (sel !== i) { sel = i; paintSel(); } });
        card.addEventListener('focusin', () => { if (sel !== i) { sel = i; paintSel(); } });
        cards.appendChild(card);
        els.push({ card: card, name: name, col: col, total: total, rnd: rnd, jk: jk });
      });
      built = S().teams.length;
    }
    function paintSel() {
      els.forEach((e, i) => { e.card.classList.toggle('is-sel', i === sel); if (i === sel) e.card.setAttribute('aria-current', 'true'); else e.card.removeAttribute('aria-current'); });
    }
    function paint() {
      const s = S(), tot = totals(s), rk = ranks(tot);
      if (built !== s.teams.length) build();
      sel = Math.max(0, Math.min(s.teams.length - 1, sel));
      if (document.activeElement !== nTeams) nTeams.value = String(s.teams.length);
      /* round list */
      rsel.textContent = '';
      s.rounds.forEach((r, i) => { const o = K.el('option', null, (i + 1) + '. ' + r); o.value = String(i); rsel.appendChild(o); });
      rsel.value = String(s.round);
      if (document.activeElement !== rname) rname.value = s.rounds[s.round];
      s.teams.forEach((t, i) => {
        const e = els[i];
        e.card.style.setProperty('--tc', 'var(--t' + (t.color + 1) + ')');
        if (document.activeElement !== e.name) e.name.value = t.name;
        e.col.value = String(t.color);
        e.total.textContent = String(tot[i]);
        const raw = s.scores[i][s.round] || 0, here = t.joker === s.round;
        e.rnd.textContent = STR.round + ': ' + (here ? raw + ' × 2 = ' + raw * 2 : raw) + '  ·  rank ' + rk[i];
        e.jk.textContent = here ? STR.jokerBack : (t.joker !== null ? STR.jokerUsed + ' (' + s.rounds[t.joker] + ')' : STR.joker);
        e.jk.disabled = t.joker !== null && !here;
        e.jk.classList.toggle('is-on', here);
        e.jk.setAttribute('aria-pressed', String(here));
      });
      paintSel();
      /* the table */
      table.textContent = '';
      const head = K.el('tr');
      head.appendChild(K.el('th', null, 'Team'));
      s.rounds.forEach((r, i) => { const th = K.el('th', i === s.round ? 'is-now' : null, r); th.scope = 'col'; head.appendChild(th); });
      head.appendChild(K.el('th', null, STR.total));
      const thead = K.el('thead'); thead.appendChild(head); table.appendChild(thead);
      const tb = K.el('tbody');
      s.teams.forEach((t, i) => {
        const tr = K.el('tr');
        const th = K.el('th', null, t.name); th.scope = 'row';
        th.style.setProperty('--tc', 'var(--t' + (t.color + 1) + ')');
        tr.appendChild(th);
        s.rounds.forEach((r, ri) => {
          const td = K.el('td', ri === s.round ? 'is-now' : null, String(effective(s, i, ri)));
          if (t.joker === ri) { td.classList.add('is-joker'); td.appendChild(K.el('small', null, ' ×2')); td.title = 'Joker'; }
          tr.appendChild(td);
        });
        tr.appendChild(K.el('td', 'sb-tot', String(tot[i])));
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      undoB.disabled = !hist.past.length; redoB.disabled = !hist.future.length;
      nextB.disabled = s.rounds.length >= MAX_ROUNDS;
      publish();
    }
    function publish() {
      const s = S(), tot = totals(s), rk = ranks(tot);
      stage.update({
        round: s.rounds[s.round],
        teams: order(tot).map((i) => ({ id: i, name: s.teams[i].name, color: s.teams[i].color, total: tot[i], rank: rk[i], joker: s.teams[i].joker === s.round })),
        timer: { total: timer.secs, left: timer.left, endAt: timer.endAt, running: timer.running }
      });
    }
    function save() { store.set({ game: S() }); }
    function act(a) {
      if (hist.do(a)) { save(); paint(); }
      return true;
    }
    function undo() { if (hist.undo()) { save(); paint(); K.announce(root, 'Undone.'); } }
    function redo() { if (hist.redo()) { save(); paint(); K.announce(root, 'Redone.'); } }
    function say(text) { note.textContent = text; K.announce(root, text); }
    function exportCsv() {
      const d = new Date();
      const name = 'quiz-scores-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '.csv';
      K.download(new Blob(['﻿' + csv(S())], { type: 'text/csv;charset=utf-8' }), name);
      say('Saved ' + name + '.');
    }

    /* ---- the timer, from timestamps ---- */
    function paintTimer() {
      const left = timerLeft(timer);
      clockEl.textContent = clock(left);
      clockEl.classList.toggle('is-low', timer.running && left < 10000);
      if (timer.running && left === 0) {
        timer.running = false; timer.left = 0; clearInterval(timerTick);
        goB.textContent = STR.start;
        K.sound.buzz(); say(STR.timesUp + '.');
        publish();
      }
    }
    function toggleTimer() {
      K.sound.unlock();
      if (timer.running) { timer.left = timerLeft(timer); timer.running = false; clearInterval(timerTick); goB.textContent = STR.start; }
      else {
        if (timer.left <= 0) timer.left = timer.secs * 1000;
        timer.endAt = Date.now() + timer.left; timer.running = true;
        goB.textContent = STR.pause;
        clearInterval(timerTick); timerTick = setInterval(paintTimer, 200);
      }
      paintTimer(); publish();
    }
    function resetTimer() {
      timer.running = false; clearInterval(timerTick);
      timer.left = timer.secs * 1000; goB.textContent = STR.start;
      paintTimer(); publish();
    }
    secs.addEventListener('change', () => { timer.secs = Math.max(5, Math.min(3600, parseInt(secs.value, 10) || 30)); secs.value = String(timer.secs); resetTimer(); });

    /* ---- inputs ---- */
    nTeams.addEventListener('change', () => act({ t: 'teams', n: Number(nTeams.value), prefix: preset.prefix }));
    /* choosing which round to score is not a scoring change: it is not an undo step */
    rsel.addEventListener('change', () => { hist.now = reduce(S(), { t: 'pick', round: Number(rsel.value) }); save(); paint(); });
    rname.addEventListener('change', () => act({ t: 'roundName', name: rname.value }));

    /* ---- keys: 1-9 pick, + and - change, U undo, Y redo ---- */
    function key(k) {
      if (/^[1-9]$/.test(k)) { const i = Number(k) - 1; if (i < S().teams.length) { sel = i; paintSel(); say(S().teams[i].name + ' picked.'); } return true; }
      if (k === '+' || k === '=') { act({ t: 'add', team: sel, n: 1 }); return true; }
      if (k === '-' || k === '−' || k === '_') { act({ t: 'add', team: sel, n: -1 }); return true; }
      if (k === 'u' || k === 'U') { undo(); return true; }
      if (k === 'y' || k === 'Y') { redo(); return true; }
      return false;
    }
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'Escape' && !sure.hidden) { sure.hidden = true; newB.focus(); return; }
      if (key(e.key)) e.preventDefault();
    });
    stage.onKey = function (k) { key(k); };

    /* ---- points from the Quiz Buzzer ---- */
    if ('BroadcastChannel' in window) {
      const pc = new BroadcastChannel(CHANNEL);
      pc.onmessage = (e) => {
        const d = e.data;
        if (!d || typeof d !== 'object') return;
        const p = cleanInt(d.points);
        if (!p || Math.abs(Number(d.points)) > 1000) return;
        const s = S();
        let i = -1;
        if (typeof d.name === 'string') i = s.teams.findIndex((t) => t.name.toLowerCase() === d.name.trim().toLowerCase());
        if (i < 0 && Number.isInteger(d.team) && d.team >= 1 && d.team <= s.teams.length) i = d.team - 1;
        if (i < 0 && typeof d.team === 'string') i = s.teams.findIndex((t) => t.name.toLowerCase() === d.team.trim().toLowerCase());
        if (i < 0) { say(STR.fromBuzzer + 'no team called “' + String(d.name || d.team).slice(0, 30) + '” here.'); return; }
        sel = i;
        act({ t: 'add', team: i, n: p });
        say(STR.fromBuzzer + S().teams[i].name + ' ' + (p > 0 ? '+' : '') + p + '.');
      };
    }

    paint();
    if (!savedGame) save();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-tool="' + SLUG + '"]');
    if (!root || !K) return;
    let host = null;
    const stage = K.stage({
      slug: SLUG,
      title: 'Quiz Scoreboard',
      render: renderStage,
      onCommand: (m) => { if (m && m.type === 'key' && host && host.onKey) host.onKey(m.key); }
    });
    if (stage.isStage) return;
    host = stage;
    mount(root, stage);
  });
})();
