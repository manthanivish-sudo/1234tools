/**
 * Tambola (Housie) number caller: the host's screen and the TV.
 *
 * Draws 1–90 fairly (GameKit.randInt over the numbers not yet called), says
 * each one with the browser's own speech voice — "Twenty-two… two little
 * ducks… twenty-two", or the Hindi number — and lights it on a 1–90 board.
 * Manual or auto-call (3–20 s, timed from timestamps, waiting for the voice
 * to finish), undo, and a new game that asks first. The game in progress is
 * kept in localStorage so a refresh loses nothing.
 *
 * "Check a claim" rebuilds any ticket from its printed ID (K7MPQ2-014: the
 * seed and the ticket number, see engine/game-tambola-core.js) and checks
 * the claimed prize against the numbers called. The TV window gets only what
 * it shows: the called list, the current number and its call, the prizes.
 */
(function () {
  'use strict';
  window.GAME_TOOLS = window.GAME_TOOLS || {};
  const SLUG = 'tambola-number-caller';
  window.GAME_TOOLS[SLUG] = {
    order: 1,
    title: 'Tambola Number Caller',
    short: 'Tambola Caller',
    description: 'Call Tambola (Housie) numbers 1–90 aloud with the traditional calls in English or Hindi, on a board big enough for the TV. Auto-call, undo, and check any claim from its ticket number. Free, no sign-up, works offline.',
    keywords: ['tambola number caller', 'housie number generator', 'tambola caller with voice', 'housie caller online', 'tambola board 1 to 90', '90 ball bingo caller', 'diwali tambola', 'tambola calls'],
    glyph: 'i-tambola-number-caller',
    glyphSvg: '<symbol id="i-tambola-number-caller" viewBox="0 0 24 24">\n  <circle cx="9.5" cy="12" r="7"/>\n  <circle cx="9.5" cy="12" r="3.4" class="thin"/>\n  <path d="M8.7 10.7l1.1-.7v4" class="thin"/>\n  <path d="M18.6 8.8a4.6 4.6 0 0 1 0 6.4M21 6.6a7.8 7.8 0 0 1 0 10.8" class="thin"/>\n</symbol>',
    scripts: ['/engine/game-kit.js', '/engine/game-tambola-core.js', '/engine/game-tambola-number-caller.js'],
    privacy: 'The game in progress — the numbers called, the prizes and who won them — is your own data, kept in this browser on this device so a refresh does not lose it; New game clears it. Nothing is uploaded. The numbers are spoken by your device’s voices; if a browser has only an online voice for the language, the page says so, because that browser’s voice service then receives the words spoken.',
    how: [
      'Press Next number (or Space) to draw a number, or press Start auto-call and choose 3 to 20 seconds between numbers.',
      'Choose the voice: English with the Indian Tambola calls, English with the British bingo calls, or the numbers in Hindi.',
      'Press Show on TV for the big screen: the number huge, its call, the 1–90 board, the last five and the prizes won.',
      'When someone shouts, type their ticket number (such as K7MPQ2-014) and the prize into Check a claim. A good claim can be awarded and appears on the TV.'
    ],
    uses: [
      ['Diwali at home', 'the whole family round the TV, the caller on a laptop or phone'],
      ['Kitty party', 'auto-call every ten seconds, so the host can play too'],
      ['On a video call', 'share the big-screen window; everyone marks their own ticket picture']
    ],
    tips: [
      'Each number is drawn from the ones not yet called with your browser’s cryptographic random generator, so every remaining number is equally likely and none comes up twice.',
      'Called the wrong one? Undo last call puts it back. New game asks before it clears the board and the winners.',
      'The game survives a refresh or a closed tab: the numbers called and the winners stay on this device until you start a new game. Auto-call stops on a refresh: press Start auto-call to carry on.',
      'Tickets from the Tambola Ticket Generator carry a number such as K7MPQ2-014. Type it into Check a claim and the page rebuilds that exact ticket — nothing has to be saved or sent beforehand.',
      'If the voice is still speaking when the countdown ends, the next number waits until it has finished, so calls never talk over each other.',
      'Keyboard: Space or Enter calls the next number and P starts, pauses or resumes auto-call. A keyboard on the TV computer works in the big-screen window too.',
      'Hindi needs a Hindi voice on the device (most Android phones have one; Windows, iPhone and Mac can add one in their language settings). Without one the page says so and calls in English.'
    ],
    faq: [
      { q: 'What is Early Five?', a: 'The first player to mark any five numbers on their ticket wins Early Five. It is usually the first prize of the game. The claim checker counts the called numbers on the ticket and says how many more it needs.' },
      { q: 'Which prizes can it check?', a: 'Early Five, Top line, Middle line, Bottom line, Four Corners (the first and last numbers of the top and bottom rows) and Full House, plus One line and Two lines for 90-ball bingo. Tick the prizes your game is playing for; only those are shown on the TV.' },
      { q: 'How does checking a claim work?', a: 'Type the ticket number printed on the ticket, such as K7MPQ2-014, and choose the prize. The page rebuilds that ticket from its number, marks the numbers called, and says whether the claim is good or which numbers are still missing. It also says at which call the prize was complete, so you can apply your own rule about late claims.' },
      { q: 'Is the draw really random?', a: 'Yes. Every number is drawn from those not yet called using your browser’s cryptographic random number generator with rejection sampling, so each remaining number is equally likely. Our tests check the first draw of 9,000 games against an even spread with a chi-square test.' },
      { q: 'Can it call the numbers in Hindi?', a: 'Yes, choose Hindi numbers: it says “दो और दो, बाईस” for 22. This needs a Hindi voice on your device; if there is none the page tells you and speaks in English instead.' },
      { q: 'How do we play Tambola on a video call?', a: 'Make the tickets with the Tambola Ticket Generator and send each player their ticket picture on WhatsApp. Open this caller, press Show on TV and share that window in the call. Players mark their own tickets and shout their ticket number when they win; check it here.' },
      { q: 'What happens if I refresh the page or the phone sleeps?', a: 'The game is kept on this device and comes back as it was, with the board, the last five numbers and the winners. While a game is running the page asks the browser to keep the screen on, where the browser allows it.' },
      { q: 'Does it work without the internet?', a: 'Yes, after the first visit the page opens offline. Voices that are built into the device keep working offline; online voices need a connection.' }
    ],
    related: ['/utilities/random-number-generator/', '/time/countdown-timer/'],
    landings: [
      {
        slug: 'diwali-tambola-caller',
        title: 'Diwali Tambola Number Caller',
        description: 'Call Diwali Tambola for the whole family: numbers 1–90 spoken with the traditional calls, the board on the TV, and claims checked from the ticket number. Free, nothing to install.',
        lede: 'Diwali night, the family round the TV: press Next number, hear “twenty-two… two little ducks”, and check every Early Five and Full House from the ticket number.',
        preset: { lang: 'en-IN', title: 'Diwali Tambola' },
        about: [
          'Set up for a family game: English with the Indian Tambola calls, the six classic prizes on (Early Five, three lines, Four Corners, Full House), and “Diwali Tambola” across the top of the big screen. Switch to Hindi numbers for the grandparents in one tap.',
          'Print or send the tickets from the Tambola Ticket Generator first: every ticket carries a number, and this page rebuilds the ticket from it when someone claims a prize.'
        ],
        faq: [
          { q: 'How many tickets do we need for a family game?', a: 'One per player, and a few spare for anyone who wants two. Tickets come in strips of six that use every number once, so print 24 for a family of up to 20.' },
          { q: 'Can the children call the numbers?', a: 'Yes. The big Next number button and the Space bar are all it takes; the voice says each number and its call, and the board shows what has been called.' }
        ]
      },
      {
        slug: 'kitty-party-tambola',
        title: 'Kitty Party Tambola Caller',
        description: 'Run Tambola at your kitty party: numbers called aloud every ten seconds in Hindi or English, the board on the TV, and every claim checked from the ticket number. Free.',
        lede: 'Let the page call while you play: auto-call every ten seconds, Hindi numbers or the English calls, and claims checked in seconds from the ticket number.',
        preset: { lang: 'hi', interval: 10, title: 'Kitty party Tambola' },
        about: [
          'Set up for a kitty party: Hindi numbers, ten seconds between calls once you press Start auto-call, and “Kitty party Tambola” on the big screen. Pause with P or the button whenever someone shouts.',
          'Prizes are on the right: untick any your group does not play, and when a claim is good press Award with the winner’s name so the TV shows who won what.'
        ],
        faq: [
          { q: 'Can the host play too?', a: 'Yes. Start auto-call and the numbers are called on their own, every ten seconds by default (anything from 3 to 20). Pause for claims and resume when you are ready.' },
          { q: 'Our phones have no Hindi voice. What happens?', a: 'The page says so under the voice settings and calls in English with the Indian calls instead. Most Android phones include a Hindi voice; others can add one in the device’s language settings.' }
        ]
      },
      {
        slug: '90-ball-bingo-caller',
        title: '90-Ball Bingo Caller',
        description: 'A free 90-ball bingo caller with the traditional British calls spoken aloud, a 1–90 board for the TV, auto-call, and One line, Two lines and Full House checked from the ticket number.',
        lede: 'Eyes down: “Two little ducks, twenty-two” in a British voice, the board on the big screen, and One line, Two lines and Full House checked from the ticket number.',
        preset: { lang: 'en-GB', title: 'Bingo', prizes: ['line', 'twolines', 'full'] },
        about: [
          'Set up for UK 90-ball bingo: the British calls in an English (UK) voice where the device has one, and the three usual prizes — One line, Two lines and Full House — with the Tambola prizes switched off.',
          'Print the tickets with the Tambola Ticket Generator (90-ball tickets are the same thing: six to a strip, every number once). Each ticket has a number, and this page checks a claim from it.'
        ],
        faq: [
          { q: 'Are the calls suitable for a family bingo night?', a: 'Yes. We kept the well-known calls such as “legs eleven” and “two little ducks”, used the clean alternatives where a number has a rude one, and wrote our own for the few that had none.' },
          { q: 'Can I turn the calls off and just say the numbers?', a: 'Yes. Untick Say the traditional calls and the voice says “Two and two, twenty-two” instead. You can also switch the voice off and read the screen.' }
        ]
      }
    ]
  };

  if (typeof document === 'undefined') return;
  const K = window.GameKit, T = window.TambolaCore;

  const STR = {
    start: 'Press Next number to start.',
    allDone: 'All 90 numbers have been called.',
    next: 'Next number  (Space)',
    undo: 'Undo last call',
    autoStart: 'Start auto-call  (P)', autoPause: 'Pause  (P)', autoResume: 'Resume  (P)',
    nextIn: (s) => 'Next number in ' + s + ' s',
    waiting: 'Waiting for the voice to finish…',
    paused: 'Auto-call paused.',
    counts: (c) => 'Called ' + c + ' of 90 · ' + (90 - c) + ' left',
    lastFive: 'Last five:',
    newGame: 'New game', confirmQ: 'Clear the board and the winners and start again?', confirmYes: 'Yes, new game', confirmNo: 'Keep playing',
    took: (n) => 'Took back ' + n + '.',
    noSpeech: 'This browser cannot speak, so the numbers are shown but not said.',
    noHindi: 'This device has no Hindi voice, so the numbers are spoken in English. Add a Hindi voice in the device’s language settings to hear them in Hindi.',
    voiceLocal: (v) => 'Voice: ' + v + ' (on this device).',
    voiceOnline: (v) => 'Voice: ' + v + ' — an online voice: your browser’s voice service receives the words spoken.',
    voiceWait: 'Looking for voices…',
    checkHint: 'Type the ticket number printed on the ticket, such as K7MPQ2-014.',
    good: (p, id) => 'Good claim: ' + p + ' on ticket ' + id + '.',
    bad: (p, miss) => 'Not yet: ' + p + ' still needs ' + miss + '.',
    badEarly: (k) => 'Not yet: Early Five needs ' + k + ' more number' + (k === 1 ? '' : 's') + ' called on this ticket.',
    completeAt: (at, last) => at === last ? ' Complete with the latest number.' : ' It was complete at call ' + at + '; the latest call is ' + last + '. Your house rules decide whether a late claim counts.',
    already: (who) => ' Already won by ' + who + '.',
    award: (p, who) => 'Award ' + p + ' to ' + who,
    awarded: (p, who) => p + ' awarded to ' + who + '.',
    remove: 'Remove',
    setFrom: (s) => 'Tickets from set ' + s + ': type the ticket number after the dash.'
  };
  const LANGS = [['en-IN', 'English — Indian Tambola calls'], ['en-GB', 'English — British bingo calls'], ['hi', 'Hindi numbers (हिंदी)']];
  const RATES = [['0.8', 'Slow'], ['1', 'Normal'], ['1.2', 'Quick']];
  const DEFAULT_PRIZES = ['early5', 'top', 'middle', 'bottom', 'corners', 'full'];

  /* ---------- the maths (pure; build/tests/games checks it) ---------- */

  function newGame(prizes, title) {
    const on = new Set(prizes && prizes.length ? prizes : DEFAULT_PRIZES);
    const p = {};
    T.PRIZES.forEach((x) => { p[x.id] = { on: on.has(x.id), winners: [] }; });
    return { called: [], prizes: p, title: title || 'Tambola', seed: '' };
  }
  const styleOf = (lang) => (lang === 'en-GB' ? 'bingo' : 'tambola');
  function callText(n, set) {
    if (set.lang === 'hi') return T.hindi(n);
    if (set.calls) return T.callFor(n, styleOf(set.lang));
    const w = T.words(n);
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  function stageState(game, set) {
    const n = game.called.length ? game.called[game.called.length - 1] : null;
    return {
      title: game.title,
      called: game.called.slice(),
      current: n,
      call: n ? callText(n, set) : '',
      prizes: T.PRIZES.filter((p) => game.prizes[p.id] && game.prizes[p.id].on).map((p) => ({
        name: p.name, won: game.prizes[p.id].winners.length > 0,
        who: game.prizes[p.id].winners.map((w) => w.name || w.id).join(', ')
      }))
    };
  }
  window.GAME_TOOLS[SLUG].maths = { newGame, callText, stageState, draw: T.draw };

  /* ---------- the big screen ---------- */

  function renderStage(body, s) {
    let v = body._tcs;
    if (!v) {
      body.textContent = '';
      const wrap = K.el('div', 'tcs');
      const head = K.el('div', 'tcs-head');
      const title = K.el('span', 'tcs-title');
      const count = K.el('span', 'tcs-count');
      head.appendChild(title); head.appendChild(count);
      const now = K.el('div', 'tcs-now');
      const num = K.el('div', 'tcs-num');
      const call = K.el('div', 'tcs-call');
      now.appendChild(num); now.appendChild(call);
      const board = K.el('div', 'tcs-board');
      const cells = [null];
      for (let i = 1; i <= 90; i++) { const c = K.el('div', 'tcs-cell', String(i)); cells.push(c); board.appendChild(c); }
      const last = K.el('ul', 'tcs-last');
      const prizes = K.el('ul', 'tcs-prizes');
      [head, now, board, last, prizes].forEach((x) => wrap.appendChild(x));
      body.appendChild(wrap);
      v = body._tcs = { title, count, num, call, cells, last, prizes, shown: null };
    }
    v.title.textContent = s.title || 'Tambola';
    v.count.textContent = (s.called || []).length + ' / 90';
    const on = new Set(s.called || []);
    for (let i = 1; i <= 90; i++) {
      v.cells[i].classList.toggle('is-on', on.has(i));
      v.cells[i].classList.toggle('is-last', i === s.current);
    }
    v.num.textContent = s.current ? String(s.current) : '–';
    v.call.textContent = s.current ? s.call : 'Eyes down…';
    if (s.current !== v.shown) {
      v.shown = s.current;
      v.num.classList.remove('is-new'); void v.num.offsetWidth; v.num.classList.add('is-new');
    }
    v.last.textContent = '';
    const prev = (s.called || []).slice(-6, -1).reverse();
    if (prev.length) {
      v.last.appendChild(K.el('li', 'tcs-lab', 'Before:'));
      prev.forEach((x) => v.last.appendChild(K.el('li', null, String(x))));
    }
    v.prizes.textContent = '';
    (s.prizes || []).forEach((p) => v.prizes.appendChild(K.el('li', p.won ? 'is-won' : null, p.name + (p.won && p.who ? ': ' + p.who : ''))));
  }

  /* ---------- the page ---------- */

  function mount(root, stage) {
    const io = root.querySelector('.tool-io');
    const store = K.store(SLUG, 1);
    const preset = K.preset(root);
    const saved = store.get({}) || {};
    const set = Object.assign({ lang: 'en-IN', voice: true, calls: true, rate: 1, interval: 6 }, saved.set || {});
    if (preset.lang) set.lang = preset.lang;
    if (preset.interval) set.interval = preset.interval;
    let game = saved.game && Array.isArray(saved.game.called) ? saved.game : newGame(preset.prizes, preset.title);
    if (!game.prizes) game.prizes = newGame().prizes;
    T.PRIZES.forEach((p) => { if (!game.prizes[p.id]) game.prizes[p.id] = { on: false, winners: [] }; });
    if (preset.title && !game.called.length) game.title = preset.title;
    if (preset.prizes && !game.called.length) game = Object.assign(newGame(preset.prizes, game.title), { seed: game.seed || '' });
    const urlSeed = T.cleanSeed(new URLSearchParams(location.search).get('seed') || '');
    if (urlSeed) game.seed = urlSeed;
    const auto = { on: false, paused: false, next: 0, left: 0, timer: null, shown: -1 };

    const cols = K.el('div', 'game-cols tc-cols');
    /* left: the draw */
    const left = K.el('section', 'game-panel');
    left.appendChild(K.el('h2', null, 'Call the numbers'));
    const nowBox = K.el('div', 'tc-now');
    const num = K.el('div', 'tc-num', '–');
    const call = K.el('div', 'tc-call');
    const meta = K.el('p', 'tc-meta', STR.start);
    meta.setAttribute('role', 'status');
    nowBox.appendChild(num); nowBox.appendChild(call); nowBox.appendChild(meta);
    left.appendChild(nowBox);
    const row1 = K.el('div', 'game-row');
    const nextB = K.button(STR.next, 'btn-primary game-big', () => { K.sound.unlock(); callNext(); });
    nextB.setAttribute('aria-keyshortcuts', 'Space Enter');
    const undoB = K.button(STR.undo, 'btn-ghost', undo);
    row1.appendChild(nextB); row1.appendChild(undoB);
    left.appendChild(row1);
    const row2 = K.el('div', 'game-row');
    row2.style.marginTop = '10px';
    const autoB = K.button(STR.autoStart, 'btn-ghost', toggleAuto);
    autoB.setAttribute('aria-keyshortcuts', 'P');
    const secs = K.el('input');
    secs.type = 'number'; secs.min = '3'; secs.max = '20'; secs.step = '1'; secs.inputMode = 'numeric';
    secs.value = String(set.interval);
    secs.style.width = '6em';
    const secsF = K.field('Seconds between numbers', secs);
    secsF.wrap.style.marginBottom = '0';
    row2.appendChild(autoB); row2.appendChild(secsF.wrap);
    left.appendChild(row2);
    const counts = K.el('p', 'tc-meta');
    counts.style.marginTop = '12px';
    left.appendChild(counts);
    const last = K.el('ul', 'tc-last');
    last.setAttribute('aria-label', 'The last five numbers');
    left.appendChild(last);
    const board = K.el('div', 'tc-board');
    board.setAttribute('role', 'img');
    const cells = [null];
    for (let i = 1; i <= 90; i++) { const c = K.el('div', 'tc-cell', String(i)); cells.push(c); board.appendChild(c); }
    left.appendChild(board);
    left.appendChild(stage.bar());
    const newRow = K.el('div', 'game-row');
    newRow.style.marginTop = '12px';
    const newB = K.button(STR.newGame, 'btn-ghost', askNew);
    newRow.appendChild(newB);
    left.appendChild(newRow);
    const confirmBox = K.el('div', 'tc-confirm');
    confirmBox.hidden = true;
    confirmBox.appendChild(K.el('p', null, STR.confirmQ));
    confirmBox.appendChild(K.button(STR.confirmYes, 'btn-primary', () => { confirmBox.hidden = true; startNew(); }));
    confirmBox.appendChild(K.button(STR.confirmNo, 'btn-ghost', () => { confirmBox.hidden = true; newB.focus(); }));
    left.appendChild(confirmBox);

    /* right: voice, prizes, claims */
    const right = K.el('section', 'game-panel');
    right.appendChild(K.el('h2', null, 'Voice'));
    const vOn = K.el('input'); vOn.type = 'checkbox'; vOn.checked = !!set.voice;
    const vOnL = K.el('label', 'game-check'); vOnL.appendChild(vOn); vOnL.appendChild(document.createTextNode('Speak the numbers'));
    const cOn = K.el('input'); cOn.type = 'checkbox'; cOn.checked = !!set.calls;
    const cOnL = K.el('label', 'game-check'); cOnL.appendChild(cOn); cOnL.appendChild(document.createTextNode('Say the traditional calls (“two little ducks”)'));
    right.appendChild(vOnL); right.appendChild(cOnL);
    const langS = K.el('select');
    LANGS.forEach((l) => { const o = K.el('option', null, l[1]); o.value = l[0]; langS.appendChild(o); });
    langS.value = set.lang;
    right.appendChild(K.field('Language', langS).wrap);
    const rateS = K.el('select');
    RATES.forEach((r) => { const o = K.el('option', null, r[1]); o.value = r[0]; rateS.appendChild(o); });
    rateS.value = String(set.rate);
    if (!rateS.value) rateS.value = '1';
    right.appendChild(K.field('Speed', rateS).wrap);
    const voiceMsg = K.el('p', 'game-msg', K.speech.supported ? STR.voiceWait : STR.noSpeech);
    voiceMsg.style.marginBottom = '14px';
    right.appendChild(voiceMsg);
    const titleIn = K.el('input'); titleIn.type = 'text'; titleIn.maxLength = 40; titleIn.value = game.title;
    right.appendChild(K.field('Name on the big screen', titleIn).wrap);

    right.appendChild(K.el('h2', null, 'Prizes'));
    const prizeList = K.el('ul', 'tc-prizes');
    right.appendChild(prizeList);

    right.appendChild(K.el('h2', null, 'Check a claim'));
    const seedNote = K.el('p', 'game-msg');
    seedNote.style.marginBottom = '10px';
    right.appendChild(seedNote);
    const idIn = K.el('input'); idIn.type = 'text'; idIn.placeholder = 'K7MPQ2-014'; idIn.autocapitalize = 'characters'; idIn.spellcheck = false;
    idIn.setAttribute('aria-describedby', SLUG + '-idhint');
    const idF = K.field('Ticket number', idIn, STR.checkHint);
    idF.wrap.querySelector('.game-field-hint').id = SLUG + '-idhint';
    right.appendChild(idF.wrap);
    const prizeS = K.el('select');
    right.appendChild(K.field('Prize claimed', prizeS).wrap);
    const whoIn = K.el('input'); whoIn.type = 'text'; whoIn.maxLength = 30; whoIn.placeholder = 'Asha';
    right.appendChild(K.field('Player’s name (optional)', whoIn).wrap);
    const checkB = K.button('Check claim', 'btn-primary', check);
    const checkRow = K.el('div', 'game-row'); checkRow.appendChild(checkB);
    right.appendChild(checkRow);
    const verdict = K.el('p', 'tc-verdict');
    verdict.setAttribute('role', 'status');
    right.appendChild(verdict);
    const ticketBox = K.el('div', 'tk-wrap');
    right.appendChild(ticketBox);
    const awardRow = K.el('div', 'game-row');
    awardRow.style.marginTop = '10px';
    awardRow.hidden = true;
    const awardB = K.button('Award', 'btn-primary', award);
    awardRow.appendChild(awardB);
    right.appendChild(awardRow);

    cols.appendChild(left); cols.appendChild(right);
    io.appendChild(cols);

    /* ----- state ----- */
    function persist() {
      store.set({ set: { lang: set.lang, voice: set.voice, calls: set.calls, rate: set.rate, interval: set.interval }, game: game });
    }
    function publish() { stage.update(stageState(game, set)); }
    let lastShown = null;
    function paint() {
      const c = game.called;
      const n = c.length ? c[c.length - 1] : null;
      num.textContent = n ? String(n) : '–';
      call.textContent = n ? callText(n, set) : '';
      if (n !== lastShown) {
        lastShown = n;
        if (n) { num.classList.remove('is-new'); void num.offsetWidth; num.classList.add('is-new'); }
      }
      counts.textContent = STR.counts(c.length);
      const on = new Set(c);
      for (let i = 1; i <= 90; i++) {
        cells[i].classList.toggle('is-on', on.has(i));
        cells[i].classList.toggle('is-last', i === n);
      }
      board.setAttribute('aria-label', c.length ? 'Board: called ' + c.slice().sort((a, b) => a - b).join(', ') : 'Board: nothing called yet');
      last.textContent = '';
      const five = c.slice(-5).reverse();
      if (five.length) {
        last.appendChild(K.el('li', 'tc-lab', STR.lastFive));
        five.forEach((x) => last.appendChild(K.el('li', null, String(x))));
      }
      nextB.disabled = c.length >= 90;
      undoB.disabled = !c.length;
      if (!auto.on) meta.textContent = c.length >= 90 ? STR.allDone : c.length ? '' : STR.start;
      publish();
    }
    function paintAuto() {
      autoB.textContent = !auto.on ? STR.autoStart : auto.paused ? STR.autoResume : STR.autoPause;
      autoB.setAttribute('aria-pressed', String(auto.on && !auto.paused));
      if (auto.on && auto.paused) meta.textContent = STR.paused;
      auto.shown = -1;
    }

    /* ----- voice ----- */
    const norm = (v) => String(v.lang || '').replace('_', '-').toLowerCase();
    function voiceFor(lang) {
      if (!K.speech.supported) return null;
      const all = window.speechSynthesis.getVoices() || [];
      const want = lang === 'hi' ? ['hi', 'en-in', 'en-gb', 'en'] : lang === 'en-GB' ? ['en-gb', 'en-in', 'en'] : ['en-in', 'en-gb', 'en'];
      for (const w of want) {
        const m = all.filter((v) => norm(v).indexOf(w) === 0);
        if (m.length) return m.find((v) => v.localService) || m[0];
      }
      return null;
    }
    function voiceStatus() {
      if (!K.speech.supported) { voiceMsg.textContent = STR.noSpeech; voiceMsg.className = 'game-msg is-warn'; return; }
      const v = voiceFor(set.lang);
      if (!v) { voiceMsg.textContent = STR.voiceWait; voiceMsg.className = 'game-msg'; return; }
      const noHindi = set.lang === 'hi' && norm(v).indexOf('hi') !== 0;
      const label = v.name + ' (' + v.lang + ')';
      voiceMsg.textContent = (noHindi ? STR.noHindi + ' ' : '') + (v.localService === false ? STR.voiceOnline(label) : STR.voiceLocal(label));
      voiceMsg.className = 'game-msg' + (noHindi || v.localService === false ? ' is-warn' : '');
    }
    /* "still speaking" ends when the utterance ends, or at a generous estimate
       of its length: some browsers never report the end (no voice installed) */
    let speakUntil = 0;
    function speaking() { return performance.now() < speakUntil; }
    function speak(n) {
      if (!set.voice || !K.speech.supported) return;
      const v = voiceFor(set.lang);
      const hindi = set.lang === 'hi' && v && norm(v).indexOf('hi') === 0;
      const text = T.speakText(n, { lang: hindi ? 'hi' : 'en', calls: set.calls, style: styleOf(set.lang) });
      const u = K.speech.say(text, { voice: v || undefined, lang: hindi ? 'hi-IN' : (v ? v.lang : (set.lang === 'en-GB' ? 'en-GB' : 'en-IN')), rate: set.rate });
      if (!u) return;
      speakUntil = performance.now() + 1500 + text.length * 85 / (set.rate || 1);
      u.onend = u.onerror = () => { speakUntil = 0; };
    }
    if (K.speech.supported) {
      /* iOS and Safari fill the voice list late, sometimes more than once */
      window.speechSynthesis.addEventListener('voiceschanged', voiceStatus);
      K.speech.ready().then(voiceStatus);
      setTimeout(voiceStatus, 2500);
    }

    /* ----- calling ----- */
    function callNext() {
      if (game.called.length >= 90) { meta.textContent = STR.allDone; stopAuto(); return; }
      const n = T.draw(game.called, K.randInt);
      game.called.push(n);
      persist();
      paint();
      speak(n);
      if (!set.voice) K.sound.tick();
      K.announce(root, n + '. ' + callText(n, set));
      K.wakeLock(true);
      if (auto.on) { auto.next = performance.now() + set.interval * 1000; auto.shown = -1; }
      if (game.called.length >= 90) stopAuto();
    }
    function undo() {
      if (!game.called.length) return;
      const n = game.called.pop();
      K.speech.cancel(); speakUntil = 0;
      persist();
      paint();
      meta.textContent = STR.took(n);
      K.announce(root, STR.took(n));
      if (auto.on) auto.next = performance.now() + set.interval * 1000;
    }
    function tick() {
      if (!auto.on || auto.paused) return;
      const now = performance.now();
      const left = auto.next - now;
      if (left <= 0) {
        if (speaking() && now - auto.next < 10000) { if (auto.shown !== 0) { auto.shown = 0; meta.textContent = STR.waiting; } return; }
        callNext();
        return;
      }
      const s = Math.ceil(left / 1000);
      if (s !== auto.shown) { auto.shown = s; meta.textContent = STR.nextIn(s); }
    }
    function startAuto() {
      auto.on = true; auto.paused = false;
      if (!auto.timer) auto.timer = setInterval(tick, 200);
      callNext();
      auto.next = performance.now() + set.interval * 1000;
      paintAuto();
    }
    function stopAuto() {
      auto.on = false; auto.paused = false;
      if (auto.timer) { clearInterval(auto.timer); auto.timer = null; }
      paintAuto();
    }
    function toggleAuto() {
      K.sound.unlock();
      if (!auto.on) startAuto();
      else if (auto.paused) { auto.paused = false; auto.next = performance.now() + auto.left; paintAuto(); }
      else { auto.paused = true; auto.left = Math.max(0, auto.next - performance.now()); paintAuto(); }
    }
    function askNew() {
      if (!game.called.length && !T.PRIZES.some((p) => game.prizes[p.id].winners.length)) { startNew(); return; }
      confirmBox.hidden = false;
      confirmBox.querySelector('button').focus();
    }
    function startNew() {
      stopAuto();
      K.speech.cancel();
      const on = T.PRIZES.filter((p) => game.prizes[p.id].on).map((p) => p.id);
      game = Object.assign(newGame(on, game.title), { seed: game.seed || '' });
      persist();
      lastShown = null;
      renderPrizes();
      paint();
      verdict.textContent = ''; verdict.className = 'tc-verdict'; ticketBox.textContent = ''; awardRow.hidden = true;
      K.announce(root, 'New game. The board is clear.');
    }

    /* ----- prizes ----- */
    function renderPrizes() {
      prizeList.textContent = '';
      const keep = prizeS.value;
      prizeS.textContent = '';
      T.PRIZES.forEach((p) => {
        const st = game.prizes[p.id];
        const li = K.el('li');
        const cb = K.el('input'); cb.type = 'checkbox'; cb.checked = st.on;
        const lab = K.el('label', 'game-check'); lab.appendChild(cb);
        lab.appendChild(document.createTextNode(p.name));
        lab.title = p.rule;
        cb.addEventListener('change', () => { st.on = cb.checked; persist(); renderPrizes(); publish(); });
        li.appendChild(lab);
        if (st.winners.length) {
          const won = K.el('p', 'tc-won');
          st.winners.forEach((w, i) => {
            won.appendChild(document.createTextNode('Won by ' + (w.name ? w.name + ' (' + w.id + ')' : w.id) + (w.at ? ' at call ' + w.at : '')));
            const rm = K.button(STR.remove, 'btn-ghost', () => { st.winners.splice(i, 1); persist(); renderPrizes(); publish(); });
            rm.setAttribute('aria-label', STR.remove + ' ' + (w.name || w.id) + ' from ' + p.name);
            won.appendChild(rm);
          });
          li.appendChild(won);
        }
        prizeList.appendChild(li);
        if (st.on) { const o = K.el('option', null, p.name); o.value = p.id; prizeS.appendChild(o); }
      });
      if (keep && Array.from(prizeS.options).some((o) => o.value === keep)) prizeS.value = keep;
    }

    /* ----- claims ----- */
    let lastCheck = null;
    function check() {
      awardRow.hidden = true; lastCheck = null;
      ticketBox.textContent = '';
      const p = T.parseId(idIn.value);
      if (!p) { verdict.textContent = STR.checkHint; verdict.className = 'tc-verdict is-bad'; K.announce(root, STR.checkHint); return; }
      const t = T.ticket(p.seed, p.n);
      const prize = T.prize(prizeS.value) || T.prize('full');
      const c = T.claims(t, game.called)[prize.id];
      const calledSet = new Set(game.called);
      ticketBox.appendChild(T.ticketEl(t, { title: game.title, colour: 1, called: calledSet, miss: prize.id === 'early5' ? null : new Set(c.missing) }));
      const st = game.prizes[prize.id];
      const others = st.winners.filter((w) => w.id !== t.id).map((w) => w.name || w.id);
      let text;
      if (c.won) {
        text = STR.good(prize.name, t.id) + STR.completeAt(c.at, game.called.length) + (others.length ? STR.already(others.join(', ')) : '');
        const who = whoIn.value.trim();
        awardB.textContent = STR.award(prize.name, who || t.id);
        awardRow.hidden = st.winners.some((w) => w.id === t.id);
        lastCheck = { prize: prize, id: t.id, at: c.at };
        K.sound.fanfare();
      } else {
        text = prize.id === 'early5' ? STR.badEarly(c.need) : STR.bad(prize.name, c.missing.join(', '));
        K.sound.wrong();
      }
      verdict.textContent = text;
      verdict.className = 'tc-verdict ' + (c.won ? 'is-good' : 'is-bad');
      K.announce(root, text);
      if (p.seed !== game.seed) { game.seed = p.seed; persist(); paintSeed(); }
    }
    function award() {
      if (!lastCheck) return;
      const st = game.prizes[lastCheck.prize.id];
      const who = whoIn.value.trim().slice(0, 30);
      st.winners.push({ id: lastCheck.id, name: who, at: lastCheck.at });
      persist();
      renderPrizes();
      publish();
      awardRow.hidden = true;
      const msg = STR.awarded(lastCheck.prize.name, who || lastCheck.id);
      verdict.textContent = msg;
      K.announce(root, msg);
      K.sound.ding();
    }
    function paintSeed() {
      seedNote.textContent = game.seed ? STR.setFrom(game.seed) : '';
      seedNote.hidden = !game.seed;
    }

    /* ----- wiring ----- */
    vOn.addEventListener('change', () => { set.voice = vOn.checked; if (!set.voice) K.speech.cancel(); persist(); });
    cOn.addEventListener('change', () => { set.calls = cOn.checked; persist(); paint(); });
    langS.addEventListener('change', () => { set.lang = langS.value; persist(); voiceStatus(); paint(); });
    rateS.addEventListener('change', () => { set.rate = Number(rateS.value) || 1; persist(); });
    secs.addEventListener('change', () => {
      const v = Math.max(3, Math.min(20, Math.round(Number(secs.value) || 6)));
      secs.value = String(v);
      if (auto.on && !auto.paused) auto.next += (v - set.interval) * 1000;
      set.interval = v; persist();
    });
    titleIn.addEventListener('input', () => { game.title = titleIn.value.trim().slice(0, 40) || 'Tambola'; persist(); publish(); });
    idIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
    whoIn.addEventListener('input', () => { if (lastCheck) awardB.textContent = STR.award(lastCheck.prize.name, whoIn.value.trim() || lastCheck.id); });

    function key(k) {
      if (k === ' ' || k === 'Enter') { K.sound.unlock(); callNext(); return true; }
      if (k === 'p' || k === 'P') { toggleAuto(); return true; }
      return false;
    }
    stage.onKey = key;
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'BUTTON' || t.tagName === 'A' || t.isContentEditable)) return;
      if (key(e.key)) e.preventDefault();
    });

    if (game.seed && !idIn.value) idIn.value = game.seed + '-';
    paintSeed();
    renderPrizes();
    paintAuto();
    paint();
    persist();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-tool="' + SLUG + '"]');
    if (!root || !K || !T) return;
    let host = null;
    const stage = K.stage({
      slug: SLUG,
      title: 'Tambola',
      render: renderStage,
      onCommand: (m) => { if (m && m.type === 'key' && host && host.onKey) host.onKey(m.key); }
    });
    if (stage.isStage) return;
    host = stage;
    mount(root, stage);
  });
})();
