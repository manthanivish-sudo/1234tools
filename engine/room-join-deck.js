/**
 * The Live Presentation cards of /join/ (engine/room-join.js), fetched only
 * when the presenter shows one: multiple choice with one or several answers
 * (mc), an open-ended typed answer (oe), a timed quiz question with points
 * (dq), the leaderboard (lb), "look at the screen" for a content slide
 * (look) and the finale after the last slide, with confetti (end). The quiz
 * games use oe for typed answers (the verdict comes in a direct {q, ok}). room-join.js passes its helpers in `x` (heading, el, btn, note,
 * setNote, send, remember, t, buzzHaptic, LETTERS, mine(), me(), and dv:
 * the last `direct` message from the presenter). Card shapes:
 * engine/room-kit.js.
 */
(function () {
  'use strict';
  var S = {
    en: {
      upTo: 'Choose up to {m}, then press Send.', send: 'Send', sent: 'Your answer was sent.',
      sentChange: 'Your answer was sent. You can change it until voting closes.',
      typePh: 'Type your answer', left: '{n} characters left', look: 'Look at the screen',
      pts: '+{p} points in {s} s', pts0: '+{p} points', total: 'Total {t} points · {r} of {of} · {tm} s answering', rank: 'You are {r} of {of} with {t} points ({tm} s).',
      won: 'You won! {t} points in {tm} s.', fin: 'You finished {r} of {of} with {t} points ({tm} s).',
      thanks: 'Thank you for taking part!', winIs: 'The winner: {n}'
    },
    hi: {
      upTo: 'ज़्यादा से ज़्यादा {m} चुनें, फिर भेजें दबाएँ।', send: 'भेजें', sent: 'आपका जवाब भेज दिया गया।',
      sentChange: 'आपका जवाब भेज दिया गया। वोटिंग बंद होने तक आप इसे बदल सकते हैं।',
      typePh: 'अपना जवाब लिखें', left: '{n} अक्षर बाक़ी', look: 'स्क्रीन की ओर देखें',
      pts: '+{p} अंक, {s} सेकंड में', pts0: '+{p} अंक', total: 'कुल {t} अंक · {of} में से {r} · {tm} सेकंड', rank: '{of} में से आप {r} हैं, {t} अंकों के साथ ({tm} सेकंड)।',
      won: 'आप जीत गए! {t} अंक, {tm} सेकंड में।', fin: '{of} में से आप {r} रहे, {t} अंकों के साथ ({tm} सेकंड)।',
      thanks: 'भाग लेने के लिए धन्यवाद!', winIs: 'विजेता: {n}'
    }
  };
  function s(k, a) {
    var l = document.documentElement.lang === 'hi' ? 'hi' : 'en';
    var v = S[l][k] || S.en[k];
    return a ? v.replace(/\{(\w+)\}/g, function (m, n) { return a[n] !== undefined ? a[n] : m; }) : v;
  }
  function pct(n, d) { return d ? Math.round(n * 100 / d) : 0; }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function sec(ms) { return (Math.round((ms || 0) / 100) / 10).toFixed(1); }
  /* the phone's own place: "You won!" or its final place at the end of the quiz */
  function place(v, key) {
    var a = { r: v.r, of: v.of, t: v.t, tm: sec(v.tm) };
    return v.fin ? s(v.r === 1 ? 'won' : 'fin', a) : s(key, a);
  }

  /* confetti falling once over the phone; none with reduced motion (inline styles: /join/ keeps its CSS small) */
  var COLS = ['#f4b400', '#e8453c', '#3d7cf2', '#1aa260', '#a64bd6', '#ff7a45', '#18b5c9', '#f06292'];
  function confetti(n) {
    if (!document.body.animate || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    for (var i = 0; i < n; i++) {
      var p = document.createElement('i'), z = 6 + Math.random() * 6;
      p.setAttribute('aria-hidden', 'true');
      p.style.cssText = 'position:fixed;top:-24px;left:' + (Math.random() * 100).toFixed(1) + 'vw;width:' + z.toFixed(1) + 'px;height:' + (z * 1.6).toFixed(1) +
        'px;background:' + COLS[i % COLS.length] + ';border-radius:2px;pointer-events:none;z-index:9';
      document.body.appendChild(p);
      p.animate([{ transform: 'translate(0,0) rotate(0deg)' }, { transform: 'translate(' + Math.round(Math.random() * 160 - 80) + 'px,110vh) rotate(' + Math.round(Math.random() * 1080 - 540) + 'deg)' }],
        { duration: 2600 + Math.random() * 2200, delay: Math.random() * 1400, easing: 'cubic-bezier(.25,.6,.4,1)', fill: 'both' }).onfinish = (function (el) { return function () { el.remove(); }; })(p);
    }
  }

  window.MVRJoinCards = function (x) {
    /* the option buttons shared by mc and dq, with the result fill and a tick for a correct one */
    function options(box, s0, pick) {
      var wrap = x.el('div', 'opts'), bs = [];
      (s0.o || []).forEach(function (o, i) {
        var b = x.btn('', 'opt', function () { pick(i); });
        b.style.setProperty('--oc', 'var(--o' + ((i % 6) + 1) + ')');
        var f = x.el('span', 'fill'); f.style.width = '0';
        b.appendChild(f);
        b.appendChild(x.el('span', 'l', x.LETTERS[i] || String(i + 1)));
        b.appendChild(x.el('span', 't', o));
        b.appendChild(x.el('span', 'n', ''));
        b.setAttribute('aria-pressed', 'false');
        wrap.appendChild(b); bs.push(b);
      });
      box.appendChild(wrap);
      return bs;
    }
    function results(bs, rv) {
      bs.forEach(function (b, i) {
        var good = rv && rv.a && rv.a.indexOf(i) >= 0;
        b.querySelector('.fill').style.width = rv && rv.c ? pct(rv.c[i] || 0, rv.n) + '%' : '0';
        b.querySelector('.n').textContent = (good ? '✓ ' : '') + (rv && rv.c ? pct(rv.c[i] || 0, rv.n) + '% · ' + (rv.c[i] || 0) : '');
        b.style.borderColor = good ? 'var(--ok)' : '';
      });
    }
    /* "Correct!" when everything this phone chose is a correct answer */
    function verdict(n, m, rv) {
      if (!rv || !rv.a || m === undefined) return false;
      var picks = Array.isArray(m) ? m : [m];
      var good = picks.length > 0 && picks.every(function (i) { return rv.a.indexOf(i) >= 0; });
      x.setNote(n, good ? x.t('quizRight') : x.t('quizWrong'), good ? 'ok' : 'bad');
      return true;
    }
    function scoreLine(p, v, st, withPts) {
      if (!v || v.q !== st.id) { p.textContent = ''; return; }
      p.textContent = (withPts && v.p !== undefined ? (v.ms === undefined ? s('pts0', { p: v.p }) : s('pts', { p: v.p, s: sec(v.ms) })) + ' · ' : '') + place(v, 'total');
    }

    return {
      mc: function (s0, box) {
        x.heading(box, s0);
        var st = s0, sel = null;
        var max = Math.max(1, s0.m || 1);
        var bs = options(box, s0, function (i) {
          if (!can()) return;
          if (max === 1) return submit(i);
          var cur = sel || [];
          var at = cur.indexOf(i);
          if (at >= 0) cur.splice(at, 1); else if (cur.length < max) cur.push(i); else return;
          sel = cur.slice().sort(function (a, b) { return a - b; });
          paint();
        });
        var hint = null, go = null;
        if (max > 1) {
          hint = x.el('p', 'hint', s('upTo', { m: max }));
          box.appendChild(hint);
          go = x.btn(s('send'), 'pri', function () { if (sel && sel.length) submit(sel); });
          go.style.marginTop = '12px';
          box.appendChild(go);
        }
        var n = x.note(box);
        function can() { var m = x.mine()[st.id]; return !st.cl && (m === undefined || !!st.ch); }
        function submit(v) {
          var m = x.mine()[st.id];
          if (!can() || (m !== undefined && same(m, v))) return;
          x.buzzHaptic();
          x.send({ q: st.id, v: v });
          x.remember(st.id, v);
          paint();
        }
        function paint() {
          var m = x.mine()[st.id];
          if (max > 1 && sel === null && Array.isArray(m)) sel = m.slice();
          var open = can();
          bs.forEach(function (b, i) {
            var on = max > 1 ? !!sel && sel.indexOf(i) >= 0 : m === i;
            b.setAttribute('aria-pressed', String(on));
            b.disabled = !open && !on;
          });
          if (go) { go.disabled = !open || !sel || !sel.length || same(sel, m); go.hidden = !open; }
          if (hint) hint.hidden = !open;
          results(bs, st.rv);
          if (verdict(n, m, st.rv)) return;
          if (st.cl) x.setNote(n, x.t('closed'));
          else if (m !== undefined) x.setNote(n, st.ch ? s('sentChange') : s('sent'), 'ok');
          else x.setNote(n, '');
        }
        return { update: function (s2) { st = s2; paint(); } };
      },

      oe: function (s0, box) {
        x.heading(box, s0);
        var st = s0, maxL = s0.l || 200;
        var ta = x.el('textarea', 'txt');
        ta.maxLength = maxL; ta.placeholder = s('typePh');
        ta.setAttribute('aria-label', s('typePh'));
        var had = x.mine()[s0.id];
        if (typeof had === 'string') ta.value = had;
        box.appendChild(ta);
        var left = x.el('p', 'hint', s('left', { n: maxL - ta.value.length }));
        box.appendChild(left);
        ta.addEventListener('input', function () { left.textContent = s('left', { n: maxL - ta.value.length }); paint(); });
        var go = x.btn(s('send'), 'pri', submit);
        go.style.marginTop = '8px';
        box.appendChild(go);
        var n = x.note(box);
        function can() { var m = x.mine()[st.id]; return !st.cl && (m === undefined || !!st.ch); }
        function submit() {
          var v = ta.value.replace(/\s+/g, ' ').trim().slice(0, maxL);
          if (!v || !can() || v === x.mine()[st.id]) return;
          x.send({ q: st.id, v: v });
          x.remember(st.id, v);
          paint();
        }
        function paint() {
          var m = x.mine()[st.id], open = can();
          ta.disabled = !open;
          go.disabled = !open || !ta.value.trim() || ta.value.replace(/\s+/g, ' ').trim() === m;
          go.hidden = !open;
          var v = x.dv;
          /* a typed quiz answer (the quiz games): the presenter's verdict comes as a direct {q, ok} */
          if (m !== undefined && v && v.q === st.id && v.ok !== undefined) x.setNote(n, v.ok ? x.t('quizRight') : x.t('quizWrong'), v.ok ? 'ok' : 'bad');
          else if (st.cl) x.setNote(n, x.t('closed'));
          else if (m !== undefined) x.setNote(n, st.ch ? s('sentChange') : s('sent'), 'ok');
          else x.setNote(n, '');
        }
        return { update: function (s2) { st = s2; paint(); }, direct: paint };
      },

      dq: function (s0, box) {
        x.heading(box, s0);
        var st = s0, timer = 0;
        var bs = options(box, s0, function (i) {
          if (x.mine()[st.id] !== undefined || st.cl || st.rv || over()) return;
          x.send({ q: st.id, v: i, at: x.me().serverNow() });
          x.remember(st.id, i);
          x.buzzHaptic();
          paint();
        });
        var n = x.note(box), clock = x.el('p', 'hint'), score = x.el('p', 'msg ok');
        box.appendChild(clock); box.appendChild(score);
        function over() { return st.e && x.me() && x.me().serverNow() >= st.e; }
        function tick() {
          clearTimeout(timer);
          if (!st.e || st.rv || st.cl) { clock.textContent = ''; return; }
          var left = Math.ceil((st.e - x.me().serverNow()) / 1000);
          clock.textContent = left > 0 ? x.t('secs', { n: left }) : x.t('timeUp');
          if (left > 0) timer = setTimeout(tick, 250); else paint();
        }
        function paint() {
          var m = x.mine()[st.id];
          bs.forEach(function (b, i) {
            b.setAttribute('aria-pressed', String(m === i));
            b.disabled = m !== undefined || !!st.cl || !!st.rv || !!over();
          });
          results(bs, st.rv);
          if (!verdict(n, m, st.rv)) x.setNote(n, m !== undefined ? x.t('quizSent') : st.cl || over() ? x.t('closed') : '', m !== undefined ? 'ok' : '');
          scoreLine(score, st.rv ? x.dv : null, st, true);
        }
        return {
          update: function (s2) { st = s2; tick(); paint(); },
          direct: function () { paint(); }
        };
      },

      lb: function (s0, box) {
        x.heading(box, s0);
        box.appendChild(x.el('p', null, s('look')));
        var st = s0, me = x.el('p', 'msg ok');
        me.setAttribute('role', 'status');
        box.appendChild(me);
        function paint() {
          var v = x.dv;
          me.textContent = v && v.q === st.id ? place(v, 'rank') : '';
        }
        return { update: function (s2) { st = s2; paint(); }, direct: paint };
      },

      look: function (s0, box) {
        x.heading(box, s0);
        box.appendChild(x.el('p', 'hint', s('look')));
        return {};
      },

      end: function (s0, box) {
        x.heading(box, s0);
        var st = s0, won = false, w = x.el('h3', null), me = x.el('p', 'msg ok');
        box.appendChild(x.el('p', null, s('thanks')));
        box.appendChild(w);
        me.setAttribute('role', 'status');
        box.appendChild(me);
        confetti(40);
        function paint() {
          var v = x.dv, mine = v && v.q === st.id;
          w.textContent = st.w ? s('winIs', { n: st.w }) : '';
          me.textContent = mine ? place(v, 'rank') : '';
          if (mine && v.r === 1 && !won) { won = true; confetti(140); x.buzzHaptic && x.buzzHaptic(); }
        }
        paint();
        return { update: function (s2) { st = s2; paint(); }, direct: paint };
      }
    };
  };
})();
