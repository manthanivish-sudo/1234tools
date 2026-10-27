/**
 * Live poll: the presenter asks a multiple-choice question, the audience
 * vote on their phones at 1234tools.com/join, and the bars (or a donut) grow
 * on the big screen as the votes arrive.
 *
 * The votes are counted here, in the presenter's browser, one per phone: a
 * vote is kept against the phone's id, which survives a dropped connection,
 * so a phone that reconnects and votes again replaces its vote instead of
 * adding one. Phones receive the question and the options and, only when the
 * presenter shows the results on phones, the totals — never anyone else's
 * vote. engine/room-kit.js runs the session; engine/room-client.js talks to
 * the relay.
 */
(function () {
  'use strict';
  window.ROOM_TOOLS = window.ROOM_TOOLS || {};
  const PRIVACY = 'Answers pass through our server only to reach the presenter’s screen. They are held in memory for the room’s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants.';
  window.ROOM_TOOLS['live-poll'] = {
    order: 1,
    title: 'Live Poll',
    short: 'Live Poll',
    description: 'Ask a multiple-choice question and watch the votes arrive live from phones: the audience join at 1234tools.com/join with a code, one vote per phone, bars or a donut on the projector. Free, no sign-up, no app.',
    keywords: ['live poll', 'free live polling', 'audience poll', 'classroom poll', 'poll with phones', 'live voting for presentations', 'meeting poll'],
    glyph: 'i-live-poll',
    glyphSvg: '<symbol id="i-live-poll" viewBox="0 0 24 24">\n  <path d="M4 20.4h16" class="thin"/>\n  <path d="M5.4 20.4v-6.2h3.2v6.2M10.4 20.4V8.6h3.2v11.8M15.4 20.4v-9h3.2v9"/>\n  <path d="M8.2 5.2a5.4 5.4 0 0 1 7.6 0M10 7a2.8 2.8 0 0 1 4 0" class="thin"/>\n</symbol>',
    scripts: ['/engine/game-kit.js', '/engine/room-client.js', '/engine/room-words.js', '/engine/room-kit.js', '/engine/room-live-poll.js'],
    privacy: PRIVACY,
    how: [
      'Type your question and the answers, one answer per line (2 to 10).',
      'Press “Start a live session”. A 6-digit code and a QR code appear.',
      'Press “Show on TV” and drag the new window to the projector, then press Full screen there.',
      'Tell the audience: open 1234tools.com/join on your phone (or scan the QR code), type the code, pick a nickname and press Join.',
      'Press “Ask this question”. The question appears on every phone; each phone taps one answer.',
      'Watch the bars grow. Press “Reveal results” (R) if you chose to hide them, and “Close voting” (C) when time is up.',
      'Type the next question and press “Ask this question” again. The earlier results are kept.',
      'Press “Export CSV” to save every question’s totals, then “End session” (press it twice) to close the room on every phone.'
    ],
    manual: {
      setup: [
        'Open Live Poll on the laptop that is connected to the projector or TV.',
        'Type the question and the answers, one per line.',
        'Choose bars or a donut, and tick “Hide results until I press Reveal” if the votes should stay secret at first.',
        'Press “Start a live session”: a 6-digit code and a QR code appear.'
      ],
      play: [
        'Audience: open 1234tools.com/join on a phone, or scan the QR code with the camera.',
        'Audience: type the 6 digits, choose a nickname (or press Random nickname) and press Join.',
        'Presenter: press “Ask this question”; the answers appear as big buttons on every phone.',
        'Audience: tap one answer. If changes are allowed, tap another to change it.',
        'Presenter: press Reveal results (R), Close voting (C), then ask the next question.',
        'Presenter: Export CSV, then End session (press twice).'
      ],
      tv: [
        'Press “Show on TV (new window)” and drag that window to the projector or TV.',
        'Press Full screen in that window; this page stays your remote.',
        'With one screen only, press “Full screen here”; press Esc to come back.',
        'Untick “Show the join code on the big screen” to give the results the whole screen.'
      ],
      troubleshooting: [
        { q: 'A phone says “No session with this code”.', a: 'Check the six digits against the screen. Codes work only while the session is open.' },
        { q: 'A phone says the session is full.', a: 'Free sessions take 100 phones. People can share a phone, or end and start a new session for a second group.' },
        { q: 'Someone joined with a rude nickname.', a: 'Open “People” in the session panel and press Remove next to it; that phone cannot rejoin.' },
        { q: 'I reloaded the page by mistake.', a: 'Press “Reopen session” in the same tab: the code and the votes come back.' },
        { q: 'Phones show “The presenter’s screen has dropped out”.', a: 'This page lost its connection; it reconnects by itself. Keep this tab open and the laptop awake.' }
      ]
    },
    uses: [
      ['Classroom', 'a quick check of what the class thinks before the lesson starts'],
      ['Team meeting', 'pick the date for the team lunch with everyone voting from their phone'],
      ['Events', 'let the room choose the next song, the winner or the topic']
    ],
    tips: [
      'One vote per phone: a phone that drops its connection and comes back keeps the same vote, and a second vote from it replaces the first.',
      'Untick “Phones may change their vote” for a vote that should be final as soon as it is cast.',
      'Hide results until I press Reveal keeps the big screen to a count of votes, so nobody follows the crowd. Press R to reveal.',
      'Results on phones are off until you reveal them; untick “Show results on phones too” to keep them on the big screen only.',
      'The percentages always add up to 100: they are rounded with the largest-remainder method.',
      'Export CSV saves every question asked in this session with its totals, made in your browser.'
    ],
    faq: [
      { q: 'Do people need an app or an account?', a: 'No. They open 1234tools.com/join in their phone’s browser, type the 6-digit code (or scan the QR code) and choose a nickname. You need no account either.' },
      { q: 'How many people can vote?', a: 'A free session takes up to 100 phones at once. When it is full, the next phone is told the session is full.' },
      { q: 'Can someone vote twice?', a: 'No. Votes are counted in your browser against each phone’s connection, which stays the same when the phone reconnects, so a second vote replaces the first (or is refused if changes are off). A different phone or browser counts as a different person.' },
      { q: 'What does the server see and keep?', a: 'The relay at live.1234tools.com passes the question to the phones and each phone’s vote to you. It keeps only the current question in memory so late joiners see it, and forgets everything when the session ends (24 hours at most). Votes are counted on your device.' },
      { q: 'Do other people see how I voted?', a: 'No. Phones receive the question and, only if the presenter shows them, the totals. No phone ever receives another person’s vote, and the presenter’s screen shows totals, not who voted for what.' },
      { q: 'How do I show it on the projector?', a: 'Press Show on TV to open the big-screen view in a new window, drag it to the projector and press Full screen there. This page stays your remote. With one screen, press Full screen here.' },
      { q: 'How many answers can a question have?', a: 'From 2 to 10, each up to 80 characters. The question itself can be up to 200 characters.' },
      { q: 'Can I keep the results?', a: 'Yes. Export CSV saves every question in the session with its votes and percentages. The file is made in your browser; nothing is stored by us.' }
    ],
    related: ['/games/quiz-buzzer/', '/games/scoreboard/', '/games/spin-the-wheel/'],
    landings: [
      {
        slug: 'live-poll-for-classroom',
        title: 'Live Poll for the Classroom',
        description: 'Ask the class a question on the board and let pupils vote from phones or tablets with a 6-digit code. One vote each, results revealed when you choose. Free, no accounts.',
        lede: 'Put a question on the board, give the class the code, and see what everyone thinks — not just the hands that go up first.',
        preset: { q: 'How confident do you feel about today’s topic?', opts: 'Very confident\nFairly confident\nA bit unsure\nLost', hide: true, change: true, chart: 'bars' },
        about: [
          'This page starts with a confidence check and “Hide results until I press Reveal” ticked, so pupils answer for themselves before they see the class’s answer. Change the question and the answers to anything you like.',
          'Pupils join at 1234tools.com/join with the code on the board and a nickname — no accounts and no e-mail addresses. Results are counted on your computer and can be saved as a CSV.'
        ],
        faq: [
          { q: 'Do pupils need to sign up or give their names?', a: 'No. They type the code and a nickname; the page suggests friendly random ones. No account, no e-mail address and no cookies on their phones.' },
          { q: 'Can I see who voted for what?', a: 'No, the poll shows totals only, which keeps it honest and anonymous for the class. Use the Quiz Buzzer or a quiz when you need names.' }
        ]
      },
      {
        slug: 'live-poll-for-meetings',
        title: 'Live Poll for Team Meetings',
        description: 'Run a quick vote in a team meeting or a town hall: share your screen, people vote from their phones with a code, and the bars fill in live. Free, no sign-up, no app.',
        lede: 'Decide in a minute instead of a thread of messages: one question on the shared screen, everyone votes from their phone.',
        preset: { q: 'Which day suits the team lunch?', opts: 'Tuesday\nWednesday\nThursday\nFriday', hide: false, change: true, chart: 'donut' },
        about: [
          'This page starts with a donut chart and live results, which suits a quick decision. Share the big-screen window in your video call or put it on the meeting-room screen.',
          'Everyone joins at 1234tools.com/join with the code. Votes are counted in your browser; the server only passes them on and forgets them when you end the session.'
        ],
        faq: [
          { q: 'Does it work in a video call?', a: 'Yes. Share the big-screen window (or your whole screen) in the call; people vote from their phones or from another browser tab at 1234tools.com/join.' },
          { q: 'Is the vote anonymous?', a: 'Nicknames are used only for joining. The results show totals, never who voted for which answer.' }
        ]
      }
    ]
  };

  if (typeof document === 'undefined') return;
  const K = window.GameKit, L = window.LiveKit;
  const SLUG = 'live-poll';
  const MAXO = 10, MAXQ = 200, MAXOL = 80;
  const LETTERS = 'ABCDEFGHIJ';
  const STR = {
    qLabel: 'Your question', qPh: 'What should we do next?',
    oLabel: 'Answers, one per line (2 to 10)', oHint: 'Each answer up to 80 characters.',
    change: 'Phones may change their vote', hide: 'Hide results until I press Reveal', phones: 'Show results on phones too',
    chart: 'Chart', bars: 'Bars', donut: 'Donut',
    ask: 'Ask this question', asked: 'Asked. Waiting for votes…', queued: 'Ready. Press “Start a live session” to send it to the phones.',
    close: 'Close voting  (C)', reopen: 'Reopen voting  (C)', reveal: 'Reveal results  (R)', unreveal: 'Hide results  (R)',
    clear: 'Clear votes', export: 'Export CSV', results: 'Results', none: 'Ask a question to see the votes here.',
    votes: '{n} votes', vote1: '1 vote', closed: 'Voting closed', hidden: 'Results hidden from the big screen',
    need2: 'Type at least two answers, one per line.', needQ: 'Type a question first.',
    history: 'Earlier questions', stageVotes: '{n} votes so far', stageHidden: 'Results in a moment…'
  };
  const fmt = (s, a) => s.replace(/\{(\w+)\}/g, (m, k) => (a && a[k] !== undefined ? a[k] : m));
  const nVotes = (n) => (n === 1 ? STR.vote1 : fmt(STR.votes, { n }));

  /* ---------- the maths (pure; build/tests/live/live-poll.js checks it) ---------- */

  /** Answers typed one per line: trimmed, blanks dropped, duplicates (ignoring case) dropped, at most 10. */
  function parseOptions(text) {
    const seen = new Set(), out = [];
    for (const line of String(text || '').split(/\r?\n/)) {
      const s = line.replace(/\s+/g, ' ').trim().slice(0, MAXOL);
      if (!s || seen.has(s.toLowerCase())) continue;
      seen.add(s.toLowerCase()); out.push(s);
      if (out.length === MAXO) break;
    }
    return out;
  }
  /**
   * One phone's vote into votes (a Map id → option index). Returns true when
   * the vote counts: a valid option, voting open, and either a first vote or
   * a change that is allowed.
   */
  function vote(votes, id, v, card) {
    if (!card || card.cl || !Number.isInteger(v) || v < 0 || v >= card.o.length) return false;
    if (votes.has(id) && (!card.ch || votes.get(id) === v)) return false;
    votes.set(id, v);
    return true;
  }
  function tally(votes, n) {
    const c = new Array(n).fill(0);
    votes.forEach((v) => { if (v >= 0 && v < n) c[v]++; });
    return c;
  }
  /** Whole percentages that add up to 100 (largest remainder), or all 0. */
  function percents(counts) {
    const total = counts.reduce((a, b) => a + b, 0);
    if (!total) return counts.map(() => 0);
    const raw = counts.map((c) => c * 100 / total);
    const out = raw.map(Math.floor);
    let left = 100 - out.reduce((a, b) => a + b, 0);
    raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, i]) => { if (left > 0) { out[i]++; left--; } });
    return out;
  }
  window.ROOM_TOOLS[SLUG].maths = { parseOptions, vote, tally, percents };

  /* ---------- the big screen ---------- */

  function renderStage(body, s) {
    const main = L.stageFrame(body, s.join);
    main.textContent = '';
    if (!s.q) { main.appendChild(K.el('p', 'game-stage-wait', L.STR.stageWait)); return; }
    main.appendChild(K.el('h1', 'st-title', s.q));
    const total = s.n || 0;
    const showing = !!s.c;
    const pc = showing ? percents(s.c) : null;
    if (showing && s.chart === 'donut') {
      const wrap = K.el('div', 'st-donut-wrap');
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 42 42'); svg.setAttribute('class', 'st-donut'); svg.setAttribute('aria-hidden', 'true');
      let at = 25;
      const ring = document.createElementNS(NS, 'circle');
      ring.setAttribute('cx', '21'); ring.setAttribute('cy', '21'); ring.setAttribute('r', '15.915'); ring.setAttribute('class', 'st-donut-ring');
      svg.appendChild(ring);
      s.c.forEach((c, i) => {
        if (!c) return;
        const share = c * 100 / total;
        const seg = document.createElementNS(NS, 'circle');
        seg.setAttribute('cx', '21'); seg.setAttribute('cy', '21'); seg.setAttribute('r', '15.915');
        seg.setAttribute('stroke-dasharray', share.toFixed(3) + ' ' + (100 - share).toFixed(3));
        seg.setAttribute('stroke-dashoffset', String(at));
        seg.setAttribute('style', 'stroke: var(--t' + ((i % 8) + 1) + ')');
        svg.appendChild(seg);
        at = (at - share + 100) % 100;
      });
      const mid = document.createElementNS(NS, 'text');
      mid.setAttribute('x', '21'); mid.setAttribute('y', '23'); mid.setAttribute('class', 'st-donut-n'); mid.textContent = String(total);
      svg.appendChild(mid);
      wrap.appendChild(svg);
      const key = K.el('ul', 'st-donut-key');
      s.o.forEach((o, i) => {
        const li = K.el('li');
        li.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')');
        li.appendChild(K.el('b', null, LETTERS[i]));
        li.appendChild(K.el('span', null, o));
        li.appendChild(K.el('strong', null, pc[i] + '%'));
        key.appendChild(li);
      });
      wrap.appendChild(key);
      main.appendChild(wrap);
    } else {
      const list = K.el('ol', 'st-bars' + (showing ? '' : ' is-hidden'));
      list.style.setProperty('--rows', String(s.o.length));
      const most = showing ? Math.max(1, ...s.c) : 1;
      s.o.forEach((o, i) => {
        const li = K.el('li');
        li.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')');
        li.appendChild(K.el('b', null, LETTERS[i]));
        const lab = K.el('span', 'st-bar-label', o);
        li.appendChild(lab);
        const track = K.el('span', 'st-bar');
        const fill = K.el('i');
        fill.style.width = showing ? (s.c[i] * 100 / most).toFixed(1) + '%' : '0';
        track.appendChild(fill);
        li.appendChild(track);
        li.appendChild(K.el('strong', null, showing ? pc[i] + '% · ' + s.c[i] : ''));
        list.appendChild(li);
      });
      main.appendChild(list);
    }
    main.appendChild(K.el('p', 'st-foot', (showing ? nVotes(total) : (total ? fmt(STR.stageVotes, { n: total }) : STR.stageHidden)) + (s.cl ? ' · ' + STR.closed : '')));
  }

  /* ---------- the presenter's page ---------- */

  function mount(root, stage) {
    const io = root.querySelector('.tool-io');
    const store = K.store(SLUG, 1);
    const preset = K.preset(root);
    const saved = store.get({});
    const opt = Object.assign({ q: '', opts: 'Yes\nNo\nNot sure', change: true, hide: false, phones: true, chart: 'bars' }, saved, preset);
    let card = null;              /* the question on the phones: {k:'poll', id, q, o, ch, cl?} */
    let votes = new Map();        /* phone id → option index, for the current question */
    let shown = !opt.hide;        /* results visible on the big screen */
    const history = [];           /* every question asked: {id, q, o, c, n, at} */

    const cols = K.el('div', 'game-cols');
    const left = K.el('section', 'game-panel');
    left.appendChild(K.el('h2', null, 'Your question'));
    const qIn = K.el('input'); qIn.type = 'text'; qIn.maxLength = MAXQ; qIn.placeholder = STR.qPh; qIn.value = opt.q;
    left.appendChild(K.field(STR.qLabel, qIn).wrap);
    const oIn = K.el('textarea'); oIn.value = opt.opts; oIn.rows = 5;
    oIn.style.minHeight = '140px';
    left.appendChild(K.field(STR.oLabel, oIn, STR.oHint).wrap);
    function check(label, on) {
      const l = K.el('label', 'game-check'); const c = K.el('input'); c.type = 'checkbox'; c.checked = !!on;
      l.appendChild(c); l.appendChild(document.createTextNode(label)); left.appendChild(l); return c;
    }
    const chC = check(STR.change, opt.change);
    const hideC = check(STR.hide, opt.hide);
    const phC = check(STR.phones, opt.phones);
    const seg = K.el('div', 'game-seg');
    const bBars = K.button(STR.bars, null, () => setChart('bars'));
    const bDonut = K.button(STR.donut, null, () => setChart('donut'));
    seg.appendChild(bBars); seg.appendChild(bDonut);
    left.appendChild(K.field(STR.chart, seg).wrap);
    const askB = K.button(STR.ask, 'btn-primary game-big', ask);
    const askRow = K.el('div', 'game-row'); askRow.appendChild(askB);
    left.appendChild(askRow);
    const askMsg = K.el('p', 'game-msg'); askMsg.setAttribute('role', 'status');
    left.appendChild(askMsg);

    const right = K.el('div', 'live-right');
    const kit = L.session({
      slug: SLUG, title: 'Live Poll',
      onMsg, onChange: publish,
      onLeft: (p) => { if (p.k && votes.delete(p.id)) recount(); },
      onRestore: restore,
      onEnd: () => { draw(); publish(); }
    });
    right.appendChild(kit.el);
    const res = K.el('section', 'game-panel');
    res.appendChild(K.el('h2', null, STR.results));
    const resQ = K.el('p', 'live-q', '');
    const resList = K.el('ol', 'live-bars');
    const resMsg = K.el('p', 'game-msg', STR.none);
    res.appendChild(resQ); res.appendChild(resList); res.appendChild(resMsg);
    const act = K.el('div', 'game-row');
    const closeB = K.button(STR.close, 'btn-ghost', toggleClose);
    const revealB = K.button(STR.reveal, 'btn-ghost', toggleReveal);
    /* a new card id, so every phone may vote again */
    const clearB = K.button(STR.clear, 'btn-ghost', () => {
      if (!card) return;
      card = Object.assign({}, card, { id: L.newId() });
      const h = current(); if (h) h.id = card.id;
      votes = new Map();
      kit.setCard(card);
      recount();
    });
    const expB = K.button(STR.export, 'btn-ghost', exportCsv);
    [closeB, revealB, clearB, expB].forEach((b) => act.appendChild(b));
    res.appendChild(act);
    res.appendChild(stage.bar());
    const hist = K.el('details', 'live-history'); hist.hidden = true;
    const histS = K.el('summary', null, STR.history); const histL = K.el('ol');
    hist.appendChild(histS); hist.appendChild(histL); res.appendChild(hist);
    right.appendChild(res);
    cols.appendChild(left); cols.appendChild(right);
    io.appendChild(cols);

    function persist() { store.set({ q: qIn.value, opts: oIn.value, change: chC.checked, hide: hideC.checked, phones: phC.checked, chart: opt.chart }); }
    function setChart(c) {
      opt.chart = c === 'donut' ? 'donut' : 'bars';
      bBars.setAttribute('aria-pressed', String(opt.chart === 'bars'));
      bDonut.setAttribute('aria-pressed', String(opt.chart === 'donut'));
      persist(); publish();
    }
    function counts() { return card ? tally(votes, card.o.length) : []; }
    function current() { return history[history.length - 1]; }

    function ask() {
      const q = qIn.value.replace(/\s+/g, ' ').trim().slice(0, MAXQ);
      const o = parseOptions(oIn.value);
      if (!q) { askMsg.textContent = STR.needQ; qIn.focus(); return; }
      if (o.length < 2) { askMsg.textContent = STR.need2; oIn.focus(); return; }
      persist();
      card = { k: 'poll', id: L.newId(), q, o };
      if (chC.checked) card.ch = 1;
      votes = new Map();
      shown = !hideC.checked;
      history.push({ id: card.id, q, o, c: o.map(() => 0), n: 0, at: new Date() });
      kit.setCard(card);
      askMsg.textContent = kit.live ? STR.asked : STR.queued;
      K.announce(root, 'Question asked: ' + q);
      draw(); publish(); save();
    }
    function onMsg(m) {
      const v = m.v;
      if (!card || !v || v.q !== card.id) return;
      if (!vote(votes, m.id, v.v, card)) return;
      recount();
    }
    function recount() {
      const c = counts(), n = c.reduce((a, b) => a + b, 0);
      const h = current();
      if (h && card && h.id === card.id) { h.c = c; h.n = n; }
      if (card && shown && phC.checked) kit.patch({ rv: { c, n } });
      draw(); publish(); save();
    }
    function toggleClose() {
      if (!card) return;
      card.cl = card.cl ? 0 : 1;
      kit.patch({ cl: card.cl ? 1 : null });
      if (!card.cl) delete card.cl;
      K.announce(root, card.cl ? STR.closed : 'Voting open');
      draw(); publish(); save();
    }
    function toggleReveal() {
      if (!card) return;
      shown = !shown;
      if (shown && phC.checked) { const c = counts(); kit.patch({ rv: { c, n: c.reduce((a, b) => a + b, 0) } }); } else kit.patch({ rv: null });
      draw(); publish(); save();
    }
    phC.addEventListener('change', () => {
      persist();
      if (!card) return;
      if (shown && phC.checked) { const c = counts(); kit.patch({ rv: { c, n: c.reduce((a, b) => a + b, 0) } }); } else kit.patch({ rv: null });
    });
    [qIn, oIn, chC, hideC].forEach((x) => x.addEventListener('change', persist));

    function draw() {
      const c = counts(), n = c.reduce((a, b) => a + b, 0), pc = percents(c);
      resList.textContent = '';
      resQ.textContent = card ? card.q : '';
      if (card) {
        const most = Math.max(1, ...c);
        card.o.forEach((o, i) => {
          const li = K.el('li');
          li.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')');
          li.appendChild(K.el('b', null, LETTERS[i]));
          li.appendChild(K.el('span', 'live-bar-label', o));
          const tr = K.el('span', 'live-bar'); const f = K.el('i'); f.style.width = (c[i] * 100 / most).toFixed(1) + '%'; tr.appendChild(f);
          li.appendChild(tr);
          li.appendChild(K.el('strong', null, pc[i] + '% · ' + c[i]));
          resList.appendChild(li);
        });
      }
      resMsg.textContent = card ? nVotes(n) + (card.cl ? ' · ' + STR.closed : '') + (shown ? '' : ' · ' + STR.hidden) : STR.none;
      closeB.textContent = card && card.cl ? STR.reopen : STR.close;
      revealB.textContent = shown ? STR.unreveal : STR.reveal;
      revealB.setAttribute('aria-pressed', String(shown));
      [closeB, revealB, clearB].forEach((b) => { b.disabled = !card; });
      expB.disabled = !history.length;
      histL.textContent = '';
      hist.hidden = history.length < 2;
      history.slice(0, -1).forEach((h) => histL.appendChild(K.el('li', null, h.q + ' — ' + nVotes(h.n))));
    }
    function publish() {
      stage.update({ join: kit.join, q: card ? card.q : '', o: card ? card.o : [], c: card && shown ? counts() : null, n: card ? votes.size : 0, cl: card ? !!card.cl : false, chart: opt.chart });
    }
    function save() {
      kit.save({ card, votes: Array.from(votes), shown, history: history.map((h) => ({ id: h.id, q: h.q, o: h.o, c: h.c, n: h.n, at: +h.at })) });
    }
    function restore(s) {
      if (!s) return;
      card = s.card || null; votes = new Map(s.votes || []); shown = !!s.shown;
      history.length = 0;
      (s.history || []).forEach((h) => history.push({ id: h.id, q: h.q, o: h.o, c: h.c, n: h.n, at: new Date(h.at) }));
      if (card) kit.setCard(Object.assign({}, card, shown && phC.checked ? { rv: { c: counts(), n: votes.size } } : {}));
      draw(); publish();
    }
    function exportCsv() {
      const rows = [['Question', 'Asked at', 'Answer', 'Votes', 'Percent']];
      history.forEach((h) => {
        const pc = percents(h.c);
        h.o.forEach((o, i) => rows.push([h.q, h.at.toISOString().slice(0, 19).replace('T', ' '), o, h.c[i], pc[i]]));
      });
      L.downloadCsv(L.fileName(SLUG), rows);
    }

    document.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); toggleReveal(); }
      else if (e.key === 'c' || e.key === 'C') { e.preventDefault(); toggleClose(); }
    });
    qIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); oIn.focus(); } });
    setChart(opt.chart);
    draw(); publish();
    root._live = { kit, ask: () => ask(), votes: () => votes, card: () => card };
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-tool="' + SLUG + '"]');
    if (!root || !K || !L) return;
    const stage = K.stage({ slug: SLUG, title: 'Live Poll', render: renderStage });
    if (stage.isStage) return;
    mount(root, stage);
  });
})();
