/**
 * Spin the Wheel: names, prizes or forfeits on a wheel, drawn on a canvas.
 *
 * Fair and checkable. The winner is chosen FIRST, by GameKit.randInt (the
 * browser's cryptographic generator, rejection-sampled), weighted by slices:
 * "Asha*3" is three slices' worth of weight, so it wins three times as often
 * as a plain name. The wheel is then animated to land on that winner, at a
 * random offset inside its slice. The spin is a show; it never decides.
 *
 * Geometry. Angles are radians, clockwise, 0 = 3 o'clock (canvas
 * convention). The pointer sits at 3 o'clock, so a winning name comes to rest
 * horizontal. Slice i covers the wheel's own angles [cum(i-1), cum(i)] / W *
 * 2π. A wheel turned clockwise by θ shows its angle (−θ mod 2π) at the
 * pointer, so the spin ends at θ ≡ −(slice start + offset × slice width).
 *
 * The TV window. The host sends the stage ONE message per spin,
 * { entries, rot, spin: { winner, turns, offset, from, startAt, duration } };
 * the TV runs the same easing (rotationAt, shared with the host) from those
 * numbers and the wall clock (Date.now: both windows are on this device), so
 * the two wheels stay in step and no frames are streamed. Removing the winner
 * afterwards is a second message (the new list); nothing else is sent during
 * a spin.
 *
 * Reduced motion: no spinning; the wheel jumps to the result and the winner
 * fades in after a short pause.
 *
 * Nothing is uploaded. The list is saved only when "Keep this list on this
 * device" is ticked.
 */
(function () {
  'use strict';
  window.GAME_TOOLS = window.GAME_TOOLS || {};
  window.GAME_TOOLS['spin-the-wheel'] = {
    order: 4,
    title: 'Spin the Wheel',
    short: 'Spin the Wheel',
    description: 'A spinning wheel for names, prizes or forfeits: up to 100 entries, weighted slices, a fair winner chosen before the spin, remove each winner so nobody repeats, and a big-screen view for the TV. Free, no sign-up.',
    keywords: ['spin the wheel', 'random name picker wheel', 'wheel of names', 'yes or no wheel', 'prize wheel', 'decision wheel', 'random picker wheel', 'spinner wheel online', 'classroom name picker'],
    glyph: 'i-spin-the-wheel',
    glyphSvg: '<symbol id="i-spin-the-wheel" viewBox="0 0 24 24">\n  <circle cx="11" cy="12" r="8.2"/>\n  <circle cx="11" cy="12" r="1.5" class="fill"/>\n  <path d="M11 12 17.4 8.4M11 12v8.2M11 12 3.9 8.2" class="thin"/>\n  <path d="M22.4 12 18.6 9.6v4.8z" class="fill"/>\n</symbol>',
    scripts: ['/engine/game-kit.js', '/engine/game-spin-the-wheel.js'],
    privacy: 'The entries you type stay on this device. The winner is drawn by your own browser and the wheel is drawn on your own screens; nothing is uploaded, and the list is saved only if you tick “Keep this list on this device”.',
    how: [
      'Type or paste the entries, one per line, or press a ready-made list such as Yes / No or Forfeits. Add *3 after a name to give it three slices’ worth of chance.',
      'Choose whether each winner should be taken off the wheel, and how long the spin lasts (3 to 6 seconds).',
      'Press Spin, press Space or Enter, or tap the wheel. The winner is announced and added to the results list.',
      'Press Show on TV to put the wheel on a big screen; it spins there in step with this page.'
    ],
    uses: [
      ['Classroom', 'pick who answers next, taking each pupil off the wheel once they have had a turn'],
      ['Party', 'a prize wheel with a few big prizes and lots of small ones, weighted with *3 and *5'],
      ['Family', 'who goes first, who washes up, or a yes-or-no for “can we get a takeaway?”']
    ],
    tips: [
      'The winner is chosen by the browser’s cryptographic random generator before the wheel moves; the spin then lands on it. Every slice has exactly its share of the chance, however long or short the spin.',
      'Add *3 after a name (“Asha*3”) to make its slice three times as wide and three times as likely. Weights from 1 to 50 are accepted; a name without one counts as 1.',
      'A name typed twice gets two slices, so it is twice as likely. Check the count under the box: it shows entries and slices.',
      'Tick “Remove the winner after each spin” for a draw where nobody comes up twice. The winner leaves the list about a second and a half after the spin (or when you press Spin again), so it also leaves a saved list.',
      'Up to 100 entries of 40 characters each. Long names are shortened with an ellipsis on the wheel, and with many entries the names get small; the winner is always announced in full below the wheel and in the results list.',
      'Space or Enter spins when no box or button is selected. With “reduce motion” switched on in your device settings the wheel does not spin: it jumps to the result and the winner fades in.',
      'Ticks and the fanfare play from the page where you press Spin. Switch sound off with the tick box; the choice is remembered on this device.'
    ],
    faq: [
      { q: 'Is the wheel really random?', a: 'Yes. The winner is drawn first with your browser’s cryptographic random number generator, using rejection sampling so no entry is favoured, and weighted by slices. The wheel is then turned to land on that winner. The animation does not influence who wins.' },
      { q: 'How do I make one entry more likely?', a: 'Type * and a number after it: “Grand prize*1” and “Sweets*4”. The number is how many slices’ worth of weight the entry has, so Sweets is four times as likely as Grand prize and its slice is four times as wide. Without a number an entry counts as 1.' },
      { q: 'How do I stop the same person coming up twice?', a: 'Tick “Remove the winner after each spin”. About a second and a half after the result, the winning line is deleted from the list and the wheel is redrawn without it. To start again, press one of the ready-made lists or paste the names back in.' },
      { q: 'How do I show the wheel on the TV?', a: 'Press Show on TV to open the big-screen view in a new window, drag it to the TV or projector (or cast that browser tab) and press Full screen there. The host page sends one message per spin and the TV window runs the same spin, so the two stay together. With one screen, press Full screen here.' },
      { q: 'Are my entries saved or sent anywhere?', a: 'They are never sent anywhere. They are saved on this device only if you tick “Keep this list on this device”; unticking it deletes them. Your spin time and the remove-winner choice are remembered on this device.' },
      { q: 'How many entries can the wheel take?', a: 'Up to 100 entries, each up to 40 characters. The names on the wheel get smaller as the number grows, and the winner is always shown in full under the wheel, so a long list still works on a phone.' },
      { q: 'Does it work on a phone and offline?', a: 'Yes. It works on phones, tablets and computers, and after the first visit it opens without a connection. You can also install it as an app from your browser’s menu.' }
    ],
    related: ['/utilities/random-number-generator/', '/utilities/dice-roller/', '/education/exam-seating/'],
    landings: [
      {
        slug: 'random-name-picker-wheel',
        title: 'Random Name Picker Wheel',
        description: 'Paste a list of names and spin a wheel to pick one, with each winner taken off the wheel so nobody is picked twice. Free, fair, nothing uploaded, and it shows on the classroom board.',
        lede: 'Paste the names, press Spin: one fair pick, and the winner leaves the wheel so everyone gets a turn before anyone gets a second.',
        preset: { remove: true },
        about: [
          '“Remove the winner after each spin” is already ticked here. Paste the register, spin for the first volunteer, and keep pressing Space for the next one; the wheel has one slice fewer each time.',
          'Tick “Keep this list on this device” and your class comes back next lesson. Press Show on TV to put the wheel on the board.'
        ],
        faq: [
          { q: 'Is the pick random or could it favour the top of the list?', a: 'It is random. The winner is drawn with the browser’s cryptographic random generator before the wheel turns, and every line has the same chance unless you give it a weight with *.' },
          { q: 'Do my pupils’ names leave the computer?', a: 'No. The names are read and drawn by the browser on that computer and are not uploaded. They are saved on it only if you tick the box to keep the list.' }
        ]
      },
      {
        slug: 'yes-or-no-wheel',
        title: 'Yes or No Wheel',
        description: 'Spin a yes-or-no wheel to settle a decision, fairly, in one tap. Change the odds with *2 or *3, add a Maybe, and show it on the TV. Free, no sign-up.',
        lede: 'Two slices, one fair spin. Add Maybe, or give Yes more slices, when a plain coin-flip will not do.',
        preset: { entries: 'Yes\nNo' },
        about: [
          'The wheel opens with Yes and No. Type “Yes*2” to make Yes twice as likely, or add a third line such as Maybe.',
          'Space or Enter spins. The answer is chosen first and the wheel then lands on it, so the result is exactly as fair as a coin.'
        ],
        faq: [
          { q: 'Is yes exactly as likely as no?', a: 'Yes, with the two plain lines each has a one-in-two chance. The browser draws the answer from a cryptographic generator before the wheel moves.' },
          { q: 'Can I weight it towards one answer?', a: 'Yes. Write “Yes*3” and “No” and Yes will come up three times in four, over many spins. The slice for Yes is drawn three times as wide.' }
        ]
      },
      {
        slug: 'prize-wheel-for-party-or-class',
        title: 'Prize Wheel for a Party or Classroom',
        description: 'A prize wheel with weighted slices: a few big prizes and many small ones, spun fairly and shown on the TV. Free, no sign-up, works offline once opened.',
        lede: 'Set the prizes, set the odds with *, and let each child spin. Rare prizes get thin slices, common ones wide.',
        preset: { entries: 'Grand prize\nBig sweet*3\nSticker*4\nSpin again*2\nTry again*4' },
        about: [
          'The list starts as an example: Grand prize has weight 1, Big sweet 3, Sticker 4, Spin again 2 and Try again 4, so the grand prize is a one-in-fourteen chance. Replace it with your own prizes.',
          'Leave “Remove the winner” unticked so prizes can come up again, or tick it when each prize can be won once. Show the wheel on the TV and let everyone watch.'
        ],
        faq: [
          { q: 'How do I work out the chance of each prize?', a: 'Add up all the numbers (a prize without one counts as 1) and divide each prize’s number by the total. The page shows the number of entries and slices under the list.' },
          { q: 'Can each prize be won only once?', a: 'Yes. Tick “Remove the winner after each spin” and the prize leaves the wheel after it is won.' }
        ]
      }
    ]
  };

  if (typeof document === 'undefined') return;
  const K = window.GameKit;
  const SLUG = 'spin-the-wheel';
  const MAX_ENTRIES = 100, MAX_WEIGHT = 50, MAX_LEN = 40;
  const TAU = Math.PI * 2;
  const REDUCED_MS = 600;       /* the pause before the result shows when motion is reduced */
  const REMOVE_AFTER = 1500;    /* the winner leaves the list this long after the spin */

  /* every user-facing string lives here so the Hindi wave can translate them */
  const STR = {
    entriesHeading: 'Entries',
    entriesLabel: 'Entries, one per line',
    entriesHint: 'Add *3 after a name to give it three slices’ worth of chance.',
    placeholder: 'Asha\nRavi\nMeera*3\nGrandad',
    presetsLabel: 'Ready-made lists',
    options: 'Options',
    remove: 'Remove the winner after each spin',
    time: 'Spin time',
    sound: 'Sound',
    keep: 'Keep this list on this device',
    spin: 'Spin  (Space)',
    spinning: 'Spinning…',
    wheelLabel: 'The wheel. Press to spin.',
    empty: 'Add at least two entries to spin.',
    one: 'Only one entry is left: ',
    winner: 'Winner: ',
    results: 'Results',
    none: 'No spins yet.',
    copy: 'Copy results',
    copied: 'Copied',
    clear: 'Clear results',
    tvWait: 'Add entries and spin.',
    removed: ' leaves the wheel.'
  };
  const PRESETS = [
    ['Yes / No', 'Yes\nNo'],
    ['1 to 10', '1\n2\n3\n4\n5\n6\n7\n8\n9\n10'],
    ['Who goes first', 'Player 1\nPlayer 2\nPlayer 3\nPlayer 4'],
    ['Forfeits', 'Sing a song\nTen star jumps\nTell a joke\nDance for 20 seconds\nSpeak in a funny voice\nBalance on one leg\nMake an animal noise\nGive someone a compliment\nDo your best catwalk\nHum a tune for others to guess']
  ];

  /* ---------- the maths (pure; build/tests/games/spin-the-wheel.js checks it) ---------- */

  /** "Asha*3" → { n: 'Asha', w: 3 }; no or bad weight → 1; weights run 1..50. */
  function parseEntry(line) {
    const m = /^(.*?)\s*\*\s*(\d{1,4})$/.exec(line);
    if (m && m[1].trim()) return { n: m[1].trim(), w: Math.max(1, Math.min(MAX_WEIGHT, parseInt(m[2], 10) || 1)) };
    return { n: line, w: 1 };
  }
  function parseEntries(text) {
    return K.parseList(text, { lines: true, max: MAX_ENTRIES, maxLen: MAX_LEN + 5 }).map(parseEntry).map((e) => ({ n: e.n.slice(0, MAX_LEN), w: e.w }));
  }
  const weightsOf = (entries) => entries.map((e) => e.w);
  const totalOf = (weights) => weights.reduce((a, b) => a + b, 0);
  /** The winner: a fair draw over the total weight, then the entry that owns that slice. */
  function drawWinner(weights, intFn) {
    let r = intFn(totalOf(weights));
    for (let i = 0; i < weights.length; i++) { if (r < weights[i]) return i; r -= weights[i]; }
    return weights.length - 1;
  }
  /** Where slice i starts and ends, as fractions of the full turn. */
  function sliceSpan(weights, i) {
    const W = totalOf(weights);
    let a = 0;
    for (let j = 0; j < i; j++) a += weights[j];
    return [a / W, (a + weights[i]) / W];
  }
  /** The slice that owns a fraction of the turn, [0,1). */
  function sliceAt(weights, frac) {
    const W = totalOf(weights);
    let t = frac * W;
    for (let i = 0; i < weights.length; i++) { if (t < weights[i]) return i; t -= weights[i]; }
    return weights.length - 1;
  }
  const mod = (x, m) => ((x % m) + m) % m;
  /** The slice under the pointer when the wheel is turned clockwise by `rotation`. */
  function pointerSlice(weights, rotation) { return sliceAt(weights, mod(-rotation, TAU) / TAU); }
  const ease = (p) => 1 - Math.pow(1 - p, 3);
  /** Where the spin ends: whole turns, then whatever brings the chosen spot to the pointer. */
  function endRotation(weights, spin) {
    const span = sliceSpan(weights, spin.winner);
    const spot = (span[0] + (span[1] - span[0]) * spin.offset) * TAU;
    return spin.from + spin.turns * TAU + mod(-spot - spin.from, TAU);
  }
  /** The wheel's rotation `elapsed` ms into the spin. The host and the TV both call this. */
  function rotationAt(weights, spin, elapsed, reduced) {
    const end = endRotation(weights, spin);
    if (reduced) return elapsed >= REDUCED_MS ? end : spin.from;
    if (elapsed <= 0) return spin.from;
    if (elapsed >= spin.duration) return end;
    return spin.from + (end - spin.from) * ease(elapsed / spin.duration);
  }
  /** A new spin: the winner first, then how it will look. */
  function planSpin(weights, intFn, seconds, from, now) {
    const winner = drawWinner(weights, intFn);
    const duration = Math.max(3, Math.min(6, Number(seconds) || 5)) * 1000;
    return {
      winner: winner,
      turns: Math.max(3, Math.round(duration / 1000 * 1.2)) + intFn(2),
      offset: 0.1 + intFn(8001) / 10000,
      from: mod(from || 0, TAU),
      startAt: now,
      duration: duration
    };
  }
  /** Colours for n slices, never the same on two neighbours (the last meets the first). */
  function colourIndex(n) {
    const c = [];
    for (let i = 0; i < n; i++) c.push(i % 8);
    if (n > 2 && c[n - 1] === c[0]) c[n - 1] = (c[n - 1] + 4) % 8;
    if (n > 2 && c[n - 1] === c[n - 2]) c[n - 1] = (c[n - 1] + 2) % 8;
    return c;
  }
  /** Text cut to fit with an ellipsis; measure(text) gives its width. */
  function fitText(text, maxW, measure) {
    if (measure(text) <= maxW) return text;
    let lo = 0, hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (measure(text.slice(0, mid).trimEnd() + '…') <= maxW) lo = mid; else hi = mid - 1;
    }
    return lo ? text.slice(0, lo).trimEnd() + '…' : '';
  }
  /** Delete the line that holds entry number n (counting non-empty lines). */
  function removeEntryLine(text, n) {
    const lines = String(text).split(/\r?\n/);
    let seen = -1;
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].replace(/\s+/g, ' ').trim()) continue;
      seen++;
      if (seen === n) { lines.splice(i, 1); break; }
    }
    return lines.join('\n');
  }
  window.GAME_TOOLS[SLUG].maths = {
    parseEntry, parseEntries, drawWinner, sliceSpan, sliceAt, pointerSlice, endRotation, rotationAt,
    planSpin, colourIndex, fitText, removeEntryLine, ease, TAU
  };

  /* ---------- drawing (shared by the host's wheel and the TV's) ---------- */

  function theme(el) {
    const cs = getComputedStyle(el);
    const p = (n) => cs.getPropertyValue(n).trim();
    const t = [];
    for (let i = 1; i <= 8; i++) t.push(p('--t' + i) || '#f7c948');
    return { font: cs.fontFamily || 'system-ui, sans-serif', t: t, bg: p('--st-bg') || p('--bg-1') || '#101524', fg: p('--st-fg') || p('--text-1') || '#ffffff', line: p('--st-line') || p('--border') || 'rgba(255,255,255,.2)' };
  }
  function inkFor(hex) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return '#0b1020';
    const n = parseInt(m[1], 16);
    /* WCAG relative luminance: dark ink (about 0.006) or white, whichever contrasts more */
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return (l + 0.05) / 0.056 > 1.05 / (l + 0.05) ? '#0b1020' : '#ffffff';
  }
  /** The static wheel, drawn once into its own canvas (size in device pixels). */
  function wheelImage(size, d, entries, th) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const R = size / 2 - 3, cx = size / 2;
    g.translate(cx, cx);
    if (!entries.length) {
      g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fillStyle = th.line; g.fill();
      return c;
    }
    const weights = weightsOf(entries), W = totalOf(weights), col = colourIndex(entries.length);
    let a = 0;
    entries.forEach((e, i) => {
      const sp = weights[i] / W * TAU, b = a + sp;
      const fill = th.t[col[i]];
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a, b); g.closePath();
      g.fillStyle = fill; g.fill();
      g.lineWidth = Math.max(1, size / 400); g.strokeStyle = th.bg; g.stroke();
      /* the label: along the slice's middle, ending at the rim */
      const rOut = R * 0.94, rIn = R * 0.2;
      const h = 2 * R * 0.55 * Math.sin(Math.min(sp, Math.PI) / 2);
      const fs = Math.min(R * 0.11, h * 0.62);
      if (fs / d >= 6.2) {
        g.save();
        g.rotate((a + b) / 2);
        g.font = '700 ' + fs.toFixed(1) + 'px ' + th.font;
        g.textAlign = 'right'; g.textBaseline = 'middle';
        g.fillStyle = inkFor(fill);
        g.fillText(fitText(e.n, rOut - rIn, (s) => g.measureText(s).width), rOut, 0);
        g.restore();
      }
      a = b;
    });
    g.beginPath(); g.arc(0, 0, R * 0.12, 0, TAU); g.fillStyle = th.bg; g.fill();
    g.lineWidth = Math.max(2, size / 150); g.strokeStyle = th.fg; g.stroke();
    return c;
  }

  /**
   * A wheel in a box. setState({ entries, spin, rot, last }) may be called as
   * often as you like; the spin runs from the wall clock, so calling it again
   * with the same spin does not restart it.
   */
  function makeView(box, hooks) {
    const canvas = K.el('canvas', 'wheel-canvas');
    canvas.setAttribute('aria-hidden', 'true');
    box.appendChild(canvas);
    const view = { canvas: canvas, ekey: '', entries: [], spin: null, rot: 0, ended: null, raf: 0 };
    let img = null, imgKey = '', th = null, thAt = 0, cssSize = 0, lastSlice = -1, lastTick = 0, kick = 0, kickAt = 0;
    const g = canvas.getContext('2d');

    function size() {
      const w = Math.max(120, Math.floor(Math.min(box.clientWidth || 300, box.clientHeight || 9999)));
      const d = Math.min(3, window.devicePixelRatio || 1);
      if (w !== cssSize || canvas.width !== Math.round(w * d)) {
        cssSize = w;
        canvas.style.width = canvas.style.height = w + 'px';
        canvas.width = canvas.height = Math.round(w * d);
      }
      return d;
    }
    function paint(rotation) {
      const d = size(), px = canvas.width;
      if (!th || performance.now() - thAt > 300) { th = theme(canvas); thAt = performance.now(); }
      const key = px + '|' + th.t.join() + th.bg + '|' + view.ekey;
      if (key !== imgKey) { img = wheelImage(px, d, view.entries, th); imgKey = key; }
      g.clearRect(0, 0, px, px);
      g.save(); g.translate(px / 2, px / 2); g.rotate(rotation); g.drawImage(img, -px / 2, -px / 2); g.restore();
      /* the pointer at 3 o'clock, flicking back on each tick */
      const tilt = kick * Math.max(0, 1 - (performance.now() - kickAt) / 110) * 0.45;
      g.save(); g.translate(px - 2 * d, px / 2); g.rotate(tilt);
      const L = px * 0.12, Wd = px * 0.05;
      g.beginPath(); g.moveTo(-L, 0); g.lineTo(0, -Wd); g.lineTo(0, Wd); g.closePath();
      g.fillStyle = th.fg; g.fill(); g.lineWidth = Math.max(2, d * 1.5); g.strokeStyle = th.bg; g.stroke();
      g.restore();
    }
    function frame() {
      view.raf = 0;
      const sp = view.spin;
      let rot = view.rot;
      if (sp) {
        const weights = weightsOf(view.entries);
        const reduced = K.reducedMotion();
        const elapsed = Date.now() - sp.startAt;
        rot = rotationAt(weights, sp, elapsed, reduced);
        const done = elapsed >= (reduced ? REDUCED_MS : sp.duration);
        if (!reduced) {
          const idx = pointerSlice(weights, rot);
          if (lastSlice !== -1 && idx !== lastSlice) {
            const now = performance.now();
            kick = 1; kickAt = now;
            if (hooks.onTick && now - lastTick > 45) { lastTick = now; hooks.onTick(); }
          }
          lastSlice = idx;
        }
        paint(rot);
        if (done) finish(sp, rot);
        else view.raf = requestAnimationFrame(frame);
        return;
      }
      lastSlice = -1;
      paint(rot);
    }
    /* the spin is over: rest where it landed and tell the page once */
    function finish(sp, rot) {
      view.rot = mod(rot, TAU);
      if (view.ended !== sp.startAt) { view.ended = sp.startAt; if (hooks.onEnd) hooks.onEnd(sp); }
    }
    view.draw = function () { if (!view.raf) view.raf = requestAnimationFrame(frame); };
    view.setState = function (s) {
      const newSpin = s.spin && (!view.spin || view.spin.startAt !== s.spin.startAt);
      view.entries = s.entries || [];
      view.ekey = view.entries.map((e) => e.n + '\u0001' + e.w).join('\u0002');
      view.rot = s.rot || 0;
      if (newSpin) {
        lastSlice = -1;
        /* a hidden window does not run animation frames: a timer still ends the spin on time */
        const sp = s.spin, wait = (K.reducedMotion() ? REDUCED_MS : sp.duration) - (Date.now() - sp.startAt);
        clearTimeout(view.timer);
        view.timer = setTimeout(function () {
          if (view.spin && view.spin.startAt === sp.startAt && view.ended !== sp.startAt) {
            finish(sp, rotationAt(weightsOf(view.entries), sp, Infinity, K.reducedMotion()));
            view.draw();
          }
        }, Math.max(0, wait) + 40);
      }
      view.spin = s.spin || null;
      if (!s.spin) view.ended = null;
      view.draw();
    };
    if (window.ResizeObserver) new ResizeObserver(() => { view.draw(); }).observe(box);
    return view;
  }

  /* ---------- the big screen ---------- */

  const views = new WeakMap();
  function renderStage(body, s) {
    let v = views.get(body);
    if (!v || !body.contains(v.box)) {
      body.textContent = '';
      const box = K.el('div', 'wheel-stage-box');
      const win = K.el('p', 'wheel-stage-win');
      win.setAttribute('role', 'status');
      body.appendChild(box); body.appendChild(win);
      v = { box: box, win: win, view: null, spinId: null };
      v.view = makeView(box, { onEnd: (sp) => reveal(v, sp) });
      views.set(body, v);
      new MutationObserver(() => v.view.draw()).observe(body.parentElement || body, { attributes: true, attributeFilter: ['class'] });
    }
    v.state = s;
    v.view.setState(s);
    if (!s.entries || !s.entries.length) { v.win.textContent = STR.tvWait; v.win.className = 'wheel-stage-win is-dim'; return; }
    if (s.spin) {
      const elapsed = Date.now() - s.spin.startAt;
      if (elapsed < (K.reducedMotion() ? REDUCED_MS : s.spin.duration)) { v.win.textContent = ''; v.win.className = 'wheel-stage-win'; }
      else reveal(v, s.spin);
    } else if (s.last) { v.win.textContent = s.last; v.win.className = 'wheel-stage-win is-on'; }
    else { v.win.textContent = ''; v.win.className = 'wheel-stage-win'; }
  }
  function reveal(v, sp) {
    const e = v.state && v.state.entries[sp.winner];
    if (!e) return;
    v.win.textContent = e.n;
    v.win.className = 'wheel-stage-win is-on' + (K.reducedMotion() ? ' is-fade' : ' is-pop');
  }

  /* ---------- the page ---------- */

  function mount(root, stage) {
    const io = root.querySelector('.tool-io');
    const store = K.store(SLUG, 1);
    const preset = K.preset(root);
    const saved = store.get({});
    const opt = Object.assign({ remove: false, time: 5 }, saved.opt || {});
    if (preset.remove !== undefined) opt.remove = !!preset.remove;
    let entries = [], busy = false, history = [], removeTimer = 0, pendingRemove = null, rot = 0, lastWinner = '';

    const cols = K.el('div', 'game-cols wheel-cols');
    const left = K.el('section', 'game-panel');
    left.appendChild(K.el('h2', null, STR.entriesHeading));
    const list = K.el('textarea');
    list.placeholder = STR.placeholder;
    list.spellcheck = false;
    list.setAttribute('aria-describedby', SLUG + '-hint');
    list.value = typeof preset.entries === 'string' ? preset.entries : (saved.keep && saved.list ? saved.list : '');
    const lf = K.field(STR.entriesLabel, list, STR.entriesHint);
    lf.wrap.querySelector('.game-field-hint').id = SLUG + '-hint';
    left.appendChild(lf.wrap);
    const count = K.el('p', 'game-msg wheel-count');
    left.appendChild(count);

    const pre = K.el('div', 'game-row wheel-presets');
    pre.setAttribute('role', 'group'); pre.setAttribute('aria-label', STR.presetsLabel);
    PRESETS.forEach((p) => pre.appendChild(K.button(p[0], 'btn-ghost', () => { if (busy) return; flushRemove(); list.value = p[1]; refresh(); persist(); })));
    left.appendChild(K.field(STR.presetsLabel, pre).wrap);

    const rem = K.el('input'); rem.type = 'checkbox'; rem.checked = !!opt.remove;
    const remL = K.el('label', 'game-check'); remL.appendChild(rem); remL.appendChild(document.createTextNode(STR.remove));
    left.appendChild(remL);
    const time = K.el('select');
    [3, 4, 5, 6].forEach((s) => { const o = K.el('option', null, s + ' seconds'); o.value = String(s); time.appendChild(o); });
    time.value = String(opt.time >= 3 && opt.time <= 6 ? Math.round(opt.time) : 5);
    left.appendChild(K.field(STR.time, time).wrap);
    const snd = K.el('input'); snd.type = 'checkbox'; snd.checked = K.sound.on;
    const sndL = K.el('label', 'game-check'); sndL.appendChild(snd); sndL.appendChild(document.createTextNode(STR.sound));
    left.appendChild(sndL);
    const keep = K.el('input'); keep.type = 'checkbox'; keep.checked = !!saved.keep;
    const keepL = K.el('label', 'game-check'); keepL.appendChild(keep); keepL.appendChild(document.createTextNode(STR.keep));
    left.appendChild(keepL);

    const right = K.el('section', 'game-panel wheel-main');
    const wbox = K.el('div', 'wheel-box');
    wbox.tabIndex = 0;
    wbox.setAttribute('role', 'button');
    wbox.setAttribute('aria-label', STR.wheelLabel);
    right.appendChild(wbox);
    const spinB = K.button(STR.spin, 'btn-primary game-big wheel-spin', spin);
    const win = K.el('p', 'wheel-win');
    win.setAttribute('role', 'status');
    const row = K.el('div', 'game-row wheel-actions');
    row.appendChild(spinB);
    right.appendChild(row);
    right.appendChild(win);
    const msg = K.el('p', 'game-msg wheel-msg', STR.empty);
    right.appendChild(msg);
    right.appendChild(K.el('h3', 'wheel-h3', STR.results));
    const histEl = K.el('ol', 'wheel-history');
    right.appendChild(histEl);
    const histMsg = K.el('p', 'game-msg', STR.none);
    right.appendChild(histMsg);
    const hrow = K.el('div', 'game-row');
    const copyB = K.button(STR.copy, 'btn-copy', () => {
      if (!history.length) return;
      K.copy(history.map((h, i) => (i + 1) + '. ' + h).join('\n')).then(() => { copyB.textContent = STR.copied; copyB.classList.add('ok'); setTimeout(() => { copyB.textContent = STR.copy; copyB.classList.remove('ok'); }, 1600); });
    });
    const clearB = K.button(STR.clear, 'btn-ghost', () => { history = []; drawHistory(); });
    hrow.appendChild(copyB); hrow.appendChild(clearB);
    right.appendChild(hrow);
    right.appendChild(stage.bar());

    cols.appendChild(left); cols.appendChild(right);
    io.appendChild(cols);

    const view = makeView(wbox, {
      onTick: () => K.sound.tick(),
      onEnd: onEnd
    });

    function refresh() {
      entries = parseEntries(list.value);
      const slices = totalOf(weightsOf(entries));
      count.textContent = entries.length
        ? entries.length + (entries.length === 1 ? ' entry' : ' entries') + (slices !== entries.length ? ', ' + slices + ' slices' : '')
        : '';
      if (entries.length < 2) { msg.textContent = entries.length ? STR.one + entries[0].n : STR.empty; } else msg.textContent = '';
      spinB.disabled = busy || entries.length < 2;
      wbox.setAttribute('aria-disabled', String(spinB.disabled));
      view.setState({ entries: entries, spin: null, rot: rot });
      publish(null);
    }
    function persist() {
      const data = { opt: { remove: rem.checked, time: Number(time.value) }, keep: keep.checked };
      if (keep.checked) data.list = list.value.slice(0, 20000);
      store.set(data);
    }
    function publish(sp) {
      stage.update({ entries: entries, rot: rot, spin: sp, last: sp ? '' : lastWinner });
    }
    function flushRemove() {
      clearTimeout(removeTimer);
      if (pendingRemove === null) return;
      const n = pendingRemove; pendingRemove = null;
      list.value = removeEntryLine(list.value, n);
      if (keep.checked) persist();
      refresh();
    }
    function spin() {
      if (busy) return;
      flushRemove();
      refresh();
      if (entries.length < 2) { K.announce(root, msg.textContent); return; }
      K.sound.unlock();
      const sp = planSpin(weightsOf(entries), K.randInt, time.value, rot, Date.now());
      busy = true; lastWinner = '';
      list.readOnly = true; spinB.disabled = true; spinB.textContent = STR.spinning;
      win.textContent = ''; win.className = 'wheel-win';
      persist();
      view.setState({ entries: entries, spin: sp, rot: rot });
      publish(sp);
      current = sp;
    }
    let current = null;
    function onEnd(sp) {
      if (!current || sp.startAt !== current.startAt) return;
      current = null;
      const e = entries[sp.winner];
      rot = view.rot;
      busy = false; list.readOnly = false; spinB.textContent = STR.spin;
      lastWinner = e.n;
      win.textContent = e.n;
      win.className = 'wheel-win is-on' + (K.reducedMotion() ? ' is-fade' : ' is-pop');
      history.push(e.n);
      drawHistory();
      K.sound.fanfare();
      K.announce(root, STR.winner + e.n + (rem.checked ? STR.removed : ''));
      if (rem.checked) { pendingRemove = sp.winner; removeTimer = setTimeout(flushRemove, REMOVE_AFTER); }
      spinB.disabled = entries.length < 2;
    }
    function drawHistory() {
      histEl.textContent = '';
      history.forEach((h) => histEl.appendChild(K.el('li', null, h)));
      histMsg.hidden = history.length > 0;
      copyB.hidden = clearB.hidden = !history.length;
    }

    wbox.addEventListener('click', () => { if (!spinB.disabled) spin(); });
    document.addEventListener('keydown', (e) => {
      if ((e.key !== ' ' && e.key !== 'Enter') || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'BUTTON' || t.tagName === 'SELECT' || t.tagName === 'A' || t.tagName === 'SUMMARY')) return;
      e.preventDefault();
      if (!spinB.disabled) spin();
    });
    list.addEventListener('input', () => { flushRemove(); refresh(); if (keep.checked) persist(); });
    rem.addEventListener('change', persist);
    time.addEventListener('change', persist);
    snd.addEventListener('change', () => { K.sound.on = snd.checked; });
    keep.addEventListener('change', () => {
      if (!keep.checked) { const s = store.get({}); delete s.list; s.keep = false; store.set(s); }
      persist();
    });
    stage.onKey = function (key) { if ((key === ' ' || key === 'Enter') && !spinB.disabled) spin(); };
    drawHistory();
    refresh();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-tool="' + SLUG + '"]');
    if (!root || !K) return;
    let host = null;
    const stage = K.stage({
      slug: SLUG,
      title: 'Spin the Wheel',
      render: renderStage,
      onCommand: (m) => { if (m && m.type === 'key' && host && host.onKey) host.onKey(m.key); }
    });
    if (stage.isStage) return;
    host = stage;
    mount(root, stage);
  });
})();
