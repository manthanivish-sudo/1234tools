/**
 * Icebreaker Question Cards: one card at a time, big, on the host's screen
 * and on the TV.
 *
 * The decks are in engine/game-icebreaker-words.js. A deck is shuffled once
 * by a seeded generator (GameKit.seeded) and dealt in order, so no card
 * comes up twice until the deck is used up; "Shuffle again" starts a new
 * order. Next moves on, Skip sets a card aside and moves on, Back shows the
 * last card again, and the heart keeps a card among the favourites on this
 * device. A timer, if chosen, counts down from the moment a card is shown,
 * against the device's clock; it rings at zero and does not move the game
 * on. A short drag across the card does Next (left) or Back (right).
 */
(function () {
  'use strict';
  window.GAME_TOOLS = window.GAME_TOOLS || {};
  window.GAME_TOOLS['icebreaker-cards'] = {
    order: 13,
    title: 'Icebreaker Question Cards',
    short: 'Icebreaker Cards',
    description: 'Question cards for family nights, classrooms, meetings and parties: would you rather, this or that, conversation starters and more. Fair draw, optional timer, shown big on the TV. Free, no sign-up.',
    keywords: ['icebreaker questions', 'icebreaker cards', 'would you rather questions', 'would you rather for kids', 'conversation starters', 'this or that questions', 'get to know you questions', 'icebreaker questions for meetings'],
    glyph: 'i-icebreaker-cards',
    glyphSvg: '<symbol id="i-icebreaker-cards" viewBox="0 0 24 24">\n  <path d="M4 4.5h16v11H12.2L8 19.6v-4.1H4z"/>\n  <path d="M10.2 9.2a1.9 1.9 0 1 1 2.8 1.6c-.7.4-1 .8-1 1.5" class="thin"/>\n  <circle cx="12" cy="13.4" r=".9" class="fill"/>\n</symbol>',
    scripts: ['/engine/game-kit.js', '/engine/game-icebreaker-words.js', '/engine/game-icebreaker-cards.js'],
    privacy: 'The cards are built into the page and nothing is uploaded. Your favourite cards, the deck you chose and your place in it are saved on this device only, so a refresh carries on where you were.',
    how: [
      'Choose a deck, such as Would you rather or Conversation starters.',
      'If you like, choose a timer of 30, 60 or 90 seconds for each card.',
      'Press Draw a card (or Space). The question appears in large type.',
      'Press Show on TV to put the card on the big screen.',
      'Read the card out and take turns to answer it.',
      'Press Next card (or the right arrow, or swipe left on a phone) for another. Press Skip (or S) if a card does not suit the group, and Back (or the left arrow) to see the last one again.',
      'Press the heart (or F) on a card you like; it is kept under Favourites on this device.',
      'When every card has been used, press Shuffle again to start a new order.'
    ],
    manual: {
      setup: [
        'Choose a deck from the list. Each one says who it suits.',
        'Choose a timer, or leave it off.',
        'Press Draw a card. Use Shuffle again whenever you want a new order.'
      ],
      play: [
        'Read the card aloud, or pass the phone to the next person to read it.',
        'Everyone answers in turn. With a timer on, it counts down from the moment the card is shown and rings at zero.',
        'Press Next card (right arrow or Space) for another, Skip (S) for a card that does not suit, or Back (left arrow) for the last one.',
        'Press the heart (F) on a favourite. Open Favourites to show one again or copy the list.'
      ],
      tv: [
        'Press Show on TV (new window) and drag the new window to the TV or projector.',
        'On the TV window press Full screen. The card appears in large type and follows every change you make here.',
        'Keep this page as the remote.'
      ],
      troubleshooting: [
        { q: 'The TV window shows “Press Draw a card”.', a: 'Press Draw a card on this page. The TV window shows whatever this page shows.' },
        { q: 'Swiping does nothing.', a: 'Drag a finger across the card itself, about a thumb’s width. Dragging up and down scrolls the page instead. The Next and Back buttons always work.' },
        { q: 'I have seen all the cards.', a: 'Press Shuffle again for a new order of the same deck, or pick another deck.' },
        { q: 'My favourites have gone.', a: 'They are kept on this device, in this browser. Clearing the site’s data, or using a private window, removes them.' }
      ]
    },
    uses: [
      ['Family dinner', 'one Would you rather card each, read out by the youngest'],
      ['First week of term', 'the Get to know you deck on the board, a minute for each answer'],
      ['Team meeting', 'a Conversation starter on the screen while people join, so the first minute is friendly']
    ],
    tips: [
      'The deck is shuffled once and dealt in order, so no card repeats until you have used them all. Shuffle again gives a new order.',
      'Skip is for a card that does not suit the group. It is set aside and does not come back until you shuffle again.',
      'The timer starts when a card appears and rings at zero. It does not move the game on, so a good answer can run over.',
      'On a phone or tablet, drag across the card to the left for the next card and to the right to go back.',
      'This or that cards are very short, so they suit a quick round where everyone picks a side and says why in a sentence.',
      'Favourites stay on this device. Open Favourites to show one again on the TV or copy the whole list into a message.',
      'The decks are written to be kind: no cards about bodies, money, religion or politics, and none that assume a particular kind of home or family.'
    ],
    faq: [
      { q: 'Which decks are there?', a: 'Would you rather (family), Conversation starters, This or that, Get to know you (classroom) and Party questions (adults, still PG). Each has more than 80 cards.' },
      { q: 'Will a card come up twice?', a: 'Not until the deck is used up. The deck is shuffled once and dealt in that order; when the last card has been shown the page offers to shuffle again.' },
      { q: 'Are the cards suitable for children and for work?', a: 'The family and classroom decks use short, plain words. The party deck is written for adults but is still family-friendly, and the conversation starters suit a meeting. None has cards about bodies, money, religion or politics.' },
      { q: 'Can I add my own questions?', a: 'Not in this version: the decks are fixed. If you want to pick from your own list, the Spin the wheel game takes any list of names or questions.' },
      { q: 'How do I show a card on the TV?', a: 'Press Show on TV to open the big-screen view in a new window, drag it to the TV or projector (or cast that browser tab) and press Full screen there. With one screen, press Full screen here.' },
      { q: 'Are my favourites sent anywhere?', a: 'No. They are saved on this device only, and the Remove button deletes them.' },
      { q: 'Does it work offline?', a: 'Yes. After the first visit the page and all the cards open without a connection.' }
    ],
    related: ['/games/spin-the-wheel/', '/utilities/random-number-generator/', '/utilities/dice-roller/'],
    landings: [
      {
        slug: 'would-you-rather-questions-for-kids',
        title: 'Would You Rather Questions for Kids',
        description: 'More than 80 would-you-rather questions for children, silly and kind, drawn at random with no repeats and shown big on the TV. Free, no sign-up.',
        lede: 'Press Draw a card and a would-you-rather question appears in large type — silly choices, kind choices, never the same one twice until the deck is used up.',
        preset: { deck: 'wyr' },
        about: [
          'The cards are written for children, with short plain words and choices about animals, adventures, food and games. Nothing is about bodies, money, religion or politics.',
          'Read each card aloud, let everyone pick a side, and ask one person to say why. Use Skip for a card that does not suit and the heart to keep the best ones.'
        ],
        faq: [
          { q: 'What age are the questions for?', a: 'They use short, plain words and suit children from about 6 or 7 reading with a grown-up, and older children and adults who enjoy a silly choice.' },
          { q: 'Can we use them in the car?', a: 'Yes. Open the page on a phone, keep the timer off, and press Next card (or swipe) for each new question. It works without a signal after the first visit.' }
        ]
      },
      {
        slug: 'icebreaker-questions-for-meetings',
        title: 'Icebreaker Questions for Meetings',
        description: 'Friendly icebreaker questions for a team meeting or workshop, drawn at random with a one-minute timer and shown big on the screen. Free, no sign-up.',
        lede: 'Put a conversation starter on the screen while people join: one question, a minute each, nothing personal or awkward.',
        preset: { deck: 'starters', secs: 60 },
        about: [
          'The Conversation starters deck has more than 80 open questions about everyday things — places, food, small joys, things learned — with nothing about bodies, money, religion or politics.',
          'The timer is set to 60 seconds for each card. It rings at zero but never moves the meeting on, so the facilitator stays in charge. Skip any card that does not suit your group.'
        ],
        faq: [
          { q: 'How long should an icebreaker take?', a: 'Two to five minutes is enough for most meetings: one question, a minute or less for each person. Use the timer as a gentle guide.' },
          { q: 'Can I show the question on a shared screen?', a: 'Yes. Press Show on TV and share that window or tab in your meeting software, or press Full screen if the meeting is in a room.' }
        ]
      }
    ]
  };

  if (typeof document === 'undefined') return;
  const K = window.GameKit;
  const SLUG = 'icebreaker-cards';
  const MAX_FAV = 200;
  const STR = {
    deck: 'Deck', timer: 'Timer for each card', off: 'Off', draw: 'Draw a card  (Space)', next: 'Next card  (→)', back: 'Back  (←)', skip: 'Skip  (S)',
    fav: 'Favourite  (F)', unfav: 'Favourite  (F)', shuffle: 'Shuffle again', done: 'That was the last card in this deck.',
    start: 'Press Draw a card to begin.', time: 'Time!', favs: 'Favourites', show: 'Show', remove: 'Remove', copy: 'Copy the list', none: 'No favourites yet. Press the heart on a card you like.'
  };
  const SECS = [0, 30, 60, 90];
  const el = K.el;

  /* ---------- the maths (pure; build/tests/games.js checks it) ---------- */

  /** A deck's cards → [{ a, b|null, text }]. A pair card reads "<lead> a or b?". */
  function parseDeck(deck) {
    return String(deck.cards || '').split('|').map((s) => s.trim()).filter(Boolean).map((s) => {
      if (deck.pair) {
        const p = s.split(' ~ ');
        const lead = deck.lead ? deck.lead + ' ' : '';
        return { a: p[0], b: p[1], text: lead + p[0] + ' or ' + p[1] + '?' };
      }
      return { a: s, b: null, text: s };
    });
  }
  function orderFor(seed, n) { return K.seeded(seed).shuffle(Array.from({ length: n }, (_, i) => i)); }
  /** Where Next, Back and Skip lead: pos is the card now showing (n means the deck is used up). */
  function nav(pos, n, dir) {
    if (dir > 0) return Math.min(n, pos + 1);
    return Math.max(0, Math.min(pos, n - 1) - (pos >= n ? 0 : 1));
  }
  /** A drag across the card: 'next' (left), 'back' (right) or '' (too short, or more up-and-down than sideways). */
  function swipe(dx, dy, ms) {
    if (ms > 1200) return '';
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return '';
    return dx < 0 ? 'next' : 'back';
  }
  /** Font size, in rem, for the host's card. */
  function hostSize(card) {
    const len = card.b !== null ? Math.max(card.a.length, card.b.length) * 1.7 : card.text.length;
    return len <= 30 ? 2.6 : len <= 60 ? 2.1 : len <= 90 ? 1.8 : 1.5;
  }
  /** Font size, in vmin, for the TV. */
  function stageSize(card) {
    const len = card.b !== null ? Math.max(card.a.length, card.b.length) * 1.7 : card.text.length;
    return len <= 30 ? 12 : len <= 60 ? 9 : len <= 90 ? 7.2 : 5.8;
  }
  function remaining(endAt, now) { return Math.max(0, endAt - now); }
  function clock(ms) { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  window.GAME_TOOLS[SLUG].maths = { parseDeck, orderFor, nav, swipe, hostSize, stageSize, remaining, clock };

  const DECKS = ((window.GAME_WORDS || {}).icebreaker || { decks: [] }).decks;
  const deckById = (id) => DECKS.find((d) => d.id === id) || DECKS[0];

  /* ---------- the big screen ---------- */

  function renderStage(body, s) {
    if (body.__raf) { cancelAnimationFrame(body.__raf); body.__raf = 0; }
    body.textContent = '';
    if (!s || !s.deck) { body.appendChild(el('p', 'game-stage-wait', 'The question cards will appear here.')); return; }
    const wrap = el('div', 'ib-stage');
    wrap.appendChild(el('p', 'cg-st-sub', s.deck + (s.card ? ' · Card ' + s.num + ' of ' + s.total : '')));
    if (!s.card) {
      wrap.appendChild(el('p', 'cg-st-line', s.done ? STR.done : 'Press Draw a card on the host screen.'));
      body.appendChild(wrap); return;
    }
    const c = s.card;
    const card = el('div', 'ib-bigcard');
    card.style.setProperty('--fs', stageSize(c) + 'vmin');
    if (c.b !== null) {
      if (s.lead) card.appendChild(el('p', 'ib-lead', s.lead + '…'));
      const pair = el('div', 'ib-pair');
      pair.appendChild(el('p', 'ib-opt', c.a)); pair.appendChild(el('p', 'ib-or', 'or')); pair.appendChild(el('p', 'ib-opt', c.b));
      card.appendChild(pair);
    } else card.appendChild(el('p', 'ib-text-big', c.text));
    wrap.appendChild(card);
    if (s.endsAt) {
      const t = el('p', 'ib-clock'); wrap.appendChild(t);
      const tick = () => {
        const rem = remaining(s.endsAt, Date.now());
        t.textContent = rem > 0 ? clock(rem) : STR.time;
        t.classList.toggle('is-low', rem <= 10000);
        if (rem > 0) body.__raf = requestAnimationFrame(tick);
      };
      tick();
    }
    body.appendChild(wrap);
  }

  /* ---------- the page ---------- */

  function mount(root, stage) {
    const io = root.querySelector('.tool-io');
    const store = K.store(SLUG, 1);
    const preset = K.preset(root);
    const saved = store.get({});
    const opt = { deck: saved.deck || DECKS[0].id, secs: saved.secs || 0 };
    if (preset.deck && DECKS.some((d) => d.id === preset.deck)) opt.deck = preset.deck;
    if (typeof preset.secs === 'number') opt.secs = preset.secs;
    if (!DECKS.some((d) => d.id === opt.deck)) opt.deck = DECKS[0].id;
    const games = saved.games || {};
    let favs = Array.isArray(saved.fav) ? saved.fav.slice(0, MAX_FAV) : [];
    let cards = [], order = [], S = null, pin = null, endAt = 0, ticker = 0, rang = false;

    const cols = el('div', 'game-cols ib-cols');
    const side = el('section', 'game-panel');
    side.appendChild(el('h2', null, 'Choose a deck'));
    const deckSeg = el('div', 'ib-decks'); deckSeg.setAttribute('role', 'group'); deckSeg.setAttribute('aria-label', STR.deck);
    const deckBtns = DECKS.map((d) => {
      const b = K.button('', 'ib-deck-btn', () => setDeck(d.id));
      b.appendChild(el('strong', null, d.name)); b.appendChild(el('span', null, d.blurb));
      deckSeg.appendChild(b); return [d.id, b];
    });
    side.appendChild(deckSeg);
    const secSeg = el('div', 'game-seg'); secSeg.setAttribute('role', 'group'); secSeg.setAttribute('aria-label', STR.timer);
    const secBtns = SECS.map((n) => { const b = K.button(n ? n + ' s' : STR.off, null, () => { opt.secs = n; persist(); syncSeg(); startTimer(); publish(); }); secSeg.appendChild(b); return [n, b]; });
    side.appendChild(K.field(STR.timer, secSeg).wrap);
    const shuffleB = K.button(STR.shuffle, 'btn-ghost', () => reshuffle());
    side.appendChild(shuffleB);
    side.appendChild(stage.bar());

    const favBox = el('details', 'ib-favs');
    const favSum = el('summary', null, STR.favs);
    const favList = el('ul', 'ib-fav-list');
    const favCopy = K.button(STR.copy, 'btn-copy', () => {
      if (!favs.length) return;
      K.copy(favs.map((f) => cardOf(f).text).join('\n')).then(() => { favCopy.textContent = 'Copied'; favCopy.classList.add('ok'); setTimeout(() => { favCopy.textContent = STR.copy; favCopy.classList.remove('ok'); }, 1600); });
    });
    favBox.appendChild(favSum); favBox.appendChild(favList); favBox.appendChild(favCopy);
    side.appendChild(favBox);

    const main = el('section', 'game-panel ib-main');
    const counter = el('p', 'game-msg ib-counter'); counter.setAttribute('role', 'status');
    const card = el('div', 'ib-card'); card.tabIndex = 0; card.setAttribute('role', 'group'); card.setAttribute('aria-label', 'Question card');
    const cardLead = el('p', 'ib-lead'); const cardBody = el('div', 'ib-body'); cardBody.setAttribute('aria-live', 'polite');
    const cardClock = el('p', 'ib-clock-host'); cardClock.setAttribute('aria-hidden', 'true');
    card.appendChild(cardLead); card.appendChild(cardBody); card.appendChild(cardClock);
    const acts = el('div', 'game-row ib-acts');
    const backB = K.button(STR.back, 'btn-ghost', () => go(-1));
    const nextB = K.button(STR.draw, 'btn-primary game-big ib-next', () => go(1));
    const skipB = K.button(STR.skip, 'btn-ghost', () => skip());
    const favB = K.button(STR.fav, 'btn-ghost ib-heart', () => toggleFav());
    [backB, nextB, skipB, favB].forEach((b) => acts.appendChild(b));
    main.appendChild(counter); main.appendChild(card); main.appendChild(acts);
    cols.appendChild(side); cols.appendChild(main);
    io.appendChild(cols);

    /* ----- state ----- */
    function cardOf(f) { const d = deckById(f.d); return parseDeck({ pair: d.pair, lead: d.lead, cards: f.b !== null && f.b !== undefined ? f.a + ' ~ ' + f.b : f.a })[0]; }
    function loadDeck() {
      const d = deckById(opt.deck);
      cards = parseDeck(d);
      const g = games[d.id];
      S = g && g.seed && g.n === cards.length ? { seed: g.seed, pos: g.pos, started: !!g.started, skipped: new Set(g.skipped || []) } : { seed: K.newSeed(6), pos: 0, started: false, skipped: new Set() };
      order = orderFor(S.seed + ':' + d.id, cards.length);
      pin = null;
    }
    function persist() {
      const d = deckById(opt.deck);
      if (S) games[d.id] = { seed: S.seed, n: cards.length, pos: S.pos, started: S.started, skipped: Array.from(S.skipped) };
      store.set({ deck: opt.deck, secs: opt.secs, games, fav: favs });
    }
    function current() {
      if (pin) return pin;
      if (!S.started || S.pos >= cards.length) return null;
      return cards[order[S.pos]];
    }
    function setDeck(id) {
      opt.deck = id; loadDeck(); syncSeg(); render(); startTimer(); publish(); persist();
    }
    function reshuffle() {
      S = { seed: K.newSeed(6), pos: 0, started: false, skipped: new Set() };
      order = orderFor(S.seed + ':' + opt.deck, cards.length); pin = null;
      render(); startTimer(); publish(); persist();
      K.announce(root, 'Shuffled. Press Draw a card.');
    }
    function go(dir) {
      K.sound.unlock();
      if (pin) { pin = null; }
      else if (!S.started) { if (dir > 0) S.started = true; }
      else S.pos = nav(S.pos, cards.length, dir);
      if (S.started && S.pos >= cards.length) { rang = true; endAt = 0; }
      shown();
    }
    function skip() {
      if (!S.started || pin || S.pos >= cards.length) return;
      S.skipped.add(order[S.pos]);
      go(1);
    }
    function shown() {
      render(); startTimer(); publish(); persist();
      const c = current();
      if (c) K.announce(root, c.text);
      else if (S.started) K.announce(root, STR.done);
    }

    /* ----- timer ----- */
    function startTimer() {
      clearInterval(ticker); ticker = 0; rang = false;
      endAt = opt.secs && current() ? performance.now() + opt.secs * 1000 : 0;
      paintClock();
      if (endAt) ticker = setInterval(paintClock, 250);
    }
    function paintClock() {
      if (!endAt) { cardClock.textContent = ''; cardClock.hidden = true; return; }
      cardClock.hidden = false;
      const rem = remaining(endAt, performance.now());
      cardClock.textContent = rem > 0 ? clock(rem) : STR.time;
      cardClock.classList.toggle('is-low', rem <= 10000);
      if (rem <= 0 && !rang) { rang = true; K.sound.ding(); K.announce(root, STR.time); clearInterval(ticker); ticker = 0; }
    }

    /* ----- favourites ----- */
    const keyOf = (f) => f.d + '|' + f.a + '|' + (f.b || '');
    function curFav() {
      const c = current(); if (!c) return null;
      return pin ? pin.fav : { d: opt.deck, a: c.a, b: c.b };
    }
    function isFav(f) { return !!f && favs.some((x) => keyOf(x) === keyOf(f)); }
    function toggleFav() {
      const f = curFav(); if (!f) return;
      if (isFav(f)) favs = favs.filter((x) => keyOf(x) !== keyOf(f));
      else if (favs.length < MAX_FAV) favs.push({ d: f.d, a: f.a, b: f.b === undefined ? null : f.b });
      renderFavs(); render(); persist();
      K.announce(root, isFav(f) ? 'Added to favourites.' : 'Removed from favourites.');
    }
    function renderFavs() {
      favSum.textContent = STR.favs + ' (' + favs.length + ')';
      favList.textContent = '';
      favCopy.hidden = !favs.length;
      if (!favs.length) { favList.appendChild(el('li', 'game-msg', STR.none)); return; }
      favs.forEach((f) => {
        const li = el('li', 'ib-fav');
        li.appendChild(el('span', 'ib-fav-text', cardOf(f).text));
        const row = el('span', 'ib-fav-btns');
        row.appendChild(K.button(STR.show, 'btn-ghost', () => { pin = Object.assign({ fav: f }, cardOf(f)); render(); startTimer(); publish(); card.scrollIntoView({ block: 'nearest' }); }));
        row.appendChild(K.button(STR.remove, 'btn-ghost', () => { favs = favs.filter((x) => keyOf(x) !== keyOf(f)); renderFavs(); render(); persist(); }));
        li.appendChild(row); favList.appendChild(li);
      });
    }

    /* ----- drawing ----- */
    function syncSeg() {
      deckBtns.forEach(([id, b]) => b.setAttribute('aria-pressed', String(id === opt.deck)));
      secBtns.forEach(([n, b]) => b.setAttribute('aria-pressed', String(n === opt.secs)));
    }
    function render() {
      const d = deckById(opt.deck), c = current();
      cardLead.textContent = ''; cardBody.textContent = '';
      card.classList.toggle('is-empty', !c);
      if (!S.started && !pin) {
        cardBody.appendChild(el('p', 'ib-text', STR.start));
        counter.textContent = d.name + ' · ' + cards.length + ' cards';
      } else if (!c) {
        cardBody.appendChild(el('p', 'ib-text', STR.done));
        counter.textContent = d.name + ' · all ' + cards.length + ' cards used';
      } else {
        card.style.setProperty('--hfs', hostSize(c) + 'rem');
        if (c.b !== null) {
          if (d.lead) cardLead.textContent = d.lead + '…';
          const pair = el('div', 'ib-pair');
          pair.appendChild(el('p', 'ib-opt', c.a)); pair.appendChild(el('p', 'ib-or', 'or')); pair.appendChild(el('p', 'ib-opt', c.b));
          cardBody.appendChild(pair);
        } else cardBody.appendChild(el('p', 'ib-text', c.text));
        counter.textContent = pin ? 'A favourite card · press Next card to return to the deck' : d.name + ' · card ' + (S.pos + 1) + ' of ' + cards.length + (S.skipped.size ? ' · ' + S.skipped.size + ' skipped' : '');
      }
      nextB.textContent = !S.started && !pin ? STR.draw : STR.next;
      nextB.disabled = S.started && !pin && S.pos >= cards.length;
      backB.disabled = pin ? false : (!S.started || S.pos === 0);
      skipB.disabled = !c || !!pin;
      favB.disabled = !c;
      const f = curFav();
      favB.setAttribute('aria-pressed', String(isFav(f)));
      favB.textContent = (isFav(f) ? '♥ ' : '♡ ') + STR.fav;
      shuffleB.textContent = S.started && S.pos >= cards.length ? STR.shuffle + ' — deck used up' : STR.shuffle;
    }
    function publish() {
      const d = deckById(opt.deck), c = current();
      stage.update({
        deck: d.name, lead: d.lead || '', card: c ? { a: c.a, b: c.b, text: c.text } : null,
        num: S.pos + 1, total: cards.length, done: S.started && !c,
        endsAt: endAt && !rang ? Date.now() + remaining(endAt, performance.now()) : 0
      });
    }

    /* ----- keys and swipes ----- */
    stage.onKey = (key) => hotkey(key);
    function hotkey(key) {
      if (key === 'ArrowRight' || key === ' ') go(1);
      else if (key === 'ArrowLeft') go(-1);
      else if (key === 's' || key === 'S') skip();
      else if (key === 'f' || key === 'F') toggleFav();
    }
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.tagName === 'SUMMARY')) return;
      if (e.key === ' ' && t && (t.tagName === 'BUTTON' || t.tagName === 'DETAILS')) return;
      if (['ArrowRight', 'ArrowLeft', ' ', 's', 'S', 'f', 'F'].indexOf(e.key) >= 0) { e.preventDefault(); if (!e.repeat) hotkey(e.key); }
    });
    let down = null;
    card.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    card.addEventListener('pointerup', (e) => {
      if (!down) return;
      const r = swipe(e.clientX - down.x, e.clientY - down.y, performance.now() - down.t);
      down = null;
      if (r === 'next') go(1); else if (r === 'back') go(-1);
    });
    card.addEventListener('pointercancel', () => { down = null; });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && endAt) paintClock(); });

    loadDeck(); syncSeg(); renderFavs(); render(); startTimer(); publish();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-tool="' + SLUG + '"]');
    if (!root || !K) return;
    let host = null;
    const stage = K.stage({
      slug: SLUG, title: 'Question cards', render: renderStage,
      onCommand: (m) => { if (m && m.type === 'key' && host && host.onKey) host.onKey(m.key); }
    });
    if (stage.isStage) return;
    host = stage;
    mount(root, stage);
  });
})();
