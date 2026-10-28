/**
 * Quiz Buzzer: one device, several teams, the fastest finger wins.
 *
 * Each team has a key (defaults A, L, Q, P, Z, M, X, N; changeable) and a big
 * pad on screen. The pads take pointerdown, so a tablet in the middle of the
 * table works for several teams at once. The first press wins and locks the
 * rest out; later presses are listed with their gap in milliseconds.
 *
 * Who was first is decided by TIME, not by the order the events were handled:
 * every press carries its event.timeStamp (a key pressed on the TV window is
 * forwarded by the kit with its own timestamp, converted to the same clock
 * with performance.timeOrigin), the presses are kept sorted by that time, and
 * a press that arrives late but was made earlier takes the lead.
 *
 * Host controls: Reset (R) opens everything again; Correct (C) ends the
 * question; Wrong (W) locks that team out for the rest of the question and
 * opens the buzzer for the others (their earlier presses do not queue: they
 * press again). R, C and W cannot be team keys.
 *
 * Points for the Quiz Scoreboard. When "Send points to the scoreboard" is
 * ticked, Correct posts to BroadcastChannel('mvr-games:points')
 *     { team: <1-based position of the team>, name: <the team's name>,
 *       points: <a whole number> }
 * The scoreboard (engine/game-scoreboard.js) matches by name first, then by
 * position, and adds the points to its current round. Both pages must be open
 * in the same browser on this device; nothing leaves the device.
 */
(function () {
  'use strict';
  window.GAME_TOOLS = window.GAME_TOOLS || {};
  window.GAME_TOOLS['quiz-buzzer'] = {
    order: 7,
    title: 'Quiz Buzzer',
    short: 'Quiz Buzzer',
    description: 'A free buzzer for a quiz night: each team gets a key and a big pad, or players buzz on their own phones. The first press wins and locks the others out, with the gaps in milliseconds. Shows on the TV.',
    keywords: ['quiz buzzer', 'online buzzer', 'buzzer for quiz night', 'family quiz buzzer', 'first to buzz', 'quiz game buzzers', 'fastest finger', 'buzzer app', 'phone buzzer'],
    glyph: 'i-quiz-buzzer',
    glyphSvg: '<symbol id="i-quiz-buzzer" viewBox="0 0 24 24">\n  <path d="M3.4 17.4h17.2v3H3.4z"/>\n  <path d="M5.6 17.4a6.4 6.4 0 0 1 12.8 0"/>\n  <path d="M12 3.2v3M5.4 5.6l1.8 2.2M18.6 5.6l-1.8 2.2" class="thin"/>\n  <circle cx="12" cy="14" r="1.1" class="fill"/>\n</symbol>',
    scripts: ['/engine/game-kit.js', '/engine/game-quiz-buzzer.js'],
    /* optional phones through the live relay (engine/game-phones.js, fetched on Use phones): build-games.js marks the page */
    phones: true,
    privacy: 'Without phones, everything happens on this device. The presses are timed by your own browser and shown on your own screens; nothing is uploaded. Team names, keys and settings are remembered on this device only. Phones are optional: once you press Use phones and start a live session, the team names and who buzzed go through our server at live.1234tools.com to the phones, and each phone’s press comes back the same way. Answers pass through our server only to reach the presenter’s screen. They are held in memory for the room’s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants.',
    how: [
      'Choose the number of teams and give each a name. Every team has a key and a pad; change a team’s key if you like.',
      'Read the question, then say go. The first team to press its key (or touch its pad) wins; the rest are locked out and listed with their gaps.',
      'Press Correct (C), or Wrong (W) to lock that team out and let the others try. Reset (R) opens the buzzer for the next question.',
      'Press Show on TV to put the winning team on the big screen. Tick “Send points to the scoreboard” to have Correct add points on the Quiz Scoreboard.',
      'Optional, with phones: press Use phones, then Start a live session. Players join at 1234tools.com/join with the 6-digit code and choose their team; press “Teams are set: back to the game” and every phone shows a BUZZ button.'
    ],
    manual: {
      setup: [
        'Type how many teams are playing (2 to 8) and give each a name.',
        'Change a team’s key if you like; R, C and W belong to you, the host.',
        'Choose an answer timer and tick “Send points to the scoreboard” if the Quiz Scoreboard is open in another tab.',
        'Optional: press Use phones, then Start a live session, and let players join at 1234tools.com/join with the code and choose their team.'
      ],
      play: [
        'Read the question, then say go.',
        'The first press, on a key, a pad or a phone, wins; the others are locked out and listed with their gaps.',
        'Press Correct (C) to give the point, or Wrong (W) to lock that team out and let the others buzz.',
        'Press Reset (R) before the next question: every pad and phone opens again.'
      ],
      tv: [
        'Press Show on TV, drag the new window to the TV and press Full screen there.',
        'Keys pressed on the TV window’s keyboard count as presses too.',
        'With phones, the TV shows 1234tools.com/join, the code and how many phones each team has.'
      ],
      troubleshooting: [
        { q: 'A key does nothing.', a: 'Click outside the name and key boxes first: the keyboard is not a buzzer while you type in a box.' },
        { q: 'A phone says “Wait for the buzzers to open”.', a: 'Someone has buzzed. Press Reset to open every phone again. After Wrong, the phones name the team that is out: its phones can still press, but those presses do not count until Reset.' },
        { q: 'A phone is in the wrong team.', a: 'Open “Phones and teams” under Phones and pick the right team beside its name.' }
      ]
    },
    uses: [
      ['Family quiz night', 'one tablet in the middle of the table, a pad each, and the winner on the TV'],
      ['Classroom', 'quick-fire revision where the first table to press answers'],
      ['Party games', 'a fastest-finger round with a keyboard and four players']
    ],
    tips: [
      'Who was first is decided by the time stamp the browser gives each press, not by the order the page happened to handle them. If a press from the TV window arrives a moment late but was made earlier, it still wins.',
      'On a tablet or touch screen several teams can press their pads at the same time: each pad answers its own touch. Keep to the pads for touch; the keys work when a keyboard is attached.',
      'Keys: R, C and W are the host’s Reset, Correct and Wrong, so a team cannot use them. Two teams cannot share a key; the page keeps the old key and tells you.',
      'Wrong locks that team out until you press Reset and opens the buzzer for the others. Presses made by the other teams while the buzzer was locked are only listed: they do not queue, so those teams press again.',
      'The answer timer (off, or 5 to 30 seconds) starts at the first press and shows on the TV. It makes a low double tone at zero; it does not decide anything, so you still press Correct or Wrong.',
      'A keyboard stops working as a buzzer while you are typing in a name or key box. Click outside the boxes to play again.',
      'The gap shown for each team is the time between its press and the winner’s. Browsers round time stamps a little, so differences of under a millisecond may show as 0.',
      'A phone’s press is timed by our server the moment it arrives, and moved onto this computer’s clock, so phones, keys and pads are sorted together. A phone on a slow connection arrives a little later, so for a close finish between phones the server’s time decides.'
    ],
    faq: [
      { q: 'How does the buzzer know who pressed first?', a: 'Every key press and touch carries a time stamp from the browser, and every phone press the time our server received it. The page sorts the presses by those times, so the earliest one wins even when a press is handled late. The later teams are listed with how many milliseconds behind they were.' },
      { q: 'Can players buzz from their own phones?', a: 'Yes, if you want: phones are optional. Press Use phones, then Start a live session. Players go to 1234tools.com/join, type the 6-digit code and choose their team, with no app and no account. During the launch trial a free session takes up to 1,000 phones. The first phone to buzz locks every other phone until you press Reset, and every phone and the TV show who it was. Answers pass through our server only to reach the presenter’s screen. They are held in memory for the room’s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants.' },
      { q: 'Can several teams use one tablet?', a: 'Yes. Each team has its own big pad and the pads respond to touch separately, so several fingers can press at once. The earliest touch wins and the others are locked out and listed.' },
      { q: 'What happens when the answer is wrong?', a: 'Press Wrong (or W). That team is locked out for the rest of the question and the buzzer opens for the others, who press again. Press Reset (or R) to bring every team back for the next question.' },
      { q: 'Can the buzzer add points to the scoreboard?', a: 'Yes. Tick “Send points to the scoreboard”, set how many points, and open the Quiz Scoreboard in the same browser. Pressing Correct sends the points to the team with the same name there. It works only between pages open in the same browser on this device.' },
      { q: 'How do I show it on the TV?', a: 'Press Show on TV to open the big-screen view in a new window, drag it to the TV or projector (or cast that browser tab) and press Full screen there. Keys pressed on the TV window’s keyboard count as presses, with their own time stamps. With one screen, press Full screen here.' },
      { q: 'Can I change the keys?', a: 'Yes. Each team has a key box: type one letter or digit. R, C and W belong to the host controls and cannot be used, and two teams cannot share a key. Your keys and names are remembered on this device.' },
      { q: 'Does it work on a phone and offline?', a: 'Yes. It works on phones, tablets and computers, and after the first visit it opens without a connection. One device runs the buzzer; with Use phones every player can buzz from their own phone too, which needs a connection.' }
    ],
    related: ['/utilities/random-number-generator/', '/time/stopwatch-timer/', '/time/countdown-timer/'],
    landings: [
      {
        slug: 'buzzer-for-family-quiz-night',
        title: 'Buzzer for a Family Quiz Night',
        description: 'Turn a tablet or laptop into a quiz buzzer for the whole family: a pad and a key for each team, the first press wins, wrong answers lock a team out. Free, no sign-up, shows on the TV.',
        lede: 'One tablet in the middle of the table, a big pad for each team, and the fastest finger on the TV. Four teams are ready.',
        preset: { teams: 4, send: true, timer: 10 },
        about: [
          'Four teams are set up, with a ten-second answer timer after each buzz and “Send points to the scoreboard” already ticked. Open the Quiz Scoreboard in another tab of the same browser and Correct adds the point for you.',
          'Children can use the pads with their fingers; adults with a keyboard can use A, L, Q and P. Say “go” after the question and press Reset between questions.'
        ],
        faq: [
          { q: 'Is it fair if two people press almost together?', a: 'It is decided by the browser’s time stamp on each press, to the precision your browser gives, and the gap is shown. A press cannot jump the queue by being handled first.' },
          { q: 'Do the children need a keyboard?', a: 'No. Each team has a big pad on the screen that responds to touch or a mouse click. The keys are there for a laptop.' }
        ]
      }
    ]
  };

  if (typeof document === 'undefined') return;
  const K = window.GameKit;
  const SLUG = 'quiz-buzzer';
  const MIN_TEAMS = 2, MAX_TEAMS = 8;
  const DEFAULT_KEYS = ['A', 'L', 'Q', 'P', 'Z', 'M', 'X', 'N'];
  const HOST_KEYS = { R: 'reset', C: 'correct', W: 'wrong' };
  const TIMERS = [0, 5, 10, 15, 20, 30];
  const POINTS_CHANNEL = 'mvr-games:points';

  /* every user-facing string lives here so the Hindi wave can translate them */
  const STR = {
    teamsHeading: 'Teams and keys',
    teams: 'Teams (2–8)',
    teamName: 'Name',
    key: 'Key',
    answerTimer: 'Answer timer after a buzz',
    off: 'Off',
    send: 'Send points to the scoreboard',
    points: 'Points for a correct answer',
    sound: 'Sound',
    buzzerHeading: 'Buzzer',
    reset: 'Reset  (R)',
    correct: 'Correct  (C)',
    wrong: 'Wrong  (W)',
    open: 'OPEN',
    locked: 'LOCKED',
    answering: 'ANSWERING',
    timeUp: 'TIME UP',
    correctWord: 'CORRECT',
    openHint: 'Say go, then press your key or touch your pad.',
    first: 'first',
    out: 'locked out',
    allOut: 'Every team is locked out. Press Reset.',
    later: 'Later presses',
    keyTaken: ' is already another team’s key.',
    keyHost: ' belongs to the host controls (R, C, W).',
    keyBad: 'Use one letter or digit for a key.',
    sent: 'Sent +',
    sentTail: ' for ',
    sentNote: '. It arrives only if the Quiz Scoreboard is open in this browser.',
    tvWait: 'The buzzer will appear here.',
    phonesH: 'Phones (optional)', usePhones: 'Use phones',
    phonesHint: 'Give every player a buzzer on their own phone: they join at 1234tools.com/join with a 6-digit code, no app, no account, and choose their team. The keys and pads keep working alongside the phones. During the launch trial a free session takes up to 1,000 phones. Without phones the buzzer works as before and nothing leaves this device.',
    phonesPrivacy: 'Answers pass through our server only to reach the presenter’s screen. They are held in memory for the room’s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants.',
    phonesFailed: 'The phone tools could not be loaded. Check the connection and press Use phones again.'
  };

  /* ---------- the rules (pure; build/tests/games/quiz-buzzer.js checks them) ---------- */

  function fresh() { return { phase: 'open', presses: [], locked: [], verdict: null }; }
  /** A press by `team` at time `at` (ms on one shared clock). Returns the same object when it is ignored. */
  function press(g, team, at) {
    if (g.phase === 'done') return g;
    if (g.locked.indexOf(team) >= 0) return g;
    if (g.presses.some((p) => p.team === team)) return g;
    const presses = g.presses.concat([{ team: team, at: at }]).sort((a, b) => a.at - b.at || a.team - b.team);
    return { phase: 'buzzed', presses: presses, locked: g.locked, verdict: null };
  }
  const winnerOf = (g) => (g.presses.length ? g.presses[0].team : null);
  /** Milliseconds behind the winner, for each press in order. */
  const gaps = (g) => g.presses.map((p) => p.at - g.presses[0].at);
  function correct(g) { return g.phase === 'buzzed' ? { phase: 'done', presses: g.presses, locked: g.locked, verdict: 'correct' } : g; }
  function wrong(g) { return g.phase === 'buzzed' ? { phase: 'open', presses: [], locked: g.locked.concat([g.presses[0].team]), verdict: null } : g; }
  /** A key as typed: one letter or digit, upper case; '' when it is not usable. */
  function normaliseKey(k) {
    const s = String(k || '').trim().toUpperCase();
    return /^[A-Z0-9]$/.test(s) ? s : '';
  }
  /** What the host and the TV call the state. */
  function label(g, timerState, teamCount) {
    if (g.phase === 'done') return 'correct';
    if (g.phase === 'buzzed') return timerState === 'up' ? 'timeUp' : (timerState === 'running' ? 'answering' : 'locked');
    return g.locked.length >= teamCount ? 'allOut' : 'open';
  }
  window.GAME_TOOLS[SLUG].maths = { fresh, press, winnerOf, gaps, correct, wrong, normaliseKey, label, DEFAULT_KEYS };

  const gapText = (ms) => '+' + (ms < 10 ? ms.toFixed(1) : String(Math.round(ms))) + ' ms';

  /* ---------- the big screen ---------- */

  const views = new WeakMap();
  const clock = (ms) => String(Math.ceil(Math.max(0, ms) / 1000));
  function renderStage(stageBody, s) {
    let body = stageBody;
    /* phones in play (s.ph): the join strip on top, drawn with engine/room-kit.js, fetched for the TV when needed */
    if (s && s.ph) {
      if (window.LiveKit && window.GamePhones) body = window.GamePhones.frame(stageBody, s.ph);
      else phonesStage().then(() => renderStage(stageBody, s)).catch(() => { /* drawn without the strip */ });
    } else if (stageBody._live) { stageBody.textContent = ''; stageBody._live = null; }
    let v = views.get(body);
    if (!v || !body.contains(v.box)) {
      body.textContent = '';
      const box = K.el('div', 'bz-stage');
      v = { box: box, state: K.el('p', 'bz-state'), win: K.el('div', 'bz-win'), order: K.el('ol', 'bz-order'), chips: K.el('ul', 'bz-chips'), tick: 0 };
      v.state.setAttribute('role', 'status');
      [v.state, v.win, v.order, v.chips].forEach((e) => box.appendChild(e));
      body.appendChild(box);
      views.set(body, v);
    }
    if (!s.teams || !s.teams.length) { v.state.textContent = STR.tvWait; return; }
    clearInterval(v.tick);
    const word = { open: STR.open, locked: STR.locked, answering: STR.answering, timeUp: STR.timeUp, correct: STR.correctWord, allOut: STR.allOut }[s.label] || '';
    v.box.className = 'bz-stage is-' + s.label;
    const paintState = () => {
      let t = '';
      if (s.timer && s.timer.running) { const left = Math.max(0, s.timer.endAt - Date.now()); t = '  ·  ' + clock(left); if (left === 0) clearInterval(v.tick); }
      v.state.textContent = word + t;
    };
    paintState();
    if (s.timer && s.timer.running) v.tick = setInterval(paintState, 200);
    v.win.textContent = '';
    if (s.winner) {
      v.win.style.setProperty('--tc', 'var(--t' + (s.winner.color + 1) + ')');
      v.win.appendChild(K.el('span', 'bz-win-name', s.winner.name));
      v.win.appendChild(K.el('span', 'bz-win-key', s.winner.key));
    } else {
      v.win.style.removeProperty('--tc');
      v.win.appendChild(K.el('span', 'bz-win-wait', s.label === 'allOut' ? '' : STR.openHint));
    }
    v.order.textContent = '';
    (s.order || []).slice(1).forEach((o, k) => {
      const li = K.el('li', null, (k + 2) + '. ' + o.name + '  ' + gapText(o.gap));
      li.style.setProperty('--tc', 'var(--t' + (o.color + 1) + ')');
      v.order.appendChild(li);
    });
    v.chips.textContent = '';
    s.teams.forEach((t) => {
      const li = K.el('li', t.locked ? 'is-out' : null);
      li.style.setProperty('--tc', 'var(--t' + (t.color + 1) + ')');
      li.appendChild(K.el('b', null, t.key));
      li.appendChild(document.createTextNode(' ' + t.name + (t.phones ? ' · ' + t.phones + (t.phones === 1 ? ' phone' : ' phones') : '') + (t.locked ? ' — ' + STR.out : '')));
      v.chips.appendChild(li);
    });
  }

  /* ---------- phones (optional): fetched only when the host presses Use phones ---------- */

  const js = {};
  function loadJs(src) {
    if (!js[src]) js[src] = new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = src; sc.async = true;
      sc.onload = res; sc.onerror = () => { delete js[src]; rej(new Error(src)); };
      document.head.appendChild(sc);
    });
    return js[src];
  }
  const inOrder = (list) => list.reduce((p, src) => p.then(() => loadJs(src)), Promise.resolve());
  /* the TV window needs only the drawing parts; the host page needs the relay client too */
  const phonesStage = () => inOrder(['/engine/room-kit.js', '/engine/game-phones.js']);
  const phonesHost = () => inOrder(['/engine/room-client.js', '/engine/room-words.js', '/engine/room-kit.js', '/engine/game-phones.js']);

  /* ---------- the page ---------- */

  function mount(root, stage) {
    const io = root.querySelector('.tool-io');
    const store = K.store(SLUG, 1);
    const preset = K.preset(root);
    const saved = store.get({});
    const opt = Object.assign({ n: 4, names: [], keys: [], timer: 0, send: false, pts: 1 }, saved);
    if (preset.teams && !saved.n) opt.n = preset.teams;
    if (preset.send !== undefined && saved.send === undefined) opt.send = !!preset.send;
    if (preset.timer !== undefined && saved.timer === undefined) opt.timer = Number(preset.timer) || 0;
    opt.n = Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, opt.n | 0 || 4));
    if (TIMERS.indexOf(opt.timer) < 0) opt.timer = 0;
    opt.pts = Math.max(1, Math.min(100, opt.pts | 0 || 1));
    let g = fresh();
    let who = {}, phones = null;   /* who: the nickname of the phone that pressed for each team */
    const timer = { running: false, endAt: 0, up: false };
    let tTick = 0, flashT = 0;
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(POINTS_CHANNEL) : null;

    const teamName = (i) => (opt.names[i] && String(opt.names[i]).trim()) || ('Team ' + (i + 1));
    const teamKey = (i) => opt.keys[i] || DEFAULT_KEYS[i];

    /* ---- setup panel ---- */
    const left = K.el('section', 'game-panel');
    left.appendChild(K.el('h2', null, STR.teamsHeading));
    const nBox = K.el('input'); nBox.type = 'number'; nBox.min = String(MIN_TEAMS); nBox.max = String(MAX_TEAMS); nBox.inputMode = 'numeric'; nBox.value = String(opt.n);
    left.appendChild(K.field(STR.teams, nBox).wrap);
    const rowsEl = K.el('div', 'bz-setup');
    left.appendChild(rowsEl);
    const keyMsg = K.el('p', 'game-msg bz-keymsg');
    keyMsg.setAttribute('role', 'status');
    left.appendChild(keyMsg);
    const tsel = K.el('select');
    TIMERS.forEach((s) => { const o = K.el('option', null, s ? s + ' seconds' : STR.off); o.value = String(s); tsel.appendChild(o); });
    tsel.value = String(opt.timer);
    left.appendChild(K.field(STR.answerTimer, tsel).wrap);
    const sendB = K.el('input'); sendB.type = 'checkbox'; sendB.checked = !!opt.send;
    const sendL = K.el('label', 'game-check'); sendL.appendChild(sendB); sendL.appendChild(document.createTextNode(STR.send));
    left.appendChild(sendL);
    const pts = K.el('input'); pts.type = 'number'; pts.min = '1'; pts.max = '100'; pts.inputMode = 'numeric'; pts.value = String(opt.pts);
    left.appendChild(K.field(STR.points, pts).wrap);
    const snd = K.el('input'); snd.type = 'checkbox'; snd.checked = K.sound.on;
    const sndL = K.el('label', 'game-check'); sndL.appendChild(snd); sndL.appendChild(document.createTextNode(STR.sound));
    left.appendChild(sndL);

    /* ---- the buzzer panel ---- */
    const right = K.el('section', 'game-panel bz-main');
    right.appendChild(K.el('h2', null, STR.buzzerHeading));
    const status = K.el('p', 'bz-status');
    status.setAttribute('role', 'status');
    right.appendChild(status);
    const pads = K.el('div', 'bz-pads');
    right.appendChild(pads);
    const orderEl = K.el('ol', 'bz-order-host');
    right.appendChild(orderEl);
    const hostRow = K.el('div', 'game-row bz-host');
    const resetB = K.button(STR.reset, 'btn-ghost', doReset);
    const okB = K.button(STR.correct, 'btn-primary', doCorrect);
    const noB = K.button(STR.wrong, 'btn-ghost', doWrong);
    [resetB, okB, noB].forEach((b) => hostRow.appendChild(b));
    right.appendChild(hostRow);
    const sentMsg = K.el('p', 'game-msg bz-sent');
    right.appendChild(sentMsg);
    right.appendChild(stage.bar());
    const cols = K.el('div', 'game-cols bz-cols');
    cols.appendChild(left); cols.appendChild(right);
    io.appendChild(cols);
    const phonesBox = K.el('section', 'game-panel bz-phones');
    phonesBox.appendChild(K.el('h2', null, STR.phonesH));
    phonesBox.appendChild(K.el('p', 'game-msg', STR.phonesHint));
    const phonesB = K.button(STR.usePhones, 'btn-ghost bz-use-phones', () => {
      phonesB.disabled = true;
      phonesHost().then(() => {
        phones = window.GamePhones.buzzer({
          teams: () => Array.from({ length: opt.n }, (_, i) => teamName(i)),
          press: (team, at, nick) => buzz(team, at, nick),
          publish: () => publish()
        });
        phonesBox.textContent = '';
        phonesBox.appendChild(K.el('h2', null, STR.phonesH));
        phonesBox.appendChild(phones.el);
        root.quizBuzzer.phones = phones;
        publish();
      }).catch(() => { phonesB.disabled = false; sentMsg.textContent = STR.phonesFailed; });
    });
    phonesBox.appendChild(phonesB);
    phonesBox.appendChild(K.el('p', 'game-msg', STR.phonesPrivacy));
    io.appendChild(phonesBox);

    let nameEls = [], keyEls = [], padEls = [];
    function buildSetup() {
      rowsEl.textContent = '';
      nameEls = []; keyEls = [];
      for (let i = 0; i < opt.n; i++) {
        const row = K.el('div', 'bz-setup-row');
        row.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')');
        const nm = K.el('input'); nm.type = 'text'; nm.maxLength = 24; nm.value = teamName(i); nm.setAttribute('aria-label', STR.teamName + ' — team ' + (i + 1));
        const ky = K.el('input'); ky.type = 'text'; ky.maxLength = 1; ky.value = teamKey(i); ky.setAttribute('aria-label', STR.key + ' — team ' + (i + 1)); ky.className = 'bz-key-in';
        ky.autocomplete = 'off'; ky.spellcheck = false;
        nm.addEventListener('change', () => { opt.names[i] = nm.value.trim().slice(0, 24); nm.value = teamName(i); persist(); paint(); });
        ky.addEventListener('focus', () => ky.select());
        ky.addEventListener('change', () => setKey(i, ky.value));
        row.appendChild(K.el('span', 'bz-dot', String(i + 1)));
        row.appendChild(nm); row.appendChild(ky);
        rowsEl.appendChild(row);
        nameEls.push(nm); keyEls.push(ky);
      }
      pads.textContent = '';
      padEls = [];
      for (let i = 0; i < opt.n; i++) {
        const p = K.el('button', 'bz-pad');
        p.type = 'button';
        p.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')');
        p.appendChild(K.el('span', 'bz-pad-key'));
        p.appendChild(K.el('span', 'bz-pad-name'));
        p.appendChild(K.el('span', 'bz-pad-tag'));
        p.addEventListener('pointerdown', (e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          e.preventDefault();
          buzz(i, performance.timeOrigin + e.timeStamp);
        });
        /* Enter or Space on a focused pad is a click with no pointer (detail 0) */
        p.addEventListener('click', (e) => { if (e.detail === 0) buzz(i, performance.timeOrigin + e.timeStamp); });
        pads.appendChild(p);
        padEls.push(p);
      }
    }
    function setKey(i, raw) {
      const k = normaliseKey(raw);
      let msg = '';
      if (!k) msg = STR.keyBad;
      else if (HOST_KEYS[k]) msg = k + STR.keyHost;
      else if (opt.n && Array.from({ length: opt.n }, (_, j) => j).some((j) => j !== i && teamKey(j) === k)) msg = k + STR.keyTaken;
      if (msg) { keyMsg.textContent = msg; keyMsg.className = 'game-msg bz-keymsg is-warn'; keyEls[i].value = teamKey(i); K.announce(root, msg); return; }
      keyMsg.textContent = ''; keyMsg.className = 'game-msg bz-keymsg';
      opt.keys[i] = k; keyEls[i].value = k;
      persist(); paint();
    }
    function persist() {
      store.set({ n: opt.n, names: opt.names.slice(0, MAX_TEAMS), keys: opt.keys.slice(0, MAX_TEAMS), timer: opt.timer, send: opt.send, pts: opt.pts });
    }

    /* ---- the game ---- */
    function timerState() { return timer.up ? 'up' : (timer.running ? 'running' : 'off'); }
    function paintStatus() {
      const lab = label(g, timerState(), opt.n);
      const w = winnerOf(g);
      let t = '';
      if (timer.running) t = ' — ' + clock(timer.endAt - Date.now()) + ' s';
      status.className = 'bz-status is-' + lab;
      status.textContent = ({
        open: STR.open + ' — ' + STR.openHint,
        locked: STR.locked + ' — ' + (w === null ? '' : teamName(w)),
        answering: STR.answering + ' — ' + (w === null ? '' : teamName(w)) + t,
        timeUp: STR.timeUp + ' — ' + (w === null ? '' : teamName(w)),
        correct: STR.correctWord + ' — ' + (w === null ? '' : teamName(w)),
        allOut: STR.allOut
      })[lab];
    }
    function paint() {
      paintStatus();
      padEls.forEach((p, i) => {
        const pos = g.presses.findIndex((x) => x.team === i);
        const out = g.locked.indexOf(i) >= 0;
        p.children[0].textContent = teamKey(i);
        p.children[1].textContent = teamName(i);
        p.children[2].textContent = out ? STR.out : (pos === 0 ? STR.first.toUpperCase() : (pos > 0 ? gapText(g.presses[pos].at - g.presses[0].at) : ''));
        p.classList.toggle('is-win', pos === 0);
        p.classList.toggle('is-later', pos > 0);
        p.classList.toggle('is-out', out);
                p.setAttribute('aria-label', teamName(i) + ', key ' + teamKey(i) + (out ? ', ' + STR.out : ', press to buzz'));
      });
      orderEl.textContent = '';
      const gp = gaps(g);
      g.presses.forEach((p, k) => orderEl.appendChild(K.el('li', null, teamName(p.team) + (k === 0 ? '  — ' + STR.first : '  ' + gapText(gp[k])))));
      orderEl.hidden = !g.presses.length;
      okB.disabled = noB.disabled = g.phase !== 'buzzed';
      publish();
    }
    function publish() {
      const lab = label(g, timerState(), opt.n);
      const w = winnerOf(g), gp = gaps(g);
      /* the phones: a buzz card while armed, then who buzzed (engine/game-phones.js) */
      const ph = phones ? phones.sync(g, lab, w === null ? '' : (who[w] ? who[w] + ' (' + teamName(w) + ')' : teamName(w))) : null;
      const st = {
        label: lab,
        timer: { running: timer.running, endAt: timer.endAt },
        winner: w === null ? null : { name: teamName(w), key: who[w] || teamKey(w), color: w % 8 },
        order: g.presses.map((p, k) => ({ name: teamName(p.team) + (who[p.team] ? ' (' + who[p.team] + ')' : ''), color: p.team % 8, gap: gp[k] })),
        teams: Array.from({ length: opt.n }, (_, i) => ({ name: teamName(i), key: teamKey(i), color: i % 8, locked: g.locked.indexOf(i) >= 0, phones: ph ? ph.counts[i] || 0 : 0 }))
      };
      if (ph) st.ph = { join: ph.join };
      stage.update(st);
    }
    function flash() {
      right.classList.add('is-flash');
      clearTimeout(flashT);
      flashT = setTimeout(() => right.classList.remove('is-flash'), 700);
    }
    function startTimer() {
      stopTimer();
      timer.up = false;
      if (!opt.timer) return;
      timer.running = true; timer.endAt = Date.now() + opt.timer * 1000;
      tTick = setInterval(() => {
        if (Date.now() >= timer.endAt) {
          stopTimer(); timer.up = true;
          K.sound.wrong();
          K.announce(root, STR.timeUp + '.');
          paint();
        } else paintStatus();
      }, 250);
    }
    function stopTimer() { clearInterval(tTick); timer.running = false; timer.up = false; }
    /** A press by team i at time `at` (ms, epoch clock); nick when it came from a phone. */
    function buzz(i, at, nick) {
      if (i < 0 || i >= opt.n) return;
      K.sound.unlock();
      const before = winnerOf(g), was = g.phase;
      const next = press(g, i, at);
      if (next === g) return;
      g = next;
      if (nick) who[i] = nick; else delete who[i];
      const now = winnerOf(g);
      if (was === 'open') {
        K.sound.buzz(); flash(); startTimer();
        K.announce(root, teamName(now) + ' buzzed first.');
      } else if (now !== before) {
        flash();
        K.announce(root, teamName(now) + ' was first by time.');
      }
      paint();
    }
    function doReset() { g = fresh(); who = {}; stopTimer(); K.announce(root, 'Buzzer reset. All teams are open.'); sentMsg.textContent = ''; paint(); }
    function doCorrect() {
      if (g.phase !== 'buzzed') return;
      const w = winnerOf(g);
      g = correct(g); stopTimer();
      K.sound.ding();
      K.announce(root, teamName(w) + ' is correct.');
      if (opt.send && channel) {
        channel.postMessage({ team: w + 1, name: teamName(w), points: opt.pts });
        sentMsg.textContent = STR.sent + opt.pts + STR.sentTail + teamName(w) + STR.sentNote;
      }
      paint();
    }
    function doWrong() {
      if (g.phase !== 'buzzed') return;
      const w = winnerOf(g);
      g = wrong(g); who = {}; stopTimer();
      K.sound.wrong();
      K.announce(root, teamName(w) + ' is wrong and locked out. The others may buzz.');
      paint();
    }

    /* ---- the keys: team keys and the host's R, C, W (also from the TV window) ---- */
    function handleKey(key, at) {
      const k = normaliseKey(key);
      if (!k) return false;
      if (HOST_KEYS[k]) { ({ reset: doReset, correct: doCorrect, wrong: doWrong })[HOST_KEYS[k]](); return true; }
      for (let i = 0; i < opt.n; i++) if (teamKey(i) === k) { buzz(i, at); return true; }
      return false;
    }
    document.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key.length !== 1) return;
      if (handleKey(e.key, performance.timeOrigin + e.timeStamp)) e.preventDefault();
    });
    /* the kit forwards a key pressed on the TV window with its time stamp on the same clock */
    stage.onKey = function (m) { handleKey(m.key, typeof m.at === 'number' ? m.at : Date.now()); };

    /* ---- settings ---- */
    nBox.addEventListener('change', () => {
      opt.n = Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, parseInt(nBox.value, 10) || opt.n));
      nBox.value = String(opt.n);
      g = fresh(); who = {}; stopTimer();
      buildSetup(); persist(); paint();
    });
    tsel.addEventListener('change', () => { opt.timer = Number(tsel.value); persist(); });
    sendB.addEventListener('change', () => { opt.send = sendB.checked; persist(); });
    pts.addEventListener('change', () => { opt.pts = Math.max(1, Math.min(100, parseInt(pts.value, 10) || 1)); pts.value = String(opt.pts); persist(); });
    snd.addEventListener('change', () => { K.sound.on = snd.checked; });

    buildSetup();
    paint();
    root.quizBuzzer = { phones: null, get state() { return g; }, buzz: buzz };
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-tool="' + SLUG + '"]');
    if (!root || !K) return;
    let host = null;
    const stage = K.stage({
      slug: SLUG,
      title: 'Quiz Buzzer',
      render: renderStage,
      onCommand: (m) => { if (m && m.type === 'key' && host && host.onKey) host.onKey(m); }
    });
    if (stage.isStage) return;
    host = stage;
    mount(root, stage);
  });
})();
