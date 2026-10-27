/**
 * Live word cloud: the presenter asks for a word or two, each phone sends up
 * to three short answers, and the cloud on the big screen grows as they
 * arrive — the more people send a word, the bigger it is.
 *
 * Answers are grouped ignoring case and spaces ("Team Work", "teamwork" and
 * "TEAMWORK" are one word), counted once per phone, and laid out with no two
 * words overlapping (an Archimedean spiral from the centre, each word placed
 * at the first spot where its box is clear). Rude words are masked by
 * default from the local list in engine/room-words.js, and the presenter can
 * hide any word. Everything is counted here; phones get the prompt and, only
 * if the presenter chooses, the top twenty words — never who sent what.
 */
(function () {
  'use strict';
  window.ROOM_TOOLS = window.ROOM_TOOLS || {};
  const PRIVACY = 'Answers pass through our server only to reach the presenter’s screen. They are held in memory for the room’s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants.';
  window.ROOM_TOOLS['word-cloud'] = {
    order: 2,
    title: 'Live Word Cloud',
    short: 'Word Cloud',
    description: 'Ask the room for a word and watch a live word cloud build on the projector as phones answer at 1234tools.com/join. Words grouped, rude words masked, any word hidden in a tap. Free, no sign-up, no app.',
    keywords: ['live word cloud', 'word cloud from audience', 'interactive word cloud', 'word cloud for meetings', 'word cloud classroom', 'free word cloud generator live', 'brainstorm word cloud'],
    glyph: 'i-word-cloud',
    glyphSvg: '<symbol id="i-word-cloud" viewBox="0 0 24 24">\n  <path d="M6.6 18.6a4.1 4.1 0 0 1-.5-8.2 5.9 5.9 0 0 1 11.4 1.3 3.5 3.5 0 0 1 .4 6.9z"/>\n  <path d="M8.4 15.4h4.4M14.4 15.4h1.6M10 12.6h3.6" class="thin"/>\n</symbol>',
    scripts: ['/engine/game-kit.js', '/engine/room-client.js', '/engine/room-words.js', '/engine/room-kit.js', '/engine/room-word-cloud.js'],
    privacy: PRIVACY,
    how: [
      'Type the prompt, for example “One word for this year”, and choose how many words each phone may send (1, 2 or 3).',
      'Press “Start a live session”. A 6-digit code and a QR code appear.',
      'Press “Show on TV” and drag the new window to the projector, then press Full screen there.',
      'Tell the audience: open 1234tools.com/join (or scan the QR code), type the code, pick a nickname and press Join.',
      'Press “Ask for words”. Each phone types a word and presses Send.',
      'Watch the cloud grow. Press Hide next to any word you do not want on screen; press Close (C) when you have enough.',
      'Press “Export CSV” to save the words and counts, then “End session” (press it twice).'
    ],
    manual: {
      setup: [
        'Open Live Word Cloud on the laptop connected to the projector.',
        'Type the prompt and choose 1, 2 or 3 words per phone.',
        'Leave “Mask rude words” ticked unless you have a reason not to.',
        'Press “Start a live session”: a 6-digit code and a QR code appear.'
      ],
      play: [
        'Audience: open 1234tools.com/join on a phone or scan the QR code.',
        'Audience: type the code, choose a nickname and press Join.',
        'Presenter: press “Ask for words”.',
        'Audience: type a word (up to 25 characters) and press Send; repeat up to the limit.',
        'Presenter: press Hide next to any word to take it off the big screen; press Close (C) to stop answers.',
        'Presenter: Export CSV, then End session (press twice).'
      ],
      tv: [
        'Press “Show on TV (new window)” and drag that window to the projector or TV.',
        'Press Full screen in that window; this page stays your remote.',
        'With one screen only, press “Full screen here”; press Esc to come back.',
        'Untick “Show the join code on the big screen” to give the cloud the whole screen.'
      ],
      troubleshooting: [
        { q: 'A word shows up twice.', a: 'Words are grouped ignoring capitals and spaces, but different spellings (“colour”, “color”) stay apart. Hide one if you wish.' },
        { q: 'A rude word got through.', a: 'Press Hide next to it on this page; it leaves the big screen and the phones at once.' },
        { q: 'Phones cannot send any more words.', a: 'Each phone may send the number of words you chose. Ask again with a new prompt for another round.' },
        { q: 'The cloud is too crowded.', a: 'The big screen shows the 60 most common words. Hide the ones you do not need, or untick the join code strip for more room.' }
      ]
    },
    uses: [
      ['Team meeting', 'one word for how the quarter went, seen by everyone at once'],
      ['Classroom', 'what pupils already know about a topic before the lesson'],
      ['Workshop', 'a brainstorm where the most common ideas grow biggest']
    ],
    tips: [
      'Words are grouped ignoring capitals and spaces: “Team Work”, “teamwork” and “TEAMWORK” count as one word.',
      'Each phone counts once per word, so one enthusiastic person cannot make a word grow by sending it again.',
      'No two words ever overlap: each word is placed on a spiral from the centre at the first spot where it fits, the most common first.',
      'Rude words are masked to their first letter and stars, in English and Hindi or Hinglish, from a list kept in this page. Untick the box to show them as typed.',
      'Hide takes a word off the big screen and off the phones at once; Show brings it back.',
      'Tick “Show top answers on phones” to let the audience see the top twenty words on their own screens too.'
    ],
    faq: [
      { q: 'Do people need an app or an account?', a: 'No. They open 1234tools.com/join in their phone’s browser, type the 6-digit code (or scan the QR code) and choose a nickname.' },
      { q: 'How many people can take part?', a: 'During the launch trial a free session takes up to 1,000 phones at once. Each phone can send one, two or three words, as you choose.' },
      { q: 'How are rude words handled?', a: 'Masked by default: a list of rude words in English and Hindi or Hinglish is kept in the page, and a match is shown as its first letter and stars. Look-alike spellings (sh!t, b1tch) and stretched ones are caught too. No list is perfect, so you can also hide any word by hand.' },
      { q: 'Can people see who wrote which word?', a: 'No. The cloud shows words and counts only. Phones never receive another person’s answers; with “Show top answers on phones” they see the top twenty words and their counts.' },
      { q: 'What does the server keep?', a: 'The relay at live.1234tools.com passes the prompt to the phones and each answer to you. It keeps only the current prompt in memory for late joiners and forgets everything when the session ends (24 hours at most). The words are counted on your device.' },
      { q: 'How long can an answer be?', a: 'Up to 25 characters, so a short phrase works (“more coffee”). Longer answers are refused on the phone.' },
      { q: 'Can I save the cloud?', a: 'Export CSV saves every word with its count. For a picture, take a screenshot of the big-screen window.' }
    ],
    related: ['/text/word-counter/', '/games/spin-the-wheel/', '/games/team-generator/'],
    landings: [
      {
        slug: 'word-cloud-for-team-meeting',
        title: 'Live Word Cloud for Team Meetings',
        description: 'Ask the team for one word and see the answers form a live word cloud on the shared screen. Phones join with a code; rude words masked. Free, no sign-up.',
        lede: 'One word from everyone, on one screen, in a minute: the quickest way to take the temperature of a team.',
        preset: { q: 'One word for how this quarter went', n: 1, phones: false },
        about: [
          'This page asks for one word per person, which keeps the cloud honest: the words that many people chose grow biggest. Share the big-screen window in the call or on the meeting-room screen.',
          'People join at 1234tools.com/join with the code and a nickname. The words are counted in your browser, and nobody can see who wrote what.'
        ],
        faq: [
          { q: 'Is it anonymous?', a: 'The cloud shows words and counts only. Nicknames are used to join and appear only in the People list on your page, never next to a word.' },
          { q: 'Can I use it in a video call?', a: 'Yes. Share the big-screen window; people answer from their phones or from a browser tab at 1234tools.com/join.' }
        ]
      },
      {
        slug: 'word-cloud-for-classroom',
        title: 'Live Word Cloud for the Classroom',
        description: 'Start a lesson with a live word cloud: pupils send up to three words from phones or tablets with a code, and the cloud grows on the board. Rude words masked. Free.',
        lede: 'What does the class already know? Ask for three words each and the board shows the answer in a minute.',
        preset: { q: 'Three words you think of when you hear “volcano”', n: 3, phones: true },
        about: [
          'This page allows three words per pupil and shows the top words on their screens as well, so they see the class’s answers too. Rude words are masked by default, in English and Hindi or Hinglish.',
          'Pupils join at 1234tools.com/join with the code and a nickname — no accounts. Hide any word with one tap.'
        ],
        faq: [
          { q: 'What if a pupil types something rude?', a: 'Listed rude words are masked automatically, and Hide removes any word from the board and the phones at once.' },
          { q: 'Do pupils need e-mail addresses?', a: 'No. A code and a nickname are all they need; nothing is stored on their devices apart from the session’s own answers in that browser tab.' }
        ]
      }
    ]
  };

  if (typeof document === 'undefined') return;
  const K = window.GameKit, L = window.LiveKit;
  const SLUG = 'word-cloud';
  const MAXL = 25, MAXQ = 200, TOP_PHONES = 20, TOP_STAGE = 60;
  const STR = {
    qLabel: 'Your prompt', qPh: 'One word for today',
    nLabel: 'Words per phone', mask: 'Mask rude words', phones: 'Show top answers on phones',
    ask: 'Ask for words', asked: 'Asked. Waiting for words…', queued: 'Ready. Press “Start a live session” to send it to the phones.',
    close: 'Close  (C)', reopen: 'Reopen  (C)', clear: 'Clear words', export: 'Export CSV',
    results: 'Words', none: 'Ask for words to see them here.', needQ: 'Type a prompt first.',
    hide: 'Hide', show: 'Show', closed: 'Answers closed',
    summary: '{w} different words from {p} people', stageWait: 'Words will appear here…'
  };
  const fmt = (s, a) => s.replace(/\{(\w+)\}/g, (m, k) => (a && a[k] !== undefined ? a[k] : m));

  /* ---------- the maths (pure; build/tests/live/word-cloud.js checks it) ---------- */

  /** The grouping key: NFKC, lower case, every space removed. */
  const keyOf = (w) => String(w).normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  const clean = (w) => String(w == null ? '' : w).normalize('NFKC').replace(/\s+/g, ' ').trim();
  function fresh() { return { words: new Map(), per: new Map(), seq: 0 }; }
  /**
   * One answer from one phone into the tally. Returns the key when it
   * counts: a string of 1..limit characters, answers open, the phone under
   * its word allowance and not repeating a word it already sent.
   */
  function addWord(st, id, text, card) {
    if (!card || card.cl || typeof text !== 'string') return null;
    const w = clean(text);
    if (!w || w.length > (card.l || MAXL)) return null;
    const key = keyOf(w);
    let mine = st.per.get(id);
    if (!mine) { mine = new Map(); st.per.set(id, mine); }
    if (mine.has(key) || mine.size >= Math.max(1, Math.min(3, card.n || 1))) return null;
    mine.set(key, w);
    let e = st.words.get(key);
    if (!e) { e = { forms: new Map(), n: 0, first: st.seq++ }; st.words.set(key, e); }
    e.n++;
    e.forms.set(w, (e.forms.get(w) || 0) + 1);
    return key;
  }
  /** Take a phone's words out again (the presenter removed it). */
  function removePhone(st, id) {
    const mine = st.per.get(id);
    if (!mine) return false;
    mine.forEach((form, key) => {
      const e = st.words.get(key);
      if (!e) return;
      e.n--;
      const f = (e.forms.get(form) || 0) - 1;
      if (f > 0) e.forms.set(form, f); else e.forms.delete(form);
      if (e.n <= 0) st.words.delete(key);
    });
    st.per.delete(id);
    return true;
  }
  /** The form most people typed (the first one on a tie). */
  function shown(e) {
    let best = null, bn = -1;
    e.forms.forEach((n, f) => { if (n > bn) { best = f; bn = n; } });
    return best;
  }
  /** [{key, text, n}] most common first (first sent first on a tie), hidden ones left out. */
  function top(st, hidden, masked, limit) {
    const out = [];
    st.words.forEach((e, key) => { if (!hidden.has(key)) out.push({ key, text: masked ? mask(shown(e)) : shown(e), n: e.n, first: e.first }); });
    out.sort((a, b) => b.n - a.n || a.first - b.first);
    return out.slice(0, limit || out.length);
  }
  function mask(t) { return window.RoomWords ? window.RoomWords.mask(t) : t; }

  /**
   * The cloud: words [{text, n}] most common first, measure(text, px) → width
   * in px, an area W × H. Font sizes run from about H/5.5 for the most common
   * word down to about 14 px, by the square root of the count; when the words
   * would cover more than 45% of the area at those sizes, every size is
   * scaled down together so they fit. Each word goes on an Archimedean
   * spiral from the centre (stretched to the area's shape, a step every few
   * pixels) at the first point where its box, with a 3 px margin, touches no
   * placed box and stays inside the area; a word that finds no room is tried
   * smaller, then left out.
   * Returns [{text, n, x, y, w, h, fs}] — x, y the top-left corner.
   */
  function layout(words, measure, W, H) {
    const placed = [];
    if (!words.length || W < 40 || H < 40) return placed;
    const maxN = words[0].n, minN = words[words.length - 1].n;
    const big = Math.max(18, Math.min(H / 5.5, W / 8)), small = Math.max(12, Math.min(16, big / 3));
    const pad = 3, LINE = 1.25;
    const nominal = words.map((word) => {
      const t = maxN === minN ? 1 : Math.sqrt((word.n - minN) / (maxN - minN));
      return small + (big - small) * t;
    });
    let area = 0;
    words.forEach((word, i) => { area += (measure(word.text, nominal[i]) + pad) * (nominal[i] * LINE + pad); });
    const k = area > 0.45 * W * H ? Math.sqrt(0.45 * W * H / area) : 1;
    const hits = (a) => {
      for (const b of placed) {
        if (a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad) return true;
      }
      return false;
    };
    const sx = Math.max(1, W / H), sy = Math.max(1, H / W);
    const rMax = Math.hypot(W, H) / 2;
    words.forEach((word, i) => {
      let fs = Math.max(10, nominal[i] * k);
      let done = null;
      for (let attempt = 0; attempt < 4 && !done; attempt++, fs = Math.max(9, fs * 0.8)) {
        const w = Math.ceil(measure(word.text, fs)) + 2, h = Math.ceil(fs * LINE);
        if (w > W || h > H) continue;
        for (let a = 0, r = 0; r <= rMax; a += Math.min(0.5, 5 / Math.max(r, 5)), r = 1.4 * a) {
          const cx = W / 2 + r * Math.cos(a) * sx, cy = H / 2 + r * Math.sin(a) * sy;
          const box = { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h };
          if (box.x < 0 || box.y < 0 || box.x + w > W || box.y + h > H) continue;
          if (!hits(box)) { done = Object.assign(box, { text: word.text, n: word.n, fs: Math.round(fs * 10) / 10 }); break; }
        }
      }
      if (done) placed.push(done);
    });
    return placed;
  }
  window.ROOM_TOOLS[SLUG].maths = { keyOf, addWord, removePhone, top, layout, fresh };

  /* ---------- the big screen ---------- */

  let measureCtx = null;
  function measurer(font) {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    return (text, px) => { measureCtx.font = '700 ' + px + 'px ' + font; return measureCtx.measureText(text).width; };
  }
  function renderStage(body, s) {
    const main = L.stageFrame(body, s.join);
    main.textContent = '';
    if (!s.q) { main.appendChild(K.el('p', 'game-stage-wait', L.STR.stageWait)); return; }
    main.appendChild(K.el('h1', 'st-title', s.q));
    const box = K.el('div', 'st-cloud');
    main.appendChild(box);
    const W = Math.max(200, box.clientWidth), H = Math.max(160, box.clientHeight);
    if (!s.w.length) {
      box.appendChild(K.el('p', 'game-stage-wait', STR.stageWait));
    } else {
      const font = getComputedStyle(box).fontFamily || 'sans-serif';
      const cloud = layout(s.w.map((x) => ({ text: x[0], n: x[1] })), measurer(font), W, H);
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', String(W)); svg.setAttribute('height', String(H));
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', cloud.map((c) => c.text + ' ' + c.n).join(', '));
      cloud.forEach((c, i) => {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', String(c.x + c.w / 2)); t.setAttribute('y', String(c.y + c.h / 2));
        t.setAttribute('font-size', String(c.fs));
        t.setAttribute('style', 'fill: var(--t' + ((i % 7) + 1) + ')');
        t.textContent = c.text;
        svg.appendChild(t);
      });
      box.appendChild(svg);
    }
    main.appendChild(K.el('p', 'st-foot', fmt(STR.summary, { w: s.total, p: s.people }) + (s.cl ? ' · ' + STR.closed : '')));
  }

  /* the big screen, also drawn by Live Presentation (engine/room-live-presentation.js) for its slides */
  window.ROOM_TOOLS[SLUG].render = renderStage;

  /* ---------- the presenter's page ---------- */

  function mount(root, stage) {
    const io = root.querySelector('.tool-io');
    const store = K.store(SLUG, 1);
    const preset = K.preset(root);
    const opt = Object.assign({ q: '', n: 1, mask: true, phones: false }, store.get({}), preset);
    let card = null, st = fresh(), hidden = new Set(), askedAt = null;

    const cols = K.el('div', 'game-cols');
    const left = K.el('section', 'game-panel');
    left.appendChild(K.el('h2', null, 'Your prompt'));
    const qIn = K.el('input'); qIn.type = 'text'; qIn.maxLength = MAXQ; qIn.placeholder = STR.qPh; qIn.value = opt.q;
    left.appendChild(K.field(STR.qLabel, qIn).wrap);
    const seg = K.el('div', 'game-seg');
    const nB = [1, 2, 3].map((n) => { const b = K.button(String(n), null, () => setN(n)); b.setAttribute('aria-label', n + (n === 1 ? ' word' : ' words') + ' per phone'); seg.appendChild(b); return b; });
    left.appendChild(K.field(STR.nLabel, seg).wrap);
    function check(label, on) {
      const l = K.el('label', 'game-check'); const c = K.el('input'); c.type = 'checkbox'; c.checked = !!on;
      l.appendChild(c); l.appendChild(document.createTextNode(label)); left.appendChild(l); return c;
    }
    const maskC = check(STR.mask, opt.mask);
    const phC = check(STR.phones, opt.phones);
    const askB = K.button(STR.ask, 'btn-primary game-big', ask);
    const row = K.el('div', 'game-row'); row.appendChild(askB); left.appendChild(row);
    const askMsg = K.el('p', 'game-msg'); askMsg.setAttribute('role', 'status'); left.appendChild(askMsg);

    const right = K.el('div', 'live-right');
    const kit = L.session({
      slug: SLUG, title: 'Live Word Cloud',
      onMsg, onChange: publish,
      onLeft: (p) => { if (p.k && removePhone(st, p.id)) changed(); },
      onRestore: restore,
      onEnd: () => { draw(); publish(); }
    });
    right.appendChild(kit.el);
    const res = K.el('section', 'game-panel');
    res.appendChild(K.el('h2', null, STR.results));
    const resMsg = K.el('p', 'game-msg', STR.none);
    const list = K.el('ul', 'live-words');
    res.appendChild(resMsg); res.appendChild(list);
    const act = K.el('div', 'game-row');
    const closeB = K.button(STR.close, 'btn-ghost', toggleClose);
    /* a new card id, so every phone may send its words again */
    const clearB = K.button(STR.clear, 'btn-ghost', () => { if (!card) return; card = Object.assign({}, card, { id: L.newId() }); st = fresh(); hidden = new Set(); kit.setCard(card); changed(); });
    const expB = K.button(STR.export, 'btn-ghost', exportCsv);
    [closeB, clearB, expB].forEach((b) => act.appendChild(b));
    res.appendChild(act);
    res.appendChild(stage.bar());
    right.appendChild(res);
    cols.appendChild(left); cols.appendChild(right);
    io.appendChild(cols);

    function persist() { store.set({ q: qIn.value, n: opt.n, mask: maskC.checked, phones: phC.checked }); }
    function setN(n) {
      opt.n = Math.max(1, Math.min(3, n | 0 || 1));
      nB.forEach((b, i) => b.setAttribute('aria-pressed', String(i + 1 === opt.n)));
      persist();
    }
    function ask() {
      const q = qIn.value.replace(/\s+/g, ' ').trim().slice(0, MAXQ);
      if (!q) { askMsg.textContent = STR.needQ; qIn.focus(); return; }
      persist();
      card = { k: 'wc', id: L.newId(), q, n: opt.n, l: MAXL };
      st = fresh(); hidden = new Set(); askedAt = new Date();
      kit.setCard(card);
      askMsg.textContent = kit.live ? STR.asked : STR.queued;
      K.announce(root, 'Prompt sent: ' + q);
      changed();
    }
    function onMsg(m) {
      const v = m.v;
      if (!card || !v || v.q !== card.id) return;
      if (addWord(st, m.id, v.v, card) !== null) changed();
    }
    function phoneTop() { return top(st, hidden, maskC.checked, TOP_PHONES).map((x) => [x.text, x.n]); }
    function changed() {
      if (card && phC.checked) kit.patch({ rv: phoneTop() });
      draw(); publish(); save();
    }
    function toggleClose() {
      if (!card) return;
      if (card.cl) { delete card.cl; kit.patch({ cl: null }); } else { card.cl = 1; kit.patch({ cl: 1 }); }
      K.announce(root, card.cl ? STR.closed : 'Answers open');
      draw(); publish(); save();
    }
    maskC.addEventListener('change', () => { persist(); changed(); });
    phC.addEventListener('change', () => { persist(); if (card) kit.patch({ rv: phC.checked ? phoneTop() : null }); });
    qIn.addEventListener('change', persist);
    qIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ask(); } });

    function draw() {
      const all = top(st, new Set(), maskC.checked, 200);
      list.textContent = '';
      all.forEach((x) => {
        const li = K.el('li', hidden.has(x.key) ? 'is-hidden' : '');
        li.appendChild(K.el('span', 'live-word', x.text));
        li.appendChild(K.el('strong', null, String(x.n)));
        const b = K.button(hidden.has(x.key) ? STR.show : STR.hide, 'btn-ghost', () => {
          if (hidden.has(x.key)) hidden.delete(x.key); else hidden.add(x.key);
          changed();
        });
        b.setAttribute('aria-label', (hidden.has(x.key) ? STR.show : STR.hide) + ' “' + x.text + '”');
        li.appendChild(b);
        list.appendChild(li);
      });
      resMsg.textContent = card ? fmt(STR.summary, { w: st.words.size, p: st.per.size }) + (card.cl ? ' · ' + STR.closed : '') : STR.none;
      closeB.textContent = card && card.cl ? STR.reopen : STR.close;
      closeB.disabled = clearB.disabled = !card;
      expB.disabled = !st.words.size;
    }
    function publish() {
      const w = card ? top(st, hidden, maskC.checked, TOP_STAGE).map((x) => [x.text, x.n]) : [];
      stage.update({ join: kit.join, q: card ? card.q : '', w, total: st.words.size, people: st.per.size, cl: card ? !!card.cl : false });
    }
    function save() {
      kit.save({
        card, hidden: Array.from(hidden), at: askedAt ? +askedAt : 0, seq: st.seq,
        words: Array.from(st.words, ([k, e]) => [k, Array.from(e.forms), e.n, e.first]),
        per: Array.from(st.per, ([id, m]) => [id, Array.from(m)])
      });
    }
    function restore(s) {
      if (!s || !s.card) return;
      card = s.card; hidden = new Set(s.hidden || []); askedAt = s.at ? new Date(s.at) : new Date();
      st = fresh(); st.seq = s.seq || 0;
      (s.words || []).forEach(([k, forms, n, first]) => st.words.set(k, { forms: new Map(forms), n, first }));
      (s.per || []).forEach(([id, pairs]) => st.per.set(id, new Map(pairs)));
      kit.setCard(Object.assign({}, card, phC.checked ? { rv: phoneTop() } : {}));
      draw(); publish();
    }
    function exportCsv() {
      const rows = [['Prompt', 'Asked at', 'Word', 'People', 'Hidden']];
      const when = askedAt ? askedAt.toISOString().slice(0, 19).replace('T', ' ') : '';
      top(st, new Set(), false, 0).forEach((x) => rows.push([card ? card.q : '', when, x.text, x.n, hidden.has(x.key) ? 'yes' : '']));
      L.downloadCsv(L.fileName(SLUG), rows);
    }
    document.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
      if (e.key === 'c' || e.key === 'C') { e.preventDefault(); toggleClose(); }
    });
    setN(opt.n);
    draw(); publish();
    root._live = { kit, ask: () => ask(), state: () => st, card: () => card };
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-tool="' + SLUG + '"]');
    if (!root || !K || !L) return;
    const stage = K.stage({ slug: SLUG, title: 'Live Word Cloud', render: renderStage });
    if (stage.isStage) return;
    mount(root, stage);
  });
})();
