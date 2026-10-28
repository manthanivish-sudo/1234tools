/**
 * The presenter's kit for the live tools under /live/ (window.LiveKit), on
 * top of engine/game-kit.js (stage, buttons, download) and
 * engine/room-client.js (the relay connection, window.MVRRoom).
 *
 * Nothing contacts the relay until the presenter presses "Start a live
 * session". Then the room is created at live.1234tools.com, the join banner
 * shows 1234tools.com/join, the six-digit code and a QR code drawn on this
 * device by the site's own QR engine (engine/qr.bundle.js, loaded on that
 * click). Every answer is counted here, in the presenter's browser, keyed by
 * the phone's id, so one phone has one vote; the relay only carries frames
 * and keeps the last public card in memory for phones that join late.
 *
 * The card shapes (state.v), shared with engine/room-join.js:
 *   every card: k (wait|poll|wc|qa|rt|quiz|buzz), id (a new id means a new
 *     card), q (the question text), cl:1 (answers closed)
 *   poll: o[] options, ch:1 (a phone may change its vote),
 *         rv:{c:[counts], n} (only when the presenter shows results on phones)
 *   wc:   n (1-3 words per phone), l:25 (characters), rv:[[word,count],…] (top 20)
 *   qa:   qs:{qid:{t,v,a}} (approved questions only, keyed so a vote is a tiny
 *         patch), up:1 (upvotes allowed), l:280, ap:1 (approval queue on)
 *   rt:   s:'stars'|'ten'|'slider' (slider 0-10), lo, hi (end labels),
 *         rv:{a:average, n, h:[counts]}
 *   quiz: o[], e (deadline in server ms), rv:{a:correct index}
 *   buzz: open:1, rv:{w:nickname}
 *   Live Presentation (phone side in engine/room-join-deck.js, lazy):
 *   mc:   o[], m (most choices, when more than 1), ch:1, rv:{c:[counts], n, a:[correct indexes]}
 *   dq:   o[], e (deadline in server ms), rv:{a:[correct], c:[counts], n} once the question is done
 *   oe:   l (characters), ch:1 (a phone may replace its answer)
 *   lb:   the leaderboard; look: a content slide (phones show "look at the screen")
 *   end:  id 'end', q (deck title), w (the winner's nickname(s), after a quiz): the finale
 *         after the last slide; its direct has q:'end' and fin:1
 *   presenter -> one phone (direct): {q:card id, t:total points, r:rank, of:players,
 *     tm:total ms of right answers, p:points and ms:answer time on a quiz, fin:1 at the end}
 *   phone -> presenter: {q:id, v:value} (quiz and buzz add at: server ms);
 *     Q&A: {q:id, ask:text} or {q:id, up:qid, on:1|0}
 *
 * Data discipline: setCard() sends a full `state` (a new question); patch()
 * sends a merge patch, folded with others for about 150 ms so a burst of
 * votes becomes one frame; the client library then folds a frame's worth.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.LiveKit) return;
  const K = window.GameKit;
  const L = window.LiveKit = {};

  const STR = {
    start: 'Start a live session',
    startHint: 'Nothing is sent anywhere until you press Start. Then phones can join with a code.',
    starting: 'Starting…',
    resume: 'Reopen session {code}',
    resumeHint: 'This tab ran a session a moment ago. Reopen it to carry on with the same code and results.',
    joinAt: 'Join at',
    code: 'Code',
    joined: '{n} joined',
    joinedCap: '{n} joined (of {cap})',
    lock: 'Lock  (L)',
    unlock: 'Unlock  (L)',
    locked: 'Locked: nobody new can join. People already in can reconnect.',
    end: 'End session',
    endSure: 'Press again to end',
    copyLink: 'Copy join link',
    copied: 'Copied',
    newSession: 'Start a new session',
    people: 'People ({n})',
    remove: 'Remove',
    noPeople: 'Nobody has joined yet.',
    showJoin: 'Show the join code on the big screen',
    open: 'Live',
    connecting: 'Connecting…',
    reconnecting: 'Reconnecting…',
    offline: 'Not connected',
    ended: 'Session ended. The results stay on this page until you leave it — export them now if you need them.',
    leaveWarn: 'Leaving this page ends your view of the results.',
    why: {
      host: 'You ended the session. Every phone has been told.',
      expired: 'The session reached its 24-hour limit and closed.',
      'host-gone': 'The session closed because this page was away for more than 30 minutes.',
      'bad-key': 'The session could not be reopened. Start a new one.',
      'no-room': 'That session has already closed. Start a new one.',
      hosts: 'This session is already open in four windows. Close one and try again.',
      rate: 'Too many sessions were started from this connection in a minute. Wait a minute and try again.',
      'create-failed': 'The live server could not be reached. Check the connection and press Start again.'
    },
    stageJoin: 'Go to',
    stageCode: 'and type',
    stageWait: 'Waiting for the first question…'
  };
  L.STR = STR;
  const fmt = (s, a) => s.replace(/\{(\w+)\}/g, (m, k) => (a && a[k] !== undefined ? a[k] : m));
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  /* ---------- the relay address ---------- */

  /** ?relay= is honoured only when this page is served from this computer
      (development and tests); on the site it is always live.1234tools.com. */
  L.endpoint = function () {
    const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    const r = local ? new URLSearchParams(location.search).get('relay') : null;
    return r && /^https?:\/\/[^\s/]+$/.test(r) ? r : undefined;
  };
  /** { href, label } for the join page with this code after the #. */
  L.joinUrl = function (code) {
    const ep = L.endpoint();
    const site = /(^|\.)1234tools\.com$/.test(location.hostname);
    return {
      href: location.origin + '/join/' + (ep ? '?relay=' + encodeURIComponent(ep) : '') + '#' + code,
      label: site ? '1234tools.com/join' : location.host + '/join'
    };
  };
  L.spaced = (code) => String(code).replace(/^(\d{3})(\d{3})$/, '$1 $2');

  /* ---------- CSV, made in this browser ---------- */

  /** One cell: a leading = + - @ (or tab, carriage return) would be read as a
      formula by a spreadsheet, so it gets an apostrophe in front. */
  L.csvCell = function (v) {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  L.csv = (rows) => rows.map((r) => r.map(L.csvCell).join(',')).join('\r\n') + '\r\n';
  L.downloadCsv = function (name, rows) {
    K.download(new Blob(['﻿' + L.csv(rows)], { type: 'text/csv;charset=utf-8' }), name);
  };

  /* ---------- the QR code, drawn here ---------- */

  const loaded = {};
  L.loadScript = function (src) {
    if (!loaded[src]) {
      loaded[src] = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('could not load ' + src)); };
        document.head.appendChild(s);
      });
    }
    return loaded[src];
  };
  /** The QR code for `text` as rows of '0'/'1' (small enough for the stage channel). */
  L.qrRows = function (text) {
    return L.loadScript('/engine/qr.bundle.js').then(() => window.encodeQR(text, 'M').matrix.map((r) => r.map((x) => (x ? 1 : 0)).join('')));
  };
  /** Draws rows onto a canvas: black on white with the four-module quiet zone. */
  L.drawQR = function (canvas, rows, px) {
    const n = rows.length, quiet = 4, total = n + quiet * 2;
    const scale = Math.max(1, Math.floor((px || 200) / total));
    canvas.width = canvas.height = total * scale;
    const c = canvas.getContext('2d');
    if (!c) return;
    c.fillStyle = '#fff'; c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = '#000';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (rows[y][x] === '1') c.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
  };

  /* ---------- the big screen ---------- */

  /**
   * The stage's frame: a join strip (when the presenter shows it) and the
   * main area, made once and reused, so a vote redraws only the results.
   * Returns the main element.
   */
  L.stageFrame = function (body, join) {
    let f = body._live;
    if (!f || !body.contains(f.wrap)) {
      body.textContent = '';
      const wrap = K.el('div', 'st-live');
      const strip = K.el('div', 'st-join');
      const main = K.el('div', 'st-main');
      wrap.appendChild(strip); wrap.appendChild(main);
      body.appendChild(wrap);
      f = body._live = { wrap, strip, main, key: '' };
    }
    const key = join ? join.code + '|' + join.n + '|' + join.label : '';
    if (key !== f.key) {
      f.key = key;
      f.strip.textContent = '';
      f.strip.hidden = !join;
      if (join) {
        const words = K.el('p', 'st-join-text');
        words.appendChild(document.createTextNode(STR.stageJoin + ' '));
        words.appendChild(K.el('strong', null, join.label));
        words.appendChild(document.createTextNode(' ' + STR.stageCode + ' '));
        words.appendChild(K.el('strong', 'st-join-code', L.spaced(join.code)));
        f.strip.appendChild(words);
        if (join.n !== undefined) f.strip.appendChild(K.el('p', 'st-join-count', fmt(STR.joined, { n: join.n })));
        if (join.qr) {
          const cv = K.el('canvas', 'st-join-qr');
          cv.setAttribute('role', 'img');
          cv.setAttribute('aria-label', 'QR code for ' + join.label);
          L.drawQR(cv, join.qr, 360);
          f.strip.appendChild(cv);
        }
      }
    }
    return f.main;
  };

  /* ---------- the leaderboard, the podium and confetti (Live Presentation and the quiz games) ---------- */

  /** Ranked rows [{n, p, r, s, w}] (name, points, rank, seconds, place before
      the last question or -1) as the big screen's list; with fin the first
      three are on a podium, so the list starts at fourth place. o: { pts(p), time(s) }. */
  L.lbList = function (main, rows, fin, o) {
    const ol = K.el('ol', 'deck-lb' + (fin ? ' is-rest' : ''));
    ol.style.setProperty('--rows', String(Math.max(rows.length, 1)));
    rows.forEach((x, i) => {
      const li = K.el('li');
      const at = fin ? i + 3 : i;
      /* rows slide in from where they stood after the previous question */
      if (x.w >= 0 && x.w !== at) li.style.setProperty('--from', String(x.w - at));
      else if (x.w < 0) li.classList.add('is-new');
      li.appendChild(K.el('b', null, String(x.r)));
      li.appendChild(K.el('span', null, x.n));
      li.appendChild(K.el('strong', null, o.pts(x.p)));
      li.appendChild(K.el('small', null, o.time(x.s)));
      ol.appendChild(li);
    });
    if (rows.length) main.appendChild(ol);
    return ol;
  };
  /** Third, second and first place on blocks (with win they rise one by one). line(x) is the text under a name. */
  L.podium = function (main, rows, win, line) {
    const pod = K.el('div', 'deck-podium' + (win ? ' is-win' : ''));
    [1, 0, 2].forEach((i) => {
      const x = rows[i];
      if (!x) return;
      const col = K.el('div', 'deck-step is-' + (i + 1));
      col.appendChild(K.el('span', 'deck-step-nick', x.n));
      col.appendChild(K.el('span', 'deck-step-pts', line(x)));
      col.appendChild(K.el('b', 'deck-step-block', String(x.r)));
      pod.appendChild(col);
    });
    main.appendChild(pod);
    return pod;
  };
  /** Confetti over the big screen, falling once from `delay` seconds (app.css hides it for reduced motion). */
  L.confetti = function (main, delay) {
    const box = K.el('div', 'deck-confetti');
    box.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 120; i++) {
      const p = K.el('i');
      p.style.cssText = '--x:' + (Math.random() * 100).toFixed(1) + '%;--d:' + (delay + Math.random() * 2.4).toFixed(2) + 's;--t:' + (2.8 + Math.random() * 2.4).toFixed(2) +
        's;--dx:' + Math.round(Math.random() * 200 - 100) + 'px;--r:' + Math.round(Math.random() * 1080 - 540) + 'deg;--c:var(--t' + ((i % 8) + 1) + ')';
      box.appendChild(p);
    }
    main.appendChild(box);
    return box;
  };
  /** The winner's name(s): everyone ranked first, joined with " & ". */
  L.firsts = (rows) => rows.filter((x) => x.r === 1).map((x) => x.n).join(' & ');

  /* ---------- a bigger room on a paid plan ---------- */

  /** The relay's plan token for a signed-in presenter on a paid plan, or ''
      for a free room. Only a visitor who has signed in on this device (the
      flag assets/account.js keeps) loads the account code and asks our
      functions; anybody else gets '' at once, with nothing loaded and
      nothing sent. Any failure, or no answer within L.PLAN_WAIT ms, is ''
      too: the room opens all the same, at the free cap. */
  L.PLAN_WAIT = 5000;
  L.planToken = function () {
    let flag = null;
    try { flag = window.localStorage.getItem('1234tools.signedIn'); } catch (e) { /* no storage: never signed in here */ }
    if (flag !== '1') return Promise.resolve('');
    const ask = (window.Account ? Promise.resolve() : L.loadScript('/assets/firebase-config.js').then(() => L.loadScript('/assets/account.js')))
      .then(() => (window.Account && typeof window.Account.liveToken === 'function' ? window.Account.liveToken() : ''));
    return Promise.race([ask, new Promise((res) => setTimeout(() => res(''), L.PLAN_WAIT))])
      .then((t) => (typeof t === 'string' && t.length < 2048 ? t : ''), () => '');
  };

  /* ---------- the session ---------- */

  let seq = 0;
  /** A card id: new for every question, never reused after a reload. */
  L.newId = () => (Date.now() % 1e9).toString(36) + (seq++).toString(36);

  /**
   * L.session({ slug, title, onMsg(m), onJoin(p), onLeft(p), onChange(),
   *             onRestore(saved), onEnd(reason), keys }) →
   *   { el, live, room, join, setCard(v), patch(p), card, save(obj),
   *     players, count, nick(id) }
   *
   * `el` is the panel to put on the page. m is {id, nick, at, v}.
   * onChange is called whenever what the big screen shows of the session
   * changes (the code, the count, the strip switched on or off).
   * keys:false leaves the L key alone (a page whose letters are buzzers).
   */
  L.session = function (opts) {
    const MVR = window.MVRRoom;
    const ep = L.endpoint();
    const roomOpts = ep ? { endpoint: ep } : {};
    const saveKey = 'mvr-live:' + opts.slug;
    const ctl = { live: false, room: null, join: null, card: undefined, players: new Map(), count: 0, cap: 100 };
    let qr = null, link = null, showJoin = true, pend = null, timer = 0, saveTimer = 0, saving = null, armed = 0;

    const el = K.el('section', 'game-panel live-panel');
    el.setAttribute('aria-label', 'Live session');
    ctl.el = el;
    const before = K.el('div', 'live-before');
    const startB = K.button(STR.start, 'btn-primary game-big live-start', () => start(null));
    before.appendChild(startB);
    before.appendChild(K.el('p', 'game-msg', STR.startHint));
    const resumeRow = K.el('div', 'live-resume');
    resumeRow.hidden = true;
    before.appendChild(resumeRow);
    const during = K.el('div', 'live-during');
    during.hidden = true;
    const banner = K.el('div', 'live-banner');
    const words = K.el('div', 'live-banner-words');
    words.appendChild(K.el('span', 'live-banner-label', STR.joinAt));
    const urlEl = K.el('strong', 'live-url', '');
    words.appendChild(urlEl);
    words.appendChild(K.el('span', 'live-banner-label', STR.code));
    const codeEl = K.el('strong', 'live-code', '');
    codeEl.setAttribute('data-live-code', '');
    words.appendChild(codeEl);
    const qrBox = K.el('canvas', 'live-qr');
    qrBox.setAttribute('role', 'img');
    banner.appendChild(words); banner.appendChild(qrBox);
    during.appendChild(banner);
    const statusRow = K.el('div', 'game-row live-status');
    const pill = K.el('span', 'live-pill', STR.connecting);
    pill.setAttribute('role', 'status');
    const countEl = K.el('span', 'live-count', '');
    countEl.setAttribute('aria-live', 'polite');
    statusRow.appendChild(pill); statusRow.appendChild(countEl);
    during.appendChild(statusRow);
    const lockMsg = K.el('p', 'game-msg is-warn', STR.locked);
    lockMsg.hidden = true;
    during.appendChild(lockMsg);
    const ctrls = K.el('div', 'game-row');
    const lockB = K.button(STR.lock, 'btn-ghost live-lock', () => toggleLock());
    lockB.setAttribute('aria-pressed', 'false');
    const copyB = K.button(STR.copyLink, 'btn-ghost', () => {
      if (!link) return;
      K.copy(link.href).then(() => { copyB.textContent = STR.copied; setTimeout(() => { copyB.textContent = STR.copyLink; }, 1600); });
    });
    const endB = K.button(STR.end, 'btn-ghost live-end', () => {
      if (Date.now() - armed < 4000) return finish();
      armed = Date.now();
      endB.textContent = STR.endSure;
      setTimeout(() => { if (Date.now() - armed >= 4000) endB.textContent = STR.end; }, 4100);
    });
    ctrls.appendChild(lockB); ctrls.appendChild(copyB); ctrls.appendChild(endB);
    during.appendChild(ctrls);
    const showL = K.el('label', 'game-check');
    const showC = K.el('input'); showC.type = 'checkbox'; showC.checked = true;
    showL.appendChild(showC); showL.appendChild(document.createTextNode(STR.showJoin));
    showC.addEventListener('change', () => { showJoin = showC.checked; changed(); });
    during.appendChild(showL);
    const people = K.el('details', 'live-people');
    const peopleS = K.el('summary', null, fmt(STR.people, { n: 0 }));
    const peopleL = K.el('ul');
    people.appendChild(peopleS); people.appendChild(peopleL);
    people.addEventListener('toggle', drawPeople);
    during.appendChild(people);
    const msg = K.el('p', 'game-msg live-msg');
    msg.setAttribute('role', 'status');
    el.appendChild(K.el('h2', null, 'Live session'));
    el.appendChild(before); el.appendChild(during); el.appendChild(msg);

    function changed() { if (opts.onChange) opts.onChange(); }
    function say(text) { msg.textContent = text || ''; }
    const cleanNick = (n) => (window.RoomWords ? window.RoomWords.mask(n || '') : n || '');
    ctl.nick = (id) => cleanNick(ctl.players.get(id) || '');

    function drawCount() {
      ctl.count = ctl.players.size;
      countEl.textContent = fmt(STR.joinedCap, { n: ctl.count, cap: ctl.cap });
      peopleS.textContent = fmt(STR.people, { n: ctl.count });
      if (people.open) drawPeople();
      ctl.join = link && showJoin ? { label: link.label, code: ctl.room.code, qr: qr, n: ctl.count } : null;
      changed();
    }
    function drawPeople() {
      if (!people.open) return;
      peopleL.textContent = '';
      if (!ctl.players.size) { peopleL.appendChild(K.el('li', 'game-msg', STR.noPeople)); return; }
      ctl.players.forEach((nick, id) => {
        const li = K.el('li');
        li.appendChild(K.el('span', null, cleanNick(nick)));
        li.appendChild(K.button(STR.remove, 'btn-ghost', () => { if (ctl.room) ctl.room.kick(id); ctl.players.delete(id); if (opts.onLeft) opts.onLeft({ id, k: 1 }); drawCount(); }));
        peopleL.appendChild(li);
      });
    }
    function setPill(s) {
      pill.textContent = s === 'open' ? STR.open : s === 'reconnecting' ? STR.reconnecting : s === 'closed' ? STR.offline : STR.connecting;
      pill.className = 'live-pill' + (s === 'open' ? ' is-on' : s === 'closed' ? ' is-off' : '');
    }
    function toggleLock() {
      if (!ctl.room || !ctl.live) return;
      const on = !ctl.room.locked;
      ctl.room.lock(on);
      lockB.textContent = on ? STR.unlock : STR.lock;
      lockB.setAttribute('aria-pressed', String(on));
      lockMsg.hidden = !on;
      K.announce(el, on ? STR.locked : '');
    }

    function start(resume) {
      if (ctl.live || ctl.starting || !MVR) return;
      K.sound.unlock();
      startB.disabled = true;
      startB.textContent = STR.starting;
      say('');
      /* a reopened room keeps the cap it was made with; a new one asks for a plan token first */
      if (resume) { open(true, ''); return; }
      ctl.starting = true;
      L.planToken().then((plan) => { ctl.starting = false; open(false, plan); });
    }
    function open(resume, plan) {
      const room = resume ? MVR.resume(roomOpts) : MVR.create(Object.assign({ title: opts.title || '' }, roomOpts, plan ? { plan } : {}));
      if (!room) { startB.disabled = false; startB.textContent = STR.start; resumeRow.hidden = true; return; }
      ctl.room = room;
      if (ctl.card !== undefined) room.setState(ctl.card);
      room.on('status', setPill);
      room.on('ready', (r) => {
        const first = !ctl.live;
        ctl.live = true;
        ctl.cap = r.cap || 100;
        ctl.players = new Map(room.players);
        before.hidden = true; during.hidden = false;
        link = L.joinUrl(r.code);
        urlEl.textContent = link.label;
        codeEl.textContent = L.spaced(r.code);
        qrBox.setAttribute('aria-label', 'QR code for ' + link.label + ', code ' + r.code);
        lockB.textContent = room.locked ? STR.unlock : STR.lock;
        lockMsg.hidden = !room.locked;
        setPill('open');
        if (first) {
          K.wakeLock(true);
          try { sessionStorage.setItem(saveKey, JSON.stringify({ code: r.code, saved: saving })); } catch (e) { /* private window */ }
          L.qrRows(link.href).then((rows) => { qr = rows; L.drawQR(qrBox, rows, 168); drawCount(); }).catch(() => { qrBox.hidden = true; });
          K.announce(el, 'Session live. Code ' + r.code);
        }
        drawCount();
        if (opts.onStart && first) opts.onStart(r);
      });
      room.on('joined', (p) => { ctl.players.set(p.id, p.nick); drawCount(); if (opts.onJoin) opts.onJoin(p); });
      room.on('left', (p) => { ctl.players.delete(p.id); drawCount(); if (opts.onLeft) opts.onLeft(p); });
      room.on('msg', (m) => { if (opts.onMsg) opts.onMsg(m); });
      room.on('closed', (e) => ended(e && e.reason));
    }
    function finish() {
      if (ctl.room) ctl.room.close();
    }
    function ended(reason) {
      clearTimeout(timer); pend = null;
      const was = ctl.live;
      ctl.live = false; ctl.join = null; link = null; qr = null; ctl.room = null;
      try { sessionStorage.removeItem(saveKey); } catch (e) { /* private window */ }
      K.wakeLock(false);
      before.hidden = false; during.hidden = true;
      startB.disabled = false;
      startB.textContent = was ? STR.newSession : STR.start;
      resumeRow.hidden = true;
      say(STR.why[reason] ? STR.why[reason] + (was ? ' ' + STR.ended : '') : (was ? STR.ended : STR.why['create-failed']));
      K.announce(el, msg.textContent);
      changed();
      if (opts.onEnd) opts.onEnd(reason, was);
    }

    /* ---------- what the phones see ---------- */

    function fold(a, b) {
      for (const k in b) {
        if (!Object.prototype.hasOwnProperty.call(b, k) || k === '__proto__') continue;
        if (isObj(b[k]) && isObj(a[k])) fold(a[k], b[k]);
        else a[k] = isObj(b[k]) ? JSON.parse(JSON.stringify(b[k])) : b[k];
      }
      return a;
    }
    /** A new card for the phones: one full `state`. */
    ctl.setCard = function (v) {
      clearTimeout(timer); pend = null;
      ctl.card = JSON.parse(JSON.stringify(v));
      if (ctl.room) ctl.room.setState(ctl.card);
      return ctl;
    };
    /** A change to the current card, sent within about 150 ms with any others. */
    ctl.patch = function (p) {
      if (ctl.card === undefined) return ctl;
      ctl.card = window.MVRRoom.merge(ctl.card, JSON.parse(JSON.stringify(p)));
      pend = fold(pend || {}, p);
      if (!timer) {
        timer = setTimeout(() => {
          timer = 0;
          const out = pend; pend = null;
          if (out && ctl.room) ctl.room.patch(out);
        }, 150);
      }
      return ctl;
    };
    /** Keep the tool's results in this tab, so Reopen after a reload has them. */
    ctl.save = function (obj) {
      saving = obj;
      if (saveTimer) return;
      saveTimer = setTimeout(() => {
        saveTimer = 0;
        if (!ctl.live || !ctl.room) return;
        try { sessionStorage.setItem(saveKey, JSON.stringify({ code: ctl.room.code, saved: saving })); } catch (e) { /* private window or full */ }
      }, 500);
    };
    ctl.end = finish;
    ctl.toggleLock = toggleLock;
    ctl.start = () => start(null);

    /* offer to reopen the room this tab had before a reload */
    let mine = null, host = null;
    try { mine = JSON.parse(sessionStorage.getItem(saveKey) || 'null'); host = JSON.parse(sessionStorage.getItem('mvr-host') || 'null'); } catch (e) { /* none */ }
    if (mine && host && mine.code === host.code && host.expiresAt > Date.now() && (host.endpoint || '') === ((ep || 'https://live.1234tools.com').replace(/\/+$/, ''))) {
      resumeRow.hidden = false;
      resumeRow.appendChild(K.button(fmt(STR.resume, { code: L.spaced(mine.code) }), 'btn-ghost', () => {
        if (mine.saved && opts.onRestore) opts.onRestore(mine.saved);
        saving = mine.saved;
        start(true);
      }));
      resumeRow.appendChild(K.el('p', 'game-msg', STR.resumeHint));
    }

    if (opts.keys !== false) document.addEventListener('keydown', (e) => {
      if (!ctl.live || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'l' || e.key === 'L') { e.preventDefault(); toggleLock(); }
    });
    window.addEventListener('beforeunload', (e) => { if (ctl.live) { e.preventDefault(); e.returnValue = STR.leaveWarn; } });
    return ctl;
  };

  /* ---------- small shared helpers for the tools ---------- */

  /** Mean, spread (population standard deviation), min and max of numbers. */
  L.stats = function (nums) {
    const n = nums.length;
    if (!n) return { n: 0, mean: 0, sd: 0, min: null, max: null };
    let sum = 0, min = Infinity, max = -Infinity;
    for (const x of nums) { sum += x; if (x < min) min = x; if (x > max) max = x; }
    const mean = sum / n;
    let sq = 0;
    for (const x of nums) sq += (x - mean) * (x - mean);
    return { n, mean, sd: Math.sqrt(sq / n), min, max };
  };
  /** A file name for an export: slug, date and time, no characters that trouble a file system. */
  L.fileName = (slug) => slug + '-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.csv';
})();
