/**
 * Phones for the quiz games (window.GamePhones): the optional "Use phones"
 * mode of the Quiz Maker & Host (engine/game-quiz-maker.js) and the Quiz
 * Buzzer (engine/game-quiz-buzzer.js), through the live relay.
 *
 * Nothing here loads on an ordinary visit. The game page fetches this file,
 * with engine/room-client.js, room-words.js and room-kit.js (window.LiveKit),
 * only when the host presses "Use phones"; the TV window fetches room-kit.js
 * and this file only when a state with phones in it (s.ph) arrives. Nothing
 * reaches the relay until the host presses "Start a live session".
 *
 * The phone cards are the /join/ cards that already exist (shapes in the
 * engine/room-kit.js header):
 *   Quiz Maker: `quiz` (multiple choice and true or false, with the deadline
 *     e; the reveal rv:{a} makes the phones say "Correct!" or "Not this
 *     time."), `oe` (typed, number and picture answers; the verdict goes to
 *     each phone in a direct {q, ok}), `look` (round titles and put-in-order
 *     questions) and, at the end, `end` with a direct per phone
 *     {q:'end', t, r, of, tm, fin:1}: "You won!" or its own place.
 *   Quiz Buzzer: `buzz` (open:1 while armed, rv:{w} names who buzzed).
 *   Teams: a `poll` card "Which team are you on?" with the team names; a
 *     phone that does not choose is put in the team with the fewest phones,
 *     and the host can move anyone in "Phones and teams".
 *
 * Times: every answer and buzz is timed by the relay's `at` stamp (server
 * ms on arrival). The host converts "question shown" to server time with
 * room.serverNow(), so an answer's time is measured on one clock; a buzz is
 * moved to this browser's clock (at - offset) so phone presses and keyboard
 * presses are sorted together, the earliest first.
 *
 * Scoring (Quiz Maker): QuizCore's own rules with its speed bonus on, so a
 * right answer earns the question's points plus up to half as much again
 * for speed, falling in a straight line to nothing at the deadline; a wrong
 * one earns nothing. Standings: most points first; equal points go to the
 * lower total time of right answers. Each question has a time limit with
 * phones (its own, else the host's default, else 20 seconds).
 *
 * Teams (Quiz Maker): each team's first answer from its phones is the
 * team's answer; the other phones of that team are listed but not counted.
 */
(function (root) {
  'use strict';
  const GP = {};
  GP.PRIVACY = 'Answers pass through our server only to reach the presenter’s screen. They are held in memory for the room’s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants.';
  GP.TRIAL = 'During the launch trial a free session takes up to 1,000 phones.';
  GP.SECS = 20;
  GP.GRACE = 750;
  GP.BOARD_MS = 4000;

  const STR = GP.STR = {
    pick: 'Which team are you on?',
    pts: function (p) { return p === 1 ? '1 point' : p + ' points'; },
    secs: function (s) { return s + ' s'; },
    top5: 'Top 5', winnerQ: 'And the winner is…', congrats: function (n) { return 'Congratulations, ' + n + '!'; },
    thanks: 'Thank you for playing!', waitQuiz: 'The quiz starts soon. Join on your phone now.',
    answered: function (a, n) { return a + ' of ' + n + ' answered'; },
    teamsAnswered: function (a, n) { return a + ' of ' + n + ' teams answered'; },
    phonesN: function (n) { return n === 1 ? '1 phone' : n + ' phones'; }
  };

  /* ---------- the rules (pure; Node runs them in build/tests/live/quiz-phones.js) ---------- */

  const secs = GP.secsText = function (ms) { return (Math.round((ms || 0) / 100) / 10).toFixed(1); };

  /**
   * Standings: rows [{id, n, p, ct}] (name, points, total ms of right
   * answers) → new rows, most points first; equal points go to the lower
   * ct, then the name. r is the competition rank (1, 2, 2, 4), shared only
   * when points and time are both equal.
   */
  GP.standings = function (rows) {
    const out = rows.map(function (x) { return Object.assign({}, x, { p: x.p || 0, ct: x.ct || 0 }); });
    out.sort(function (a, b) { return b.p - a.p || a.ct - b.ct || String(a.n).localeCompare(String(b.n)) || (String(a.id) < String(b.id) ? -1 : 1); });
    out.forEach(function (x, i) { const y = out[i - 1]; x.r = y && y.p === x.p && y.ct === x.ct ? y.r : i + 1; });
    return out;
  };
  /** The team for a phone that has not chosen: the one with the fewest phones (the first of those). */
  GP.balance = function (counts) {
    let best = 0;
    for (let i = 1; i < counts.length; i++) if (counts[i] < counts[best]) best = i;
    return best;
  };
  /** How a question is answered on a phone: 'opt' (the quiz card), 'text' (oe) or null (look at the screen). */
  GP.kindOf = function (q) {
    if (!q) return null;
    if (q.type === 'mcq' || q.type === 'tf') return 'opt';
    if (q.type === 'text' || q.type === 'number' || q.type === 'picture') return 'text';
    return null;
  };
  /** A phone's answer as QuizCore.check reads it: true-or-false option 0 is True. */
  GP.coreValue = function (q, v) { return q.type === 'tf' ? v === 0 : v; };
  /** The options a phone sees for an 'opt' question. */
  GP.options = function (q, pq) { return q.type === 'tf' ? ['True', 'False'] : (pq && pq.options ? pq.options : q.options).slice(); };
  /** The index of the right option, for the reveal on the phones (null for other types). */
  GP.rightIndex = function (q) { return q.type === 'mcq' ? q.options.indexOf(q.answer) : q.type === 'tf' ? (q.answer ? 0 : 1) : null; };
  /**
   * One question's phone answers, marked: answers {id: {v, ms}} → {id: {ok, pts}}
   * with QuizCore's check, closest and pointsFor (speed on).
   */
  GP.score = function (C, q, answers, o) {
    const ids = Object.keys(answers || {}), out = {};
    const opts = { speed: true, speedMax: 0.5, defaultPoints: 1 };
    if (q.type === 'number' && o && o.closest) {
      const w = C.closest(ids.map(function (id) { return { team: id, value: answers[id].v }; }), q.answer).winners;
      ids.forEach(function (id) { const ok = w.indexOf(id) >= 0; out[id] = { ok: ok, pts: C.pointsFor(q, { ok: ok, ms: answers[id].ms }, opts) }; });
    } else {
      ids.forEach(function (id) { const ok = !!C.check(q, GP.coreValue(q, answers[id].v)).ok; out[id] = { ok: ok, pts: C.pointsFor(q, { ok: ok, ms: answers[id].ms }, opts) }; });
    }
    return out;
  };
  /** The time a buzz was made, on this browser's clock: the relay's stamp less the clock offset. */
  GP.toLocal = function (at, offset) { return at - (offset || 0); };
  /** Who buzzed first among presses [{id, at}] in arrival order: the smallest relay stamp; on a tie, the earlier arrival. */
  GP.firstBuzz = function (presses) {
    let best = null;
    (presses || []).forEach(function (p) { if (!best || p.at < best.at) best = p; });
    return best;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GP;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  root.GamePhones = GP;
  const K = window.GameKit;
  const L = () => window.LiveKit;
  const clone = (x) => JSON.parse(JSON.stringify(x));

  /* ---------- the big screen ---------- */

  /** The stage's frame with the join strip; returns the main area to draw in. */
  GP.frame = function (body, ph) { return L().stageFrame(body, ph && ph.join ? ph.join : null); };
  const line = (x) => STR.pts(x.p) + ' · ' + STR.secs(x.s);
  /**
   * The views that belong to the phones: 'board' (the running top 5),
   * 'final' (the podium with confetti) and the waiting screen before the
   * quiz. Returns true when it drew the view.
   */
  GP.drawStage = function (main, s) {
    const ph = s.ph || {};
    if (s.view === 'board') {
      main.textContent = '';
      main.appendChild(K.el('h1', 'st-title', ph.title || STR.top5));
      if (ph.rows && ph.rows.length) L().lbList(main, ph.rows, false, { pts: STR.pts, time: STR.secs });
      return true;
    }
    if (s.view === 'final') {
      const key = JSON.stringify(ph.rows) + '|' + ph.title;
      if (main._gpFinal === key && main.querySelector('.deck-end')) return true;
      main._gpFinal = key;
      main.textContent = '';
      const box = K.el('div', 'deck-end');
      const rows = ph.rows || [];
      if (rows.length) {
        box.appendChild(K.el('p', 'deck-end-kicker', STR.winnerQ));
        L().podium(box, rows, true, line);
        box.appendChild(K.el('p', 'deck-winner is-win', STR.congrats(L().firsts(rows))));
        box.appendChild(K.el('p', 'deck-end-thanks is-late', STR.thanks));
      } else {
        box.appendChild(K.el('h1', 'deck-end-title', STR.thanks));
        if (ph.title) box.appendChild(K.el('p', 'deck-end-thanks', ph.title));
      }
      main.appendChild(box);
      L().confetti(main, rows.length ? 3.4 : 0.2);
      return true;
    }
    main._gpFinal = null;
    if (!s.view || s.view === 'idle') {
      main.textContent = '';
      main.appendChild(K.el('p', 'game-stage-wait', STR.waitQuiz));
      if (ph.teams && ph.teams.length) teamList(main, ph.teams);
      return true;
    }
    return false;
  };
  /** Teams and how many phones each has, for the waiting screen. */
  function teamList(main, teams) {
    const ol = K.el('ol', 'st-qz-scores gp-teams');
    teams.forEach(function (t, i) {
      const li = K.el('li', 'st-qz-score');
      li.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')');
      li.appendChild(K.el('span', 'st-qz-rank', String(i + 1)));
      li.appendChild(K.el('span', 'st-qz-name', t[0]));
      li.appendChild(K.el('span', 'st-qz-pts', STR.phonesN(t[1])));
      ol.appendChild(li);
    });
    ol.style.setProperty('--rows', String(Math.max(1, teams.length)));
    main.appendChild(ol);
  }
  /** "12 of 20 answered" under a question. */
  GP.answeredLine = function (wrap, ph) {
    if (!ph || ph.of === undefined) return;
    wrap.appendChild(K.el('p', 'st-foot gp-answered', ph.solo ? STR.answered(ph.n, ph.of) : STR.teamsAnswered(ph.n, ph.of)));
  };

  /* ---------- the session, the roster and the panel (both games) ---------- */

  /**
   * GP.session(cfg) → ph. cfg: { slug, title(), teams() → names, teamMode() → bool,
   * onMsg(m), onJoin(p), onChange(), onRestore(saved), save() → object,
   * keys (false: leave the L key to the game), intro (elements before the session) }.
   */
  GP.session = function (cfg) {
    const LK = L();
    const roster = new Map();   /* phone id → team index (team mode) */
    const chosen = new Set();   /* phones that chose their team on the poll */
    let picking = false, pickId = '', want = null, sent = '', pickN = 0;
    const el = K.el('section', 'game-panel gp-panel');
    el.setAttribute('aria-label', 'Phones');
    const ph = { el: el, roster: roster };

    const kit = LK.session({
      slug: cfg.slug, title: cfg.title ? cfg.title() : '', keys: cfg.keys,
      onMsg: function (m) {
        const v = m && m.v;
        if (picking && v && v.q === pickId) { vote(m.id, v.v); return; }
        if (cfg.onMsg) cfg.onMsg(m);
      },
      onJoin: function (p) {
        if (cfg.teamMode() && !roster.has(p.id)) place(p.id);
        drawRoster();
        if (cfg.onJoin) cfg.onJoin(p);
        changed();
      },
      onLeft: function () { drawRoster(); changed(); },
      onChange: function () { changed(); },
      onStart: function () { if (cfg.teamMode()) picking = true; flush(true); drawRoster(); changed(); },
      onRestore: function (saved) {
        if (!saved) return;
        (saved.roster || []).forEach(function (x) { roster.set(x[0], x[1]); });
        (saved.chosen || []).forEach(function (id) { chosen.add(id); });
        if (cfg.onRestore) cfg.onRestore(saved.game);
      },
      onEnd: function () { sent = ''; picking = false; drawRoster(); changed(); }
    });
    ph.kit = kit;
    function changed() { if (cfg.onChange) cfg.onChange(); }

    const intro = K.el('div', 'gp-intro');
    (cfg.intro || []).forEach(function (x) { intro.appendChild(x); });
    el.appendChild(intro);
    el.appendChild(kit.el);
    const pickRow = K.el('div', 'game-row gp-pick');
    const pickB = K.button('', 'btn-ghost gp-pick-btn', function () { setPicking(!picking); });
    pickRow.appendChild(pickB);
    el.appendChild(pickRow);
    const people = K.el('details', 'live-people gp-roster');
    const peopleS = K.el('summary', null, '');
    const peopleL = K.el('ul');
    people.appendChild(peopleS); people.appendChild(peopleL);
    people.addEventListener('toggle', drawRoster);
    el.appendChild(people);
    el.appendChild(K.el('p', 'game-msg gp-privacy', GP.PRIVACY));

    function names() { return cfg.teams() || []; }
    function counts() {
      const c = names().map(function () { return 0; });
      kit.players.forEach(function (n, id) { const t = roster.get(id); if (t !== undefined && t < c.length) c[t]++; });
      return c;
    }
    function place(id) {
      const c = counts();
      if (!c.length) return -1;
      const t = GP.balance(c);
      roster.set(id, t);
      return t;
    }
    /** The team index of a phone (placed now if it has none, or its team was removed). */
    ph.team = function (id) {
      if (!cfg.teamMode()) return -1;
      const t = roster.get(id);
      if (t !== undefined && t < names().length) return t;
      roster.delete(id);
      return place(id);
    };
    ph.teamName = function (id) { const t = ph.team(id); return t >= 0 ? names()[t] : ''; };
    ph.assign = function (id, t) { roster.set(id, t); chosen.add(id); persist(); drawRoster(); changed(); };
    ph.teamCounts = function () { return names().map(function (n, i) { return [n, counts()[i]]; }); };
    function vote(id, i) {
      if (!Number.isInteger(i) || i < 0 || i >= names().length) return;
      ph.assign(id, i);
    }
    function setPicking(on) {
      picking = !!on && cfg.teamMode() && kit.live;
      flush(true);
      drawRoster();
      changed();
    }
    ph.setPicking = setPicking;
    Object.defineProperty(ph, 'picking', { get: function () { return picking; } });
    function drawRoster() {
      const team = cfg.teamMode() && kit.live;
      pickRow.hidden = !team;
      people.hidden = !team;
      pickB.textContent = picking ? 'Teams are set: back to the game' : 'Let phones choose their team';
      pickB.setAttribute('aria-pressed', String(picking));
      if (!team) return;
      peopleS.textContent = 'Phones and teams (' + kit.players.size + ')';
      if (!people.open) return;
      peopleL.textContent = '';
      const ns = names();
      kit.players.forEach(function (nick, id) {
        const li = K.el('li');
        li.appendChild(K.el('span', null, kit.nick(id)));
        const sel = K.el('select');
        sel.setAttribute('aria-label', 'Team for ' + kit.nick(id));
        ns.forEach(function (n, i) { const o = K.el('option', null, n); o.value = String(i); sel.appendChild(o); });
        sel.value = String(ph.team(id));
        sel.addEventListener('change', function () { ph.assign(id, Number(sel.value)); });
        li.appendChild(sel);
        peopleL.appendChild(li);
      });
      if (!kit.players.size) peopleL.appendChild(K.el('li', 'game-msg', 'Nobody has joined yet.'));
    }
    ph.drawRoster = drawRoster;

    /* the card the game wants; the team poll goes first while phones choose */
    function flush(force) {
      if (!kit.live) return;
      let c = want;
      if (picking) {
        if (!pickId || force === true) pickId = 'team' + (++pickN) + LK.newId();
        c = { k: 'poll', id: pickId, q: STR.pick, o: names().slice(), ch: 1 };
      }
      if (!c) return;
      const j = JSON.stringify(c);
      if (j === sent) return;
      sent = j;
      kit.setCard(c);
    }
    /** The game's card for the phones (sent when it changed). */
    ph.card = function (c) { want = c ? clone(c) : null; flush(); };
    /** A message for one phone. */
    ph.direct = function (id, v) { if (kit.room && kit.live) kit.room.to(id, v); };
    /** Server time now, and the offset between the server's clock and this browser's. */
    ph.serverNow = function () { return kit.room && kit.room.serverNow ? kit.room.serverNow() : Date.now(); };
    ph.offset = function () { return ph.serverNow() - Date.now(); };
    Object.defineProperty(ph, 'live', { get: function () { return kit.live; } });
    ph.join = function () { return kit.join; };
    function persist() {
      kit.save({ roster: Array.from(roster.entries()), chosen: Array.from(chosen), game: cfg.save ? cfg.save() : null });
    }
    ph.persist = persist;
    drawRoster();
    return ph;
  };

  /* ---------- the Quiz Maker & Host ---------- */

  /**
   * GP.quiz(cfg) → the phones of one quiz page. cfg: { C (QuizCore), game(),
   * view(), quizTitle(), teams(), closest(), publish(), onChange() }.
   */
  GP.quiz = function (cfg) {
    const C = cfg.C;
    let solo = true, base = '', res = {}, meta = {}, counted = {}, boardAt = {}, endSent = '';
    let boardT = 0;
    const statusEl = K.el('div', 'gp-status');
    statusEl.setAttribute('aria-live', 'polite');

    /* the play mode, chosen before the quiz starts */
    const modeBox = K.el('fieldset', 'gp-mode');
    modeBox.appendChild(K.el('legend', null, 'How do phones play?'));
    const radios = [['solo', 'Everyone for themselves: each phone is a player'], ['teams', 'Teams: each phone plays for one of the teams in Host']].map(function (x) {
      const l = K.el('label', 'game-check');
      const r = K.el('input'); r.type = 'radio'; r.name = 'gp-mode'; r.value = x[0]; r.checked = x[0] === 'solo';
      r.addEventListener('change', function () { if (r.checked) { solo = x[0] === 'solo'; ph.drawRoster(); if (ph.live && !solo) ph.setPicking(true); else ph.setPicking(false); cfg.publish(); } });
      l.appendChild(r); l.appendChild(document.createTextNode(x[1]));
      modeBox.appendChild(l);
      return r;
    });
    const csvB = K.button('Export answers (CSV)', 'btn-ghost gp-csv', function () { L().downloadCsv(L().fileName('quiz-phones'), q.csvRows()); });

    const q = {};
    const ph = GP.session({
      slug: 'quiz-maker', title: cfg.quizTitle,
      teams: cfg.teams, teamMode: function () { return !solo; },
      intro: [modeBox],
      onMsg: onMsg, onJoin: onJoin,
      onChange: function () { cfg.publish(); drawStatus(); },
      save: function () { return { solo: solo, base: base, res: res, meta: meta, counted: counted }; },
      onRestore: function (g) {
        if (!g) return;
        solo = g.solo !== false; base = g.base || ''; res = g.res || {}; meta = g.meta || {}; counted = g.counted || {};
        radios.forEach(function (r) { r.checked = (r.value === 'solo') === solo; });
      }
    });
    ph.el.appendChild(csvB);
    q.ph = ph; q.el = ph.el; q.statusEl = statusEl;
    Object.defineProperty(q, 'solo', { get: function () { return solo; } });
    Object.defineProperty(q, 'live', { get: function () { return ph.live; } });

    /** The quiz the game is made from with phones: every question gets a time limit. */
    q.timed = function (quiz, fallback) {
      const out = clone(quiz);
      const d = Number(fallback) >= 5 ? Number(fallback) : GP.SECS;
      out.rounds.forEach(function (r) { r.questions.forEach(function (x) { if (!(Number(x.time) > 0)) x.time = d; }); });
      return out;
    };
    /** A new game: the answers of the last one are forgotten. */
    q.start = function () {
      base = L().newId(); res = {}; meta = {}; counted = {}; boardAt = {}; endSent = '';
      radios.forEach(function (r) { r.disabled = true; });
      ph.setPicking(false);
      ph.persist();
    };
    q.stop = function () { radios.forEach(function (r) { r.disabled = false; }); clearTimeout(boardT); };

    const game = function () { return cfg.game(); };
    const cardId = function (pos) { return base + '-' + pos; };
    function shownServer(pq) { return pq.shownAt + ph.offset(); }
    function deadline(pq) { return Math.round(shownServer(pq) + (pq.time || GP.SECS) * 1000); }

    function onMsg(m) {
      const g = game(), v = m.v;
      if (!g || cfg.view() !== 'question' || g.phase !== 'question' || !v || typeof v !== 'object') return;
      const pos = g.pos;
      if (v.q !== cardId(pos)) return;
      const cur = g.current().q, pq = g.publicQuestion(), kind = GP.kindOf(cur);
      if (!kind) return;
      let val;
      if (kind === 'opt') {
        if (!Number.isInteger(v.v) || v.v < 0 || v.v >= GP.options(cur, pq).length) return;
        val = v.v;
      } else {
        if (typeof v.v !== 'string') return;
        val = v.v.replace(/\s+/g, ' ').trim().slice(0, 80);
        if (!val) return;
      }
      const at = typeof m.at === 'number' ? m.at : ph.serverNow();
      if (at > deadline(pq) + GP.GRACE) return;
      const r = res[pos] = res[pos] || {};
      if (r[m.id] && kind === 'opt') return;
      const ms = Math.max(0, at - shownServer(pq));
      r[m.id] = { v: val, ms: ms, n: ph.kit.nick(m.id), t: solo ? '' : ph.teamName(m.id) };
      if (!solo) {
        const team = r[m.id].t, c = counted[pos] = counted[pos] || {};
        if (team && (!c[team] || c[team] === m.id)) {
          const out = g.submit({ team: team, value: GP.coreValue(cur, val), at: pq.shownAt + ms });
          if (out.accepted) c[team] = m.id;
        }
      }
      ph.persist();
      cfg.publish();
      drawStatus();
    }
    function onJoin(p) {
      const g = game();
      if (g && cfg.view() === 'end' && endSent) { const d = endDirects()[p.id]; if (d) ph.direct(p.id, d); }
    }

    /* ----- standings ----- */
    function revealedUpTo(upto) {
      const out = [];
      Object.keys(res).forEach(function (k) { const pos = Number(k); if (pos <= upto && meta[pos] && meta[pos].done) out.push(pos); });
      return out;
    }
    /** Rows {id, n, p, ct} over the questions revealed up to `upto`. */
    function rowsUpTo(upto) {
      const g = game();
      if (!solo) {
        const st = g ? g.toJSON() : { marks: {} };
        return g.teams().map(function (t) {
          let ct = 0;
          revealedUpTo(upto).forEach(function (pos) {
            const id = (counted[pos] || {})[t.name], k = meta[pos].k;
            if (id && st.marks[k] && st.marks[k][t.name] && res[pos][id]) ct += res[pos][id].ms;
          });
          return { id: t.name, n: t.name, p: t.score, ct: ct };
        });
      }
      const tot = {};
      revealedUpTo(upto).forEach(function (pos) {
        Object.keys(res[pos]).forEach(function (id) {
          const a = res[pos][id], x = tot[id] = tot[id] || { id: id, n: a.n, p: 0, ct: 0, tm: 0 };
          x.n = a.n || x.n; x.p += a.pts || 0; x.tm += a.ms; if (a.ok) x.ct += a.ms;
        });
      });
      return Object.keys(tot).map(function (id) { return tot[id]; });
    }
    q.standings = function (upto) { const g = game(); return GP.standings(rowsUpTo(upto === undefined ? (g ? g.length : 0) : upto)); };
    function board(limit) {
      const g = game(), pos = g.pos;
      const now = GP.standings(rowsUpTo(g.length)).slice(0, limit);
      const before = GP.standings(rowsUpTo(pos - 1)).filter(function (x) { return x.p > 0; });
      const was = new Map(before.map(function (x, i) { return [x.id, i]; }));
      return now.map(function (x) { return { n: x.n || '—', p: x.p, r: x.r, s: secs(x.ct), w: was.has(x.id) ? was.get(x.id) : -1 }; });
    }

    /* ----- the reveal ----- */
    /** After the host's Reveal: phone answers marked, typed answers told, the top 5 a moment later. */
    q.reveal = function () {
      const g = game();
      if (!g || !ph.live) return;
      const pos = g.pos, cur = g.current().q, r = res[pos] || {};
      const m = meta[pos] = meta[pos] || info(g);
      m.done = true;
      const marked = GP.score(C, cur, r, { closest: cfg.closest() });
      const marks = g.toJSON().marks[m.k] || {};
      Object.keys(r).forEach(function (id) {
        r[id].ok = marked[id].ok;
        if (solo) r[id].pts = marked[id].pts;
        else r[id].pts = (counted[pos] || {})[r[id].t] === id ? (marks[r[id].t] || 0) : 0;
        if (GP.kindOf(cur) === 'text') ph.direct(id, { q: cardId(pos), ok: r[id].ok ? 1 : 0 });
      });
      ph.persist();
      clearTimeout(boardT);
      boardT = setTimeout(function () { if (game() && game().pos === pos && cfg.view() === 'reveal') { boardAt[pos] = true; cfg.publish(); } }, GP.BOARD_MS);
      drawStatus();
    };
    function info(g) {
      const c = g.current(), pq = g.publicQuestion();
      return { k: c.ri + '.' + c.qi, round: c.round.name, prompt: c.q.prompt, type: c.q.type, o: GP.kindOf(c.q) === 'opt' ? GP.options(c.q, pq) : null };
    }

    /* ----- the phones' card and the TV, from the game's state ----- */
    function cardFor(view, g) {
      if (!g) return { k: 'wait' };
      const pos = g.pos, c = g.current(), cur = c.q, pq = g.publicQuestion();
      if (view === 'round') return { k: 'look', id: base + '-r' + pos, q: 'Round ' + pq.roundNo + ': ' + pq.round };
      if (view === 'end') return { k: 'end', id: 'end', q: cfg.quizTitle(), w: L().firsts(q.standings()) || undefined };
      const kind = GP.kindOf(cur);
      const head = pq.prompt;
      if (!kind) return { k: 'look', id: cardId(pos), q: head };
      const done = view !== 'question' || g.phase !== 'question';
      if (!meta[pos]) meta[pos] = info(g);
      if (kind === 'opt') {
        const card = { k: 'quiz', id: cardId(pos), q: head, o: GP.options(cur, pq), e: deadline(pq) };
        if (done) { card.cl = 1; card.rv = { a: GP.rightIndex(cur) }; }
        return card;
      }
      const card = { k: 'oe', id: cardId(pos), q: head, l: 80, ch: 1 };
      if (done || ph.serverNow() > deadline(pq)) card.cl = 1;
      return card;
    }
    let closeT = 0;
    /**
     * Called by the page's publish(): sends the phones their card and adds
     * what the TV shows of the phones to the stage state (st.ph), switching
     * the view to the top 5 or the podium when it is their turn.
     */
    q.decorate = function (st, view) {
      drawStatus();
      if (!ph.live) return st;
      const g = game();
      ph.card(cardFor(view, g));
      st.ph = { join: ph.join(), solo: solo };
      if (!g) {
        st.view = 'idle';
        if (!solo) st.ph.teams = ph.teamCounts();
        return st;
      }
      const pos = g.pos, kind = GP.kindOf(g.current().q);
      clearTimeout(closeT);
      if (view === 'question' && kind) {
        const n = Object.keys(res[pos] || {}).length;
        st.ph.n = solo ? n : Object.keys(counted[pos] || {}).length;
        st.ph.of = solo ? Math.max(n, ph.kit.players.size) : g.teams().length;
        /* typed answers close at the deadline (the quiz card closes itself on the phones) */
        if (kind === 'text') { const left = deadline(g.publicQuestion()) + 50 - ph.serverNow(); if (left > 0) closeT = setTimeout(cfg.publish, left); }
      }
      if (view === 'end') {
        const rows = q.standings();
        st.view = 'final';
        st.ph.rows = rows.slice(0, 5).map(function (x) { return { n: x.n || '—', p: x.p, r: x.r, s: secs(x.ct) }; });
        st.ph.title = cfg.quizTitle();
        sendEnd(rows);
      } else if ((view === 'reveal' && boardAt[pos]) || (st.view === 'scores' && solo)) {
        st.view = 'board';
        st.ph.rows = board(5);
        st.ph.title = STR.top5;
      }
      return st;
    };
    function endDirects() {
      const rows = q.standings(), out = {};
      if (solo) rows.forEach(function (x) { out[x.id] = { q: 'end', t: x.p, r: x.r, of: rows.length, tm: x.ct, fin: 1 }; });
      else {
        const byTeam = {};
        rows.forEach(function (x) { byTeam[x.id] = x; });
        ph.kit.players.forEach(function (n, id) { const x = byTeam[ph.teamName(id)]; if (x) out[id] = { q: 'end', t: x.p, r: x.r, of: rows.length, tm: x.ct, fin: 1 }; });
      }
      return out;
    }
    function sendEnd(rows) {
      const key = JSON.stringify(rows.map(function (x) { return [x.id, x.p, x.r]; }));
      if (key === endSent) return;
      endSent = key;
      const d = endDirects();
      Object.keys(d).forEach(function (id) { ph.direct(id, d[id]); });
    }

    /* ----- the host's view ----- */
    function drawStatus() {
      statusEl.textContent = '';
      const g = game();
      csvB.hidden = !Object.keys(res).length;
      if (!ph.live || !g) return;
      const pos = g.pos, kind = GP.kindOf(g.current().q), v = cfg.view();
      let text = '';
      if (v === 'question') text = kind ? (solo ? STR.answered(Object.keys(res[pos] || {}).length, Math.max(Object.keys(res[pos] || {}).length, ph.kit.players.size)) : STR.teamsAnswered(Object.keys(counted[pos] || {}).length, g.teams().length)) + ' on phones.' : 'The phones say “Look at the screen” for this question.';
      else if (v === 'reveal') text = boardAt[pos] ? 'The big screen shows the top 5.' : 'The answer is on the big screen and the phones.';
      else if (v === 'end') text = 'The big screen shows the winner; every phone shows its place.';
      statusEl.appendChild(K.el('p', 'game-msg', text));
      if (solo && v !== 'round') {
        const top = q.standings().slice(0, 5);
        if (top.length) {
          const ol = K.el('ol', 'gp-top');
          top.forEach(function (x) { ol.appendChild(K.el('li', null, x.r + '. ' + (x.n || '—') + ' — ' + STR.pts(x.p) + ' · ' + STR.secs(secs(x.ct)))); });
          statusEl.appendChild(ol);
        }
      }
    }

    /* ----- CSV: every phone's answers, then the standings ----- */
    q.csvRows = function () {
      const rows = [['Question', 'Round', 'Question text', solo ? 'Player' : 'Phone', 'Team', 'Answer', 'Right', 'Points', 'Seconds', 'Counted for the team']];
      const g = game(), marks = g && !solo ? g.toJSON().marks : {};
      Object.keys(res).map(Number).sort(function (a, b) { return a - b; }).forEach(function (pos) {
        const m = meta[pos] || {}, r = res[pos];
        Object.keys(r).sort(function (a, b) { return r[a].ms - r[b].ms; }).forEach(function (id) {
          const a = r[id];
          const ans = m.o ? m.o[a.v] : a.v, isIt = !solo && (counted[pos] || {})[a.t] === id;
          /* in teams the counted phone carries its team's mark as it stands now (the host may have changed it) */
          const pts = solo ? (a.pts || 0) : isIt ? ((marks[m.k] || {})[a.t] || 0) : 0;
          rows.push([pos + 1, m.round || '', m.prompt || '', a.n, a.t || '', ans, m.done ? (a.ok ? 'yes' : 'no') : '', m.done ? pts : '', secs(a.ms), solo ? '' : (isIt ? 'yes' : 'no')]);
        });
      });
      rows.push([]);
      rows.push(['Place', solo ? 'Player' : 'Team', 'Points', 'Seconds on right answers']);
      q.standings().forEach(function (x) { rows.push([x.r, x.n, x.p, secs(x.ct)]); });
      return rows;
    };
    q.onMsg = onMsg;
    Object.defineProperty(q, 'results', { get: function () { return res; } });
    return q;
  };

  /* ---------- the Quiz Buzzer ---------- */

  /**
   * GP.buzzer(cfg) → the phones of the buzzer page. cfg: { teams() → names,
   * press(team, at, nick) (at on this browser's clock), publish() }.
   */
  GP.buzzer = function (cfg) {
    let armed = null, armN = 0, base = '';
    const log = [];
    const bz = {};
    const ph = GP.session({
      slug: 'quiz-buzzer', title: function () { return 'Quiz Buzzer'; }, keys: false,
      teams: cfg.teams, teamMode: function () { return true; },
      onMsg: onMsg,
      onChange: function () { cfg.publish(); },
      save: function () { return { base: base, armN: armN }; },
      onRestore: function (g) { if (g) { base = g.base || ''; armN = g.armN || 0; } }
    });
    bz.ph = ph; bz.el = ph.el;
    Object.defineProperty(bz, 'live', { get: function () { return ph.live; } });
    const cardId = function () { return base + '-' + armN; };
    function onMsg(m) {
      const v = m.v;
      if (!v || typeof v !== 'object' || v.q !== cardId() || !armed) return;
      const team = ph.team(m.id);
      if (team < 0) return;
      const at = typeof m.at === 'number' ? m.at : ph.serverNow();
      log.push({ id: m.id, at: at, team: team });
      cfg.press(team, GP.toLocal(at, ph.offset()), ph.kit.nick(m.id));
    }
    /**
     * Called by the page's publish(): g is the buzzer's state, lab its label,
     * who the winner's words ("Ann (Team 2)" or "Team 2"). A new open state
     * (Reset, or Wrong) arms a new card; a buzz closes it with the winner.
     */
    bz.sync = function (g, lab, who) {
      if (!ph.live) return null;
      if (!base) base = L().newId();
      if (g.phase === 'open' && g !== armed && lab !== 'allOut') { armed = g; armN++; log.length = 0; ph.persist(); }
      if (lab === 'allOut') armed = null;
      const out = (g.locked || []).map(function (t) { return cfg.teams()[t]; }).filter(Boolean);
      const card = { k: 'buzz', id: cardId(), q: out.length ? 'Buzz when you know the answer. Out until Reset: ' + out.join(', ') : 'Buzz when you know the answer' };
      if (g.phase === 'open' && lab !== 'allOut') card.open = 1;
      else if (who) card.rv = { w: who };
      ph.card(card);
      return { join: ph.join(), counts: ph.teamCounts().map(function (x) { return x[1]; }) };
    };
    bz.onMsg = onMsg;
    bz.log = log;
    return bz;
  };
})(typeof window !== 'undefined' ? window : this);
