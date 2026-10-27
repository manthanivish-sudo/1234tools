/**
 * The phone side of a 1234Tools live session: /join/. The code comes after the
 * # (never sent to a server, never in a log) or is typed; the participant picks
 * a nickname and then sees one card at a time for what the presenter runs.
 * The presenter's browser does all the counting; this page shows the question
 * it is sent and sends back this phone's own answer through the relay
 * (engine/room-client.js). The card shapes are documented in engine/room-kit.js.
 * English strings are in STR; Hindi ones in engine/room-join-hi.js.
 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  var STR = {
    en: {
      title: 'Join a live session', badge: 'Live — answers pass through our server',
      codeLabel: 'The 6-digit code on the presenter\'s screen', nickLabel: 'Nickname (optional)',
      random: 'Random nickname', nickHint: 'Use a nickname, not your real name. The presenter\'s screen may show it.',
      join: 'Join', leave: 'Leave the session', endTitle: 'Session over', again: 'Join another session',
      fPrivacy: 'Privacy', fTerms: 'Terms', fRun: 'Run your own session',
      checking: 'Checking the code…', found: 'Found: {t}', foundNoTitle: 'Session found. Pick a nickname and join.',
      needCode: 'Type all six digits of the code.', joining: 'Joining…',
      connected: 'Connected', connecting: 'Connecting…', reconnecting: 'Reconnecting…', offline: 'Offline',
      youAre: 'You are {n}', people: '{n} here',
      wait: 'You\'re in! Wait for the presenter\'s question.', hostAway: 'The presenter\'s screen has dropped out. It usually comes back in a moment.',
      voteSent: 'Vote sent.', voteChange: 'Vote sent. Tap another answer to change it.', voteLocked: 'Vote sent. This poll does not allow changes.',
      closed: 'Answers are closed.', votes: '{n} votes', results: 'Results',
      wordPh: 'One to three words', wordSend: 'Send', wordsLeft: '{u} of {n} sent', wordsDone: 'All your words are in. Thank you!',
      wordLong: 'Up to {l} characters.', wordSame: 'You already sent that.', topWords: 'Top answers',
      askPh: 'Your question', ask: 'Send question', askSent: 'Sent. The presenter checks questions before they appear here.', askLive: 'Sent. It is on the board now.',
      askLeft: '{n} characters left', qsNone: 'No questions on the board yet.', qsTitle: 'Questions', upvote: 'Upvote', answered: 'Answered',
      rateSent: 'Rating sent. You can change it until answers close.', rateSend: 'Send rating', average: 'Average {a} from {n}',
      stars: '{n} stars', star: '1 star',
      quizSent: 'Answer locked in.', quizRight: 'Correct!', quizWrong: 'Not this time.', secs: '{n} s left', timeUp: 'Time\'s up.',
      buzz: 'BUZZ', buzzWait: 'Wait for the buzzers to open', buzzed: 'Buzzed! The presenter can see who was first.', first: 'First: {w}',
      slow: 'Slow down a little: that was a lot of taps.',
      r_host: 'The presenter ended the session.', r_expired: 'The session reached its 24-hour limit and closed.',
      r_hostgone: 'The presenter left, so the session closed.', r_kicked: 'The presenter removed you from this session.',
      r_replaced: 'You joined this session from another tab or window, so this one stopped.',
      r_full: 'This session is full. Ask the presenter for a bigger room.', r_locked: 'The presenter has locked this session to new people.',
      r_noroom: 'No session with this code. Check the code on the presenter\'s screen.', r_badnick: 'That nickname cannot be used. Try another (1 to 24 characters).',
      r_left: 'You left the session.', r_policy: 'The connection was refused. Reload the page to try again.',
      r_other: 'The connection closed. Reload the page to try again.',
      privacyHi: ''
    }
    /* hi: engine/room-join-hi.js, fetched only when Hindi is chosen */
  };
  var ADJ = ['Happy', 'Brave', 'Sunny', 'Clever', 'Swift', 'Jolly', 'Calm', 'Lucky', 'Bright', 'Gentle', 'Bold', 'Cheerful', 'Witty', 'Mighty', 'Kind', 'Zippy'];
  var ANIMAL = ['Panda', 'Tiger', 'Mango', 'Peacock', 'Otter', 'Falcon', 'Koala', 'Dolphin', 'Lion', 'Parrot', 'Elephant', 'Fox', 'Owl', 'Rabbit', 'Cheetah', 'Penguin'];
  var LETTERS = 'ABCDEFGHIJ';
  var CLOSE_KEY = { host: 'r_host', expired: 'r_expired', 'host-gone': 'r_hostgone', kicked: 'r_kicked', replaced: 'r_replaced', full: 'r_full', locked: 'r_locked', 'no-room': 'r_noroom', 'bad-nick': 'r_badnick', left: 'r_left', policy: 'r_policy' };

  var lang = 'en';
  try { lang = localStorage.getItem('mvr-join-lang') || (/^hi\b/i.test(navigator.language || '') ? 'hi' : 'en'); } catch (e) { /* storage blocked */ }
  if (lang !== 'hi') lang = 'en';
  function t(k, a) {
    var s = (STR[lang] && STR[lang][k]) || STR.en[k] || k;
    return a ? s.replace(/\{(\w+)\}/g, function (m, x) { return a[x] !== undefined ? a[x] : m; }) : s;
  }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function btn(label, cls, fn) { var b = el('button', cls, label); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  function buzzHaptic() { try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* none */ } }
  function sget(k) { try { var v = sessionStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function sset(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  function sdel(k) { try { sessionStorage.removeItem(k); } catch (e) { /* private mode */ } }

  /* The relay. ?relay= is honoured only when this page itself is served from
     this computer (development and tests); on the site it is always ours. */
  function endpoint() {
    var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    var r = local ? new URLSearchParams(location.search).get('relay') : null;
    return r && /^https?:\/\/[^\s/]+$/.test(r) ? r : undefined;
  }
  var EP = endpoint();
  var OPT = EP ? { endpoint: EP } : {};

  /* ---------- language ---------- */

  /* Hindi strings arrive on demand; until they do, English stands in. */
  var hiLoading = null;
  function loadHi() {
    if (STR.hi) return Promise.resolve();
    if (!hiLoading) hiLoading = new Promise(function (res) {
      var sc = document.createElement('script');
      sc.src = '/engine/room-join-hi.js';
      sc.onload = function () { STR.hi = window.MVRJoinHi || null; res(); };
      sc.onerror = function () { res(); };
      document.head.appendChild(sc);
    });
    return hiLoading;
  }
  function setLang(l) {
    lang = l === 'hi' ? 'hi' : 'en';
    applyLang();
    if (lang === 'hi' && !STR.hi) loadHi().then(applyLang);
  }
  function applyLang() {
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en-GB';
    var nodes = document.querySelectorAll('[data-s]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = t(nodes[i].getAttribute('data-s'));
    var lb = $('lang');
    lb.textContent = lang === 'hi' ? 'English' : 'हिंदी';
    lb.setAttribute('lang', lang === 'hi' ? 'en' : 'hi');
    lb.setAttribute('aria-label', lang === 'hi' ? 'View in English' : 'हिंदी में देखें');
    var ph = $('priv-hi');
    ph.textContent = STR.hi ? STR.hi.privacyHi : '';
    ph.hidden = lang !== 'hi' || !STR.hi;
    if (me) { renderTop(); if (card) draw(true); }
  }

  /* ---------- the code boxes ---------- */

  var boxes = Array.prototype.slice.call(document.querySelectorAll('#code input'));
  function code() { return boxes.map(function (b) { return b.value; }).join(''); }
  function fill(digits, from) {
    var d = String(digits).replace(/\D/g, '');
    var i = from || 0;
    for (var k = 0; k < d.length && i < 6; k++, i++) boxes[i].value = d[k];
    return i;
  }
  var infoSeq = 0;
  function onCodeChange() {
    var c = code();
    msg('code-msg', '');
    if (c.length !== 6) return;
    var seq = ++infoSeq;
    msg('code-msg', t('checking'));
    window.MVRRoom.info(c, OPT).then(function (r) {
      if (seq !== infoSeq) return;
      /* a busy shared network (a school's one address) can hit the lookup limit: Join still works */
      if (r && r.error) return msg('code-msg', '');
      if (!r || !r.open) return msg('code-msg', t('r_noroom'), 'bad');
      if (r.locked) return msg('code-msg', t('r_locked'), 'bad');
      if (r.full) return msg('code-msg', t('r_full'), 'bad');
      msg('code-msg', r.title ? t('found', { t: r.title }) : t('foundNoTitle'), 'ok');
    }).catch(function () { if (seq === infoSeq) msg('code-msg', ''); });
  }
  boxes.forEach(function (b, i) {
    b.addEventListener('input', function () {
      var v = b.value.replace(/\D/g, '');
      if (v.length > 1) { var end = fill(v, i); boxes[Math.min(end, 5)].focus(); }
      else { b.value = v; if (v && i < 5) boxes[i + 1].focus(); }
      onCodeChange();
    });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && !b.value && i > 0) { boxes[i - 1].value = ''; boxes[i - 1].focus(); e.preventDefault(); onCodeChange(); }
      else if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
      else if (e.key === 'ArrowRight' && i < 5) boxes[i + 1].focus();
      else if (e.key === 'Enter') start();
    });
    b.addEventListener('paste', function (e) {
      var txt = (e.clipboardData || window.clipboardData).getData('text');
      if (!txt) return;
      e.preventDefault();
      var end = fill(txt, i);
      boxes[Math.min(end, 5)].focus();
      onCodeChange();
    });
    b.addEventListener('focus', function () { b.select(); });
  });

  function msg(id, text, kind) { var m = $(id); m.textContent = text || ''; m.className = 'msg' + (kind ? ' ' + kind : ''); }
  function randomNick() {
    var a = new Uint32Array(2);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return ADJ[a[0] % ADJ.length] + ' ' + ANIMAL[a[1] % ANIMAL.length];
  }

  /* ---------- joining ---------- */

  var me = null, card = null, cur = null, roomCode = '', count = 0, hostOn = true, status = 'idle';
  var mine = {};   // this phone's own answers, by question id: survives a reload in this tab

  function show(which) {
    $('s-code').hidden = which !== 'code';
    $('s-room').hidden = which !== 'room';
    $('s-end').hidden = which !== 'end';
  }
  function start(nickArg) {
    var c = code();
    if (!/^\d{6}$/.test(c)) { msg('code-msg', t('needCode'), 'bad'); boxes[Math.min(c.length, 5)].focus(); return; }
    if (!window.MVRRoom) return;
    var nick = (typeof nickArg === 'string' ? nickArg : $('nick').value).replace(/\s+/g, ' ').trim() || randomNick();
    $('nick').value = nick;
    msg('code-msg', t('joining'));
    $('go').disabled = true;
    roomCode = c;
    try { history.replaceState(null, '', location.pathname + location.search + '#' + c); } catch (e) { /* file:// */ }
    mine = sget('mvr-join-mine:' + c) || {};
    me = window.MVRRoom.join(c, nick, OPT);
    me.on('welcome', function () {
      sset('mvr-join', { code: c, nick: nick });
      show('room');
      renderTop();
      if (me.state === undefined) { cur = { k: 'wait' }; draw(true); }
    });
    me.on('state', function (s) { cur = s && typeof s === 'object' ? s : { k: 'wait' }; draw(false); });
    me.on('count', function (n) { count = n; renderTop(); });
    me.on('host', function (on) { hostOn = on; msg('room-msg', on ? '' : t('hostAway')); });
    me.on('status', function (s) { status = s; renderTop(); });
    me.on('error', function (c2) { if (c2 === 'rate') msg('room-msg', t('slow'), 'bad'); else if (c2 === 'host-away' || c2 === 'no-host') msg('room-msg', t('hostAway')); });
    me.on('closed', function (e) { end(e && e.reason); });
    me.on('direct', function (v) { API.dv = v; if (card && card.direct) card.direct(v); });
  }
  function end(reason) {
    var r = reason || 'other';
    if (r !== 'replaced') { sdel('mvr-join'); sdel('mvr-join-mine:' + roomCode); }
    $('go').disabled = false;
    if (!$('s-code').hidden && (r === 'no-room' || r === 'full' || r === 'locked' || r === 'bad-nick')) {
      msg('code-msg', t(CLOSE_KEY[r]), 'bad');
      me = null;
      return;
    }
    me = null; card = null; cur = null;
    $('end-msg').textContent = t(CLOSE_KEY[r] || 'r_other');
    show('end');
  }
  function renderTop() {
    if (!me) return;
    $('who').textContent = t('youAre', { n: me.nick }) + (count ? ' · ' + t('people', { n: count }) : '');
    var p = $('conn');
    var s = status === 'open' ? 'connected' : status === 'reconnecting' ? 'reconnecting' : status === 'closed' ? 'offline' : 'connecting';
    p.textContent = t(s);
    p.className = 'pill' + (s === 'connected' ? '' : s === 'offline' ? ' off' : ' wait');
  }
  function remember(id, v) { mine[id] = v; sset('mvr-join-mine:' + roomCode, mine); }
  function send(v) { return me ? me.send(v) : false; }

  /* ---------- cards ---------- */

  /* Quiz and buzzer cards: engine/room-join-quiz.js; Live Presentation
     cards: room-join-deck.js. Each is fetched when first shown. */
  var EXT = { quiz: 'quiz', buzz: 'quiz', mc: 'deck', oe: 'deck', dq: 'deck', lb: 'deck', look: 'deck' }, extLoading = {};
  var API = { heading: heading, el: el, btn: btn, note: note, setNote: setNote, send: send, remember: remember, t: t, buzzHaptic: buzzHaptic, LETTERS: LETTERS,
    mine: function () { return mine; }, me: function () { return me; } };
  function loadExt(f) {
    if (!extLoading[f]) extLoading[f] = new Promise(function (res) {
      var sc = document.createElement('script');
      sc.src = '/engine/room-join-' + f + '.js';
      sc.onload = function () { if (window.MVRJoinCards) { var c = window.MVRJoinCards(API); for (var k in c) CARDS[k] = c[k]; } res(); };
      sc.onerror = function () { extLoading[f] = null; res(); };
      document.head.appendChild(sc);
    });
    return extLoading[f];
  }


  /* A new question (a new kind or id) builds a fresh card; anything else
     (a reveal, a closed flag, a new approved question) updates it in place. */
  function draw(force) {
    var s = cur || { k: 'wait' };
    if (!CARDS[s.k] && EXT[s.k]) { var want = s.k; loadExt(EXT[want]).then(function () { if (CARDS[want] && cur && cur.k === want) draw(true); }); s = { k: 'wait', id: s.id }; }
    var box = $('card');
    if (force || !card || card.k !== s.k || card.id !== s.id) {
      box.textContent = '';
      var make = CARDS[s.k] || CARDS.wait;
      card = make(s, box);
      card.k = s.k; card.id = s.id;
      if (s.k !== 'wait' && !force) buzzHaptic();
    }
    if (card.update) card.update(s);
  }
  function heading(box, s) { if (s.q) box.appendChild(el('h2', null, s.q)); }
  function note(box) { var p = el('p', 'msg'); p.setAttribute('role', 'status'); box.appendChild(p); return p; }
  function setNote(p, text, kind) { p.textContent = text || ''; p.className = 'msg' + (kind ? ' ' + kind : ''); }
  function pct(n, d) { return d ? Math.round(n * 100 / d) : 0; }

  var CARDS = {
    wait: function (s, box) { box.appendChild(el('p', null, t('wait'))); return {}; },

    poll: function (s, box) {
      heading(box, s);
      var opts = el('div', 'opts'), bs = [];
      (s.o || []).forEach(function (o, i) {
        var b = btn('', 'opt', function () { pick(i); });
        b.style.setProperty('--oc', 'var(--o' + ((i % 6) + 1) + ')');
        var f = el('span', 'fill'); f.style.width = '0';
        b.appendChild(f);
        b.appendChild(el('span', 'l', LETTERS[i] || String(i + 1)));
        b.appendChild(el('span', 't', o));
        b.appendChild(el('span', 'n', ''));
        b.setAttribute('aria-pressed', 'false');
        opts.appendChild(b); bs.push(b);
      });
      box.appendChild(opts);
      var n = note(box), st = s;
      function pick(i) {
        if (st.cl) return;
        var had = mine[st.id];
        if (had !== undefined && (!st.ch || had === i)) return;
        buzzHaptic();
        send({ q: st.id, v: i });
        remember(st.id, i);
        paint();
      }
      function paint() {
        var m = mine[st.id];
        bs.forEach(function (b, i) {
          b.setAttribute('aria-pressed', String(m === i));
          b.disabled = !!st.cl || (m !== undefined && !st.ch && m !== i);
          var rv = st.rv;
          b.querySelector('.fill').style.width = rv ? pct(rv.c[i] || 0, rv.n) + '%' : '0';
          b.querySelector('.n').textContent = rv ? pct(rv.c[i] || 0, rv.n) + '%' : '';
        });
        if (st.cl) setNote(n, t('closed'));
        else if (m !== undefined) setNote(n, st.ch ? t('voteChange') : t('voteLocked'), 'ok');
        else setNote(n, '');
        if (st.rv) n.textContent += (n.textContent ? ' ' : '') + t('votes', { n: st.rv.n });
      }
      return { update: function (s2) { st = s2; paint(); } };
    },

    wc: function (s, box) {
      heading(box, s);
      var lim = Math.max(1, Math.min(3, s.n || 1)), maxL = s.l || 25;
      var row = el('div', 'row');
      var inp = el('input', 'txt');
      inp.maxLength = maxL; inp.placeholder = t('wordPh'); inp.autocomplete = 'off'; inp.enterKeyHint = 'send';
      inp.setAttribute('aria-label', s.q || t('wordPh'));
      var go = btn(t('wordSend'), 'small', submit);
      row.appendChild(inp); row.appendChild(go);
      box.appendChild(row);
      var chipsMine = el('div', 'chips');
      box.appendChild(chipsMine);
      var n = note(box), top = el('div'), st = s;
      box.appendChild(top);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      function list() { return mine[st.id] || []; }
      function submit() {
        if (st.cl) return;
        var w = inp.value.replace(/\s+/g, ' ').trim();
        if (!w) return;
        if (w.length > maxL) return setNote(n, t('wordLong', { l: maxL }), 'bad');
        var have = list();
        if (have.length >= lim) return;
        var key = w.toLowerCase().replace(/\s+/g, '');
        if (have.some(function (x) { return x.toLowerCase().replace(/\s+/g, '') === key; })) return setNote(n, t('wordSame'), 'bad');
        send({ q: st.id, v: w });
        remember(st.id, have.concat([w]));
        inp.value = '';
        buzzHaptic();
        paint();
        if (list().length < lim) inp.focus();
      }
      function paint() {
        var have = list();
        chipsMine.textContent = '';
        have.forEach(function (w) { chipsMine.appendChild(el('span', null, w)); });
        var done = have.length >= lim;
        inp.disabled = go.disabled = done || !!st.cl;
        if (st.cl) setNote(n, t('closed'));
        else setNote(n, done ? t('wordsDone') : t('wordsLeft', { u: have.length, n: lim }), done ? 'ok' : '');
        top.textContent = '';
        if (Array.isArray(st.rv) && st.rv.length) {
          top.appendChild(el('h2', null, t('topWords')));
          var c = el('div', 'chips');
          var most = st.rv[0][1] || 1;
          st.rv.forEach(function (p) { var sp = el('span', null, p[0] + ' · ' + p[1]); sp.style.fontSize = (0.85 + 0.6 * p[1] / most).toFixed(2) + 'em'; c.appendChild(sp); });
          top.appendChild(c);
        }
      }
      return { update: function (s2) { st = s2; paint(); } };
    },

    qa: function (s, box) {
      heading(box, s);
      var maxL = s.l || 280;
      var ta = el('textarea', 'txt');
      ta.maxLength = maxL; ta.placeholder = t('askPh'); ta.setAttribute('aria-label', t('askPh'));
      box.appendChild(ta);
      var left = el('p', 'hint');
      box.appendChild(left);
      var go = btn(t('ask'), 'pri', submit);
      go.style.marginTop = '10px';
      box.appendChild(go);
      var n = note(box);
      var h = el('h2', null, t('qsTitle')); h.style.marginTop = '18px';
      box.appendChild(h);
      var ul = el('ul', 'list'), none = el('p', 'hint', t('qsNone'));
      box.appendChild(none); box.appendChild(ul);
      var st = s, rows = {};
      var ups = mine[s.id + ':up'] || {};
      ta.addEventListener('input', function () { left.textContent = t('askLeft', { n: maxL - ta.value.length }); });
      left.textContent = t('askLeft', { n: maxL });
      function submit() {
        if (st.cl) return;
        var q = ta.value.replace(/\s+/g, ' ').trim();
        if (!q) return;
        send({ q: st.id, ask: q.slice(0, maxL) });
        ta.value = ''; left.textContent = t('askLeft', { n: maxL });
        buzzHaptic();
        setNote(n, t(st.ap ? 'askSent' : 'askLive'), 'ok');
      }
      function vote(qid) {
        if (!st.up) return;
        var on = !ups[qid];
        if (on) ups[qid] = 1; else delete ups[qid];
        remember(st.id + ':up', ups);
        send({ q: st.id, up: qid, on: on ? 1 : 0 });
        buzzHaptic();
        paint();
      }
      function paint() {
        var qs = st.qs || {};
        var ids = Object.keys(qs).sort(function (a, b) { return (qs[a].a || 0) - (qs[b].a || 0) || (qs[b].v || 0) - (qs[a].v || 0) || Number(a) - Number(b); });
        none.hidden = ids.length > 0;
        Object.keys(rows).forEach(function (k) { if (!qs[k]) { rows[k].li.remove(); delete rows[k]; } });
        ids.forEach(function (k) {
          var q = qs[k], r = rows[k];
          if (!r) {
            var li = el('li');
            var tx = el('span', 'q', q.t);
            var b = btn('', 'small up', function () { vote(k); });
            li.appendChild(tx); li.appendChild(b);
            r = rows[k] = { li: li, tx: tx, b: b };
          }
          r.tx.textContent = q.t + (q.a ? ' — ' + t('answered') : '');
          r.li.className = q.a ? 'done' : '';
          r.b.textContent = '▲ ' + (q.v || 0);
          r.b.setAttribute('aria-pressed', String(!!ups[k]));
          r.b.setAttribute('aria-label', t('upvote') + ' (' + (q.v || 0) + ')');
          r.b.hidden = !st.up;
          r.b.disabled = !!q.a;
          ul.appendChild(r.li);   // re-appending in order moves only what moved
        });
        ta.disabled = go.disabled = !!st.cl;
        if (st.cl) setNote(n, t('closed'));
      }
      return { update: function (s2) { st = s2; paint(); } };
    },

    rt: function (s, box) {
      heading(box, s);
      var st = s, kind = s.s === 'ten' || s.s === 'slider' ? s.s : 'stars', bs = [];
      var n, rng, out;
      function rate(v) {
        if (st.cl) return;
        send({ q: st.id, v: v });
        remember(st.id, v);
        buzzHaptic();
        paint();
      }
      if (kind === 'stars') {
        var row = el('div', 'stars');
        for (var i = 1; i <= 5; i++) {
          (function (v) {
            var b = btn('★', 'star', function () { rate(v); });
            b.setAttribute('aria-label', v === 1 ? t('star') : t('stars', { n: v }));
            row.appendChild(b); bs.push(b);
          })(i);
        }
        box.appendChild(row);
      } else if (kind === 'ten') {
        var g = el('div', 'tens');
        for (var j = 0; j <= 10; j++) (function (v) { var b = btn(String(v), '', function () { rate(v); }); g.appendChild(b); bs.push(b); })(j);
        box.appendChild(g);
      } else {
        rng = el('input');
        rng.type = 'range'; rng.min = '0'; rng.max = '10'; rng.step = '1';
        rng.value = String(mine[s.id] !== undefined ? mine[s.id] : 5);
        rng.setAttribute('aria-label', s.q || t('rateSend'));
        out = el('p', null, rng.value); out.style.cssText = 'text-align:center;font-size:2rem;font-weight:800;margin:6px 0';
        rng.addEventListener('input', function () { out.textContent = rng.value; });
        box.appendChild(out); box.appendChild(rng);
        var go = btn(t('rateSend'), 'pri', function () { rate(Number(rng.value)); });
        go.style.marginTop = '12px';
        bs.push(go);
        box.appendChild(go);
      }
      if (kind !== 'stars' || s.lo || s.hi) {
        var ends = el('div', 'ends');
        ends.appendChild(el('span', null, s.lo || (kind === 'stars' ? '' : '0')));
        ends.appendChild(el('span', null, s.hi || (kind === 'stars' ? '' : '10')));
        box.appendChild(ends);
      }
      n = note(box);
      var hist = el('div', 'hist');
      box.appendChild(hist);
      function paint() {
        var m = mine[st.id];
        if (kind === 'stars') bs.forEach(function (b, i) { b.setAttribute('aria-pressed', String(m !== undefined && i < m)); b.disabled = !!st.cl; });
        else if (kind === 'ten') bs.forEach(function (b, i) { b.setAttribute('aria-pressed', String(m === i)); b.disabled = !!st.cl; });
        else { rng.disabled = bs[0].disabled = !!st.cl; }
        setNote(n, st.cl ? t('closed') : m !== undefined ? t('rateSent') : '', st.cl ? '' : 'ok');
        hist.textContent = '';
        if (st.rv && st.rv.n) {
          hist.appendChild(el('strong', null, t('average', { a: st.rv.a, n: st.rv.n })));
          var most = Math.max.apply(null, st.rv.h.concat([1]));
          st.rv.h.forEach(function (c, i) {
            var d = el('div');
            d.appendChild(el('span', null, String(kind === 'stars' ? i + 1 : i)));
            var bar = el('i'); bar.style.width = (c * 70 / most) + '%';
            d.appendChild(bar);
            d.appendChild(el('span', null, String(c)));
            hist.appendChild(d);
          });
        }
      }
      return { update: function (s2) { st = s2; paint(); } };
    }
  };

  /* ---------- start ---------- */

  function boot() {
    setLang(lang);
    $('lang').addEventListener('click', function () {
      var next = lang === 'hi' ? 'en' : 'hi';
      try { localStorage.setItem('mvr-join-lang', next); } catch (e) { /* storage blocked */ }
      setLang(next);
    });
    $('rnd').addEventListener('click', function () { $('nick').value = randomNick(); });
    $('go').addEventListener('click', function () { start(); });
    $('nick').addEventListener('keydown', function (e) { if (e.key === 'Enter') start(); });
    $('leave').addEventListener('click', function () { if (me) me.leave(); });
    $('again').addEventListener('click', function () {
      boxes.forEach(function (b) { b.value = ''; });
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* file:// */ }
      msg('code-msg', '');
      show('code');
      boxes[0].focus();
    });
    var m = /^#(\d{6})$/.exec(location.hash);
    if (m) {
      fill(m[1], 0);
      var back = sget('mvr-join');
      /* a reload in this tab rejoins at once, with the same id and answers */
      if (back && back.code === m[1] && back.nick) { start(back.nick); return; }
      onCodeChange();
      $('nick').focus();
    } else boxes[0].focus();
  }
  window.MVRJoin = { STR: STR, randomNick: randomNick, cards: CARDS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
