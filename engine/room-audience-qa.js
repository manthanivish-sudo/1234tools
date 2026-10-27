/**
 * Audience Q&A: people send questions from their phones, the presenter
 * approves them (on by default), the room upvotes the ones it wants
 * answered, and the big screen shows the board with the most wanted first.
 *
 * Questions are kept here, in the presenter's browser. Phones receive only
 * the approved questions (with their vote counts and whether they have been
 * answered), keyed by a question id so that a vote travels as a few bytes;
 * a waiting or hidden question never leaves this page. One upvote per phone
 * per question, kept against the phone's id. Rude words are masked by
 * default with the local list in engine/room-words.js.
 */
(function () {
  'use strict';
  window.ROOM_TOOLS = window.ROOM_TOOLS || {};
  const PRIVACY = 'Answers pass through our server only to reach the presenter’s screen. They are held in memory for the room’s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants.';
  window.ROOM_TOOLS['audience-qa'] = {
    order: 3,
    title: 'Audience Q&A',
    short: 'Audience Q&A',
    description: 'Take questions from the audience on their phones: they join at 1234tools.com/join with a code, you approve each question, the room upvotes, and the most wanted rise to the top of the big screen. Free, no sign-up.',
    keywords: ['audience q&a', 'live q&a', 'questions from the audience', 'town hall questions', 'anonymous questions for a talk', 'q&a for events', 'ask questions live from phone', 'upvote questions'],
    glyph: 'i-audience-qa',
    glyphSvg: '<symbol id="i-audience-qa" viewBox="0 0 24 24">\n  <path d="M3.4 5.4a2 2 0 0 1 2-2h13.2a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2H10l-4.4 4v-4H5.4a2 2 0 0 1-2-2z"/>\n  <path d="M9.6 8.2a2.4 2.4 0 1 1 3.4 2.2c-.7.3-1 .8-1 1.5" class="thin"/>\n  <circle cx="12" cy="13.6" r=".8" class="fill"/>\n</symbol>',
    scripts: ['/engine/game-kit.js', '/engine/room-client.js', '/engine/room-words.js', '/engine/room-kit.js', '/engine/room-audience-qa.js'],
    privacy: PRIVACY,
    how: [
      'Type a heading for the board, for example “Questions for the panel”.',
      'Press “Start a live session”. A 6-digit code and a QR code appear.',
      'Press “Show on TV” and drag the new window to the projector, then press Full screen there.',
      'Tell the audience: open 1234tools.com/join (or scan the QR code), type the code, pick a nickname and press Join.',
      'Press “Open questions”. Each phone can now type a question (up to 280 characters) and send it.',
      'New questions wait under “Waiting for approval”. Press Approve to put one on the board, or Hide to drop it.',
      'The audience upvote the questions on the board. Press Spotlight to show one big while you answer it, then Answered.',
      'Press “Export CSV” to save the questions, then “End session” (press it twice).'
    ],
    manual: {
      setup: [
        'Open Audience Q&A on the laptop connected to the projector.',
        'Type the heading for the board.',
        'Leave “Check questions before they appear” and “Mask rude words” ticked for a public event.',
        'Press “Start a live session”, then “Open questions”.'
      ],
      play: [
        'Audience: open 1234tools.com/join on a phone or scan the QR code, type the code, choose a nickname and press Join.',
        'Audience: type a question and press “Send question”.',
        'Presenter: press Approve (or Hide) for each question under “Waiting for approval”.',
        'Audience: tap ▲ next to the questions they want answered; tap again to take the vote back.',
        'Presenter: press Spotlight to show a question big, then Answered when it is done.',
        'Presenter: Export CSV, then End session (press twice).'
      ],
      tv: [
        'Press “Show on TV (new window)” and drag that window to the projector or TV.',
        'Press Full screen in that window; this page stays your remote.',
        'With one screen only, press “Full screen here”; press Esc to come back.',
        'Untick “Show nicknames on the big screen” if askers should stay anonymous to the room.'
      ],
      troubleshooting: [
        { q: 'Questions do not appear on the board.', a: 'With “Check questions before they appear” ticked, each one waits for you to press Approve. Untick it to let questions go straight on.' },
        { q: 'Phones cannot send a question.', a: 'Press “Open questions” first; Close (C) stops new questions until you reopen.' },
        { q: 'One person is sending too many questions.', a: 'Each phone can send up to 10 questions. Open “People” in the session panel and press Remove to stop a phone.' },
        { q: 'I reloaded the page by mistake.', a: 'Press “Reopen session” in the same tab: the code and the questions come back.' }
      ]
    },
    uses: [
      ['Town hall', 'staff send questions for the leadership; the most upvoted are answered first'],
      ['Wedding', 'guests send questions for the couple to answer during the speeches'],
      ['Webinar or talk', 'questions collected during the talk, ready for the end']
    ],
    tips: [
      'Approval is on by default: a question waits on your page and reaches the board and the phones only when you press Approve.',
      'One upvote per phone per question; tapping ▲ again takes it back. Answered questions move to the bottom and cannot be voted on.',
      'The board puts unanswered questions first, then the most upvoted, then the oldest.',
      'Spotlight shows one question large on the big screen while you answer it; press it again to go back to the board.',
      'Rude words are masked to their first letter and stars in English and Hindi or Hinglish; untick the box to see them as typed.',
      'Each phone can send up to 10 questions of up to 280 characters, which keeps one enthusiast from flooding the board.'
    ],
    faq: [
      { q: 'Do people need an app or an account?', a: 'No. They open 1234tools.com/join in their phone’s browser, type the 6-digit code (or scan the QR code) and choose a nickname.' },
      { q: 'Are the questions anonymous?', a: 'People join with a nickname, not their real name. Untick “Show nicknames on the big screen” and the board shows the questions alone; your own page still shows the nickname so you can remove a phone that misbehaves.' },
      { q: 'Who sees a question before I approve it?', a: 'Only you. A waiting question stays on your page; phones and the big screen get approved questions only.' },
      { q: 'How many people can take part?', a: 'During the launch trial a free session takes up to 1,000 phones at once. Each phone can send up to 10 questions.' },
      { q: 'What does the server keep?', a: 'The relay at live.1234tools.com passes questions to you and the approved board to the phones. It keeps only the current board in memory for late joiners and forgets everything when the session ends (24 hours at most).' },
      { q: 'Can I keep the questions afterwards?', a: 'Yes. Export CSV saves every question with its nickname, its upvotes and whether it was approved, hidden or answered. The file is made in your browser.' },
      { q: 'How do I show the board on the projector?', a: 'Press Show on TV to open the big-screen view in a new window, drag it to the projector and press Full screen there. This page stays your remote.' }
    ],
    related: ['/games/spin-the-wheel/', '/games/quiz-buzzer/', '/text/word-counter/'],
    landings: [
      {
        slug: 'qa-for-town-hall-meeting',
        title: 'Live Q&A for a Town Hall Meeting',
        description: 'Collect questions for a town hall or an all-hands from phones, approve them, let staff upvote and answer the most wanted first. Nicknames only, names hidden on screen. Free.',
        lede: 'The questions people really want answered, in the order they want them answered — without anyone having to stand up first.',
        preset: { q: 'Questions for the leadership team', nicks: false, ap: true },
        about: [
          'This page hides nicknames on the big screen, so the room sees the questions alone, and keeps approval on, so nothing reaches the screen before you have read it.',
          'Staff join at 1234tools.com/join with the code and upvote the questions they share. The board puts the most upvoted unanswered questions first.'
        ],
        faq: [
          { q: 'Can staff ask without being identified?', a: 'They join with a nickname of their choice, and this page hides nicknames on the big screen. Your page shows the nickname only so you can remove a phone that misbehaves.' },
          { q: 'Can we take questions before the meeting starts?', a: 'Yes. Start the session and open questions early; share the code in the invitation. Keep this page open: the session lives as long as this page (up to 24 hours).' }
        ]
      },
      {
        slug: 'wedding-questions-for-the-couple',
        title: 'Guest Questions for the Couple',
        description: 'Let wedding guests send questions for the couple from their phones during the reception, approve the best ones and show them on the big screen. Free, no app, no sign-up.',
        lede: 'How did you meet? Who said “I love you” first? Let the guests ask and put the best questions on the screen.',
        preset: { q: 'Ask the couple anything!', nicks: true, ap: true },
        about: [
          'This page shows the guests’ nicknames with their questions, which makes for a fun moment, and keeps approval on so the best man’s questions are checked first.',
          'Guests join at 1234tools.com/join with the code on the screen or a QR code on the table cards. Rude words are masked automatically.'
        ],
        faq: [
          { q: 'Can I print the code on table cards?', a: 'The code is made when you press Start and lasts until you end the session (24 hours at most), so start it on the day, then write or show the code. The QR code on the screen opens the join page with the code filled in.' },
          { q: 'Do older guests need to install anything?', a: 'No. Any phone browser works: open 1234tools.com/join, type the six digits, and the page does the rest. The buttons are large and the words plain.' }
        ]
      }
    ]
  };

  if (typeof document === 'undefined') return;
  const K = window.GameKit, L = window.LiveKit;
  const SLUG = 'audience-qa';
  const MAXL = 280, MAXQ = 200, PER_PHONE = 10, MAX_ALL = 500;
  const STR = {
    qLabel: 'Heading for the board', qPh: 'Questions for the speaker',
    ap: 'Check questions before they appear', up: 'Allow upvotes', mask: 'Mask rude words', nicks: 'Show nicknames on the big screen',
    open: 'Open questions', update: 'Update the heading', reopen: 'Reopen  (C)', close: 'Close  (C)', opened: 'Open. Waiting for questions…', queued: 'Ready. Press “Start a live session” to send it to the phones.',
    waiting: 'Waiting for approval ({n})', board: 'On the board ({n})', hiddenL: 'Hidden ({n})',
    approve: 'Approve', approveAll: 'Approve all', hide: 'Hide', restore: 'Put back', answered: 'Answered', unanswer: 'Not answered',
    spot: 'Spotlight', unspot: 'Back to the board', remove: 'Remove',
    export: 'Export CSV', none: 'No questions yet.', closed: 'Questions closed',
    stageWait: 'Send your questions from your phone', votes: '▲ {n}'
  };
  const fmt = (s, a) => s.replace(/\{(\w+)\}/g, (m, k) => (a && a[k] !== undefined ? a[k] : m));

  /* ---------- the maths (pure; build/tests/live/audience-qa.js checks it) ---------- */

  function fresh() { return { list: new Map(), per: new Map(), seq: 0 }; }
  /**
   * A question from a phone. Returns the new question, or null when it does
   * not count (empty, questions closed, the phone at its 10, the board at 500).
   * Status: 'wait' when approval is on, 'live' otherwise.
   */
  function addQuestion(st, id, nick, text, card, at) {
    if (!card || card.cl || typeof text !== 'string') return null;
    const t = text.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, card.l || MAXL);
    if (!t || st.list.size >= MAX_ALL) return null;
    const n = st.per.get(id) || 0;
    if (n >= PER_PHONE) return null;
    st.per.set(id, n + 1);
    const qid = String(++st.seq);
    const q = { qid, t, by: id, nick: nick || '', at: at || 0, status: card.ap ? 'wait' : 'live', votes: new Set(), a: 0 };
    st.list.set(qid, q);
    return q;
  }
  /** An upvote (on) or its removal from one phone; only for questions on the board and not answered. */
  function upvote(st, id, qid, on, card) {
    if (!card || !card.up) return false;
    const q = st.list.get(String(qid));
    if (!q || q.status !== 'live' || q.a) return false;
    const had = q.votes.has(id);
    if (on && !had) q.votes.add(id); else if (!on && had) q.votes.delete(id); else return false;
    return true;
  }
  /** The board order: not answered first, then most votes, then oldest. */
  function order(qs) {
    return qs.slice().sort((a, b) => (a.a || 0) - (b.a || 0) || b.votes.size - a.votes.size || Number(a.qid) - Number(b.qid));
  }
  window.ROOM_TOOLS[SLUG].maths = { fresh, addQuestion, upvote, order };

  /* ---------- the big screen ---------- */

  function renderStage(body, s) {
    const main = L.stageFrame(body, s.join);
    main.textContent = '';
    if (!s.q) { main.appendChild(K.el('p', 'game-stage-wait', L.STR.stageWait)); return; }
    main.appendChild(K.el('h1', 'st-title', s.q));
    if (s.spot) {
      const big = K.el('div', 'st-spot');
      big.appendChild(K.el('p', 'st-spot-q', s.spot.t));
      if (s.spot.nick) big.appendChild(K.el('p', 'st-spot-by', '— ' + s.spot.nick));
      big.appendChild(K.el('p', 'st-spot-v', fmt(STR.votes, { n: s.spot.v })));
      main.appendChild(big);
      return;
    }
    if (!s.list.length) { main.appendChild(K.el('p', 'game-stage-wait', STR.stageWait)); return; }
    const ol = K.el('ol', 'st-qa');
    s.list.forEach((q) => {
      const li = K.el('li', q.a ? 'is-done' : '');
      li.appendChild(K.el('strong', 'st-qa-v', fmt(STR.votes, { n: q.v })));
      const tx = K.el('span', 'st-qa-t', q.t);
      li.appendChild(tx);
      if (q.nick) li.appendChild(K.el('small', null, q.nick));
      if (q.a) li.appendChild(K.el('em', null, '✓ ' + STR.answered));
      ol.appendChild(li);
    });
    main.appendChild(ol);
    if (s.cl) main.appendChild(K.el('p', 'st-foot', STR.closed));
  }

  /* the big screen, also drawn by Live Presentation (engine/room-live-presentation.js) for its slides */
  window.ROOM_TOOLS[SLUG].render = renderStage;

  /* ---------- the presenter's page ---------- */

  function mount(root, stage) {
    const io = root.querySelector('.tool-io');
    const store = K.store(SLUG, 1);
    const preset = K.preset(root);
    const opt = Object.assign({ q: 'Questions for the speaker', ap: true, up: true, mask: true, nicks: true }, store.get({}), preset);
    let card = null, st = fresh(), spot = null;

    const cols = K.el('div', 'game-cols');
    const left = K.el('section', 'game-panel');
    left.appendChild(K.el('h2', null, 'Your board'));
    const qIn = K.el('input'); qIn.type = 'text'; qIn.maxLength = MAXQ; qIn.placeholder = STR.qPh; qIn.value = opt.q;
    left.appendChild(K.field(STR.qLabel, qIn).wrap);
    function check(label, on) {
      const l = K.el('label', 'game-check'); const c = K.el('input'); c.type = 'checkbox'; c.checked = !!on;
      l.appendChild(c); l.appendChild(document.createTextNode(label)); left.appendChild(l); return c;
    }
    const apC = check(STR.ap, opt.ap), upC = check(STR.up, opt.up), maskC = check(STR.mask, opt.mask), nickC = check(STR.nicks, opt.nicks);
    const openB = K.button(STR.open, 'btn-primary game-big', openQs);
    const openRow = K.el("div", "game-row"); openRow.appendChild(openB); left.appendChild(openRow);
    const openMsg = K.el('p', 'game-msg'); openMsg.setAttribute('role', 'status'); left.appendChild(openMsg);

    const right = K.el('div', 'live-right');
    const kit = L.session({
      slug: SLUG, title: 'Audience Q&A',
      onMsg, onChange: publish,
      onLeft: (p) => { if (p.k) dropPhone(p.id); },
      onRestore: restore,
      onEnd: () => { draw(); publish(); }
    });
    right.appendChild(kit.el);
    const res = K.el('section', 'game-panel');
    res.appendChild(K.el('h2', null, 'Questions'));
    const wH = K.el('h3', null, ''), wUl = K.el('ul', 'live-qa');
    const allB = K.button(STR.approveAll, 'btn-ghost', () => { st.list.forEach((q) => { if (q.status === 'wait') setStatus(q, 'live', true); }); changed(); });
    const bH = K.el('h3', null, ''), bUl = K.el('ul', 'live-qa');
    const hD = K.el('details', 'live-history'), hS = K.el('summary', null, ''), hUl = K.el('ul', 'live-qa');
    hD.appendChild(hS); hD.appendChild(hUl);
    const resMsg = K.el('p', 'game-msg', STR.none);
    [resMsg, wH, allB, wUl, bH, bUl, hD].forEach((x) => res.appendChild(x));
    const act = K.el('div', 'game-row');
    const closeB = K.button(STR.close, 'btn-ghost', toggleClose);
    const expB = K.button(STR.export, 'btn-ghost', exportCsv);
    act.appendChild(closeB); act.appendChild(expB);
    res.appendChild(act);
    res.appendChild(stage.bar());
    right.appendChild(res);
    cols.appendChild(left); cols.appendChild(right);
    io.appendChild(cols);

    const textOf = (q) => (maskC.checked && window.RoomWords ? window.RoomWords.mask(q.t) : q.t);
    const nickOf = (q) => (window.RoomWords ? window.RoomWords.mask(q.nick) : q.nick);
    const wire = (q) => ({ t: textOf(q), v: q.votes.size, a: q.a ? 1 : 0 });
    function persist() { store.set({ q: qIn.value, ap: apC.checked, up: upC.checked, mask: maskC.checked, nicks: nickC.checked }); }
    function boardWire() { const o = {}; st.list.forEach((q) => { if (q.status === 'live') o[q.qid] = wire(q); }); return o; }

    function openQs() {
      const q = qIn.value.replace(/\s+/g, ' ').trim().slice(0, MAXQ) || STR.qPh;
      persist();
      const keep = card && st.list.size;
      card = { k: 'qa', id: keep ? card.id : L.newId(), q, l: MAXL };
      if (upC.checked) card.up = 1;
      if (apC.checked) card.ap = 1;
      if (!keep) { st = fresh(); spot = null; }
      kit.setCard(Object.assign({}, card, { qs: boardWire() }));
      openMsg.textContent = kit.live ? STR.opened : STR.queued;
      K.announce(root, STR.opened);
      draw(); publish(); save();
    }
    function onMsg(m) {
      const v = m.v;
      if (!card || !v || v.q !== card.id) return;
      if (typeof v.ask === 'string') {
        const q = addQuestion(st, m.id, kit.nick(m.id), v.ask, card, m.at);
        if (!q) return;
        if (q.status === 'live') kit.patch({ qs: { [q.qid]: wire(q) } });
        else K.announce(root, 'New question waiting for approval');
        changed(true);
      } else if (v.up !== undefined) {
        if (upvote(st, m.id, v.up, !!v.on, card)) {
          const q = st.list.get(String(v.up));
          kit.patch({ qs: { [q.qid]: { v: q.votes.size } } });
          changed(true);
        }
      }
    }
    function setStatus(q, status, quiet) {
      const was = q.status;
      q.status = status;
      if (status === 'live' && was !== 'live') kit.patch({ qs: { [q.qid]: wire(q) } });
      if (status !== 'live' && was === 'live') { kit.patch({ qs: { [q.qid]: null } }); if (spot === q.qid) spot = null; }
      if (!quiet) changed();
    }
    function dropPhone(id) {
      st.list.forEach((q) => {
        if (q.votes.delete(id) && q.status === 'live') kit.patch({ qs: { [q.qid]: { v: q.votes.size } } });
        if (q.by === id && q.status !== 'hidden') setStatus(q, 'hidden', true);
      });
      changed();
    }
    function changed() { draw(); publish(); save(); }
    function toggleClose() {
      if (!card) return;
      if (card.cl) { delete card.cl; kit.patch({ cl: null }); } else { card.cl = 1; kit.patch({ cl: 1 }); }
      K.announce(root, card.cl ? STR.closed : STR.opened);
      changed();
    }
    upC.addEventListener('change', () => { persist(); if (card) { if (upC.checked) card.up = 1; else delete card.up; kit.patch({ up: upC.checked ? 1 : null }); } });
    apC.addEventListener('change', () => { persist(); if (card) { if (apC.checked) card.ap = 1; else delete card.ap; kit.patch({ ap: apC.checked ? 1 : null }); } });
    maskC.addEventListener('change', () => { persist(); if (card) kit.patch({ qs: boardWire() }); changed(); });
    nickC.addEventListener('change', () => { persist(); publish(); });
    qIn.addEventListener('change', () => { persist(); if (card) { card.q = qIn.value.trim().slice(0, MAXQ) || STR.qPh; kit.patch({ q: card.q }); publish(); } });

    function row(q) {
      const li = K.el('li', q.a ? 'is-done' : '');
      const top = K.el('div', 'live-qa-text');
      top.appendChild(K.el('span', null, textOf(q)));
      top.appendChild(K.el('small', null, nickOf(q) + (q.status === 'live' ? ' · ▲ ' + q.votes.size : '') + (q.a ? ' · ' + STR.answered : '')));
      li.appendChild(top);
      const b = K.el('div', 'game-row');
      const add = (label, fn, cls) => { const x = K.button(label, cls || 'btn-ghost', fn); b.appendChild(x); return x; };
      if (q.status === 'wait') {
        add(STR.approve, () => setStatus(q, 'live'), 'btn-primary');
        add(STR.hide, () => setStatus(q, 'hidden'));
      } else if (q.status === 'live') {
        add(spot === q.qid ? STR.unspot : STR.spot, () => { spot = spot === q.qid ? null : q.qid; changed(); }).setAttribute('aria-pressed', String(spot === q.qid));
        add(q.a ? STR.unanswer : STR.answered, () => { q.a = q.a ? 0 : 1; if (q.a && spot === q.qid) spot = null; kit.patch({ qs: { [q.qid]: { a: q.a } } }); changed(); });
        add(STR.remove, () => setStatus(q, 'hidden'));
      } else {
        add(STR.restore, () => setStatus(q, 'live'));
      }
      li.appendChild(b);
      return li;
    }
    function draw() {
      const all = Array.from(st.list.values());
      const wait = all.filter((q) => q.status === 'wait'), live = order(all.filter((q) => q.status === 'live')), hid = all.filter((q) => q.status === 'hidden');
      wH.textContent = fmt(STR.waiting, { n: wait.length }); wH.hidden = !wait.length && !apC.checked;
      allB.hidden = wait.length < 2;
      wUl.textContent = ''; wait.forEach((q) => wUl.appendChild(row(q)));
      bH.textContent = fmt(STR.board, { n: live.length });
      bUl.textContent = ''; live.forEach((q) => bUl.appendChild(row(q)));
      hS.textContent = fmt(STR.hiddenL, { n: hid.length }); hD.hidden = !hid.length;
      hUl.textContent = ''; hid.forEach((q) => hUl.appendChild(row(q)));
      resMsg.hidden = all.length > 0;
      openB.textContent = card ? STR.update : STR.open;
      closeB.textContent = card && card.cl ? STR.reopen : STR.close;
      closeB.disabled = !card;
      expB.disabled = !all.length;
    }
    function publish() {
      const live = order(Array.from(st.list.values()).filter((q) => q.status === 'live'));
      const sq = spot && st.list.get(spot);
      stage.update({
        join: kit.join, q: card ? card.q : '', cl: card ? !!card.cl : false,
        spot: sq ? { t: textOf(sq), v: sq.votes.size, nick: nickC.checked ? nickOf(sq) : '' } : null,
        list: live.slice(0, 12).map((q) => ({ t: textOf(q), v: q.votes.size, a: q.a, nick: nickC.checked ? nickOf(q) : '' }))
      });
    }
    function save() {
      kit.save({ card, spot, seq: st.seq, per: Array.from(st.per), list: Array.from(st.list.values()).map((q) => Object.assign({}, q, { votes: Array.from(q.votes) })) });
    }
    function restore(s) {
      if (!s || !s.card) return;
      card = s.card; spot = s.spot || null; st = fresh(); st.seq = s.seq || 0; st.per = new Map(s.per || []);
      (s.list || []).forEach((q) => st.list.set(q.qid, Object.assign({}, q, { votes: new Set(q.votes) })));
      kit.setCard(Object.assign({}, card, { qs: boardWire() }));
      draw(); publish();
    }
    function exportCsv() {
      const rows = [['Heading', 'Question', 'Nickname', 'Status', 'Upvotes', 'Answered', 'Sent at']];
      const word = { wait: 'waiting', live: 'on the board', hidden: 'hidden' };
      Array.from(st.list.values()).forEach((q) => rows.push([card ? card.q : '', q.t, q.nick, word[q.status], q.votes.size, q.a ? 'yes' : '', q.at ? new Date(q.at).toISOString().slice(0, 19).replace('T', ' ') : '']));
      L.downloadCsv(L.fileName(SLUG), rows);
    }
    document.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
      if (e.key === 'c' || e.key === 'C') { e.preventDefault(); toggleClose(); }
    });
    draw(); publish();
    root._live = { kit, open: () => openQs(), state: () => st, card: () => card, approve: (qid) => setStatus(st.list.get(String(qid)), 'live') };
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-tool="' + SLUG + '"]');
    if (!root || !K || !L) return;
    const stage = K.stage({ slug: SLUG, title: 'Audience Q&A', render: renderStage });
    if (stage.isStage) return;
    mount(root, stage);
  });
})();
