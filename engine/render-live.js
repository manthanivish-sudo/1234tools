/**
 * Renderer for the live tools — the ones with a keypad or a running clock.
 *
 * All timers compute from timestamps rather than counting ticks, so a
 * throttled background tab changes how often the display refreshes but never
 * what it reports. Alerts are scheduled on the audio clock when a countdown
 * starts (see Sound below), so they sound on time in a background tab too.
 *
 * The time tools (time zone converter, countdown, stopwatch with timers and
 * Pomodoro) keep their settings in localStorage (one versioned key each),
 * read share links (?query and #fragment) and announce what a link would
 * carry to the share bar (kind "live"). Their pure functions are in
 * engine/live.bundle.js, the zone list in engine/live-zones.js; the tests are
 * build/tests/live-fixes.js and build/tests/claims/time-live.js.
 */
(function () {
  'use strict';
  window.MVRTool = window.MVRTool || {};

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const pad = (n, w) => String(n).padStart(w || 2, '0');

  /* ============================================================
     Scientific calculator
     ============================================================ */
  window.MVRTool.mountCalculator = function (root) {
    const io = root.querySelector('.tool-io');
    const L = window.MVRLive;

    const shell = el('div', 'calc-shell');

    const display = el('div', 'calc-display');
    const expr = el('input', 'calc-expr');
    expr.type = 'text';
    expr.spellcheck = false;
    expr.setAttribute('aria-label', 'Expression');
    expr.placeholder = '0';
    const result = el('div', 'calc-result', '0');
    const modeTag = el('span', 'calc-mode', 'RAD');
    display.appendChild(modeTag);
    display.appendChild(expr);
    display.appendChild(result);

    const history = el('div', 'calc-history');

    let angle = 'rad';
    const setAngle = (a) => {
      angle = a;
      modeTag.textContent = a.toUpperCase();
      [...pads.querySelectorAll('[data-angle]')].forEach(b =>
        b.setAttribute('aria-pressed', String(b.dataset.angle === a)));
      run();
    };

    const insert = (txt, caretBack) => {
      const s = expr.selectionStart ?? expr.value.length;
      const e2 = expr.selectionEnd ?? expr.value.length;
      expr.value = expr.value.slice(0, s) + txt + expr.value.slice(e2);
      const pos = s + txt.length - (caretBack || 0);
      expr.setSelectionRange(pos, pos);
      expr.focus();
      run();
    };

    const KEYS = [
      ['sin(', 'sin'], ['cos(', 'cos'], ['tan(', 'tan'], ['^', 'xʸ'], ['(', '('], [')', ')'],
      ['asin(', 'sin⁻¹'], ['acos(', 'cos⁻¹'], ['atan(', 'tan⁻¹'], ['sqrt(', '√'], ['7', '7'], ['8', '8'],
      ['ln(', 'ln'], ['log(', 'log'], ['exp(', 'eˣ'], ['cbrt(', '∛'], ['9', '9'], ['/', '÷'],
      ['pi', 'π'], ['e', 'e'], ['!', 'n!'], ['abs(', '|x|'], ['4', '4'], ['5', '5'],
      ['%', 'mod'], ['floor(', '⌊x⌋'], ['ceil(', '⌈x⌉'], ['round(', 'rnd'], ['6', '6'], ['*', '×'],
      ['1', '1'], ['2', '2'], ['3', '3'], ['-', '−'], ['0', '0'], ['.', '.'],
      ['+', '+']
    ];

    const pads = el('div', 'calc-pad');
    const angleRow = el('div', 'calc-angle');
    [['rad', 'RAD'], ['deg', 'DEG'], ['grad', 'GRAD']].forEach(([v, label]) => {
      const b = el('button', 'calc-key calc-key-mode', label);
      b.type = 'button';
      b.dataset.angle = v;
      b.setAttribute('aria-pressed', String(v === 'rad'));
      b.addEventListener('click', () => setAngle(v));
      angleRow.appendChild(b);
    });
    const clr = el('button', 'calc-key calc-key-warn', 'AC');
    clr.type = 'button';
    clr.addEventListener('click', () => { expr.value = ''; run(); expr.focus(); });
    const del = el('button', 'calc-key calc-key-warn', '⌫');
    del.type = 'button';
    del.addEventListener('click', () => {
      const s = expr.selectionStart ?? expr.value.length;
      if (s > 0) {
        expr.value = expr.value.slice(0, s - 1) + expr.value.slice(s);
        expr.setSelectionRange(s - 1, s - 1);
      }
      run(); expr.focus();
    });
    angleRow.appendChild(clr);
    angleRow.appendChild(del);

    const grid = el('div', 'calc-grid');
    KEYS.forEach(([val, label]) => {
      const b = el('button', 'calc-key', label);
      b.type = 'button';
      if (/^[0-9.]$/.test(val)) b.classList.add('calc-key-num');
      b.addEventListener('click', () => insert(val));
      grid.appendChild(b);
    });
    const eq = el('button', 'calc-key calc-key-eq', '=');
    eq.type = 'button';
    eq.addEventListener('click', () => commit());
    grid.appendChild(eq);

    pads.appendChild(angleRow);
    pads.appendChild(grid);

    shell.appendChild(display);
    shell.appendChild(pads);
    io.appendChild(shell);
    io.appendChild(history);

    let last = null;
    function run() {
      const raw = expr.value;
      if (!raw.trim()) { result.textContent = '0'; result.className = 'calc-result'; last = null; return; }
      try {
        const r = L.evaluate(raw, angle);
        if (r.empty) { result.textContent = '0'; last = null; return; }
        if (!isFinite(r.value)) {
          result.textContent = Number.isNaN(r.value) ? 'undefined' : (r.value > 0 ? '∞' : '−∞');
          result.className = 'calc-result';
          last = null;
          return;
        }
        const v = r.value;
        const shown = Math.abs(v) >= 1e15 || (Math.abs(v) < 1e-6 && v !== 0)
          ? v.toExponential(9).replace(/e/, ' × 10^')
          : Number(v.toPrecision(14)).toLocaleString('en-GB', { maximumFractionDigits: 12 });
        result.textContent = shown;
        result.className = 'calc-result';
        last = v;
      } catch (e) {
        result.textContent = e.message;
        result.className = 'calc-result is-err';
        last = null;
      }
    }

    function commit() {
      if (last === null || !expr.value.trim()) return;
      const row = el('div', 'calc-hist-row');
      row.appendChild(el('span', 'calc-hist-expr', expr.value));
      row.appendChild(el('span', 'calc-hist-val', result.textContent));
      row.title = 'Click to reuse this result';
      row.addEventListener('click', () => { expr.value = String(last); run(); expr.focus(); });
      history.insertBefore(row, history.firstChild);
      while (history.children.length > 12) history.removeChild(history.lastChild);
      expr.value = String(last);
      expr.setSelectionRange(expr.value.length, expr.value.length);
      run();
    }

    expr.addEventListener('input', run);
    expr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { expr.value = ''; run(); }
    });
    run();
  };

  /* ============================================================
     Shared by the time tools: settings kept on this device, links,
     the share bar, sound, notifications, the tab title, and the
     time zone picker
     ============================================================ */

  /* One localStorage key per tool, with a version. Every read and write is
     wrapped: storage can refuse (a private window, a full disk), and the
     tool must still work without it. */
  const store = (key) => ({
    get() { try { const o = JSON.parse(localStorage.getItem(key) || 'null'); return o && o.v === 1 ? o : null; } catch (e) { return null; } },
    set(o) { try { localStorage.setItem(key, JSON.stringify(Object.assign({}, o, { v: 1 }))); } catch (e) { /* refused: nothing kept */ } },
    clear() { try { localStorage.removeItem(key); } catch (e) { /* nothing kept */ } }
  });

  /* The values a link carries: ?query (what the Tool Finder sends) and
     #fragment (what the share bar sends, which never reaches a server).
     Both are read here in the browser; the fragment wins. */
  const linkParams = () => {
    let q;
    try { q = new URLSearchParams(location.search); } catch (e) { q = new URLSearchParams(); }
    try { new URLSearchParams(location.hash.replace(/^#/, '')).forEach((v, k) => q.set(k, v)); } catch (e) { /* none */ }
    return q;
  };
  const validDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
  const validTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || '');
  const intIn = (v, lo, hi) => { const n = Number(v); return v !== null && v !== '' && Number.isInteger(n) && n >= lo && n <= hi ? n : null; };
  const isoDay = (p) => p.y + '-' + pad(p.mo) + '-' + pad(p.d);

  /* The share bar's half of the page (the same hand-off render-core.js
     makes): what a link would carry, as an event for a bar already
     listening and as a function for one that boots later. */
  const announce = (state) => {
    (window.MVRTool = window.MVRTool || {}).shareState = () => state;
    document.dispatchEvent(new CustomEvent('mvr:result', { detail: state }));
  };
  /* A change the visitor made, for the install offer (as render-core.js). */
  const used = () => document.dispatchEvent(new CustomEvent('mvr:tool-used'));

  const download = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = el('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  const extOf = (type) => ({ 'text/calendar': 'ics', 'text/csv': 'csv' })[String(type).split(';')[0]] || 'txt';

  /* setTimeout holds at most 2^31 − 1 ms (24.8 days); a longer delay fires at once. */
  const MAX_WAIT = 2147483647;

  /* ---------- sound ----------
     One audio context, made (or woken) by a click, and each alert scheduled
     on the audio clock for the moment it is due, when the countdown starts.
     The audio clock runs at full speed in a background tab, where Chrome
     wakes timeouts only about once a second, so the tone plays on time even
     when the page's own timeout for the same moment runs late. Pause and
     Reset take the tone back off the clock. */
  const Sound = (() => {
    let ctx = null;
    /* [frequency Hz, start s, length s, gain, wave] — "beep" is the tone the
       timer has always made */
    const SOUNDS = {
      beep: [[880, 0, 0.6, 0.18, 'sine']],
      chime: [[784, 0, 0.9, 0.16, 'sine'], [1047, 0.22, 1.2, 0.14, 'sine']],
      bell: [[523, 0, 2.2, 0.2, 'sine'], [1046, 0, 1.4, 0.07, 'sine'], [1568, 0, 0.8, 0.04, 'sine']],
      digital: [[1000, 0, 0.12, 0.12, 'square'], [1000, 0.25, 0.12, 0.12, 'square'], [1000, 0.5, 0.12, 0.12, 'square']]
    };
    const LABELS = [['beep', 'Beep'], ['chime', 'Chime'], ['bell', 'Bell'], ['digital', 'Digital'], ['none', 'No sound']];
    /* every tone on the clock and not yet over, to put back on its moment */
    const live = new Set();
    const running = () => !!ctx && ctx.state === 'running';
    /* The audio time that reaches the speaker at the wall-clock moment `at`
       (ms). getOutputTimestamp pairs an audio time with the moment it is
       heard, so this allows for the output's own delay; a context that has
       only just been made has no such pair yet (its clock waits for the
       device to start), and the plain clock stands in until it does. */
    const audioAt = (at) => {
      try {
        const ts = ctx.getOutputTimestamp && ctx.getOutputTimestamp();
        if (ts && ts.performanceTime > 0 && running()) return ts.contextTime + (performance.now() + (at - Date.now()) - ts.performanceTime) / 1000;
      } catch (e) { /* the plain clock */ }
      return ctx.currentTime + (at - Date.now()) / 1000;
    };
    const build = (h) => {
      const when = h.when;
      h.nodes = (SOUNDS[h.name] || SOUNDS.beep).map(([f, off, len, g, wave]) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = wave; osc.frequency.value = f;
        const t = when + off;
        gain.gain.setValueAtTime(g, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + len);
        return { osc, gain };
      });
      /* over: off the list (a tone taken back has its handler removed first) */
      h.nodes[0].osc.onended = () => live.delete(h);
    };
    const unbuild = (h) => {
      (h.nodes || []).forEach(n => { try { n.osc.onended = null; n.osc.stop(0); } catch (e) { /* done */ } try { n.gain.disconnect(); } catch (e) { /* done */ } });
      h.nodes = [];
    };
    /* The audio clock and the wall clock can part (a context still starting,
       a machine that slept, a long countdown): put a tone not yet begun back
       on its moment. The handle is kept, so its owner's reference holds. */
    const sync = (h) => {
      if (!h || h.cancelled || !running()) return h;
      if (h.when - ctx.currentTime <= 0.05) return h;
      const want = Math.max(ctx.currentTime, audioAt(h.at));
      if (Math.abs(want - h.when) <= 0.04) return h;
      unbuild(h);
      h.when = want;
      try { build(h); } catch (e) { h.cancelled = true; live.delete(h); }
      return h;
    };
    const syncAll = () => live.forEach(sync);
    const prime = () => {
      try {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        if (!ctx) {
          ctx = new C();
          /* Once the device has started, the tones set up meanwhile move to
             their true moment. The cue is a silent source ending on the
             audio clock, not a timeout: a background tab may hold timeouts
             back, but not the audio clock or its events. */
          ctx.addEventListener && ctx.addEventListener('statechange', syncAll);
          [0.25, 1].forEach(secs => {
            try {
              const c = ctx.createConstantSource(), g = ctx.createGain();
              g.gain.value = 0; c.connect(g); g.connect(ctx.destination);
              c.onended = () => { try { g.disconnect(); } catch (e) { /* gone */ } syncAll(); };
              c.start(); c.stop(ctx.currentTime + secs);
            } catch (e) { setTimeout(syncAll, secs * 1000); }
          });
        }
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume().then(syncAll).catch(() => {});
        return ctx;
      } catch (e) { return null; }
    };
    /* the alert for the wall-clock moment `at` (ms), or null (no sound, or no audio here) */
    const schedule = (at, name) => {
      if (!name || name === 'none' || !ctx) return null;
      try {
        const h = { at, name, when: Math.max(ctx.currentTime, audioAt(at)), nodes: [], cancelled: false };
        build(h);
        live.add(h);
        return h;
      } catch (e) { return null; }
    };
    const cancel = (h) => {
      if (!h || h.cancelled) return;
      h.cancelled = true;
      live.delete(h);
      unbuild(h);
    };
    /* At the deadline: the scheduled tone has played, is playing or is
       about to, so nothing more is needed; otherwise play it now. */
    const due = (h, name) => {
      if (!name || name === 'none') { cancel(h); return null; }
      if (h && !h.cancelled && running() && h.when - audioAt(Date.now()) <= 0.25) return h;
      cancel(h);
      if (!ctx) return null;
      if (running()) return schedule(Date.now(), name);
      if (ctx.resume) ctx.resume().then(() => schedule(Date.now(), name)).catch(() => {});
      return null;
    };
    const test = (name) => { prime(); return schedule(Date.now() + 60, name); };
    return { prime, schedule, cancel, sync, due, test, LABELS, has: () => !!ctx };
  })();

  /* ---------- notifications, only with the visitor's permission ---------- */
  const Notify = {
    supported: () => 'Notification' in window,
    allowed: () => ('Notification' in window) && Notification.permission === 'granted',
    ask: () => {
      if (!('Notification' in window)) return Promise.resolve('unsupported');
      if (Notification.permission !== 'default') return Promise.resolve(Notification.permission);
      try { return Promise.resolve(Notification.requestPermission()).then(p => p || Notification.permission); } catch (e) { return Promise.resolve('denied'); }
    },
    send(title, body, tag) {
      if (!Notify.allowed()) return;
      const opts = { body, tag, icon: '/assets/icon-192.png', badge: '/assets/icon-192.png' };
      try { new Notification(title, opts); }
      catch (e) {
        /* Chrome on Android only shows one through the service worker */
        try { if (navigator.serviceWorker) navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)).catch(() => {}); } catch (e2) { /* none */ }
      }
    }
  };
  /* A checkbox that asks for permission when ticked, and says so if refused. */
  function notifyBox(labelText, checked, onChange) {
    const w = el('div', 'tt-check-wrap');
    const lab = el('label', 'tt-check');
    const box = el('input'); box.type = 'checkbox';
    const msg = el('span', 'tt-note');
    lab.appendChild(box); lab.appendChild(el('span', null, labelText)); w.appendChild(lab); w.appendChild(msg);
    if (!Notify.supported()) { box.disabled = true; msg.textContent = ' (this browser cannot show notifications)'; return { wrap: w, get on() { return false; } }; }
    box.checked = !!checked && Notify.allowed();
    box.addEventListener('change', () => {
      msg.textContent = '';
      if (!box.checked) { onChange(false); return; }
      Notify.ask().then(p => {
        if (p !== 'granted') { box.checked = false; msg.textContent = p === 'denied' ? ' Notifications are blocked for this site in your browser settings.' : ''; onChange(false); return; }
        onChange(true);
      });
    });
    return { wrap: w, get on() { return box.checked && Notify.allowed(); } };
  }
  function soundSelect(labelText, value, id) {
    const w = el('div', 'field');
    const l = el('label', null, labelText); l.htmlFor = id;
    const s = el('select', 'control'); s.id = id;
    Sound.LABELS.forEach(([v, t]) => { const o = el('option', null, t); o.value = v; if (v === value) o.selected = true; s.appendChild(o); });
    w.appendChild(l); w.appendChild(s);
    return { wrap: w, sel: s };
  }

  /* ---------- the tab title ---------- */
  const BASE_TITLE = document.title;
  const setTitle = (s) => { const t = s ? s + ' – ' + BASE_TITLE : BASE_TITLE; if (document.title !== t) document.title = t; };

  /* ---------- time zones ---------- */
  let ZINDEX = null;
  const zoneIndex = () => {
    if (ZINDEX) return ZINDEX;
    const L = window.MVRLive;
    const data = window.MVRZones || { zones: L.COMMON_ZONES.filter(z => z !== 'UTC').map(id => ({ id, cc: '', note: '' })), links: {} };
    let names = null;
    try { names = new Intl.DisplayNames(['en-GB'], { type: 'region' }); } catch (e) { names = null; }
    ZINDEX = L.buildZoneIndex(data, {
      valid: (id) => { try { new Intl.DateTimeFormat('en-GB', { timeZone: id }); return true; } catch (e) { return false; } },
      country: (cc) => { try { return names ? names.of(cc) : cc; } catch (e) { return cc; } }
    });
    return ZINDEX;
  };
  /* a zone name from a link, storage or the browser, as the index knows it, or null */
  const zoneOf = (id) => {
    if (!id) return null;
    const idx = zoneIndex(), L = window.MVRLive;
    const c = L.canonicalZone(idx, String(id));
    if (c) return c;
    try { new Intl.DateTimeFormat('en-GB', { timeZone: id }); } catch (e) { return null; }
    /* a zone this browser knows that the list does not: usable all the same */
    idx.byId[id] = { id, city: L.cityOf(id), country: '', note: '', keys: [], names: [] };
    idx.entries.push(idx.byId[id]);
    return id;
  };
  const hereZone = () => { let z = 'UTC'; try { z = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { /* UTC */ } return zoneOf(z) || 'UTC'; };
  const cityName = (id) => { const e = zoneIndex().byId[id]; return e ? e.city : window.MVRLive.cityOf(id); };
  const zoneLabel = (id) => {
    const e = zoneIndex().byId[id];
    if (!e) return id;
    return e.city + (e.country && e.country !== e.city ? ', ' + e.country : '');
  };
  const offText = (m) => window.MVRLive.formatOffset(m).replace('-', '−');
  const spanText = (mins) => {
    const a = Math.abs(mins), h = Math.floor(a / 60), m = a % 60;
    return (h ? h + (h === 1 ? ' hour' : ' hours') : '') + (h && m ? ' ' : '') + (m ? m + ' minutes' : '');
  };

  /* A searchable zone field: a combobox over every zone, city, country,
     abbreviation and offset (MVRLive.searchZones). */
  let pickerSeq = 0;
  function zonePicker(labelText, value, onPick, placeholder) {
    const L = window.MVRLive;
    const n = ++pickerSeq, id = 'zp-' + n, listId = id + '-list';
    const wrap = el('div', 'field zp');
    const lab = el('label', null, labelText); lab.htmlFor = id;
    const box = el('div', 'zp-box');
    const input = el('input', 'control zp-input');
    input.id = id; input.type = 'text'; input.autocomplete = 'off'; input.spellcheck = false;
    input.setAttribute('data-zp', '');
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-controls', listId);
    input.placeholder = placeholder || 'City, country or zone';
    const list = el('ul', 'zp-list'); list.id = listId; list.setAttribute('role', 'listbox'); list.hidden = true;
    list.setAttribute('aria-label', labelText);
    box.appendChild(input); box.appendChild(list);
    wrap.appendChild(lab); wrap.appendChild(box);
    let cur = value, items = [], active = -1;
    const show = () => { input.value = cur ? zoneLabel(cur) : ''; };
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
    const highlight = (i) => {
      active = i;
      [...list.querySelectorAll('[role=option]')].forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
      const li = list.querySelector('#' + listId + '-' + i);
      if (li) { input.setAttribute('aria-activedescendant', li.id); if (li.scrollIntoView) li.scrollIntoView({ block: 'nearest' }); } else input.removeAttribute('aria-activedescendant');
    };
    const choose = (i) => { const r = items[i]; if (!r) return; cur = r.id; show(); close(); onPick(cur); };
    const render = () => {
      const q = input.value;
      const now = Date.now();
      items = L.searchZones(zoneIndex(), q, 12, { offsetOf: (z) => L.offsetAt(now, z) });
      list.innerHTML = '';
      items.forEach((r, i) => {
        const li = el('li', 'zp-opt'); li.id = listId + '-' + i; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false');
        li.appendChild(el('span', 'zp-title', r.title));
        li.appendChild(el('span', 'zp-detail', r.detail + ' · ' + offText(L.offsetAt(now, r.id))));
        li.addEventListener('mousedown', (e) => { e.preventDefault(); choose(i); });
        list.appendChild(li);
      });
      if (!items.length && q.trim()) list.appendChild(el('li', 'zp-none', 'Nothing matches “' + q.trim().slice(0, 40) + '”. Try a city, a country or an offset such as +5:30.'));
      list.hidden = !q.trim();
      input.setAttribute('aria-expanded', String(!list.hidden));
      highlight(items.length ? 0 : -1);
    };
    input.addEventListener('focus', () => { try { input.select(); } catch (e) { /* fine */ } });
    input.addEventListener('input', (e) => { e.stopPropagation(); render(); });
    input.addEventListener('change', (e) => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) render(); highlight(Math.min(items.length - 1, active + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(Math.max(0, active - 1)); }
      else if (e.key === 'Enter') { if (!list.hidden && active >= 0) { e.preventDefault(); choose(active); } }
      else if (e.key === 'Escape') { if (!list.hidden) { e.preventDefault(); close(); show(); } }
    });
    input.addEventListener('blur', () => { close(); show(); });
    show();
    return { wrap, input, get value() { return cur; }, set(z) { cur = z; show(); } };
  }

  /* ============================================================
     Time zone converter
     ============================================================ */
  window.MVRTool.mountTimezone = function (root) {
    const io = root.querySelector('.tool-io');
    io.classList.add('tz-io');
    const L = window.MVRLive;
    const KEY = store('1234tools.timezone.v1');
    const saved = KEY.get() || {};
    const q = linkParams();
    const MAX_CITIES = 12;
    let fromLink = false, touched = false;

    let home = zoneOf(q.get('from'));
    if (home) fromLink = true; else home = zoneOf(saved.home) || hereZone();
    let cities = (q.get('to') || '').split(',').map(zoneOf).filter(Boolean);
    if (cities.length) fromLink = true;
    else cities = (saved.cities || []).map(zoneOf).filter(Boolean);
    if (!cities.length) cities = [home === 'America/New_York' ? 'Europe/London' : 'America/New_York', 'Asia/Kolkata', 'Asia/Tokyo'].filter(z => z !== home);
    cities = [...new Set(cities)].slice(0, MAX_CITIES);
    let ws = intIn(q.get('ws'), 0, 23), we = intIn(q.get('we'), 1, 24);
    if (ws !== null || we !== null) fromLink = true;
    if (ws === null) ws = intIn(saved.ws, 0, 23); if (ws === null) ws = 9;
    if (we === null) we = intIn(saved.we, 1, 24); if (we === null) we = 17;
    if (we <= ws) { ws = 9; we = 17; }

    /* Live: the clocks follow the current time until a date or time is chosen. */
    let live = true;
    const at0 = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(q.get('at') || '');
    const hereNow = L.partsIn(Date.now(), home);

    const form = el('div', 'gen-form');
    const mk = (label, id) => { const w = el('div', 'field'); const l = el('label', null, label); l.htmlFor = id; w.appendChild(l); return w; };
    const dw = mk('Date', 'tz-date');
    const dIn = el('input', 'control'); dIn.type = 'date'; dIn.id = 'tz-date';
    const tw = mk('Time', 'tz-time');
    const tIn = el('input', 'control'); tIn.type = 'time'; tIn.id = 'tz-time';
    if (at0 && validDay(at0[1]) && validTime(at0[2])) { dIn.value = at0[1]; tIn.value = at0[2]; live = false; fromLink = true; }
    else { dIn.value = isoDay(hereNow); tIn.value = pad(hereNow.h) + ':' + pad(hereNow.mi); }
    dw.appendChild(dIn); tw.appendChild(tIn);

    const fromPick = zonePicker('From zone', home, (z) => { home = z; touched = true; used(); run(); });
    fromPick.wrap.id = 'tz-from-wrap';

    const nowBtn = el('button', 'btn-ghost', 'Use current time');
    nowBtn.type = 'button';
    const swapBtn = el('button', 'swap', '⇅ Swap zones');
    swapBtn.type = 'button';
    swapBtn.title = 'Swap the from zone with the first city';
    form.appendChild(dw); form.appendChild(tw); form.appendChild(fromPick.wrap);
    form.appendChild(nowBtn); form.appendChild(swapBtn);

    const results = el('div', 'tool-results');
    results.setAttribute('aria-live', 'polite');
    const liveTag = el('p', 'tz-live');

    /* the cities */
    const citySec = el('section', 'tz-cities');
    citySec.setAttribute('aria-label', 'Cities');
    const cityHead = el('h3', null, 'Cities');
    const cityList = el('ul', 'tz-city-list');
    const addPick = zonePicker('Add a city', null, (z) => {
      if (cities.indexOf(z) < 0) { if (cities.length >= MAX_CITIES) cities.shift(); cities.push(z); }
      addPick.set(null); touched = true; used(); run();
      addPick.input.focus();
    }, 'Type a city, country, zone or offset');
    citySec.appendChild(cityHead); citySec.appendChild(cityList); citySec.appendChild(addPick.wrap);

    const notes = el('ul', 'tz-notes');
    notes.setAttribute('aria-live', 'polite');

    /* the meeting planner */
    const plan = el('section', 'tz-planner');
    plan.setAttribute('aria-label', 'Meeting planner');
    plan.appendChild(el('h3', null, 'Meeting planner'));
    const hoursRow = el('div', 'tz-plan-controls');
    const hourSel = (label, id, from, to, val) => {
      const w = el('div', 'field'); const l = el('label', null, label); l.htmlFor = id;
      const s = el('select', 'control'); s.id = id;
      for (let h = from; h <= to; h++) { const o = el('option', null, pad(h) + ':00'); o.value = h; if (h === val) o.selected = true; s.appendChild(o); }
      w.appendChild(l); w.appendChild(s); hoursRow.appendChild(w); return s;
    };
    const wsSel = hourSel('Working day starts', 'tz-ws', 0, 23, ws);
    const weSel = hourSel('and ends', 'tz-we', 1, 24, we);
    plan.appendChild(hoursRow);
    const overlap = el('p', 'tz-overlap');
    plan.appendChild(overlap);
    const gridWrap = el('div', 'table-scroll tz-grid-wrap');
    plan.appendChild(gridWrap);
    const legend = el('p', 'tz-legend');
    [['work', 'Working hours'], ['edge', 'Early or late'], ['night', 'Night'], ['off', 'Weekend']].forEach(([c, t]) => {
      const s = el('span', 'tz-key'); s.appendChild(el('i', 'tz-c-' + c)); s.appendChild(document.createTextNode(t)); legend.appendChild(s);
    });
    plan.appendChild(legend);
    plan.appendChild(el('p', 'tz-hint', 'Choose an hour along the top to set the time. A + or − beside an hour means the next or the previous day there.'));

    /* the calendar file and the copy */
    const out = el('section', 'tz-out');
    out.setAttribute('aria-label', 'Calendar file');
    const icsRow = el('div', 'tz-ics');
    const titleW = mk('Event title', 'tz-title');
    const titleIn = el('input', 'control'); titleIn.type = 'text'; titleIn.id = 'tz-title'; titleIn.value = 'Meeting'; titleIn.maxLength = 120;
    titleW.appendChild(titleIn);
    const lenW = mk('Length', 'tz-len');
    const lenSel = el('select', 'control'); lenSel.id = 'tz-len';
    [[15, '15 minutes'], [30, '30 minutes'], [45, '45 minutes'], [60, '1 hour'], [90, '1 hour 30 minutes'], [120, '2 hours']].forEach(([v, t]) => { const o = el('option', null, t); o.value = v; if (v === 60) o.selected = true; lenSel.appendChild(o); });
    lenW.appendChild(lenSel);
    const icsBtn = el('button', 'btn-primary', 'Download .ics');
    icsBtn.type = 'button';
    const copyBtn = el('button', 'btn-ghost', 'Copy the times');
    copyBtn.type = 'button';
    const outMsg = el('p', 'tz-out-msg');
    outMsg.setAttribute('role', 'status');
    icsRow.appendChild(titleW); icsRow.appendChild(lenW);
    const btnRow = el('div', 'io-actions');
    btnRow.appendChild(icsBtn); btnRow.appendChild(copyBtn);
    out.appendChild(el('h3', null, 'Add it to a calendar'));
    out.appendChild(icsRow); out.appendChild(btnRow); out.appendChild(outMsg);

    io.appendChild(results);
    io.appendChild(liveTag);
    io.appendChild(form);
    io.appendChild(notes);
    io.appendChild(citySec);
    io.appendChild(plan);
    io.appendChild(out);

    const fmtLong = (ms, z) => new Intl.DateTimeFormat('en-GB', { timeZone: z, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);
    const fmtDate = (ms, z) => new Intl.DateTimeFormat('en-GB', { timeZone: z, weekday: 'short', day: 'numeric', month: 'short' }).format(ms);
    const fmtDay = (ms, z) => new Intl.DateTimeFormat('en-GB', { timeZone: z, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(ms);
    const clock = (ms, z, secs) => { const p = L.partsIn(ms, z); return pad(p.h) + ':' + pad(p.mi) + (secs ? ':' + pad(p.s) : ''); };
    const diffText = (mins) => mins === 0 ? 'Same time' : (mins > 0 ? '+' : '−') + spanText(mins);

    /* the instant chosen: now, or the date and time typed in the from zone */
    let chosen = null;
    function resolve() {
      if (live) return { at: Date.now(), status: 'ok' };
      const [y, mo, d] = (dIn.value || '').split('-').map(Number);
      const [h, mi] = (tIn.value || '00:00').split(':').map(Number);
      if (!y || !mo || !d) return null;
      return L.resolveWallTime(y, mo, d, h || 0, mi || 0, home);
    }

    function paintTimes() {
      if (!chosen) return;
      const at = live ? Date.now() : chosen.at;
      cityList.querySelectorAll('[data-zone]').forEach(li => {
        const z = li.getAttribute('data-zone');
        li.querySelector('.tz-clock').textContent = clock(at, z, live);
        li.querySelector('.tz-date').textContent = fmtDate(at, z);
      });
      const v = results.querySelectorAll('.result-value');
      const zs = [cities[0] || home, home];
      if (v[0]) v[0].textContent = fmtLong(at, zs[0]);
      if (v[1]) v[1].textContent = fmtLong(at, zs[1]);
      if (v[5]) v[5].textContent = fmtLong(at, 'UTC');
    }

    function noteList(at) {
      const list = [];
      const r = chosen;
      if (!live && r.status === 'gap') {
        list.push(tIn.value + ' does not exist in ' + cityName(home) + ' on ' + fmtDay(r.at, home) + ': the clocks go forward then, so it is taken as ' + clock(r.at, home) + '.');
      } else if (!live && r.status === 'overlap') {
        list.push(tIn.value + ' happens twice in ' + cityName(home) + ' on ' + fmtDay(r.at, home) + ', as the clocks go back. This uses the first, at ' + offText(L.offsetAt(r.at, home)) + '; the second is ' + spanText((r.later - r.at) / 60000) + ' later everywhere else.');
      }
      const lo = Math.min(Date.now(), at), hi = Math.max(Date.now(), at) + 28 * 86400000;
      const zones = [home].concat(cities.filter(z => z !== home));
      zones.forEach(z => {
        L.zoneTransitions(z, lo, hi).slice(0, 2).forEach(t => {
          const before = L.partsIn(t.at - 60000, z);
          const mins = before.h * 60 + before.mi + 1;
          const oldClock = pad(Math.floor(mins / 60)) + ':' + pad(mins % 60);
          const step = spanText(Math.abs(t.to - t.from));
          let s = cityName(z) + ': the clocks go ' + (t.to > t.from ? 'forward ' : 'back ') + step + ' on ' + fmtDay(t.at, z) + ' at ' + oldClock +
            ' (' + offText(t.from) + ' to ' + offText(t.to) + ').';
          if (z !== home) {
            const gb = t.from - L.offsetAt(t.at - 60000, home), ga = t.to - L.offsetAt(t.at + 60000, home);
            if (gb !== ga) s += ' From then ' + cityName(z) + ' is ' + (ga === 0 ? 'on the same time as ' + cityName(home) : spanText(ga) + (ga > 0 ? ' ahead of ' : ' behind ') + cityName(home)) + ', not ' + (gb === 0 ? 'the same' : spanText(gb)) + '.';
          }
          list.push(s);
        });
      });
      return list;
    }

    function planner(at) {
      const hp = L.partsIn(at, home);
      const dayStart = L.resolveWallTime(hp.y, hp.mo, hp.d, 0, 0, home).at;
      const nx = new Date(Date.UTC(hp.y, hp.mo - 1, hp.d + 1));
      const next = L.resolveWallTime(nx.getUTCFullYear(), nx.getUTCMonth() + 1, nx.getUTCDate(), 0, 0, home).at;
      const hours = Math.max(1, Math.round((next - dayStart) / 3600000));
      const zones = [home].concat(cities.filter(z => z !== home));
      const rows = L.plannerRows(dayStart, hours, zones, home, { start: ws, end: we });
      const sel = Math.floor((at - dayStart) / 3600000);
      const t = el('table', 'tz-grid');
      const cap = el('caption', 'visually-hidden', 'Each city’s local hour for every hour of ' + fmtDay(at, home) + ' in ' + cityName(home));
      t.appendChild(cap);
      const thead = el('thead'), hr = el('tr');
      const corner = el('th', 'tz-corner', cityName(home) + ' time'); corner.scope = 'col';
      hr.appendChild(corner);
      rows[0].cells.forEach((c, i) => {
        const th = el('th'); th.scope = 'col';
        const b = el('button', 'tz-hour', c.label);
        b.type = 'button'; b.tabIndex = i === Math.max(0, Math.min(hours - 1, sel)) ? 0 : -1;
        b.setAttribute('data-col', i);
        b.setAttribute('aria-label', 'Set the time to ' + clock(c.at, home) + ' ' + cityName(home) + ' time');
        if (i === sel) th.classList.add('is-sel');
        th.appendChild(b); hr.appendChild(th);
      });
      thead.appendChild(hr); t.appendChild(thead);
      const tb = el('tbody');
      rows.forEach(r => {
        const tr = el('tr');
        const th = el('th', null, cityName(r.zone)); th.scope = 'row';
        tr.appendChild(th);
        r.cells.forEach((c, i) => {
          const td = el('td', 'tz-c-' + c.cls + (i === sel ? ' is-sel' : ''), c.label);
          if (c.shift) { td.appendChild(el('sup', null, c.shift > 0 ? '+' : '−')); td.title = fmtDay(c.at, r.zone); }
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      gridWrap.innerHTML = '';
      gridWrap.appendChild(t);
      /* the chosen hour in view, a little in from the left */
      const th = t.querySelector('thead th.is-sel');
      if (th) gridWrap.scrollLeft = Math.max(0, th.offsetLeft - corner.offsetWidth - 3 * th.offsetWidth);
      const runs = L.sharedWorkTimes(dayStart, next, zones, { start: ws, end: we });
      if (zones.length < 2) overlap.textContent = 'Add a city to see the hours you share.';
      else if (!runs.length) overlap.textContent = 'No hour on ' + fmtDay(at, home) + ' is inside working hours (' + pad(ws) + ':00 to ' + pad(we) + ':00) in every city. The amber hours are the nearest.';
      else overlap.textContent = 'Inside working hours everywhere: ' + runs.map(x => clock(x.from, home) + '–' + (x.to >= next ? '24:00' : clock(x.to, home))).join(', ') + ' ' + cityName(home) + ' time.';
    }

    function params() {
      const p = { from: home, to: cities.join(',') };
      if (!live) p.at = dIn.value + 'T' + tIn.value;
      if (ws !== 9 || we !== 17) { p.ws = String(ws); p.we = String(we); }
      return p;
    }

    function run() {
      chosen = resolve();
      results.innerHTML = ''; cityList.innerHTML = ''; notes.innerHTML = '';
      if (!chosen) { liveTag.textContent = 'Choose a date.'; announce({ kind: 'live', params: {}, summary: null, changed: touched || fromLink }); return; }
      const at = chosen.at;
      const first = cities[0] || home;
      liveTag.textContent = live ? 'Showing the current time, live. Change the date or time to plan another moment.' : '';
      const offFrom = L.offsetAt(at, home), offTo = L.offsetAt(at, first);
      const main = el('div', 'result result-primary');
      main.appendChild(el('span', 'result-label', zoneLabel(first)));
      main.appendChild(el('span', 'result-value', fmtLong(at, first)));
      results.appendChild(main);
      [[zoneLabel(home), fmtLong(at, home)],
       ['Difference', diffText(offTo - offFrom)],
       ['Offset, source', offText(offFrom)],
       ['Offset, target', offText(offTo)],
       ['UTC', fmtLong(at, 'UTC')]
      ].forEach(([k, v]) => {
        const r = el('div', 'result');
        r.appendChild(el('span', 'result-label', k)); r.appendChild(el('span', 'result-value', v));
        results.appendChild(r);
      });

      cities.forEach((z, i) => {
        const li = el('li', 'tz-city');
        li.setAttribute('data-zone', z);
        const name = el('div', 'tz-city-name');
        name.appendChild(el('strong', null, cityName(z)));
        const e = zoneIndex().byId[z];
        name.appendChild(el('span', null, [e && e.country, offText(L.offsetAt(at, z))].filter(Boolean).join(' · ')));
        const time = el('div', 'tz-city-time');
        time.appendChild(el('span', 'tz-clock'));
        time.appendChild(el('span', 'tz-date'));
        const diff = el('span', 'tz-diff', diffText(L.offsetAt(at, z) - offFrom));
        const ctl = el('div', 'tz-city-ctl');
        if (i > 0) {
          const up = el('button', 'tz-btn', '↑'); up.type = 'button'; up.setAttribute('aria-label', 'Move ' + cityName(z) + ' up');
          up.addEventListener('click', () => { cities.splice(i, 1); cities.splice(i - 1, 0, z); touched = true; run(); const b = cityList.querySelectorAll('.tz-city')[i - 1]; if (b) (b.querySelector('.tz-btn') || b).focus(); });
          ctl.appendChild(up);
        }
        const rm = el('button', 'tz-btn tz-remove', '×'); rm.type = 'button'; rm.setAttribute('aria-label', 'Remove ' + cityName(z));
        rm.addEventListener('click', () => { cities.splice(i, 1); touched = true; used(); run(); addPick.input.focus(); });
        ctl.appendChild(rm);
        li.appendChild(name); li.appendChild(time); li.appendChild(diff); li.appendChild(ctl);
        cityList.appendChild(li);
      });
      if (!cities.length) cityList.appendChild(el('li', 'tz-empty', 'No cities yet: add one below.'));
      paintTimes();

      noteList(at).forEach(s => notes.appendChild(el('li', 'io-msg is-warn', s)));
      planner(at);

      const summary = clock(at, home) + ' ' + cityName(home) + ' = ' + cities.filter(z => z !== home).map(z => clock(at, z) + ' ' + cityName(z) + (L.partsIn(at, z).d !== L.partsIn(at, home).d ? ' (' + fmtDate(at, z) + ')' : '')).join(' · ');
      announce({ kind: 'live', params: params(), summary: summary.length > 120 ? summary.slice(0, 119) + '…' : summary, changed: touched || fromLink });
      if (touched) KEY.set({ home, cities, ws, we });
    }

    const edited = () => { live = false; touched = true; used(); run(); };
    dIn.addEventListener('input', edited); dIn.addEventListener('change', edited);
    tIn.addEventListener('input', edited); tIn.addEventListener('change', edited);
    nowBtn.addEventListener('click', () => {
      live = true; touched = true;
      const p = L.partsIn(Date.now(), home);
      dIn.value = isoDay(p); tIn.value = pad(p.h) + ':' + pad(p.mi);
      run();
    });
    swapBtn.addEventListener('click', () => {
      if (!cities.length) return;
      const f = home; home = cities[0]; cities[0] = f;
      fromPick.set(home);
      if (!live && chosen) { const p = L.partsIn(chosen.at, home); dIn.value = isoDay(p); tIn.value = pad(p.h) + ':' + pad(p.mi); }
      touched = true; used(); run();
    });
    const hoursChanged = () => {
      const a = Number(wsSel.value), b = Number(weSel.value);
      if (b <= a) { if (document.activeElement === wsSel) weSel.value = String(Math.min(24, a + 1)); else wsSel.value = String(Math.max(0, b - 1)); }
      ws = Number(wsSel.value); we = Number(weSel.value); touched = true; run();
    };
    wsSel.addEventListener('change', hoursChanged); weSel.addEventListener('change', hoursChanged);
    gridWrap.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('.tz-hour');
      if (!b || !chosen) return;
      const hp = L.partsIn(chosen.at, home);
      const dayStart = L.resolveWallTime(hp.y, hp.mo, hp.d, 0, 0, home).at;
      const p = L.partsIn(dayStart + Number(b.getAttribute('data-col')) * 3600000, home);
      dIn.value = isoDay(p); tIn.value = pad(p.h) + ':' + pad(p.mi);
      const col = b.getAttribute('data-col');
      edited();
      const nb = gridWrap.querySelector('.tz-hour[data-col="' + col + '"]');
      if (nb) nb.focus();
    });
    /* one tab stop for the row of hours; the arrow keys move along it */
    gridWrap.addEventListener('keydown', (e) => {
      const b = e.target.closest && e.target.closest('.tz-hour');
      if (!b || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End')) return;
      const all = [...gridWrap.querySelectorAll('.tz-hour')];
      const i = all.indexOf(b);
      const j = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : Math.max(0, Math.min(all.length - 1, i + (e.key === 'ArrowLeft' ? -1 : 1)));
      e.preventDefault();
      all.forEach((x, k) => { x.tabIndex = k === j ? 0 : -1; });
      all[j].focus();
    });

    const lines = () => {
      const at = chosen.at;
      return [home].concat(cities.filter(z => z !== home)).map(z => zoneLabel(z) + ': ' + fmtLong(at, z) + ' (' + offText(L.offsetAt(at, z)) + ')');
    };
    icsBtn.addEventListener('click', () => {
      if (!chosen) return;
      const at = live ? Math.ceil(Date.now() / 60000) * 60000 : chosen.at;
      const title = titleIn.value.trim() || 'Meeting';
      const text = L.buildICS({ title, start: at, minutes: Number(lenSel.value) || 60, description: lines().join('\n') });
      const blob = new Blob([text], { type: 'text/calendar' });
      const p = L.partsIn(at, home);
      download(blob, (title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'meeting') + '-' + isoDay(p) + '-' + pad(p.h) + pad(p.mi) + '.' + extOf(blob.type));
      outMsg.textContent = 'Saved a calendar file for ' + fmtLong(at, home) + ' ' + cityName(home) + ' time. Your calendar shows it in its own time zone.';
      used();
    });
    copyBtn.addEventListener('click', () => {
      if (!chosen || !navigator.clipboard) { outMsg.textContent = 'This browser does not allow copying from here.'; return; }
      navigator.clipboard.writeText(lines().join('\n')).then(() => { outMsg.textContent = 'Copied ' + lines().length + ' lines.'; }, () => { outMsg.textContent = 'This browser did not allow the copy.'; });
    });

    run();
    /* live clocks: each second; the inputs, the planner and the notes follow the minute */
    let lastMin = Math.floor(Date.now() / 60000);
    const timer = setInterval(() => {
      if (!live) return;
      const m = Math.floor(Date.now() / 60000);
      if (m !== lastMin) {
        lastMin = m;
        const p = L.partsIn(Date.now(), home);
        if (document.activeElement !== dIn && document.activeElement !== tIn) { dIn.value = isoDay(p); tIn.value = pad(p.h) + ':' + pad(p.mi); }
        run();
      } else paintTimes();
    }, 1000);
    window.addEventListener('pagehide', () => clearInterval(timer));
  };

  /* ============================================================
     Countdown
     ============================================================ */
  window.MVRTool.mountCountdown = function (root) {
    const io = root.querySelector('.tool-io');
    const L = window.MVRLive;
    const KEY = store('1234tools.countdown.v1');
    const saved = KEY.get() || {};
    const q = linkParams();
    let fromLink = false, touched = false;
    const here = hereZone();

    const THEMES = [['gold', 'Gold'], ['night', 'Night'], ['paper', 'Paper'], ['neon', 'Neon']];
    const MODES = [['down', 'Down to it, then up once it passes'], ['since', 'Time since it (counting up)']];
    const REPEATS = [['none', 'Never'], ['daily', 'Every day'], ['weekly', 'Every week'], ['monthly', 'Every month'], ['yearly', 'Every year']];
    const has = (list, v) => list.some(x => x[0] === v);

    const soon = L.partsIn(Date.now() + 30 * 86400000, here);
    const pick = (k, ok, dflt) => { const v = q.get(k); if (v !== null && ok(v)) { fromLink = true; return v; } const s = saved[k]; return s !== undefined && s !== null && ok(String(s)) ? String(s) : dflt; };
    const st = {
      name: pick('name', (v) => v.length <= 120, 'My event'),
      date: pick('date', validDay, isoDay(soon)),
      time: pick('time', validTime, '09:00'),
      tz: zoneOf(pick('tz', (v) => !!zoneOf(v), here)) || here,
      mode: pick('mode', (v) => has(MODES, v), 'down'),
      repeat: pick('repeat', (v) => has(REPEATS, v), 'none'),
      theme: pick('theme', (v) => has(THEMES, v), 'gold'),
      sound: has(Sound.LABELS, saved.sound) ? saved.sound : 'beep',
      notify: !!saved.notify
    };

    const stage = el('div', 'countdown-stage');
    stage.setAttribute('data-clarity-mask', 'true');
    const title = el('div', 'countdown-title', '');
    const clockEl = el('div', 'countdown-clock');
    clockEl.setAttribute('role', 'timer');
    const units = ['Days', 'Hours', 'Minutes', 'Seconds'].map(name => {
      const box = el('div', 'countdown-unit');
      const v = el('div', 'countdown-val', '0');
      box.appendChild(v);
      box.appendChild(el('div', 'countdown-lbl', name));
      clockEl.appendChild(box);
      return v;
    });
    const sub = el('div', 'countdown-sub', '');
    const extra = el('div', 'countdown-extra', '');
    const fsBtn = el('button', 'btn-ghost cd-fs', 'Full screen');
    fsBtn.type = 'button';
    stage.appendChild(title); stage.appendChild(clockEl); stage.appendChild(sub); stage.appendChild(extra); stage.appendChild(fsBtn);

    const form = el('div', 'gen-form cd-form');
    const field = (label, id, input) => { const w = el('div', 'field'); const l = el('label', null, label); l.htmlFor = id; input.id = id; w.appendChild(l); w.appendChild(input); form.appendChild(w); return input; };
    const nIn = field('Event name', 'cd-label', Object.assign(el('input', 'control'), { type: 'text', value: st.name, maxLength: 120 }));
    const dIn = field('Target date', 'cd-date', Object.assign(el('input', 'control'), { type: 'date', value: st.date }));
    const tIn = field('Target time', 'cd-time', Object.assign(el('input', 'control'), { type: 'time', value: st.time }));
    const tzPick = zonePicker('Time zone of the event', st.tz, (z) => { st.tz = z; change(); });
    form.appendChild(tzPick.wrap);
    const sel = (label, id, list, val) => { const s = el('select', 'control'); list.forEach(([v, t]) => { const o = el('option', null, t); o.value = v; if (v === val) o.selected = true; s.appendChild(o); }); return field(label, id, s); };
    const mSel = sel('Count', 'cd-mode', MODES, st.mode);
    const rSel = sel('Repeat', 'cd-repeat', REPEATS, st.repeat);
    const thSel = sel('Theme', 'cd-theme', THEMES, st.theme);
    const snd = soundSelect('Sound at zero', st.sound, 'cd-sound');
    form.appendChild(snd.wrap);
    const nBox = notifyBox('Notify me at zero', st.notify, (on) => { st.notify = on; save(); });
    const alerts = el('div', 'cd-alerts');
    alerts.appendChild(nBox.wrap);
    const alertMsg = el('p', 'tt-note cd-alert-msg');
    alerts.appendChild(alertMsg);

    io.appendChild(stage);
    io.appendChild(form);
    io.appendChild(alerts);

    const save = () => { if (touched) KEY.set({ name: st.name, date: st.date, time: st.time, tz: st.tz, mode: st.mode, repeat: st.repeat, theme: st.theme, sound: st.sound, notify: st.notify }); };

    let target = null, alarm = null, tone = null, firedFor = null;
    const eventOf = () => {
      if (!validDay(st.date)) return null;
      const [y, mo, d] = st.date.split('-').map(Number);
      const [h, mi] = (validTime(st.time) ? st.time : '00:00').split(':').map(Number);
      return { y, mo, d, h, mi, zone: st.tz, repeat: st.repeat };
    };
    /* the moment counted to (or from): the next time round for a repeating event */
    function computeTarget(after) {
      const ev = eventOf();
      if (!ev) { target = null; return; }
      const first = L.resolveWallTime(ev.y, ev.mo, ev.d, ev.h, ev.mi, ev.zone).at;
      if (st.mode === 'since') { target = { at: first, first, n: 0 }; return; }
      const nx = L.nextOccurrence(ev, Math.max(Date.now(), after || 0));
      target = { at: nx.at, first, n: nx.n };
    }
    const fmtWhen = (ms, z) => new Intl.DateTimeFormat('en-GB', { timeZone: z, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);
    /* whole years, months and days from a to b in the event's zone */
    const calendarSpan = (a, b, z) => {
      const p = L.partsIn(a, z), r = L.partsIn(b, z);
      let months = (r.y - p.y) * 12 + (r.mo - p.mo);
      if (r.d < p.d || (r.d === p.d && r.h * 60 + r.mi < p.h * 60 + p.mi)) months--;
      if (months < 0) return null;
      const anchor = new Date(Date.UTC(p.y, p.mo - 1 + months, 1));
      const dim = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0)).getUTCDate();
      const startDay = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), Math.min(p.d, dim));
      let days = Math.floor((Date.UTC(r.y, r.mo - 1, r.d) - startDay) / 86400000);
      if (r.h * 60 + r.mi < p.h * 60 + p.mi) days--;
      if (days < 0) days = 0;
      const y = Math.floor(months / 12), m = months % 12;
      const part = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
      return [y ? part(y, 'year') : '', m ? part(m, 'month') : '', part(days, 'day')].filter(Boolean).join(', ');
    };

    function tick() {
      if (!target) {
        title.textContent = 'Choose a target date';
        units.forEach((u, i) => { u.textContent = i ? '00' : '0'; });
        sub.textContent = ''; extra.textContent = ''; setTitle('');
        return;
      }
      const now = Date.now();
      const diff = target.at - now;
      const since = st.mode === 'since';
      const past = diff <= 0;
      const s = L.splitSpan(diff);
      units[0].textContent = s.days.toLocaleString('en-GB');
      units[1].textContent = pad(s.hours);
      units[2].textContent = pad(s.minutes);
      units[3].textContent = pad(s.seconds);
      const name = st.name.trim() || 'the target';
      title.textContent = since ? (past ? 'Since ' + name : name + ' is still to come') : (past ? 'Since ' + name : 'Until ' + name);
      stage.classList.toggle('is-past', past);
      sub.textContent = fmtWhen(target.at, st.tz) + (st.tz !== here ? ' (' + cityName(st.tz) + ' time; ' + fmtWhen(target.at, here) + ' where you are)' : '') +
        (past && !since ? ' — this has passed' : '');
      if (since && past) extra.textContent = calendarSpan(target.at, now, st.tz) + ' · ' + Math.floor(-diff / 86400000).toLocaleString('en-GB') + ' days in all';
      else if (st.repeat !== 'none' && !since) extra.textContent = 'Repeats ' + REPEATS.find(r => r[0] === st.repeat)[1].toLowerCase() + (target.n ? ' · occurrence ' + (target.n + 1) : '');
      else extra.textContent = '';
      const short = (s.days ? s.days + 'd ' : '') + pad(s.hours) + ':' + pad(s.minutes) + ':' + pad(s.seconds);
      setTitle((past ? '+' : '') + short + ' ' + name.slice(0, 40));
    }

    /* the moment of zero: a timeout armed to it (re-armed in steps, as a
       timeout cannot wait more than 24.8 days), a tone on the audio clock,
       and a re-check whenever the tab is shown */
    function arm() {
      clearTimeout(alarm);
      if (!target || st.mode === 'since') return;
      const left = target.at - Date.now();
      if (left <= 25) {
        if (firedFor !== target.at && left > -2000) zero();
        else if (st.repeat !== 'none') { computeTarget(target.at + 1000); schedule(); }
        return;
      }
      if (!tone && Sound.has() && left < 6 * 3600000) tone = Sound.schedule(target.at, st.sound);
      else tone = Sound.sync(tone);
      alarm = setTimeout(arm, Math.min(MAX_WAIT, left > 4000 ? left - 2500 : left));
    }
    function schedule() {
      Sound.cancel(tone); tone = null;
      if (target && st.mode !== 'since' && target.at > Date.now() && Sound.has() && target.at - Date.now() < 6 * 3600000) tone = Sound.schedule(target.at, st.sound);
      arm();
    }
    function zero() {
      firedFor = target.at;
      tone = Sound.due(tone, st.sound);
      if (nBox.on) Notify.send(st.name.trim() || 'Countdown', 'The countdown has reached zero: ' + fmtWhen(target.at, st.tz) + '.', 'countdown');
      stage.classList.remove('is-zero'); void stage.offsetWidth; stage.classList.add('is-zero');
      if (st.repeat !== 'none') computeTarget(firedFor + 1000);
      tone = null;
      schedule();
      tick();
    }
    /* a tone can only be set up after a click; long countdowns are set up again nearer the time */
    io.addEventListener('pointerdown', () => { if (st.sound !== 'none' && !Sound.has()) { Sound.prime(); schedule(); } });
    io.addEventListener('keydown', () => { if (st.sound !== 'none' && !Sound.has()) { Sound.prime(); schedule(); } });
    document.addEventListener('visibilitychange', () => { if (target && st.mode !== 'since' && firedFor !== target.at && target.at - Date.now() <= 25 && target.at - Date.now() > -60000) zero(); else arm(); });

    function announceState() {
      const p = { name: st.name.slice(0, 120), date: st.date, time: st.time, tz: st.tz };
      if (st.mode !== 'down') p.mode = st.mode;
      if (st.repeat !== 'none') p.repeat = st.repeat;
      if (st.theme !== 'gold') p.theme = st.theme;
      const summary = target ? (st.mode === 'since' ? 'Time since ' : 'Countdown to ') + (st.name.trim() || 'the event') + ': ' + fmtWhen(target.first, st.tz) + ' (' + cityName(st.tz) + ')' : null;
      announce({ kind: 'live', params: target ? p : {}, summary: summary && summary.length > 120 ? summary.slice(0, 119) + '…' : summary, changed: touched || fromLink });
    }
    function applyTheme() { THEMES.forEach(([t]) => stage.classList.toggle('cd-theme-' + t, t === st.theme)); }
    function change() {
      st.name = nIn.value; st.date = dIn.value; st.time = tIn.value; st.mode = mSel.value; st.repeat = rSel.value; st.theme = thSel.value; st.sound = snd.sel.value;
      rSel.disabled = st.mode === 'since';
      touched = true; used();
      computeTarget(); applyTheme(); schedule(); tick(); announceState(); save();
      alertMsg.textContent = st.sound !== 'none' && !Sound.has() ? 'The sound is set up when you next click or type on the page.' : '';
    }
    [nIn, dIn, tIn, mSel, rSel, thSel, snd.sel].forEach(x => { x.addEventListener('input', change); x.addEventListener('change', change); });
    snd.sel.addEventListener('change', () => { if (snd.sel.value !== 'none') Sound.test(snd.sel.value); });

    /* full screen: the Fullscreen API where there is one, and a page-filling panel where not (iPhone) */
    const canFs = !!(stage.requestFullscreen || stage.webkitRequestFullscreen);
    const isFs = () => (document.fullscreenElement || document.webkitFullscreenElement) === stage || stage.classList.contains('cd-fill');
    const fsLabel = () => { fsBtn.textContent = isFs() ? 'Exit full screen' : 'Full screen'; };
    fsBtn.addEventListener('click', () => {
      if (isFs()) {
        if (stage.classList.contains('cd-fill')) stage.classList.remove('cd-fill');
        else (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else if (canFs) {
        try { const r = (stage.requestFullscreen || stage.webkitRequestFullscreen).call(stage); if (r && r.catch) r.catch(() => { stage.classList.add('cd-fill'); fsLabel(); }); }
        catch (e) { stage.classList.add('cd-fill'); }
      } else stage.classList.add('cd-fill');
      fsLabel();
    });
    document.addEventListener('fullscreenchange', fsLabel);
    document.addEventListener('webkitfullscreenchange', fsLabel);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stage.classList.contains('cd-fill')) { stage.classList.remove('cd-fill'); fsLabel(); } });

    rSel.disabled = st.mode === 'since';
    if (st.sound !== 'none') alertMsg.textContent = 'The sound is set up when you next click or type on the page.';
    computeTarget(); applyTheme(); tick(); announceState(); arm();
    const timer = setInterval(tick, 250);
    window.addEventListener('pagehide', () => { clearInterval(timer); clearTimeout(alarm); });
  };

  /* ============================================================
     Stopwatch / timer / pomodoro
     ============================================================ */
  window.MVRTool.mountStopwatch = function (root) {
    const io = root.querySelector('.tool-io');
    const KEY = store('1234tools.stopwatch.v1');
    const saved = KEY.get() || {};
    const q = linkParams();
    let fromLink = false, touched = false;
    const TABS = [['stopwatch', 'Stopwatch'], ['timer', 'Timer'], ['pomodoro', 'Pomodoro']];
    let active = TABS.some(t => t[0] === q.get('tab')) ? (fromLink = true, q.get('tab')) : (TABS.some(t => t[0] === saved.tab) ? saved.tab : 'stopwatch');
    const settings = { sound: Sound.LABELS.some(l => l[0] === saved.sound) ? saved.sound : 'beep', notify: !!saved.notify };

    const tabs = el('div', 'sw-tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Mode');
    const panels = {};
    const showTab = (k) => {
      active = k;
      [...tabs.children].forEach(x => x.setAttribute('aria-pressed', String(x.dataset.tab === k)));
      Object.entries(panels).forEach(([pk, p]) => { p.hidden = pk !== k; });
      /* the alert settings belong to the timers and the Pomodoro */
      opts.hidden = k === 'stopwatch';
    };
    TABS.forEach(([k, label]) => {
      const b = el('button', 'sw-tab', label);
      b.type = 'button';
      b.dataset.tab = k;
      b.setAttribute('aria-pressed', String(k === active));
      b.addEventListener('click', () => { showTab(k); touched = true; save(); share(); });
      tabs.appendChild(b);
    });

    /* settings shared by the three: the alert sound and notifications */
    const opts = el('div', 'sw-opts');
    const snd = soundSelect('Alert sound', settings.sound, 'sw-sound');
    const testBtn = el('button', 'btn-ghost sw-test', 'Play');
    testBtn.type = 'button';
    testBtn.setAttribute('aria-label', 'Play the alert sound');
    snd.wrap.appendChild(testBtn);
    const nBox = notifyBox('Notify me when a timer or a Pomodoro phase ends', settings.notify, (on) => { settings.notify = on; save(); });
    opts.appendChild(snd.wrap); opts.appendChild(nBox.wrap);
    snd.sel.addEventListener('change', () => { settings.sound = snd.sel.value; touched = true; save(); Sound.test(settings.sound); resched(); });
    testBtn.addEventListener('click', () => Sound.test(settings.sound === 'none' ? 'beep' : settings.sound));
    const keysHint = el('p', 'sw-keys');
    keysHint.innerHTML = 'Keys: <kbd>Space</kbd> start or pause · <kbd>L</kbd> lap · <kbd>R</kbd> reset';
    const restoreMsg = el('p', 'tt-note sw-restore');
    restoreMsg.setAttribute('role', 'status');

    /* the tones scheduled on the audio clock, by owner */
    const tones = new Map();
    const setTone = (owner, at) => { Sound.cancel(tones.get(owner)); tones.delete(owner); if (Sound.has() && at > Date.now()) { const h = Sound.schedule(at, settings.sound); if (h) tones.set(owner, h); } };
    const dropTone = (owner) => { Sound.cancel(tones.get(owner)); tones.delete(owner); };
    const dueTone = (owner) => { const h = Sound.due(tones.get(owner), settings.sound); tones.delete(owner); return h; };
    const syncTone = (owner) => { const h = tones.get(owner); if (h) { const n = Sound.sync(h); if (n) tones.set(owner, n); else tones.delete(owner); } };
    const resched = () => keepers.forEach(k => k.resched && k.resched());

    /* each running countdown's re-check, run whenever the tab is hidden or
       shown: a deadline that passed while the browser held timers back (as
       Chrome does in a tab hidden for long) is acted on at once */
    const keepers = [];
    /* A timeout can wake a millisecond or two before Date.now() reaches the
       deadline; re-arming for that sliver would wait for the next wake-up a
       background tab is allowed (up to a second), so this close counts as due. */
    const EARLY = 25;
    document.addEventListener('visibilitychange', () => keepers.forEach(k => k.check()));

    const fmt = (ms) => {
      const t = Math.max(0, ms);
      const h = Math.floor(t / 3600000);
      const m = Math.floor(t / 60000) % 60;
      const s = Math.floor(t / 1000) % 60;
      const cs = Math.floor(t / 10) % 100;
      return (h ? h + ':' : '') + pad(m) + ':' + pad(s) + '.' + pad(cs);
    };
    const short = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(t / 3600); return (h ? h + ':' : '') + pad(Math.floor(t / 60) % 60) + ':' + pad(t % 60); };
    const clockAt = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    /* ---- stopwatch ---- */
    const SW = (() => {
      const p = el('div', 'sw-panel');
      const disp = el('div', 'sw-display', '00:00.00');
      disp.setAttribute('role', 'timer');
      const btns = el('div', 'sw-buttons');
      const laps = el('div', 'sw-laps');
      const lapActs = el('div', 'io-actions sw-lap-acts');
      const s0 = saved.sw || {};
      /* performance.now() for the display while the page is open; Date.now()
         alongside it, so a reload can carry on from the same moment */
      let running = !!s0.running && isFinite(s0.t0), acc = running ? 0 : Math.max(0, Number(s0.acc) || 0);
      let p0 = running ? performance.now() - (Date.now() - Number(s0.t0)) : 0, raf = null;
      const lapTotals = Array.isArray(s0.laps) ? s0.laps.filter(n => isFinite(n)).slice(-999) : [];
      const elapsed = () => acc + (running ? performance.now() - p0 : 0);

      const startBtn = el('button', 'btn-primary', running ? 'Stop' : (acc ? 'Resume' : 'Start'));
      const lapBtn = el('button', 'btn-ghost', 'Lap');
      const resetBtn = el('button', 'btn-ghost', 'Reset');
      lapBtn.disabled = !running;
      [startBtn, lapBtn, resetBtn].forEach(b => { b.type = 'button'; btns.appendChild(b); });
      const csvBtn = el('button', 'btn-ghost', 'Download laps (CSV)');
      csvBtn.type = 'button';
      lapActs.appendChild(csvBtn);

      const paint = () => {
        disp.textContent = fmt(elapsed());
        if (running) raf = requestAnimationFrame(paint);
      };
      const drawLaps = () => {
        laps.innerHTML = '';
        const splits = lapTotals.map((t, i) => t - (i ? lapTotals[i - 1] : 0));
        const fast = splits.length >= 3 ? Math.min(...splits) : null, slow = splits.length >= 3 ? Math.max(...splits) : null;
        for (let i = lapTotals.length - 1; i >= 0; i--) {
          const row = el('div', 'sw-lap' + (splits[i] === fast ? ' is-fast' : splits[i] === slow ? ' is-slow' : ''));
          row.appendChild(el('span', 'sw-lap-n', '#' + (i + 1)));
          row.appendChild(el('span', 'sw-lap-split', fmt(splits[i])));
          row.appendChild(el('span', 'sw-lap-total', fmt(lapTotals[i])));
          if (splits[i] === fast) row.title = 'Fastest lap'; else if (splits[i] === slow) row.title = 'Slowest lap';
          laps.appendChild(row);
        }
        lapActs.hidden = !lapTotals.length;
      };
      const toggle = () => {
        if (running) {
          acc = elapsed(); running = false;
          startBtn.textContent = 'Resume';
          cancelAnimationFrame(raf); paint();
          lapBtn.disabled = true;
        } else {
          p0 = performance.now(); running = true;
          startBtn.textContent = 'Stop';
          lapBtn.disabled = false;
          paint();
        }
        touched = true; used(); save();
      };
      const lap = () => {
        if (!running) return;
        lapTotals.push(Math.floor(elapsed()));      // whole milliseconds: the list, the CSV and the saved state agree
        drawLaps(); save();
      };
      const reset = () => {
        running = false; acc = 0; lapTotals.length = 0;
        cancelAnimationFrame(raf);
        startBtn.textContent = 'Start';
        lapBtn.disabled = true;
        disp.textContent = '00:00.00';
        drawLaps(); save();
      };
      startBtn.addEventListener('click', toggle);
      lapBtn.addEventListener('click', lap);
      resetBtn.addEventListener('click', reset);
      csvBtn.addEventListener('click', () => {
        const rows = [['Lap', 'Split', 'Total', 'Split (s)', 'Total (s)']];
        /* whole milliseconds, so 1049.6 ms is 00:01.04 and 1.049 s alike
           (rounding the seconds would print 1.050 beside 00:01.04) */
        const whole = lapTotals.map(Math.floor);
        whole.forEach((t, i) => { const sp = t - (i ? whole[i - 1] : 0); rows.push([i + 1, fmt(sp), fmt(t), (sp / 1000).toFixed(3), (t / 1000).toFixed(3)]); });
        const blob = new Blob([rows.map(r => r.join(',')).join('\r\n') + '\r\n'], { type: 'text/csv' });
        const n = new Date();
        download(blob, 'stopwatch-laps-' + n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate()) + '-' + pad(n.getHours()) + pad(n.getMinutes()) + '.' + extOf(blob.type));
      });

      p.appendChild(disp); p.appendChild(btns); p.appendChild(laps); p.appendChild(lapActs);
      drawLaps();
      if (running) paint(); else disp.textContent = fmt(acc);
      return {
        panel: p, toggle, lap, reset,
        state: () => ({ running, acc: running ? 0 : acc, t0: running ? Date.now() - elapsed() : 0, laps: lapTotals.slice() }),
        title: () => running ? fmt(elapsed()).replace(/.dd$/, '') + ' stopwatch' : null
      };
    })();
    panels.stopwatch = SW.panel;

    /* ---- timers: one or more, each with its own deadline ---- */
    const timersPanel = el('div', 'sw-panel sw-timers');
    timersPanel.hidden = true;
    const timerList = el('div', 'sw-timer-list');
    const addBtn = el('button', 'btn-ghost sw-add', '+ Add a timer');
    addBtn.type = 'button';
    timersPanel.appendChild(timerList);
    timersPanel.appendChild(addBtn);
    panels.timer = timersPanel;
    const timers = [];
    const MAX_TIMERS = 8;
    let timerSeq = 0;

    function makeTimer(cfg) {
      cfg = cfg || {};
      const owner = 'timer-' + (++timerSeq);
      const box = el('div', 'sw-timer');
      const head = el('div', 'sw-timer-head');
      const label = el('input', 'control sw-label');
      label.type = 'text'; label.maxLength = 40; label.value = cfg.label || ('Timer ' + (timers.length + 1));
      label.setAttribute('aria-label', 'Timer name');
      const rm = el('button', 'tz-btn sw-remove', '×'); rm.type = 'button';
      head.appendChild(label); head.appendChild(rm);
      const disp = el('div', 'sw-display', '05:00.00');
      disp.setAttribute('role', 'timer');
      const form = el('div', 'sw-inputs');
      const mkNum = (lbl, val, max) => {
        const w = el('div', 'field');
        const id = owner + '-' + lbl.toLowerCase();
        const l = el('label', null, lbl); l.htmlFor = id;
        w.appendChild(l);
        const i = el('input', 'control');
        i.type = 'number'; i.min = 0; i.max = max; i.value = val; i.id = id; i.inputMode = 'numeric';
        w.appendChild(i);
        form.appendChild(w);
        return i;
      };
      const hIn = mkNum('Hours', cfg.h !== undefined ? cfg.h : 0, 99), mIn = mkNum('Minutes', cfg.m !== undefined ? cfg.m : 5, 59), sIn = mkNum('Seconds', cfg.s !== undefined ? cfg.s : 0, 59);
      const startBtn = el('button', 'btn-primary', 'Start');
      const resetBtn = el('button', 'btn-ghost', 'Reset');
      const btns = el('div', 'sw-buttons');
      [startBtn, resetBtn].forEach(b => { b.type = 'button'; btns.appendChild(b); });
      const ended = el('p', 'sw-ended');
      ended.hidden = true;
      box.appendChild(head); box.appendChild(disp); box.appendChild(form); box.appendChild(btns); box.appendChild(ended);

      let running = false, endsAt = 0, remaining = 0, raf = null, fired = false, alarm = null;
      const total = () => ((Number(hIn.value) || 0) * 3600 + (Number(mIn.value) || 0) * 60 + (Number(sIn.value) || 0)) * 1000;
      const setFromInputs = () => {
        remaining = total();
        disp.textContent = fmt(remaining);
        fired = false; ended.hidden = true;
        box.classList.remove('is-done');
      };
      const name = () => label.value.trim() || 'Timer';
      const end = (late) => {
        fired = true; running = false;
        clearTimeout(alarm); cancelAnimationFrame(raf);
        box.classList.add('is-done');
        startBtn.textContent = 'Start';
        disp.textContent = '00:00.00';
        ended.hidden = false;
        ended.textContent = late ? name() + ' ended at ' + clockAt(endsAt) + ', while the page was closed.' : name() + ' ended at ' + clockAt(endsAt) + '.';
        if (!late) {
          dueTone(owner);
          if (nBox.on && document.hidden) Notify.send(name() + ' has finished', 'Set for ' + short(total()) + '.', owner);
        } else dropTone(owner);
        save(); titles();
      };
      const paint = () => {
        const left = running ? endsAt - Date.now() : remaining;
        disp.textContent = fmt(left);
        if (left <= 0 && !fired) { end(); return; }
        if (running) raf = requestAnimationFrame(paint);
      };
      /* The display is painted on animation frames, which a browser stops in
         a background tab. The end is a timeout armed to the deadline, which
         keeps running there, and the tone is already on the audio clock.
         Pause and Reset clear both; showing the tab again re-checks. A
         wake 2.5 s before the end puts the tone back on its moment if the
         two clocks have parted. */
      const arm = () => {
        clearTimeout(alarm);
        if (!running) return;
        const left = endsAt - Date.now();
        if (left <= EARLY) { if (!fired) end(); return; }
        syncTone(owner);
        alarm = setTimeout(arm, Math.min(MAX_WAIT, left > 4000 ? left - 2500 : left));
      };
      const start = () => {
        if (running) return;
        if (remaining <= 0) setFromInputs();
        if (remaining <= 0) return;
        endsAt = Date.now() + remaining;
        running = true; fired = false; ended.hidden = true;
        box.classList.remove('is-done');
        startBtn.textContent = 'Pause';
        Sound.prime();
        setTone(owner, endsAt);
        paint();
        arm();
      };
      const pause = () => {
        if (!running) return;
        remaining = endsAt - Date.now();
        running = false;
        startBtn.textContent = 'Resume';
        cancelAnimationFrame(raf);
        clearTimeout(alarm);
        dropTone(owner);
      };
      const toggle = () => { if (running) pause(); else start(); touched = true; used(); save(); };
      const reset = () => {
        running = false; cancelAnimationFrame(raf); clearTimeout(alarm); dropTone(owner);
        startBtn.textContent = 'Start';
        setFromInputs(); save();
      };
      startBtn.addEventListener('click', toggle);
      resetBtn.addEventListener('click', reset);
      form.addEventListener('input', () => { if (!running) { setFromInputs(); startBtn.textContent = 'Start'; } touched = true; save(); share(); });
      label.addEventListener('input', () => { rm.setAttribute('aria-label', 'Remove ' + name()); save(); });
      rm.setAttribute('aria-label', 'Remove ' + name());
      const t = {
        box, owner, toggle, reset, done: () => fired,
        isRunning: () => running,
        check: () => { if (running && !fired && endsAt - Date.now() <= EARLY) end(); },
        resched: () => { if (running) setTone(owner, endsAt); },
        left: () => running ? endsAt - Date.now() : remaining,
        name,
        state: () => ({ label: label.value, h: Number(hIn.value) || 0, m: Number(mIn.value) || 0, s: Number(sIn.value) || 0, running, endsAt: running ? endsAt : 0, remaining: running ? 0 : remaining, done: fired }),
        remove: () => { running = false; cancelAnimationFrame(raf); clearTimeout(alarm); dropTone(owner); box.remove(); },
        inputs: () => [hIn.value, mIn.value, sIn.value]
      };
      rm.addEventListener('click', () => {
        if (timers.length <= 1) { reset(); return; }
        t.remove(); timers.splice(timers.indexOf(t), 1); keepers.splice(keepers.indexOf(t), 1);
        addBtn.disabled = timers.length >= MAX_TIMERS;
        save(); titles();
        const first = timerList.querySelector('.btn-primary'); if (first) first.focus();
      });
      /* a restored timer */
      setFromInputs();
      if (cfg.running && cfg.endsAt) {
        endsAt = Number(cfg.endsAt);
        if (endsAt - Date.now() > EARLY) { running = true; startBtn.textContent = 'Pause'; paint(); arm(); }
        else { remaining = 0; end(true); }
      } else if (cfg.remaining > 0 && cfg.remaining < total()) { remaining = cfg.remaining; disp.textContent = fmt(remaining); startBtn.textContent = 'Resume'; }
      else if (cfg.done) { fired = true; box.classList.add('is-done'); disp.textContent = '00:00.00'; }
      timerList.appendChild(box);
      timers.push(t); keepers.push(t);
      addBtn.disabled = timers.length >= MAX_TIMERS;
      return t;
    }
    addBtn.addEventListener('click', () => {
      if (timers.length >= MAX_TIMERS) return;
      const t = makeTimer({});
      touched = true; save();
      const i = t.box.querySelector('.sw-label'); if (i) { i.focus(); i.select(); }
    });

    /* ---- pomodoro ---- */
    const PO = (() => {
      const owner = 'pomodoro';
      const s0 = saved.pomo || {};
      const p = el('div', 'sw-panel');
      p.hidden = true;
      const phase = el('div', 'sw-phase', 'Work');
      const disp = el('div', 'sw-display', '25:00.00');
      disp.setAttribute('role', 'timer');
      const count = el('div', 'sw-count', 'Cycle 1 of 4');
      const form = el('div', 'sw-inputs');
      const num = (k, v, lo, hi, dflt) => { const n = intIn(v, lo, hi); return n === null ? dflt : n; };
      const linkNum = (k, lo, hi) => { const n = intIn(q.get(k), lo, hi); if (n !== null) fromLink = true; return n; };
      const lw = linkNum('work', 1, 120), lb = linkNum('break', 1, 120), ll = linkNum('long', 1, 120), lc = linkNum('cycles', 1, 12);
      const mkNum = (label, val, min, max, id) => {
        const w = el('div', 'field');
        const l = el('label', null, label); l.htmlFor = id;
        w.appendChild(l);
        const i = el('input', 'control');
        i.type = 'number'; i.min = min; i.max = max; i.value = val; i.id = id; i.inputMode = 'numeric';
        w.appendChild(i); form.appendChild(w);
        return i;
      };
      const workIn = mkNum('Work minutes', lw !== null ? lw : num('work', s0.work, 1, 120, 25), 1, 120, 'po-work');
      const breakIn = mkNum('Break minutes', lb !== null ? lb : num('break', s0.brk, 1, 120, 5), 1, 120, 'po-break');
      const longIn = mkNum('Long break minutes', ll !== null ? ll : num('long', s0.long, 1, 120, 15), 1, 120, 'po-long');
      const cycIn = mkNum('Long break after (work sessions)', lc !== null ? lc : num('cycles', s0.cycles, 1, 12, 4), 1, 12, 'po-cycles');
      const checks = el('div', 'sw-checks');
      const check = (label, on) => { const w = el('label', 'tt-check'); const b = el('input'); b.type = 'checkbox'; b.checked = on; w.appendChild(b); w.appendChild(el('span', null, label)); checks.appendChild(w); return b; };
      const autoBreak = check('Start breaks automatically', s0.autoBreak !== false);
      const autoWork = check('Start work automatically', s0.autoWork !== false);

      let running = false, endsAt = 0, remaining = 25 * 60000, raf = null, alarm = null;
      let mode = 'work', cycle = 1;
      const cycles = () => Math.max(1, Math.min(12, Number(cycIn.value) || 4));
      const durationFor = (m) => (m === 'work' ? Number(workIn.value) || 25
        : m === 'long' ? Number(longIn.value) || 15
        : Number(breakIn.value) || 5) * 60000;
      const label = (m) => m === 'work' ? 'Work' : m === 'long' ? 'Long break' : 'Break';
      const setPhase = (m) => {
        mode = m;
        phase.textContent = label(m);
        p.classList.toggle('is-break', m !== 'work');
        remaining = durationFor(m);
        disp.textContent = fmt(remaining);
        count.textContent = `Cycle ${cycle} of ${cycles()}`;
      };
      /* the next phase, starting at `from` (the end of this one); it runs on
         if that kind of phase starts automatically, otherwise waits for Start */
      const next = (from) => {
        if (mode === 'work') setPhase(cycle % cycles() === 0 ? 'long' : 'break');
        else { if (mode === 'long') cycle = 1; else cycle++; setPhase('work'); count.textContent = `Cycle ${cycle} of ${cycles()}`; }
        const auto = mode === 'work' ? autoWork.checked : autoBreak.checked;
        if (running && auto) endsAt = from + remaining;
        else if (running) { running = false; startBtn.textContent = 'Start'; cancelAnimationFrame(raf); clearTimeout(alarm); }
      };
      const advance = (silent) => {
        const from = running ? endsAt : Date.now();
        const was = mode;
        if (!silent) dueTone(owner);
        next(from);
        if (!silent && nBox.on && document.hidden) Notify.send(was === 'work' ? label(mode) + ': ' + Math.round(remaining / 60000) + ' minutes' : 'Back to work: ' + Math.round(remaining / 60000) + ' minutes', running ? 'Started automatically.' : 'Press Start when you are ready.', owner);
        if (running) setTone(owner, endsAt);
        save(); titles();
      };
      const paint = () => {
        const left = running ? endsAt - Date.now() : remaining;
        disp.textContent = fmt(left);
        if (running && left <= 0) { advance(); arm(); }
        if (running) raf = requestAnimationFrame(paint);
      };
      /* as the timer: a timeout armed to the end of each phase moves it on
         in a background tab, where animation frames stop; the tone is on
         the audio clock */
      const arm = () => {
        clearTimeout(alarm);
        if (!running) return;
        if (endsAt - Date.now() <= EARLY) { advance(); disp.textContent = fmt(running ? endsAt - Date.now() : remaining); if (!running) return; }
        const left = Math.max(0, endsAt - Date.now());
        syncTone(owner);
        alarm = setTimeout(arm, Math.min(MAX_WAIT, left > 4000 ? left - 2500 : left));
      };

      const startBtn = el('button', 'btn-primary', 'Start');
      const skipBtn = el('button', 'btn-ghost', 'Skip phase');
      const resetBtn = el('button', 'btn-ghost', 'Reset');
      const btns = el('div', 'sw-buttons');
      [startBtn, skipBtn, resetBtn].forEach(b => { b.type = 'button'; btns.appendChild(b); });

      const toggle = () => {
        if (running) {
          remaining = endsAt - Date.now();
          running = false; startBtn.textContent = 'Resume';
          cancelAnimationFrame(raf);
          clearTimeout(alarm);
          dropTone(owner);
        } else {
          endsAt = Date.now() + remaining;
          running = true; startBtn.textContent = 'Pause';
          Sound.prime();
          setTone(owner, endsAt);
          paint();
          arm();
        }
        touched = true; used(); save();
      };
      const reset = () => {
        running = false; cancelAnimationFrame(raf); clearTimeout(alarm); dropTone(owner);
        startBtn.textContent = 'Start';
        cycle = 1; setPhase('work'); save();
      };
      startBtn.addEventListener('click', toggle);
      skipBtn.addEventListener('click', () => {
        dropTone(owner);
        const was = running;
        if (running) endsAt = Date.now();
        next(Date.now());
        if (running) { setTone(owner, endsAt); arm(); } else { disp.textContent = fmt(remaining); if (was) startBtn.textContent = 'Start'; }
        save();
      });
      resetBtn.addEventListener('click', reset);
      form.addEventListener('input', () => { if (!running) setPhase(mode); else count.textContent = `Cycle ${cycle} of ${cycles()}`; touched = true; save(); share(); });
      checks.addEventListener('change', () => { touched = true; save(); });

      p.appendChild(phase); p.appendChild(disp); p.appendChild(count);
      p.appendChild(form); p.appendChild(checks); p.appendChild(btns);

      /* restored: a running cycle carries on from where the clock says it is */
      if (s0.mode === 'work' || s0.mode === 'break' || s0.mode === 'long') { cycle = intIn(s0.cycle, 1, 12) || 1; setPhase(s0.mode); } else setPhase('work');
      if (s0.running && s0.endsAt) {
        running = true; endsAt = Number(s0.endsAt);
        let guard = 0;
        while (running && endsAt <= Date.now() && guard++ < 500) next(endsAt);
        if (running) { startBtn.textContent = 'Pause'; paint(); arm(); }
      } else if (s0.remaining > 0 && s0.remaining < durationFor(mode)) { remaining = s0.remaining; disp.textContent = fmt(remaining); startBtn.textContent = 'Resume'; }

      return {
        panel: p, owner, toggle, reset, isRunning: () => running,
        check: () => { if (running && endsAt - Date.now() <= EARLY) arm(); },
        resched: () => { if (running) setTone(owner, endsAt); },
        state: () => ({ work: Number(workIn.value) || 25, brk: Number(breakIn.value) || 5, long: Number(longIn.value) || 15, cycles: cycles(),
          autoBreak: autoBreak.checked, autoWork: autoWork.checked, mode, cycle, running, endsAt: running ? endsAt : 0, remaining: running ? 0 : remaining }),
        title: () => running ? short(endsAt - Date.now()) + ' ' + label(mode).toLowerCase() : null,
        params: () => ({ work: String(Number(workIn.value) || 25), break: String(Number(breakIn.value) || 5), long: String(Number(longIn.value) || 15), cycles: String(cycles()) })
      };
    })();
    panels.pomodoro = PO.panel;
    keepers.push(PO);

    /* timers from the last visit, or one from a link (?h=0&m=10&s=0) */
    const lh = intIn(q.get('h'), 0, 99), lm = intIn(q.get('m'), 0, 59), ls = intIn(q.get('s'), 0, 59);
    if (lh !== null || lm !== null || ls !== null) { fromLink = true; makeTimer({ h: lh || 0, m: lm || 0, s: ls || 0 }); }
    else if (Array.isArray(saved.timers) && saved.timers.length) saved.timers.slice(0, MAX_TIMERS).forEach(makeTimer);
    else makeTimer({});

    function save() {
      KEY.set({ tab: active, sound: settings.sound, notify: settings.notify, sw: SW.state(), timers: timers.map(t => t.state()), pomo: PO.state() });
    }
    function share() {
      const t = timers[0] ? timers[0].inputs() : ['0', '5', '0'];
      const params = active === 'pomodoro' ? Object.assign({ tab: 'pomodoro' }, PO.params())
        : active === 'timer' ? { tab: 'timer', h: String(Number(t[0]) || 0), m: String(Number(t[1]) || 0), s: String(Number(t[2]) || 0) }
        : { tab: 'stopwatch' };
      const pp = PO.params();
      const summary = active === 'pomodoro' ? 'Pomodoro: ' + pp.work + ' min work, ' + pp.break + ' min break, a ' + pp.long + ' min break after every ' + pp.cycles
        : active === 'timer' ? 'Timer: ' + short(((Number(t[0]) || 0) * 3600 + (Number(t[1]) || 0) * 60 + (Number(t[2]) || 0)) * 1000)
        : null;
      announce({ kind: 'live', params: active === 'stopwatch' ? {} : params, summary, changed: touched || fromLink });
    }

    /* the tab title: the soonest timer, else the Pomodoro, else the stopwatch */
    function titles() {
      const run = timers.filter(t => t.isRunning()).sort((a, b) => a.left() - b.left())[0];
      setTitle(run ? short(run.left()) + ' ' + run.name() : PO.title() || SW.title() || '');
    }
    const titleTimer = setInterval(titles, 500);

    /* keys: Space starts or pauses what is on screen, L laps, R resets */
    document.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target, tag = t && t.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable);
      if (typing) return;
      const k = e.key === ' ' || e.key === 'Spacebar' ? 'space' : String(e.key).toLowerCase();
      if (k === 'space' && (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY')) return;
      const firstTimer = timers.find(x => x.isRunning()) || timers[0];
      if (k === 'space') { e.preventDefault(); if (active === 'stopwatch') SW.toggle(); else if (active === 'timer') firstTimer && firstTimer.toggle(); else PO.toggle(); }
      else if (k === 'l') { if (active === 'stopwatch') { e.preventDefault(); SW.lap(); } }
      else if (k === 'r') { e.preventDefault(); if (active === 'stopwatch') SW.reset(); else if (active === 'timer') firstTimer && firstTimer.reset(); else PO.reset(); }
    });

    /* restored and running, but no click yet: the sound waits for one */
    const anyRunning = () => timers.some(t => t.isRunning()) || PO.isRunning();
    if (anyRunning()) restoreMsg.textContent = 'Carried on from your last visit. Click or press a key on the page to turn the alert sound back on.';
    const wake = () => {
      if (Sound.has() || !anyRunning()) return;
      Sound.prime(); resched();
      if (restoreMsg.textContent) restoreMsg.textContent = '';
    };
    document.addEventListener('pointerdown', wake, true);
    document.addEventListener('keydown', wake, true);

    io.appendChild(tabs);
    io.appendChild(opts);
    io.appendChild(restoreMsg);
    Object.values(panels).forEach(p => io.appendChild(p));
    io.appendChild(keysHint);
    showTab(active);
    titles(); share();
    window.addEventListener('pagehide', () => { save(); clearInterval(titleTimer); });
  };
})();
