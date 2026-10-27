/**
 * Rating scale: the audience rate something from their phones — one to five
 * stars, a 0-10 score, or a 0-10 slider with words at each end — and the big
 * screen shows the average, the spread and a histogram as the ratings come.
 *
 * One rating per phone, kept against the phone's id: rating again replaces
 * the earlier one until the presenter closes the question. The average is
 * the mean of the ratings; the spread is their standard deviation (how far a
 * typical rating sits from the average). Phones get the question and, only
 * if the presenter shows them, the average, the count and the histogram.
 */
(function () {
  'use strict';
  window.ROOM_TOOLS = window.ROOM_TOOLS || {};
  const PRIVACY = 'Answers pass through our server only to reach the presenter’s screen. They are held in memory for the room’s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants.';
  window.ROOM_TOOLS['rating-scale'] = {
    order: 4,
    title: 'Live Rating Scale',
    short: 'Rating Scale',
    description: 'Let the audience rate a talk, an idea or how well they understood, from their phones: stars, 0 to 10 or a slider. The average, the spread and a histogram fill in live on the big screen. Free, no sign-up.',
    keywords: ['live rating scale', 'audience rating', 'rate the session', 'feedback from audience live', 'star rating poll', 'scale 1 to 10 poll', 'confidence check classroom', 'net promoter live'],
    glyph: 'i-rating-scale',
    glyphSvg: '<symbol id="i-rating-scale" viewBox="0 0 24 24">\n  <path d="M12 3.2l2.3 4.7 5.2.8-3.8 3.6.9 5.1L12 15l-4.6 2.4.9-5.1-3.8-3.6 5.2-.8z"/>\n  <path d="M4 21h16" class="thin"/>\n</symbol>',
    scripts: ['/engine/game-kit.js', '/engine/room-client.js', '/engine/room-words.js', '/engine/room-kit.js', '/engine/room-rating-scale.js'],
    privacy: PRIVACY,
    how: [
      'Type what people should rate, for example “How useful was today’s session?”.',
      'Choose the scale: 1 to 5 stars, 0 to 10 buttons, or a 0 to 10 slider. Add words for each end if you like (“Not at all”, “Very”).',
      'Press “Start a live session”. A 6-digit code and a QR code appear.',
      'Press “Show on TV” and drag the new window to the projector, then press Full screen there.',
      'Tell the audience: open 1234tools.com/join (or scan the QR code), type the code, pick a nickname and press Join.',
      'Press “Ask for ratings”. Each phone taps a star or a number (or moves the slider and presses Send rating).',
      'Watch the average and the histogram. Press “Reveal results” (R) if you hid them, and “Close” (C) when done.',
      'Press “Export CSV” to save the ratings, then “End session” (press it twice).'
    ],
    manual: {
      setup: [
        'Open Live Rating Scale on the laptop connected to the projector.',
        'Type the question and choose stars, 0 to 10 or a slider.',
        'Optionally type words for the low and high ends.',
        'Press “Start a live session”: a 6-digit code and a QR code appear.'
      ],
      play: [
        'Audience: open 1234tools.com/join on a phone or scan the QR code, type the code, choose a nickname and press Join.',
        'Presenter: press “Ask for ratings”.',
        'Audience: tap a star or a number, or move the slider and press Send rating. Tap again to change it.',
        'Presenter: press Reveal results (R) if hidden, then Close (C).',
        'Presenter: Export CSV, then End session (press twice).'
      ],
      tv: [
        'Press “Show on TV (new window)” and drag that window to the projector or TV.',
        'Press Full screen in that window; this page stays your remote.',
        'With one screen only, press “Full screen here”; press Esc to come back.'
      ],
      troubleshooting: [
        { q: 'The average changed after someone rated twice.', a: 'Each phone has one rating; a second tap replaces the first, so the average moves to match.' },
        { q: 'Phones still show the old question.', a: 'Press “Ask for ratings” again after changing the question: phones get the new one at once.' },
        { q: 'I want the room not to see the results yet.', a: 'Tick “Hide results until I press Reveal” before asking; the big screen then shows only how many have rated.' }
      ]
    },
    uses: [
      ['Training', 'rate each session out of 5 before the coffee break'],
      ['Classroom', 'how well did you understand this, 0 to 10, before moving on'],
      ['Product team', 'how much would customers want this idea, on a slider from “meh” to “take my money”']
    ],
    tips: [
      'One rating per phone: rating again replaces the earlier one, so changing your mind never counts twice.',
      'The spread is the standard deviation: a small spread means the room agrees, a large one that opinions are split even if the average looks middling.',
      'The histogram shows every value, so a room split between 2 and 9 does not hide behind an average of 5.5.',
      'Words for the ends (“Not at all” and “Completely”) appear on every phone under the scale.',
      'Results on phones stay off until you reveal them; untick “Show results on phones too” to keep them on the big screen only.',
      'Export CSV saves the count for every value of every question, with the average and the spread, made in your browser.'
    ],
    faq: [
      { q: 'Do people need an app or an account?', a: 'No. They open 1234tools.com/join in their phone’s browser, type the 6-digit code (or scan the QR code) and choose a nickname.' },
      { q: 'Which scales can I use?', a: 'One to five stars, 0 to 10 as eleven buttons, or a 0 to 10 slider. Each can have words at the low and high ends.' },
      { q: 'How is the average worked out?', a: 'It is the mean of everyone’s latest rating, shown to one decimal place. The spread is the standard deviation of the same ratings.' },
      { q: 'Can people see each other’s ratings?', a: 'No. Phones receive only the question and, if you show them, the average, the count and the histogram — never who gave which rating.' },
      { q: 'How many people can rate?', a: 'During the launch trial a free session takes up to 1,000 phones at once.' },
      { q: 'What does the server keep?', a: 'The relay at live.1234tools.com passes the question to the phones and each rating to you. It keeps only the current question in memory for late joiners and forgets everything when the session ends (24 hours at most). Ratings are counted on your device.' },
      { q: 'Can I ask several questions?', a: 'Yes. Change the question and press Ask for ratings again; the earlier results are kept and all of them go into the CSV export.' }
    ],
    related: ['/games/scoreboard/', '/education/attendance-calculator/', '/mathematics/average-calculator/'],
    landings: [
      {
        slug: 'rate-a-session-live',
        title: 'Rate a Talk or Training Session Live',
        description: 'Collect instant feedback at the end of a talk or a training session: everyone rates it out of five stars from their phone and the average appears on screen. Free, no forms.',
        lede: 'Feedback before people leave the room: five stars, one tap, and the average on the screen in seconds.',
        preset: { q: 'How useful was this session?', s: 'stars', lo: 'Not useful', hi: 'Very useful', hide: false },
        about: [
          'This page asks for one to five stars with words at each end. Because it is one tap, nearly everyone answers — far more than fill in a form afterwards.',
          'Ask a second question (“How likely are you to recommend it?”) on a 0 to 10 scale by switching the scale and pressing Ask for ratings again; both go into the CSV.'
        ],
        faq: [
          { q: 'Is the feedback anonymous?', a: 'People join with a nickname and the results show totals only, never who gave which rating.' },
          { q: 'Can I compare sessions?', a: 'Export the CSV after each one: every question’s counts, average and spread are in it.' }
        ]
      },
      {
        slug: 'classroom-understanding-check',
        title: 'Classroom Understanding Check, 0 to 10',
        description: 'Ask the class how well they understood, from 0 to 10, on phones or tablets. Results stay hidden until you reveal them, so pupils answer honestly. Free.',
        lede: 'Before moving on, ask how well it went in: a 0 to 10 slider, answered privately, with the spread on the board.',
        preset: { q: 'How well do you understand this now?', s: 'slider', lo: 'Lost', hi: 'Could teach it', hide: true },
        about: [
          'This page uses a 0 to 10 slider and hides the results until you press Reveal, so pupils are not swayed by each other.',
          'Look at the spread as well as the average: a wide spread means part of the class needs another go even if the average looks fine.'
        ],
        faq: [
          { q: 'Can I see which pupil gave which answer?', a: 'No, only the totals, which helps pupils answer honestly.' },
          { q: 'Does it work on tablets?', a: 'Yes. Any browser on a phone, tablet or laptop can join at 1234tools.com/join.' }
        ]
      }
    ]
  };

  if (typeof document === 'undefined') return;
  const K = window.GameKit, L = window.LiveKit;
  const SLUG = 'rating-scale';
  const MAXQ = 200, MAXLAB = 30;
  const STR = {
    qLabel: 'What should people rate?', qPh: 'How useful was today?',
    scale: 'Scale', stars: '1–5 stars', ten: '0–10 buttons', slider: '0–10 slider',
    lo: 'Words for the low end (optional)', hi: 'Words for the high end (optional)',
    hide: 'Hide results until I press Reveal', phones: 'Show results on phones too',
    ask: 'Ask for ratings', asked: 'Asked. Waiting for ratings…', queued: 'Ready. Press “Start a live session” to send it to the phones.',
    needQ: 'Type a question first.',
    close: 'Close  (C)', reopen: 'Reopen  (C)', reveal: 'Reveal results  (R)', unreveal: 'Hide results  (R)', export: 'Export CSV',
    results: 'Ratings', none: 'Ask for ratings to see them here.', closed: 'Answers closed', hidden: 'Results hidden from the big screen',
    avg: 'Average', spread: 'Spread', range: 'Range', count: 'Ratings',
    stageN: '{n} ratings so far', history: 'Earlier questions'
  };
  const fmt = (s, a) => s.replace(/\{(\w+)\}/g, (m, k) => (a && a[k] !== undefined ? a[k] : m));

  /* ---------- the maths (pure; build/tests/live/rating-scale.js checks it) ---------- */

  const range = (s) => (s === 'stars' ? [1, 5] : [0, 10]);
  /** One phone's rating into ratings (Map id → value): an integer on the scale, answers open. */
  function rate(ratings, id, v, card) {
    if (!card || card.cl || !Number.isInteger(v)) return false;
    const [lo, hi] = range(card.s);
    if (v < lo || v > hi || ratings.get(id) === v) return false;
    ratings.set(id, v);
    return true;
  }
  /** {n, mean, sd, min, max, h} — h counts every value of the scale, low to high. */
  function summary(ratings, s) {
    const [lo, hi] = range(s);
    const h = new Array(hi - lo + 1).fill(0);
    const vals = [];
    ratings.forEach((v) => { if (v >= lo && v <= hi) { h[v - lo]++; vals.push(v); } });
    return Object.assign(L ? L.stats(vals) : stats(vals), { h });
  }
  function stats(nums) {
    const n = nums.length;
    if (!n) return { n: 0, mean: 0, sd: 0, min: null, max: null };
    const mean = nums.reduce((a, b) => a + b, 0) / n;
    return { n, mean, sd: Math.sqrt(nums.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n), min: Math.min(...nums), max: Math.max(...nums) };
  }
  const one = (x) => (Math.round(x * 10) / 10).toFixed(1);
  window.ROOM_TOOLS[SLUG].maths = { rate, summary, range };

  /* ---------- the big screen ---------- */

  function renderStage(body, s) {
    const main = L.stageFrame(body, s.join);
    main.textContent = '';
    if (!s.q) { main.appendChild(K.el('p', 'game-stage-wait', L.STR.stageWait)); return; }
    main.appendChild(K.el('h1', 'st-title', s.q));
    if (!s.r) {
      main.appendChild(K.el('p', 'st-big-n', fmt(STR.stageN, { n: s.n })));
      if (s.cl) main.appendChild(K.el('p', 'st-foot', STR.closed));
      return;
    }
    const top = K.el('div', 'st-rate');
    const big = K.el('p', 'st-rate-avg');
    big.appendChild(K.el('strong', null, s.r.n ? one(s.r.mean) : '–'));
    big.appendChild(K.el('span', null, s.s === 'stars' ? ' / 5 ★' : ' / 10'));
    top.appendChild(big);
    const facts = K.el('dl', 'st-rate-facts');
    [[STR.count, String(s.r.n)], [STR.spread, s.r.n ? '± ' + one(s.r.sd) : '–'], [STR.range, s.r.n ? s.r.min + '–' + s.r.max : '–']].forEach(([k, v]) => { facts.appendChild(K.el('dt', null, k)); facts.appendChild(K.el('dd', null, v)); });
    top.appendChild(facts);
    main.appendChild(top);
    const [lo] = range(s.s);
    const hist = K.el('div', 'st-hist');
    hist.setAttribute('role', 'img');
    hist.setAttribute('aria-label', s.r.h.map((c, i) => (i + lo) + ': ' + c).join(', '));
    const most = Math.max(1, ...s.r.h);
    s.r.h.forEach((c, i) => {
      const col = K.el('div', 'st-hist-col');
      const bar = K.el('i');
      bar.style.height = (c * 100 / most).toFixed(1) + '%';
      const n = K.el('span', 'st-hist-n', c ? String(c) : '');
      col.appendChild(n); col.appendChild(bar);
      col.appendChild(K.el('b', null, String(i + lo)));
      hist.appendChild(col);
    });
    main.appendChild(hist);
    if (s.lo || s.hi) { const ends = K.el('div', 'st-ends'); ends.appendChild(K.el('span', null, s.lo || '')); ends.appendChild(K.el('span', null, s.hi || '')); main.appendChild(ends); }
    if (s.cl) main.appendChild(K.el('p', 'st-foot', STR.closed));
  }

  /* the big screen, also drawn by Live Presentation (engine/room-live-presentation.js) for its slides */
  window.ROOM_TOOLS[SLUG].render = renderStage;

  /* ---------- the presenter's page ---------- */

  function mount(root, stage) {
    const io = root.querySelector('.tool-io');
    const store = K.store(SLUG, 1);
    const preset = K.preset(root);
    const opt = Object.assign({ q: '', s: 'stars', lo: '', hi: '', hide: false, phones: true }, store.get({}), preset);
    let card = null, ratings = new Map(), shown = true;
    const history = [];

    const cols = K.el('div', 'game-cols');
    const left = K.el('section', 'game-panel');
    left.appendChild(K.el('h2', null, 'Your question'));
    const qIn = K.el('input'); qIn.type = 'text'; qIn.maxLength = MAXQ; qIn.placeholder = STR.qPh; qIn.value = opt.q;
    left.appendChild(K.field(STR.qLabel, qIn).wrap);
    const seg = K.el('div', 'game-seg');
    const sB = { stars: K.button(STR.stars, null, () => setS('stars')), ten: K.button(STR.ten, null, () => setS('ten')), slider: K.button(STR.slider, null, () => setS('slider')) };
    Object.values(sB).forEach((b) => seg.appendChild(b));
    left.appendChild(K.field(STR.scale, seg).wrap);
    const loIn = K.el('input'); loIn.type = 'text'; loIn.maxLength = MAXLAB; loIn.value = opt.lo;
    const hiIn = K.el('input'); hiIn.type = 'text'; hiIn.maxLength = MAXLAB; hiIn.value = opt.hi;
    left.appendChild(K.field(STR.lo, loIn).wrap);
    left.appendChild(K.field(STR.hi, hiIn).wrap);
    function check(label, on) {
      const l = K.el('label', 'game-check'); const c = K.el('input'); c.type = 'checkbox'; c.checked = !!on;
      l.appendChild(c); l.appendChild(document.createTextNode(label)); left.appendChild(l); return c;
    }
    const hideC = check(STR.hide, opt.hide), phC = check(STR.phones, opt.phones);
    const askB = K.button(STR.ask, 'btn-primary game-big', ask);
    const row = K.el('div', 'game-row'); row.appendChild(askB); left.appendChild(row);
    const askMsg = K.el('p', 'game-msg'); askMsg.setAttribute('role', 'status'); left.appendChild(askMsg);

    const right = K.el('div', 'live-right');
    const kit = L.session({
      slug: SLUG, title: 'Live Rating Scale',
      onMsg, onChange: publish,
      onLeft: (p) => { if (p.k && ratings.delete(p.id)) changed(); },
      onRestore: restore,
      onEnd: () => { draw(); publish(); }
    });
    right.appendChild(kit.el);
    const res = K.el('section', 'game-panel');
    res.appendChild(K.el('h2', null, STR.results));
    const resQ = K.el('p', 'live-q', '');
    const facts = K.el('dl', 'live-facts');
    const hist = K.el('ol', 'live-bars');
    const resMsg = K.el('p', 'game-msg', STR.none);
    [resQ, facts, hist, resMsg].forEach((x) => res.appendChild(x));
    const act = K.el('div', 'game-row');
    const closeB = K.button(STR.close, 'btn-ghost', toggleClose);
    const revealB = K.button(STR.reveal, 'btn-ghost', toggleReveal);
    const expB = K.button(STR.export, 'btn-ghost', exportCsv);
    [closeB, revealB, expB].forEach((b) => act.appendChild(b));
    res.appendChild(act);
    res.appendChild(stage.bar());
    const histD = K.el('details', 'live-history'); histD.hidden = true;
    const histL = K.el('ol');
    histD.appendChild(K.el('summary', null, STR.history)); histD.appendChild(histL);
    res.appendChild(histD);
    right.appendChild(res);
    cols.appendChild(left); cols.appendChild(right);
    io.appendChild(cols);

    function persist() { store.set({ q: qIn.value, s: opt.s, lo: loIn.value, hi: hiIn.value, hide: hideC.checked, phones: phC.checked }); }
    function setS(s) {
      opt.s = s === 'ten' || s === 'slider' ? s : 'stars';
      Object.keys(sB).forEach((k) => sB[k].setAttribute('aria-pressed', String(k === opt.s)));
      persist();
    }
    function sum() { return summary(ratings, card ? card.s : 'stars'); }
    function rv() { const r = sum(); return { a: one(r.mean), n: r.n, h: r.h }; }
    function current() { return history[history.length - 1]; }
    function ask() {
      const q = qIn.value.replace(/\s+/g, ' ').trim().slice(0, MAXQ);
      if (!q) { askMsg.textContent = STR.needQ; qIn.focus(); return; }
      persist();
      card = { k: 'rt', id: L.newId(), q, s: opt.s };
      const lo = loIn.value.trim().slice(0, MAXLAB), hi = hiIn.value.trim().slice(0, MAXLAB);
      if (lo) card.lo = lo;
      if (hi) card.hi = hi;
      ratings = new Map();
      shown = !hideC.checked;
      history.push({ id: card.id, q, s: card.s, r: sum(), at: new Date() });
      kit.setCard(card);
      askMsg.textContent = kit.live ? STR.asked : STR.queued;
      K.announce(root, 'Question asked: ' + q);
      changed();
    }
    function onMsg(m) {
      const v = m.v;
      if (!card || !v || v.q !== card.id) return;
      if (rate(ratings, m.id, v.v, card)) changed();
    }
    function changed() {
      const h = current();
      if (h && card && h.id === card.id) h.r = sum();
      if (card && shown && phC.checked && ratings.size) kit.patch({ rv: rv() });
      draw(); publish(); save();
    }
    function toggleClose() {
      if (!card) return;
      if (card.cl) { delete card.cl; kit.patch({ cl: null }); } else { card.cl = 1; kit.patch({ cl: 1 }); }
      K.announce(root, card.cl ? STR.closed : 'Ratings open');
      draw(); publish(); save();
    }
    function toggleReveal() {
      if (!card) return;
      shown = !shown;
      kit.patch({ rv: shown && phC.checked && ratings.size ? rv() : null });
      draw(); publish(); save();
    }
    phC.addEventListener('change', () => { persist(); if (card) kit.patch({ rv: shown && phC.checked && ratings.size ? rv() : null }); });
    [qIn, loIn, hiIn, hideC].forEach((x) => x.addEventListener('change', persist));
    qIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ask(); } });

    function draw() {
      const r = card ? sum() : null;
      resQ.textContent = card ? card.q : '';
      facts.textContent = ''; hist.textContent = '';
      if (r) {
        [[STR.avg, r.n ? one(r.mean) + (card.s === 'stars' ? ' / 5' : ' / 10') : '–'], [STR.spread, r.n ? '± ' + one(r.sd) : '–'], [STR.range, r.n ? r.min + '–' + r.max : '–'], [STR.count, String(r.n)]]
          .forEach(([k, v]) => { facts.appendChild(K.el('dt', null, k)); facts.appendChild(K.el('dd', null, v)); });
        const [lo] = range(card.s), most = Math.max(1, ...r.h);
        r.h.forEach((c, i) => {
          const li = K.el('li');
          li.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')');
          li.appendChild(K.el('b', null, String(i + lo) + (card.s === 'stars' ? '★' : '')));
          const tr = K.el('span', 'live-bar'); const f = K.el('i'); f.style.width = (c * 100 / most).toFixed(1) + '%'; tr.appendChild(f);
          li.appendChild(tr);
          li.appendChild(K.el('strong', null, String(c)));
          hist.appendChild(li);
        });
      }
      resMsg.textContent = card ? (card.cl ? STR.closed : '') + (shown ? '' : (card.cl ? ' · ' : '') + STR.hidden) : STR.none;
      closeB.textContent = card && card.cl ? STR.reopen : STR.close;
      revealB.textContent = shown ? STR.unreveal : STR.reveal;
      revealB.setAttribute('aria-pressed', String(shown));
      closeB.disabled = revealB.disabled = !card;
      expB.disabled = !history.length;
      histL.textContent = '';
      histD.hidden = history.length < 2;
      history.slice(0, -1).forEach((h) => histL.appendChild(K.el('li', null, h.q + ' — ' + (h.r.n ? one(h.r.mean) : '–') + ' (' + h.r.n + ')')));
    }
    function publish() {
      const r = card ? sum() : null;
      stage.update({ join: kit.join, q: card ? card.q : '', s: card ? card.s : 'stars', lo: card ? card.lo || '' : '', hi: card ? card.hi || '' : '', n: ratings.size, cl: card ? !!card.cl : false, r: card && shown ? r : null });
    }
    function save() {
      kit.save({ card, shown, ratings: Array.from(ratings), history: history.map((h) => ({ id: h.id, q: h.q, s: h.s, r: h.r, at: +h.at })) });
    }
    function restore(s) {
      if (!s || !s.card) return;
      card = s.card; shown = !!s.shown; ratings = new Map(s.ratings || []);
      history.length = 0;
      (s.history || []).forEach((h) => history.push({ id: h.id, q: h.q, s: h.s, r: h.r, at: new Date(h.at) }));
      kit.setCard(Object.assign({}, card, shown && phC.checked && ratings.size ? { rv: rv() } : {}));
      draw(); publish();
    }
    function exportCsv() {
      const rows = [['Question', 'Asked at', 'Scale', 'Value', 'Count', 'Average', 'Spread (SD)', 'Ratings']];
      history.forEach((h) => {
        const [lo] = range(h.s);
        const when = h.at.toISOString().slice(0, 19).replace('T', ' ');
        h.r.h.forEach((c, i) => rows.push([h.q, when, h.s, i + lo, c, h.r.n ? one(h.r.mean) : '', h.r.n ? one(h.r.sd) : '', h.r.n]));
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
    setS(opt.s);
    draw(); publish();
    root._live = { kit, ask: () => ask(), ratings: () => ratings, card: () => card };
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-tool="' + SLUG + '"]');
    if (!root || !K || !L) return;
    const stage = K.stage({ slug: SLUG, title: 'Live Rating Scale', render: renderStage });
    if (stage.isStage) return;
    mount(root, stage);
  });
})();
