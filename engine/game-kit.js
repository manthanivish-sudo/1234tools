/**
 * The shared kit for the quiz and party games under /games/.
 *
 * Every game runs on the visitor's device. This file holds what they all
 * need and nothing a single game needs alone:
 *
 *   - fair randomness: crypto.getRandomValues with rejection sampling, so a
 *     wheel of seven names gives each one exactly a seventh of the chances
 *     (a plain `% n` would favour the low ones); and a seeded generator
 *     (sfc32 over a cyrb128 hash) for anything that must come out the same
 *     again from its number — a Tambola ticket, a bingo card;
 *   - the stage: the same page opened with ?stage=1 in a second window (drag
 *     it to the TV or projector, or cast that tab) shows the big-screen view,
 *     kept in step with the host's page over a BroadcastChannel. No server is
 *     involved: both windows are on this device. Without a second screen the
 *     host can show the stage full screen in the same window instead;
 *   - sound (Web Audio tones, made on the device, no files to fetch), speech
 *     (the browser's own voices), settings kept in localStorage under one
 *     versioned key per game, a screen wake lock, and small DOM helpers.
 *
 * The games send nothing anywhere. A game loads this file and its own
 * engine/game-<slug>.js; both are cached by the service worker after the
 * first visit, so a party with no signal still works.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.GameKit) return;
  const K = window.GameKit = {};

  /* ---------- DOM ---------- */

  K.el = function (tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  };
  K.button = function (label, cls, onClick, title) {
    const b = K.el('button', cls || 'btn-ghost', label);
    b.type = 'button';
    if (title) b.title = title;
    if (onClick) b.addEventListener('click', onClick);
    return b;
  };
  /** A labelled field: returns { wrap, input }. */
  K.field = function (label, input, hint) {
    const wrap = K.el('label', 'game-field');
    wrap.appendChild(K.el('span', 'game-field-label', label));
    wrap.appendChild(input);
    if (hint) wrap.appendChild(K.el('span', 'game-field-hint', hint));
    return { wrap: wrap, input: input };
  };
  K.announce = function (root, text) {
    let live = root.querySelector('.game-live');
    if (!live) { live = K.el('p', 'game-live visually-hidden'); live.setAttribute('aria-live', 'polite'); root.appendChild(live); }
    live.textContent = '';
    setTimeout(function () { live.textContent = text; }, 30);
  };
  K.reducedMotion = function () {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  /* ---------- randomness ---------- */

  const U32 = 4294967296;
  function cryptoU32() {
    const a = new Uint32Array(1);
    window.crypto.getRandomValues(a);
    return a[0];
  }
  /** Fair [0, n) from any source of uniform 32-bit integers: values from the
      top partial block are thrown back, so every result is equally likely. */
  function fairInt(n, u32) {
    if (!(n >= 1) || n > U32) throw new RangeError('randInt: n must be 1..2^32');
    n = Math.floor(n);
    const limit = U32 - (U32 % n);
    let x;
    do { x = u32(); } while (x >= limit);
    return x % n;
  }
  K.randInt = function (n) { return fairInt(n, cryptoU32); };
  /** A shuffled copy (Fisher–Yates). */
  K.shuffle = function (list, intFn) {
    const a = list.slice();
    const pick = intFn || K.randInt;
    for (let i = a.length - 1; i > 0; i--) {
      const j = pick(i + 1);
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  K.pick = function (list) { return list[K.randInt(list.length)]; };

  /* cyrb128 → four 32-bit words, then sfc32: small, fast, and the same in
     every browser, which is what lets a ticket number stand for a ticket. */
  function cyrb128(str) {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  }
  /** A reproducible generator: the same seed gives the same sequence everywhere. */
  K.seeded = function (seed) {
    let [a, b, c, d] = cyrb128(String(seed));
    function u32() {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return t >>> 0;
    }
    for (let i = 0; i < 12; i++) u32();
    const g = {
      u32: u32,
      int: function (n) { return fairInt(n, u32); },
      next: function () { return u32() / U32; },
      shuffle: function (list) { return K.shuffle(list, g.int); }
    };
    return g;
  };
  /** A fresh seed people can read out and type back: no 0/O or 1/I/L. */
  const SEED_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  K.newSeed = function (len) {
    let s = '';
    for (let i = 0; i < (len || 6); i++) s += SEED_CHARS[K.randInt(SEED_CHARS.length)];
    return s;
  };
  K.cleanSeed = function (s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16); };

  /* ---------- lists ---------- */

  /** Names typed one per line (commas and semicolons work too), trimmed,
      empty lines dropped, each cut to `maxLen`, at most `max` of them. */
  K.parseList = function (text, opts) {
    const o = opts || {};
    const max = o.max || 500, maxLen = o.maxLen || 60;
    const sep = o.lines ? /\r?\n/ : /\r?\n|[,;]/;
    return String(text || '').split(sep)
      .map(function (s) { return s.replace(/\s+/g, ' ').trim().slice(0, maxLen); })
      .filter(Boolean).slice(0, max);
  };

  /* ---------- settings on this device ---------- */

  K.store = function (slug, version) {
    const key = 'mvr-games-' + slug + '-v' + (version || 1);
    return {
      get: function (fallback) {
        try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
        catch (e) { return fallback; }
      },
      set: function (value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private window or full */ } },
      clear: function () { try { localStorage.removeItem(key); } catch (e) { /* nothing to clear */ } }
    };
  };

  /* ---------- sound ---------- */

  const prefs = K.store('kit', 1);
  let audio = null;
  function ctx() {
    if (audio) return audio;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { audio = new AC(); } catch (e) { audio = null; }
    return audio;
  }
  K.sound = {
    get on() { return prefs.get({}).sound !== false; },
    set on(v) { const p = prefs.get({}); p.sound = !!v; prefs.set(p); },
    /** Call from a click: browsers start audio only after a gesture. */
    unlock: function () { const c = ctx(); if (c && c.state === 'suspended') c.resume(); },
    tone: function (freq, ms, type, gain, at) {
      if (!K.sound.on) return;
      const c = ctx(); if (!c) return;
      const t0 = c.currentTime + (at || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain || 0.25, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
      o.connect(g); g.connect(c.destination);
      o.start(t0); o.stop(t0 + ms / 1000 + 0.02);
    },
    tick: function () { K.sound.tone(1400, 35, 'square', 0.06); },
    ding: function () { K.sound.tone(880, 380, 'sine', 0.3); K.sound.tone(1320, 420, 'sine', 0.18, 0.09); },
    buzz: function () { K.sound.tone(150, 520, 'sawtooth', 0.22); K.sound.tone(155, 520, 'square', 0.08); },
    wrong: function () { K.sound.tone(220, 180, 'square', 0.15); K.sound.tone(165, 320, 'square', 0.15, 0.17); },
    fanfare: function () { [523, 659, 784, 1047].forEach(function (f, i) { K.sound.tone(f, i === 3 ? 600 : 160, 'triangle', 0.22, i * 0.13); }); }
  };

  /* ---------- speech (the browser's own voices; nothing is sent by us) ---------- */

  K.speech = {
    supported: 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function',
    voices: function (langPrefix) {
      if (!K.speech.supported) return [];
      const all = window.speechSynthesis.getVoices() || [];
      return langPrefix ? all.filter(function (v) { return String(v.lang).toLowerCase().indexOf(langPrefix.toLowerCase()) === 0; }) : all;
    },
    /** Resolves when the browser has its voice list (some load it late). */
    ready: function () {
      return new Promise(function (resolve) {
        if (!K.speech.supported) return resolve([]);
        const now = window.speechSynthesis.getVoices();
        if (now && now.length) return resolve(now);
        const done = function () { resolve(window.speechSynthesis.getVoices() || []); };
        window.speechSynthesis.addEventListener('voiceschanged', done, { once: true });
        setTimeout(done, 1500);
      });
    },
    say: function (text, opts) {
      if (!K.speech.supported) return null;
      const o = opts || {};
      const u = new SpeechSynthesisUtterance(text);
      if (o.voice) u.voice = o.voice;
      u.lang = o.lang || (o.voice && o.voice.lang) || document.documentElement.lang || 'en-GB';
      u.rate = o.rate || 1;
      u.pitch = o.pitch || 1;
      if (o.onend) u.onend = o.onend;
      if (o.interrupt !== false) window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return u;
    },
    cancel: function () { if (K.speech.supported) window.speechSynthesis.cancel(); }
  };

  /* ---------- keep the screen on during a game ---------- */

  let lock = null, wantLock = false;
  K.wakeLock = function (on) {
    wantLock = on !== false;
    if (!('wakeLock' in navigator)) return;
    if (!wantLock) { if (lock) { lock.release().catch(function () {}); lock = null; } return; }
    if (lock) return;
    navigator.wakeLock.request('screen').then(function (l) {
      lock = l; l.addEventListener('release', function () { lock = null; });
    }).catch(function () { /* battery saver or not allowed: the game still runs */ });
  };
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && wantLock && !lock) K.wakeLock(true);
  });

  /* ---------- full screen ---------- */

  K.fullscreen = function (el) {
    const d = document;
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      return false;
    }
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) { try { const p = req.call(el); if (p && p.catch) p.catch(function () {}); } catch (e) { /* iPhone: no element full screen */ } }
    return true;
  };

  /* ---------- the stage: a second window on this device ---------- */

  const STAGE = /(?:^|[?&])stage=1(?:&|$)/.test(location.search);
  K.isStage = STAGE;

  /**
   * K.stage({ slug, title, render(el, state), onCommand(msg) }) →
   *   { isStage, open(), present(), close(), update(state), command(msg), bar() }
   *
   * render draws the big-screen view from a plain state object; it is called
   * in the TV window for every update, in the host's own overlay when that is
   * showing, and again on resize. Keep state small — it is copied on every
   * update — and send what the screen shows, not the whole game.
   */
  K.stage = function (opts) {
    const slug = opts.slug;
    const name = 'mvr-games:' + slug;
    const chan = 'BroadcastChannel' in window ? new BroadcastChannel(name) : null;
    let last = null, overlay = null, win = null, pending = false;

    function stageRoot(inPage) {
      const root = K.el('div', 'game-stage' + (inPage ? ' is-overlay' : ''));
      root.setAttribute('role', 'region');
      root.setAttribute('aria-label', (opts.title || 'Game') + ' — big screen');
      const bar = K.el('div', 'game-stage-bar');
      const fs = K.button('Full screen', 'game-stage-btn', function () { K.fullscreen(document.documentElement); });
      const theme = K.button('Light', 'game-stage-btn', function () {
        const light = root.classList.toggle('is-light');
        theme.textContent = light ? 'Dark' : 'Light';
      });
      bar.appendChild(fs); bar.appendChild(theme);
      if (inPage) bar.appendChild(K.button('Close  (Esc)', 'game-stage-btn', function () { ctrl.close(); }));
      const body = K.el('div', 'game-stage-body');
      root.appendChild(bar); root.appendChild(body);
      let idle;
      const wake = function () { root.classList.remove('is-idle'); clearTimeout(idle); idle = setTimeout(function () { root.classList.add('is-idle'); }, 2500); };
      root.addEventListener('pointermove', wake);
      wake();
      return { root: root, body: body };
    }
    function draw(target) {
      if (!target || last === null) return;
      try { opts.render(target.body, last); }
      catch (e) { target.body.textContent = 'The big screen could not draw this state.'; }
    }

    const ctrl = {
      isStage: STAGE,
      update: function (state) {
        last = state;
        if (pending) return;
        pending = true;
        /* one message per frame however many changes the frame made. A
           hidden window gets no animation frames — the host page minimised
           while the TV window plays — so a short timer races the frame and
           whichever comes first sends. */
        const flush = function () {
          if (!pending) return;
          pending = false;
          if (chan) chan.postMessage({ k: 'state', s: last });
          if (overlay) draw(overlay);
        };
        if (window.requestAnimationFrame && !document.hidden) window.requestAnimationFrame(flush);
        setTimeout(flush, document.hidden ? 0 : 50);
      },
      open: function () {
        const url = location.pathname + '?stage=1';
        win = window.open(url, 'mvr-stage-' + slug, 'popup,width=1280,height=720');
        if (!win) ctrl.present();
        return win;
      },
      present: function () {
        if (overlay) return;
        overlay = stageRoot(true);
        document.body.appendChild(overlay.root);
        document.documentElement.classList.add('game-stage-open');
        draw(overlay);
        K.fullscreen(document.documentElement);
        K.wakeLock(true);
        overlay.root.tabIndex = -1;
        overlay.root.focus();
      },
      close: function () {
        if (!overlay) return;
        overlay.root.remove();
        overlay = null;
        document.documentElement.classList.remove('game-stage-open');
        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
        if (opts.onClose) opts.onClose();
      },
      get presenting() { return !!overlay; },
      command: function (msg) { if (chan) chan.postMessage({ k: 'cmd', m: msg }); },
      /** The two "show it big" buttons, for the host's controls. */
      bar: function () {
        const wrap = K.el('div', 'game-present');
        if (chan) wrap.appendChild(K.button('Show on TV  (new window)', 'btn-primary game-present-tv', function () { K.sound.unlock(); ctrl.open(); }));
        wrap.appendChild(K.button('Full screen here', 'btn-ghost game-present-fs', function () { K.sound.unlock(); ctrl.present(); }));
        wrap.appendChild(K.el('p', 'game-present-hint', chan
          ? 'Drag the new window to the TV or projector (or cast that tab) and press Full screen there. This page stays your remote.'
          : 'Press Full screen to show the game on this screen.'));
        return wrap;
      }
    };

    if (STAGE) {
      document.documentElement.classList.add('game-stage-mode');
      const start = function () {
        const s = stageRoot(false);
        document.body.appendChild(s.root);
        s.body.appendChild(K.el('p', 'game-stage-wait', 'Waiting for the host window… Open ' + (opts.title || 'the game') + ' in another window and press “Show on TV”.'));
        if (chan) {
          chan.onmessage = function (e) {
            const d = e.data || {};
            if (d.k === 'state') { last = d.s; draw(s); }
          };
          chan.postMessage({ k: 'hello' });
        }
        window.addEventListener('resize', function () { draw(s); });
        /* keys pressed on the TV window reach the host (a buzzer on the TV's keyboard) */
        window.addEventListener('keydown', function (e) {
          if (chan && !e.repeat) chan.postMessage({ k: 'cmd', m: { type: 'key', key: e.key, code: e.code, at: performance.timeOrigin + e.timeStamp } });
        });
        K.wakeLock(true);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    } else if (chan) {
      chan.onmessage = function (e) {
        const d = e.data || {};
        if (d.k === 'hello' && last !== null) chan.postMessage({ k: 'state', s: last });
        else if (d.k === 'cmd' && opts.onCommand) opts.onCommand(d.m);
      };
      window.addEventListener('resize', function () { if (overlay) draw(overlay); });
      document.addEventListener('keydown', function (e) {
        if (overlay && e.key === 'Escape') ctrl.close();
      });
    }
    return ctrl;
  };

  /** The settings a landing page set for its job (data-preset JSON on the
      tool), merged over the game's defaults; never throws. */
  K.preset = function (root) {
    try { return JSON.parse(root.getAttribute('data-preset') || '{}') || {}; }
    catch (e) { return {}; }
  };

  /* ---------- download ---------- */

  K.download = function (blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  K.copy = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    const t = document.createElement('textarea');
    t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } finally { t.remove(); }
    return Promise.resolve();
  };
})();
