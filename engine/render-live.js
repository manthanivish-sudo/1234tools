/**
 * Renderer for the live tools — the ones with a keypad or a running clock.
 *
 * All timers compute from timestamps rather than counting ticks, so a
 * throttled background tab changes how often the display refreshes but never
 * what it reports.
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
     Time zone converter
     ============================================================ */
  window.MVRTool.mountTimezone = function (root) {
    const io = root.querySelector('.tool-io');
    const L = window.MVRLive;
    const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const zones = [...new Set([localZone, ...L.COMMON_ZONES])];

    const form = el('div', 'gen-form');
    const mk = (label, id) => {
      const w = el('div', 'field');
      const l = el('label', null, label); l.setAttribute('for', id);
      w.appendChild(l);
      return w;
    };

    const now = new Date();
    const dw = mk('Date', 'tz-date');
    const dIn = el('input', 'control'); dIn.type = 'date'; dIn.id = 'tz-date';
    dIn.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    dw.appendChild(dIn);

    const tw = mk('Time', 'tz-time');
    const tIn = el('input', 'control'); tIn.type = 'time'; tIn.id = 'tz-time';
    tIn.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    tw.appendChild(tIn);

    const zoneSelect = (id, label, def) => {
      const w = mk(label, id);
      const s = el('select', 'control'); s.id = id;
      zones.forEach(z => {
        const o = el('option', null, z.replace(/_/g, ' ') + (z === localZone ? '  (your zone)' : ''));
        o.value = z;
        if (z === def) o.selected = true;
        s.appendChild(o);
      });
      w.appendChild(s);
      return { wrap: w, sel: s };
    };
    const from = zoneSelect('tz-from', 'From zone', localZone);
    const to = zoneSelect('tz-to', 'To zone', localZone === 'America/New_York' ? 'Europe/London' : 'America/New_York');

    const nowBtn = el('button', 'btn-ghost', 'Use current time');
    nowBtn.type = 'button';
    nowBtn.addEventListener('click', () => {
      const n = new Date();
      dIn.value = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
      tIn.value = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
      run();
    });
    const swapBtn = el('button', 'swap', '⇅ Swap zones');
    swapBtn.type = 'button';
    swapBtn.addEventListener('click', () => {
      const f = from.sel.value; from.sel.value = to.sel.value; to.sel.value = f; run();
    });

    form.appendChild(dw); form.appendChild(tw);
    form.appendChild(from.wrap); form.appendChild(to.wrap);
    form.appendChild(nowBtn);
    form.appendChild(swapBtn);

    const results = el('div', 'tool-results');
    const table = el('div', 'fx-table');
    io.appendChild(results);
    io.appendChild(form);
    io.appendChild(table);

    function run() {
      const [y, mo, d] = dIn.value.split('-').map(Number);
      const [h, mi] = (tIn.value || '00:00').split(':').map(Number);
      results.innerHTML = ''; table.innerHTML = '';
      if (!y || !mo || !d) return;

      const instant = L.zonedTimeToInstant(y, mo, d, h || 0, mi || 0, from.sel.value);
      const fmt = (z) => new Intl.DateTimeFormat('en-GB', {
        timeZone: z, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(instant);

      const offFrom = L.zoneOffset(instant, from.sel.value);
      const offTo = L.zoneOffset(instant, to.sel.value);
      const diff = (offTo - offFrom) / 60;

      const main = el('div', 'result result-primary');
      main.innerHTML = `<span class="result-label">${to.sel.value.replace(/_/g, ' ')}</span>` +
                       `<span class="result-value">${fmt(to.sel.value)}</span>`;
      results.appendChild(main);

      [[from.sel.value.replace(/_/g, ' '), fmt(from.sel.value)],
       ['Difference', (diff === 0 ? 'Same time' : `${diff > 0 ? '+' : ''}${diff} hour${Math.abs(diff) === 1 ? '' : 's'}`)],
       ['Offset, source', L.formatOffset(offFrom)],
       ['Offset, target', L.formatOffset(offTo)],
       ['UTC', new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(instant)]
      ].forEach(([k, v]) => {
        const r = el('div', 'result');
        r.innerHTML = `<span class="result-label">${k}</span><span class="result-value">${v}</span>`;
        results.appendChild(r);
      });

      table.appendChild(el('h3', null, 'That instant around the world'));
      const grid = el('div', 'fx-grid');
      ['UTC', 'Europe/London', 'Europe/Paris', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore',
       'Asia/Tokyo', 'Australia/Sydney', 'America/New_York', 'America/Chicago',
       'America/Los_Angeles', 'America/Sao_Paulo'].forEach(z => {
        const cell = el('div', 'fx-cell');
        cell.appendChild(el('span', 'fx-code', z.split('/').pop().replace(/_/g, ' ')));
        cell.appendChild(el('span', 'fx-val', new Intl.DateTimeFormat('en-GB', {
          timeZone: z, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
        }).format(instant)));
        grid.appendChild(cell);
      });
      table.appendChild(grid);
    }

    form.addEventListener('input', run);
    form.addEventListener('change', run);
    run();
  };

  /* ============================================================
     Countdown
     ============================================================ */
  window.MVRTool.mountCountdown = function (root) {
    const io = root.querySelector('.tool-io');

    const form = el('div', 'gen-form');
    const dw = el('div', 'field');
    dw.appendChild(Object.assign(el('label', null, 'Target date'), { htmlFor: 'cd-date' }));
    const dIn = el('input', 'control'); dIn.type = 'date'; dIn.id = 'cd-date';
    const soon = new Date(Date.now() + 30 * 86400000);
    dIn.value = `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}`;
    dw.appendChild(dIn);

    const tw = el('div', 'field');
    tw.appendChild(Object.assign(el('label', null, 'Target time'), { htmlFor: 'cd-time' }));
    const tIn = el('input', 'control'); tIn.type = 'time'; tIn.id = 'cd-time'; tIn.value = '09:00';
    tw.appendChild(tIn);

    const lw = el('div', 'field');
    lw.appendChild(Object.assign(el('label', null, 'Event name'), { htmlFor: 'cd-label' }));
    const lIn = el('input', 'control'); lIn.type = 'text'; lIn.id = 'cd-label'; lIn.value = 'My event';
    lw.appendChild(lIn);

    form.appendChild(dw); form.appendChild(tw); form.appendChild(lw);

    const stage = el('div', 'countdown-stage');
    const title = el('div', 'countdown-title', '');
    const clock = el('div', 'countdown-clock');
    const units = ['Days', 'Hours', 'Minutes', 'Seconds'].map(name => {
      const box = el('div', 'countdown-unit');
      const v = el('div', 'countdown-val', '0');
      box.appendChild(v);
      box.appendChild(el('div', 'countdown-lbl', name));
      clock.appendChild(box);
      return v;
    });
    const sub = el('div', 'countdown-sub', '');
    stage.appendChild(title);
    stage.appendChild(clock);
    stage.appendChild(sub);

    io.appendChild(stage);
    io.appendChild(form);

    let timer = null;
    function tick() {
      const [y, mo, d] = (dIn.value || '').split('-').map(Number);
      const [h, mi] = (tIn.value || '00:00').split(':').map(Number);
      if (!y || !mo || !d) { title.textContent = 'Choose a target date'; return; }

      const target = new Date(y, mo - 1, d, h || 0, mi || 0, 0, 0);
      const diff = target - Date.now();
      const past = diff < 0;
      const abs = Math.abs(diff);

      const days = Math.floor(abs / 86400000);
      const hours = Math.floor(abs / 3600000) % 24;
      const mins = Math.floor(abs / 60000) % 60;
      const secs = Math.floor(abs / 1000) % 60;

      units[0].textContent = days.toLocaleString('en-GB');
      units[1].textContent = pad(hours);
      units[2].textContent = pad(mins);
      units[3].textContent = pad(secs);

      const name = lIn.value.trim() || 'the target';
      title.textContent = past ? `Since ${name}` : `Until ${name}`;
      stage.classList.toggle('is-past', past);
      sub.textContent = target.toLocaleString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }) + (past ? ' — this has passed' : '');
    }

    form.addEventListener('input', tick);
    form.addEventListener('change', tick);
    tick();
    timer = setInterval(tick, 250);
    window.addEventListener('pagehide', () => clearInterval(timer));
  };

  /* ============================================================
     Stopwatch / timer / pomodoro
     ============================================================ */
  window.MVRTool.mountStopwatch = function (root) {
    const io = root.querySelector('.tool-io');

    const tabs = el('div', 'sw-tabs');
    const panels = {};
    let active = 'stopwatch';
    [['stopwatch', 'Stopwatch'], ['timer', 'Timer'], ['pomodoro', 'Pomodoro']].forEach(([k, label]) => {
      const b = el('button', 'sw-tab', label);
      b.type = 'button';
      b.dataset.tab = k;
      b.setAttribute('aria-pressed', String(k === active));
      b.addEventListener('click', () => {
        active = k;
        [...tabs.children].forEach(x => x.setAttribute('aria-pressed', String(x.dataset.tab === k)));
        Object.entries(panels).forEach(([pk, p]) => { p.hidden = pk !== k; });
      });
      tabs.appendChild(b);
    });

    const beep = () => {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.6);
      } catch (e) { /* audio blocked until the user interacts — not fatal */ }
    };

    const fmt = (ms) => {
      const t = Math.max(0, ms);
      const h = Math.floor(t / 3600000);
      const m = Math.floor(t / 60000) % 60;
      const s = Math.floor(t / 1000) % 60;
      const cs = Math.floor(t / 10) % 100;
      return (h ? h + ':' : '') + pad(m) + ':' + pad(s) + '.' + pad(cs);
    };

    /* ---- stopwatch ---- */
    {
      const p = el('div', 'sw-panel');
      const disp = el('div', 'sw-display', '00:00.00');
      const btns = el('div', 'sw-buttons');
      const laps = el('div', 'sw-laps');

      let running = false, startedAt = 0, accumulated = 0, lapMark = 0, raf = null;
      const elapsed = () => accumulated + (running ? performance.now() - startedAt : 0);

      const startBtn = el('button', 'btn-primary', 'Start');
      const lapBtn = el('button', 'btn-ghost', 'Lap');
      const resetBtn = el('button', 'btn-ghost', 'Reset');
      lapBtn.disabled = true;
      [startBtn, lapBtn, resetBtn].forEach(b => { b.type = 'button'; btns.appendChild(b); });

      const paint = () => {
        disp.textContent = fmt(elapsed());
        if (running) raf = requestAnimationFrame(paint);
      };

      startBtn.addEventListener('click', () => {
        if (running) {
          accumulated = elapsed();
          running = false;
          startBtn.textContent = 'Resume';
          cancelAnimationFrame(raf);
          paint();
        } else {
          startedAt = performance.now();
          running = true;
          startBtn.textContent = 'Stop';
          lapBtn.disabled = false;
          paint();
        }
      });
      lapBtn.addEventListener('click', () => {
        const total = elapsed();
        const split = total - lapMark;
        lapMark = total;
        const row = el('div', 'sw-lap');
        row.appendChild(el('span', 'sw-lap-n', '#' + (laps.children.length + 1)));
        row.appendChild(el('span', 'sw-lap-split', fmt(split)));
        row.appendChild(el('span', 'sw-lap-total', fmt(total)));
        laps.insertBefore(row, laps.firstChild);
      });
      resetBtn.addEventListener('click', () => {
        running = false; accumulated = 0; lapMark = 0;
        cancelAnimationFrame(raf);
        startBtn.textContent = 'Start';
        lapBtn.disabled = true;
        laps.innerHTML = '';
        disp.textContent = '00:00.00';
      });

      p.appendChild(disp); p.appendChild(btns); p.appendChild(laps);
      panels.stopwatch = p;
    }

    /* ---- timer ---- */
    {
      const p = el('div', 'sw-panel');
      p.hidden = true;
      const disp = el('div', 'sw-display', '05:00.00');
      const form = el('div', 'sw-inputs');
      const mkNum = (label, val, max) => {
        const w = el('div', 'field');
        w.appendChild(el('label', null, label));
        const i = el('input', 'control');
        i.type = 'number'; i.min = 0; i.max = max; i.value = val;
        w.appendChild(i);
        form.appendChild(w);
        return i;
      };
      const hIn = mkNum('Hours', 0, 99), mIn = mkNum('Minutes', 5, 59), sIn = mkNum('Seconds', 0, 59);

      let running = false, endsAt = 0, remaining = 300000, raf = null, fired = false;
      const startBtn = el('button', 'btn-primary', 'Start');
      const resetBtn = el('button', 'btn-ghost', 'Reset');
      const btns = el('div', 'sw-buttons');
      [startBtn, resetBtn].forEach(b => { b.type = 'button'; btns.appendChild(b); });

      const setFromInputs = () => {
        remaining = ((Number(hIn.value) || 0) * 3600 + (Number(mIn.value) || 0) * 60 + (Number(sIn.value) || 0)) * 1000;
        disp.textContent = fmt(remaining);
        fired = false;
        p.classList.remove('is-done');
      };
      const paint = () => {
        const left = running ? endsAt - Date.now() : remaining;
        disp.textContent = fmt(left);
        if (left <= 0 && !fired) {
          fired = true; running = false;
          p.classList.add('is-done');
          startBtn.textContent = 'Start';
          disp.textContent = '00:00.00';
          beep();
          return;
        }
        if (running) raf = requestAnimationFrame(paint);
      };
      startBtn.addEventListener('click', () => {
        if (running) {
          remaining = endsAt - Date.now();
          running = false;
          startBtn.textContent = 'Resume';
          cancelAnimationFrame(raf);
        } else {
          if (remaining <= 0) setFromInputs();
          if (remaining <= 0) return;
          endsAt = Date.now() + remaining;
          running = true; fired = false;
          p.classList.remove('is-done');
          startBtn.textContent = 'Pause';
          paint();
        }
      });
      resetBtn.addEventListener('click', () => {
        running = false; cancelAnimationFrame(raf);
        startBtn.textContent = 'Start';
        setFromInputs();
      });
      form.addEventListener('input', () => { if (!running) setFromInputs(); });

      p.appendChild(disp); p.appendChild(form); p.appendChild(btns);
      panels.timer = p;
    }

    /* ---- pomodoro ---- */
    {
      const p = el('div', 'sw-panel');
      p.hidden = true;
      const phase = el('div', 'sw-phase', 'Work');
      const disp = el('div', 'sw-display', '25:00.00');
      const count = el('div', 'sw-count', 'Cycle 1 of 4');
      const form = el('div', 'sw-inputs');
      const mkNum = (label, val) => {
        const w = el('div', 'field');
        w.appendChild(el('label', null, label));
        const i = el('input', 'control');
        i.type = 'number'; i.min = 1; i.max = 120; i.value = val;
        w.appendChild(i); form.appendChild(w);
        return i;
      };
      const workIn = mkNum('Work minutes', 25);
      const breakIn = mkNum('Break minutes', 5);
      const longIn = mkNum('Long break minutes', 15);

      let running = false, endsAt = 0, remaining = 25 * 60000, raf = null;
      let mode = 'work', cycle = 1;

      const durationFor = (m) => (m === 'work' ? Number(workIn.value) || 25
        : m === 'long' ? Number(longIn.value) || 15
        : Number(breakIn.value) || 5) * 60000;

      const setPhase = (m) => {
        mode = m;
        phase.textContent = m === 'work' ? 'Work' : m === 'long' ? 'Long break' : 'Break';
        p.classList.toggle('is-break', m !== 'work');
        remaining = durationFor(m);
        disp.textContent = fmt(remaining);
        count.textContent = `Cycle ${cycle} of 4`;
      };

      const advance = () => {
        beep();
        if (mode === 'work') {
          setPhase(cycle % 4 === 0 ? 'long' : 'break');
        } else {
          if (mode === 'long') cycle = 1; else cycle++;
          setPhase('work');
        }
        endsAt = Date.now() + remaining;
      };

      const paint = () => {
        const left = running ? endsAt - Date.now() : remaining;
        disp.textContent = fmt(left);
        if (left <= 0) { advance(); }
        if (running) raf = requestAnimationFrame(paint);
      };

      const startBtn = el('button', 'btn-primary', 'Start');
      const skipBtn = el('button', 'btn-ghost', 'Skip phase');
      const resetBtn = el('button', 'btn-ghost', 'Reset');
      const btns = el('div', 'sw-buttons');
      [startBtn, skipBtn, resetBtn].forEach(b => { b.type = 'button'; btns.appendChild(b); });

      startBtn.addEventListener('click', () => {
        if (running) {
          remaining = endsAt - Date.now();
          running = false; startBtn.textContent = 'Resume';
          cancelAnimationFrame(raf);
        } else {
          endsAt = Date.now() + remaining;
          running = true; startBtn.textContent = 'Pause';
          paint();
        }
      });
      skipBtn.addEventListener('click', () => { advance(); if (!running) disp.textContent = fmt(remaining); });
      resetBtn.addEventListener('click', () => {
        running = false; cancelAnimationFrame(raf);
        startBtn.textContent = 'Start';
        cycle = 1; setPhase('work');
      });
      form.addEventListener('input', () => { if (!running) setPhase(mode); });

      p.appendChild(phase); p.appendChild(disp); p.appendChild(count);
      p.appendChild(form); p.appendChild(btns);
      panels.pomodoro = p;
    }

    io.appendChild(tabs);
    Object.values(panels).forEach(p => io.appendChild(p));
  };
})();
