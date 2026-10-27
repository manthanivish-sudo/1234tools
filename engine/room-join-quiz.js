/**
 * The quiz-answer and buzzer cards of /join/ (engine/room-join.js), fetched
 * only when the presenter shows one. room-join.js passes its helpers in `x`
 * (heading, el, btn, note, setNote, send, remember, t, buzzHaptic, LETTERS,
 * mine(), me()). Card shapes: engine/room-kit.js.
 */
(function () {
  'use strict';
  window.MVRJoinCards = function (x) {
    return {
      quiz: function (s, box) {
        x.heading(box, s);
        var opts = x.el('div', 'opts'), bs = [], st = s, timer = 0;
        (s.o || []).forEach(function (o, i) {
          var b = x.btn('', 'opt', function () {
            if (x.mine()[st.id] !== undefined || st.cl || st.rv || over()) return;
            x.send({ q: st.id, v: i, at: x.me().serverNow() });
            x.remember(st.id, i);
            x.buzzHaptic();
            paint();
          });
          b.style.setProperty('--oc', 'var(--o' + ((i % 6) + 1) + ')');
          b.appendChild(x.el('span', 'l', x.LETTERS[i] || String(i + 1)));
          b.appendChild(x.el('span', 't', o));
          opts.appendChild(b); bs.push(b);
        });
        box.appendChild(opts);
        var n = x.note(box), clock = x.el('p', 'hint');
        box.appendChild(clock);
        function over() { return st.e && x.me() && x.me().serverNow() >= st.e; }
        function tick() {
          if (!st.e || st.rv) { clock.textContent = ''; return; }
          var left = Math.ceil((st.e - x.me().serverNow()) / 1000);
          clock.textContent = left > 0 ? x.t('secs', { n: left }) : x.t('timeUp');
          if (left > 0) timer = setTimeout(tick, 250); else paint();
        }
        function paint() {
          var m = x.mine()[st.id];
          bs.forEach(function (b, i) {
            b.setAttribute('aria-pressed', String(m === i));
            b.disabled = m !== undefined || !!st.cl || !!st.rv || !!over();
            if (st.rv && st.rv.a === i) b.style.borderColor = 'var(--ok)';
          });
          if (st.rv && m !== undefined) x.setNote(n, m === st.rv.a ? x.t('quizRight') : x.t('quizWrong'), m === st.rv.a ? 'ok' : 'bad');
          else x.setNote(n, m !== undefined ? x.t('quizSent') : st.cl ? x.t('closed') : '', m !== undefined ? 'ok' : '');
        }
        return { update: function (s2) { st = s2; clearTimeout(timer); tick(); paint(); } };
      },

      buzz: function (s, box) {
        x.heading(box, s);
        var st = s;
        var b = x.btn(x.t('buzz'), 'big');
        b.addEventListener('pointerdown', function (e) { e.preventDefault(); press(); });
        b.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); press(); } });
        box.appendChild(b);
        var n = x.note(box);
        function press() {
          if (!st.open || x.mine()[st.id]) return;
          x.send({ q: st.id, v: 1, at: x.me().serverNow() });
          x.remember(st.id, 1);
          x.buzzHaptic();
          paint();
        }
        function paint() {
          b.disabled = !st.open || !!x.mine()[st.id];
          b.textContent = st.open ? x.t('buzz') : x.t('buzzWait');
          if (st.rv && st.rv.w) x.setNote(n, x.t('first', { w: st.rv.w }), 'ok');
          else x.setNote(n, x.mine()[st.id] ? x.t('buzzed') : '', 'ok');
        }
        return { update: function (s2) { st = s2; paint(); } };
      }
    };
  };
})();
