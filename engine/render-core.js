/**
 * Tool Renderer
 * -------------
 * Builds the interactive UI for ANY tool from its spec. One renderer,
 * every tool. Live-updating: results recalculate on each keystroke,
 * with no submit button and no network request.
 *
 * What a spec may declare, beyond inputs / compute / outputs:
 *
 *   input.slider    [min, max] or { min, max, step }: a range control beside
 *                   the number box, the two kept in step
 *   input.integer   whole numbers only (a message, not a silent round)
 *   input.max       checked like min, with a message under the field
 *   input.hint      one line of help under the field
 *   input.group     consecutive inputs with the same group sit in one
 *                   collapsible block (open when it holds an error)
 *   input.showIf    { key, is: value | [values] }: shown only then; a hidden
 *                   field keeps its value and is not checked
 *   input.type      'height' (held in cm) and 'weight' (held in kg) are
 *                   composite fields: cm | ft + in | in, kg | st + lb | lb,
 *                   opening on the reader's metric / imperial preference
 *   spec.validate   (vals) => { key: message } for rules across fields
 *   spec.filled     (vals, res, f) => [lines]: the formula with the reader's
 *                   own numbers, shown under the page's Formula panel
 *   spec.steps      (vals, res, f) => [lines]: the working, step by step
 *   spec.linkUpgrade(params) => params: reads an older link's keys
 *   res._table      { head, rows, cols?, foot?, title?, views? }: schedules,
 *                   with a view toggle (yearly / monthly), CSV and print;
 *                   numeric cells are formatted by cols ('currency',
 *                   'number', 'int', 'percent', 'text') so they follow the
 *                   currency, grouping and decimals preferences
 *   res._chart      a chart, or a list of them: { type: 'line' | 'bar' |
 *                   'donut', title, labels, series: [{ name, values }] or
 *                   slices: [{ name, value }], format } drawn as inline SVG
 *                   in the site's colours, with values on hover or arrow
 *                   keys, and a copy-as-PNG button
 *   res._invalid    { key: message } from compute(), shown like spec.validate
 *
 * And for every calculator: save up to four scenarios on this device and
 * compare them side by side, the last few results of this visit, and
 * "Reset to example".
 */
(function () {
  'use strict';

  /* Preferences load ahead of this file and may be absent (an old cached
     page, or a browser that refused the script). Everything below falls
     back to what the tool itself asked for, which is what happened
     before preferences existed. */
  const P = () => window.Prefs || null;

  /* The spec's currency is a suggestion. It stops being one when the
     tool applies a country's rules: Indian income tax in dollars is not
     a translation, it is a wrong answer. Those specs set currencyLocked
     and the page says why rather than quietly overruling the reader. */
  const curFor = (spec) => {
    const asked = (spec && spec.currency) || 'GBP';
    if (spec && spec.currencyLocked) return asked;
    return P() ? P().currency(asked) : asked;
  };
  const locFor = (code) => P() ? P().locale(code)
    : (code === 'INR' ? 'en-IN' : code === 'USD' ? 'en-US' : code === 'EUR' ? 'de-DE' : 'en-GB');

  const SYMBOL = { INR: '₹', GBP: '£', USD: '$', EUR: '€', AED: 'د.إ', SGD: 'S$', AUD: 'A$', CAD: 'C$', ZAR: 'R' };
  const symOf = (code) => SYMBOL[code] || code;
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /* A unit label such as "£" or "₹ a month" names the tool's own currency.
     When the reader has chosen another, the label follows it, exactly as
     the results do; a tool whose currency is part of the rule keeps its own. */
  function unitText(spec, unit) {
    if (!unit || typeof unit !== 'string') return unit || '';
    if (!spec || spec.currencyLocked) return unit;
    const own = spec.currency || 'GBP';
    const now = curFor(spec);
    if (now === own) return unit;
    const s = SYMBOL[own];
    if (!s) return unit;
    /* a whole symbol only: the $ inside S$ or A$ is not the dollar sign */
    const re = new RegExp('(^|[^A-Za-z])' + reEsc(s) + '(?![A-Za-z])');
    return unit.replace(re, (m, pre) => pre + symOf(now));
  }

  const fmt = {
    number(v, unit, code) {
      if (v === null || v === undefined || v === '') return '—';
      if (typeof v === 'string') return v;
      if (!isFinite(v)) return v > 0 ? '∞' : (isNaN(v) ? '—' : '−∞');
      const abs = Math.abs(v);
      let s;
      /* trailing zeros of the mantissa say nothing: 1.000000e-6 reads as 1e-6 */
      if (abs !== 0 && (abs < 1e-4 || abs >= 1e12)) s = v.toExponential(6).replace(/\.?0+e/, 'e');
      else {
        const dp = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
        const nloc = locFor(code);
        s = Number(v.toFixed(dp)).toLocaleString(nloc, { maximumFractionDigits: dp });
      }
      return unit ? `${s} ${unit}` : s;
    },
    /* The symbol is data, and now the reader's data as often as the
       tool's. `code` arrives already resolved by curFor(). */
    currency(v, unit, code) {
      if (!isFinite(v)) return '—';
      const cur = code || window.__CURRENCY__ || 'GBP';
      if (P()) return P().money(v, { code: cur, locked: true, decimals: 2 });
      /* Locale drives digit grouping, not just the symbol. INR groups in
         lakhs and crores (3,19,800), which is what Indian users read. */
      const loc = cur === 'USD' ? 'en-US' : cur === 'EUR' ? 'de-DE'
                : cur === 'INR' ? 'en-IN' : 'en-GB';
      try {
        return v.toLocaleString(loc, { style: 'currency', currency: cur, maximumFractionDigits: 2 });
      } catch (e) {
        return cur + ' ' + v.toLocaleString(loc, { maximumFractionDigits: 2 });
      }
    },
    percent(v, unit, code) {
      const loc = locFor(code);
      return isFinite(v) ? `${Number(v.toFixed(4)).toLocaleString(loc)}%` : '—';
    },
    int(v, unit, code) {
      if (typeof v !== 'number' || !isFinite(v)) return typeof v === 'string' ? v : '—';
      const s = Math.round(v).toLocaleString(locFor(code));
      return unit ? `${s} ${unit}` : s;
    },
    text(v) { return v === null || v === undefined ? '' : String(v); },
    auto(v, unit, code) { return typeof v === 'string' ? v : fmt.number(v, unit, code); }
  };

  /* What spec.filled and spec.steps are handed to write numbers with, so
     the working follows the same currency, grouping and decimals as the
     results above it. */
  function kitFor(spec) {
    const code = curFor(spec);
    const loc = locFor(code);
    const num = (v, dp) => {
      if (typeof v !== 'number' || !isFinite(v)) return '—';
      if (typeof dp === 'number') return v.toLocaleString(loc, { minimumFractionDigits: dp, maximumFractionDigits: dp });
      return fmt.number(v, null, code);
    };
    return {
      code, sym: symOf(code), locale: loc,
      money: (v) => fmt.currency(v, null, code),
      num,
      /* at most `dp` decimals, none forced: 0.0675 → "0.0675", 12 → "12" */
      upto: (v, dp) => typeof v === 'number' && isFinite(v) ? v.toLocaleString(loc, { maximumFractionDigits: dp === undefined ? 6 : dp }) : '—',
      pct: (v, dp) => (typeof v === 'number' && isFinite(v) ? num(v, dp === undefined ? 2 : dp) + '%' : '—'),
      int: (v) => fmt.int(v, null, code)
    };
  }

  /* ---------------- height and weight, in the reader's units ---------------- */

  /* Each field holds one number in the base unit (cm, kg); the boxes on
     screen are a view of it. Factors are exact by definition: an inch is
     2.54 cm, a pound 0.45359237 kg, a stone 14 lb. */
  const MEASURES = {
    height: {
      base: 'cm',
      units: {
        cm: { label: 'cm', parts: [['cm', 1]] },
        ftin: { label: 'ft + in', parts: [['ft', 30.48], ['in', 2.54]] },
        in: { label: 'in', parts: [['in', 2.54]] }
      },
      imperial: () => 'ftin'
    },
    weight: {
      base: 'kg',
      units: {
        kg: { label: 'kg', parts: [['kg', 1]] },
        stlb: { label: 'st + lb', parts: [['st', 6.35029318], ['lb', 0.45359237]] },
        lb: { label: 'lb', parts: [['lb', 0.45359237]] }
      },
      /* stones are what a British reader weighs in; an American one uses
         pounds, and the currency is the one hint the preferences give */
      imperial: () => (P() && P().currency('GBP') === 'USD' ? 'lb' : 'stlb')
    },
    /* a waist, a room: one box either way */
    length: {
      base: 'cm',
      units: {
        cm: { label: 'cm', parts: [['cm', 1]] },
        in: { label: 'in', parts: [['in', 2.54]] }
      },
      imperial: () => 'in'
    }
  };
  const isMeasure = (inp) => inp && Object.prototype.hasOwnProperty.call(MEASURES, inp.type);
  /* base value -> the numbers in each box, the last one to 1 decimal, with
     the carry done (5 ft 11.96 in shows as 6 ft 0 in) */
  function splitMeasure(base, unit) {
    const parts = unit.parts;
    if (!Number.isFinite(base)) return parts.map(() => '');
    if (parts.length === 1) return [String(Number((base / parts[0][1]).toFixed(parts[0][0] === 'cm' || parts[0][0] === 'kg' ? 1 : 1)))];
    const neg = base < 0;
    let rest = Math.abs(base);
    let big = Math.floor(rest / parts[0][1] + 1e-9);
    let small = Number(((rest - big * parts[0][1]) / parts[1][1]).toFixed(1));
    const per = Math.round(parts[0][1] / parts[1][1]);
    if (small >= per) { big += 1; small = Number((small - per).toFixed(1)); }
    return [String(neg ? -big : big), String(neg && big === 0 ? -small : small)];
  }
  function joinMeasure(values, unit) {
    let total = 0, any = false;
    for (let i = 0; i < unit.parts.length; i++) {
      const raw = values[i];
      if (raw === '' || raw === undefined) continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) return NaN;
      total += n * unit.parts[i][1]; any = true;
    }
    return any ? total : null;
  }
  function measureText(v, inp, unitKey) {
    const M = MEASURES[inp.type];
    const u = M.units[unitKey] || M.units[M.base];
    const bits = splitMeasure(v, u);
    return u.parts.map((p, i) => bits[i] + ' ' + p[0]).join(' ');
  }

  /* ---------------- this tool's corner of the device ---------------- */

  /* One key per tool, versioned. Saved scenarios and the unit and table
     choices live here; nothing leaves the device. The recent results live
     in sessionStorage instead, so they are gone when the tab is closed:
     somebody's salary should not sit in a browser because they once
     typed it, only because they chose to save it. */
  function toolStore(slug) {
    const KEY = '1234tools.calc.v1.' + slug;
    const RKEY = '1234tools.calc-recent.v1.' + slug;
    const read = (s, k) => { try { const v = JSON.parse(s.getItem(k) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } };
    const write = (s, k, v) => { try { s.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
    let box = null;
    try { box = read(window.localStorage, KEY); } catch (e) { box = null; }
    box = box || {};
    if (!Array.isArray(box.scenarios)) box.scenarios = [];
    if (!box.units || typeof box.units !== 'object') box.units = {};
    return {
      get: (k) => box[k],
      set(k, v) { box[k] = v; try { return write(window.localStorage, KEY, box); } catch (e) { return false; } },
      recent() { try { const r = read(window.sessionStorage, RKEY); return Array.isArray(r) ? r : []; } catch (e) { return []; } },
      setRecent(list) { try { return write(window.sessionStorage, RKEY, list); } catch (e) { return false; } }
    };
  }

  /* ---------------- fields ---------------- */

  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  const isNum = (inp) => inp.type === 'number' || isMeasure(inp);
  const required = (inp) => !inp.optional && !(inp.default === null || inp.default === undefined || inp.default === '');

  function buildInput(input, spec) {
    const id = `in-${input.key}`;
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.setAttribute('data-field', input.key);

    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = input.label + (input.unit ? ` (${unitText(spec, input.unit)})` : '');
    wrap.appendChild(label);

    let el;
    if (input.type === 'select') {
      el = document.createElement('select');
      input.options.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value; opt.textContent = o.label;
        if (String(o.value) === String(input.default)) opt.selected = true;
        el.appendChild(opt);
      });
    } else {
      el = document.createElement('input');
      el.type = input.type === 'date' ? 'date' : input.type === 'text' ? 'text' : 'number';
      if (input.type === 'number') {
        el.step = input.step || 'any';
        el.inputMode = 'decimal';
        if (input.min !== undefined) el.min = input.min;
        if (input.max !== undefined) el.max = input.max;
      }
      let def = input.default;
      if (def === 'TODAY') {
        /* the local calendar date: toISOString() is UTC, which is still
           yesterday between midnight and 1 am in British Summer Time */
        const n = new Date();
        def = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
      }
      if (def !== null && def !== undefined) el.value = def;
      if (input.optional) el.placeholder = input.placeholder || 'leave blank to solve for this';
      else if (input.placeholder) el.placeholder = input.placeholder;
    }
    el.id = id;
    el.name = input.key;
    el.className = 'control';

    const field = { input, wrap, label, el, msg: null, sync: null, relabel: null };
    field.relabel = () => { label.textContent = input.label + (input.unit ? ` (${unitText(spec, input.unit)})` : ''); };

    if (input.type === 'number' && input.slider) {
      /* a range beside the box for the figures people drag through (a
         rate, a term); the box stays the source of truth and takes any
         value, the slider only the span it declares */
      const s = Array.isArray(input.slider) ? { min: input.slider[0], max: input.slider[1] } : input.slider;
      const row = document.createElement('div');
      row.className = 'field-row';
      const r = document.createElement('input');
      r.type = 'range'; r.className = 'slider';
      r.min = s.min; r.max = s.max; r.step = s.step || input.step || 'any';
      r.setAttribute('aria-label', input.label + ' slider');
      r.tabIndex = 0;
      row.appendChild(el); row.appendChild(r);
      wrap.appendChild(row);
      field.sync = () => {
        const n = Number(el.value);
        if (el.value !== '' && Number.isFinite(n)) r.value = String(Math.min(Number(s.min) <= n ? n : Number(s.min), Number(s.max)));
      };
      r.addEventListener('input', () => {
        el.value = r.value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      el.addEventListener('input', field.sync);
      field.slider = r;
    } else {
      wrap.appendChild(el);
    }

    if (input.type === 'number' && Array.isArray(input.presets) && input.presets.length) {
      /* one-tap values (10%, 12.5%, 15% …); the box still takes any figure */
      const row = document.createElement('div');
      row.className = 'field-presets';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', input.label + ': common values');
      const mark = () => Array.prototype.forEach.call(row.children, (b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === Number(el.value) && el.value !== '')));
      input.presets.forEach((v) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn-ghost preset';
        b.dataset.v = v;
        b.textContent = String(v) + (input.unit === '%' ? '%' : '');
        b.addEventListener('click', () => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); mark(); });
        row.appendChild(b);
      });
      el.addEventListener('input', mark);
      wrap.appendChild(row);
      const prev = field.sync;
      field.sync = () => { if (prev) prev(); mark(); };
    }

    if (input.hint) {
      const h = document.createElement('p');
      h.className = 'field-hint calc-hint';
      h.id = id + '-hint';
      h.textContent = input.hint;
      wrap.appendChild(h);
      el.setAttribute('aria-describedby', h.id);
    }
    return field;
  }

  /* height / weight: a hidden control named after the key holds the base
     value (that is what compute(), links, the share bar and "Try these
     numbers" read and write); the boxes on screen are rebuilt from it */
  function buildMeasure(input, spec, store) {
    const M = MEASURES[input.type];
    const id = `in-${input.key}`;
    const wrap = document.createElement('div');
    wrap.className = 'field field-measure';
    wrap.setAttribute('data-field', input.key);
    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = input.label;
    wrap.appendChild(label);

    const hidden = document.createElement('input');
    hidden.type = 'hidden'; hidden.name = input.key;
    hidden.className = 'measure-value';
    if (input.default !== null && input.default !== undefined) hidden.value = String(input.default);
    wrap.appendChild(hidden);

    const row = document.createElement('div');
    row.className = 'measure-row';
    const boxes = document.createElement('div');
    boxes.className = 'measure-boxes';
    const pick = document.createElement('select');
    pick.className = 'control measure-unit';
    pick.setAttribute('aria-label', input.label + ' unit');
    Object.keys(M.units).forEach((k) => {
      const o = document.createElement('option');
      o.value = k; o.textContent = M.units[k].label;
      pick.appendChild(o);
    });
    row.appendChild(boxes); row.appendChild(pick);
    wrap.appendChild(row);

    const saved = (store.get('units') || {})[input.key];
    const prefUnit = () => (P() && P().units() === 'imperial' ? M.imperial() : M.base);
    let unit = saved && M.units[saved] ? saved : prefUnit();
    pick.value = unit;

    let inputs = [];
    const field = { input, wrap, label, el: hidden, msg: null, measure: true, pick, chosen: !!saved };
    field.focusEl = () => inputs[0];
    function draw() {
      boxes.innerHTML = '';
      const u = M.units[unit];
      const bits = splitMeasure(hidden.value === '' ? NaN : Number(hidden.value), u);
      inputs = u.parts.map((p, i) => {
        const w = document.createElement('span');
        w.className = 'measure-part';
        const b = document.createElement('input');
        b.type = 'number'; b.step = 'any'; b.inputMode = 'decimal'; b.className = 'control';
        b.id = i === 0 ? id : id + '-' + p[0];
        b.setAttribute('aria-label', input.label + ' in ' + ({ cm: 'centimetres', ft: 'feet', in: 'inches', kg: 'kilograms', st: 'stones', lb: 'pounds' })[p[0]]);
        b.value = bits[i];
        if (input.min !== undefined && Number(input.min) >= 0) b.min = 0;
        const s = document.createElement('span');
        s.className = 'measure-sym'; s.textContent = p[0]; s.setAttribute('aria-hidden', 'true');
        w.appendChild(b); w.appendChild(s);
        boxes.appendChild(w);
        b.addEventListener('input', () => {
          const v = joinMeasure(inputs.map((x) => x.value), M.units[unit]);
          hidden.value = v === null ? '' : Number.isFinite(v) ? String(Number(v.toPrecision(12))) : 'NaN';
        });
        return b;
      });
    }
    field.sync = draw;
    field.setUnit = (k, remember) => {
      if (!M.units[k] || k === unit) return;
      unit = k; pick.value = k;
      if (remember) { const u = Object.assign({}, store.get('units') || {}); u[input.key] = k; store.set('units', u); field.chosen = true; }
      draw();
    };
    field.unit = () => unit;
    field.prefUnit = prefUnit;
    pick.addEventListener('change', (e) => { e.stopPropagation(); field.setUnit(pick.value, true); });
    draw();
    return field;
  }

  /* ---------------- links ---------------- */

  /* A link can open a calculator on somebody's own figures: the Tool Finder
     sends "20% of 150" here as ?value=20&total=150. Only keys the spec
     declares are read, and only values the field could hold: a finite number
     inside its min and max, a real YYYY-MM-DD date, one of a select's own
     options, text up to 200 characters. Anything else keeps the worked
     example. The query string is read here in the browser and goes nowhere. */
  function fromQuery(input, raw) {
    if (input.type === 'number' || isMeasure(input)) {
      const n = raw.trim() === '' ? NaN : Number(raw);
      if (!Number.isFinite(n)) return null;
      if (input.min !== undefined && n < Number(input.min)) return null;
      if (input.max !== undefined && n > Number(input.max)) return null;
      return String(n);
    }
    if (input.type === 'date') {
      if (!DAY.test(raw)) return null;
      const d = new Date(raw + 'T00:00:00Z');
      return !isNaN(d) && d.toISOString().slice(0, 10) === raw ? raw : null;
    }
    if (input.type === 'select') {
      return (input.options || []).some(o => String(o.value) === raw) ? raw : null;
    }
    return raw.slice(0, 200);
  }

  /* The values a link carries. The query string is what the Tool Finder
     sends; the fragment (#principal=5000) is what the share bar sends,
     because a fragment never reaches a server, a hosting log or analytics.
     Both are read, and the fragment wins where they name the same key. */
  const linkParams = () => { const q = new URLSearchParams(location.search); try { const h = new URLSearchParams(location.hash.replace(/^#/, '')); for (const [k, v] of h) q.set(k, v); } catch (e) {} return q; };

  /* Returns how many values were taken from the link, so the share bar can
     tell figures somebody was sent from the worked example. */
  function prefill(spec, form) {
    let q;
    try { if (!location.search && !location.hash) return 0; q = linkParams(); } catch (e) { return 0; }
    if (typeof spec.linkUpgrade === 'function') {
      try {
        const o = {}; q.forEach((v, k) => { o[k] = v; });
        const up = spec.linkUpgrade(o) || o;
        q = new URLSearchParams(); Object.keys(up).forEach((k) => { if (up[k] !== undefined && up[k] !== null) q.set(k, String(up[k])); });
      } catch (e) { /* the link as it came */ }
    }
    let n = 0;
    spec.inputs.forEach(inp => {
      const raw = q.get(inp.key);
      if (raw === null) return;
      const el = form.querySelector('[name="' + inp.key + '"]');
      const v = el ? fromQuery(inp, raw) : null;
      if (v !== null) { el.value = v; n++; }
    });
    return n;
  }

  /* The share bar's half of the page. Each engine that can reproduce its
     result from a link says what it would put in one, as an event for a
     share bar already listening and as a function for one that boots
     later. Nothing here knows the share bar exists. */
  function announce(state) {
    (window.MVRTool = window.MVRTool || {}).shareState = function () { return state; };
    document.dispatchEvent(new CustomEvent('mvr:result', { detail: state }));
  }

  /* Every declared input that holds a value, as the string the field holds,
     so the link reproduces the figures even if a default changes later. */
  function paramsOf(spec, form) {
    const p = {};
    spec.inputs.forEach(inp => {
      const el = form.querySelector('[name="' + inp.key + '"]');
      if (!el || el.value === '' || el.value === null || el.value === undefined) return;
      p[inp.key] = inp.type === 'text' ? String(el.value).slice(0, 200) : String(el.value);
    });
    return p;
  }

  /* One line for the message: the primary output first, a second one if it
     still fits in 90 characters. Formatted exactly as the page shows it. */
  function summaryOf(spec, res) {
    if (typeof spec.shareSummary === 'function') {
      try { const s = spec.shareSummary(res); if (s) return String(s).slice(0, 120); } catch (e) { /* fall through */ }
    }
    const cur = curFor(spec);
    const rows = spec.outputs
      .filter(o => res[o.key] !== undefined && !(o.format === 'text' && (res[o.key] === '' || res[o.key] === null)))
      .sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0))
      .map(o => (o.label ? o.label + ': ' : '') + (fmt[o.format] || fmt.number)(res[o.key], unitText(spec, o.unit), cur));
    if (!rows.length) return null;
    let s = rows[0];
    if (rows[1] && (s + ' · ' + rows[1]).length <= 90) s += ' · ' + rows[1];
    return s.length > 90 ? s.slice(0, 89) + '…' : s;
  }

  function valueOf(inp, raw) {
    if (isNum(inp)) return raw === '' || raw === null || raw === undefined ? null : Number(raw);
    return raw;
  }
  function readValues(spec, form) {
    const vals = {};
    spec.inputs.forEach(inp => {
      const el = form.querySelector(`[name="${inp.key}"]`);
      if (!el) return;
      vals[inp.key] = valueOf(inp, el.value);
    });
    return vals;
  }
  /* the same, from a saved scenario's strings, with the defaults behind it */
  function valuesFrom(spec, params) {
    const vals = {};
    spec.inputs.forEach(inp => {
      const raw = Object.prototype.hasOwnProperty.call(params, inp.key) ? params[inp.key] : (inp.default === 'TODAY' ? '' : inp.default);
      vals[inp.key] = valueOf(inp, raw === undefined || raw === null ? '' : String(raw));
    });
    return vals;
  }

  /* ---------------- checking what was typed ---------------- */

  const shownBound = (spec, inp, v, f) => {
    const u = unitText(spec, inp.unit || '');
    const n = f.upto(Number(v), 6);
    if (!u) return n;
    if (u === '%') return n + '%';
    if (Object.values(SYMBOL).indexOf(u) >= 0) return u + n;
    return n + ' ' + u;
  };
  /* One message per field, in words, rather than "Check your inputs". */
  function checkField(spec, field, f) {
    const inp = field.input;
    const el = field.el;
    const raw = el.value;
    if (inp.type === 'select') return null;
    if (inp.type === 'date') {
      if (raw === '') return inp.optional ? null : 'Choose a date.';
      if (!DAY.test(raw) || fromQuery(inp, raw) === null) return 'Enter a real date.';
      return null;
    }
    if (inp.type === 'text') {
      if (inp.required && !String(raw).trim()) return 'This cannot be empty.';
      if (inp.maxLength && String(raw).length > inp.maxLength) return 'At most ' + inp.maxLength + ' characters.';
      return null;
    }
    if (raw === '' || raw === null) {
      const visible = field.measure ? null : el;
      if (visible && visible.validity && visible.validity.badInput) return 'Enter a number, using digits and at most one decimal point.';
      return required(inp) ? 'Enter a number.' : null;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return 'Enter a number.';
    if (field.measure) {
      const unit = field.unit();
      if (inp.min !== undefined && n < Number(inp.min)) return 'Must be at least ' + measureText(Number(inp.min), inp, unit) + '.';
      if (inp.max !== undefined && n > Number(inp.max)) return 'Must be at most ' + measureText(Number(inp.max), inp, unit) + '.';
      return null;
    }
    if (inp.min !== undefined && n < Number(inp.min)) return 'Must be at least ' + shownBound(spec, inp, inp.min, f) + '.';
    if (inp.max !== undefined && n > Number(inp.max)) return 'Must be at most ' + shownBound(spec, inp, inp.max, f) + '.';
    if (inp.integer && !Number.isInteger(n)) return 'Must be a whole number.';
    return null;
  }

  /* ---------------- results ---------------- */

  /* The symbol on its own does not tell somebody they may change it,
     and a preference nobody can find is not a preference. One line,
     under the results, only where money is actually shown. */
  function currencyNote(spec) {
    if (!spec.outputs || !spec.outputs.some(o => o.format === 'currency')) return null;
    const code = curFor(spec);
    const sym = SYMBOL[code] || code;
    const note = document.createElement('p');
    note.className = 'cur-note';
    if (spec.currencyLocked) {
      note.innerHTML = 'Shown in ' + sym + ' because this tool applies '
        + (spec.currencyNote || 'one country’s rules') + ', and the currency is part of the rule rather than a label on it.';
      return note;
    }
    note.innerHTML = 'Amounts in ' + sym + ' · <a href="/settings/">change the currency and grouping</a>';
    return note;
  }

  function renderResults(spec, results, container) {
    container.innerHTML = '';
    spec.outputs.forEach(out => {
      const v = results[out.key];
      if (v === undefined) return;
      if (out.format === 'text' && (v === '' || v === null)) return;

      const row = document.createElement('div');
      row.className = 'result' + (out.primary ? ' result-primary' : '');

      if (out.label) {
        const l = document.createElement('span');
        l.className = 'result-label';
        l.textContent = out.label;
        row.appendChild(l);
      }

      const val = document.createElement('span');
      val.className = 'result-value';
      const f = fmt[out.format] || fmt.number;
      val.textContent = f(v, unitText(spec, out.unit), curFor(spec));
      row.appendChild(val);

      const copy = document.createElement('button');
      copy.className = 'copy';
      copy.type = 'button';
      copy.title = 'Copy value';
      copy.setAttribute('aria-label', 'Copy ' + (out.label || 'value'));
      copy.textContent = '⧉';
      copy.addEventListener('click', () => {
        navigator.clipboard?.writeText(val.textContent).then(() => {
          copy.textContent = '✓';
          setTimeout(() => (copy.textContent = '⧉'), 1200);
        });
      });
      row.appendChild(copy);

      container.appendChild(row);
    });
    const note = currencyNote(spec);
    if (note) container.appendChild(note);
  }

  /* what the results well says when the figures cannot be worked out yet:
     each field's own message, named, instead of one generic line */
  function renderProblems(container, list) {
    container.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'result result-invalid';
    row.setAttribute('role', 'alert');
    const l = document.createElement('span');
    l.className = 'result-label';
    l.textContent = list.length === 1 ? 'Check this figure' : 'Check these figures';
    const v = document.createElement('span');
    v.className = 'result-value';
    v.textContent = list.map((p) => (p.label ? p.label + ': ' : '') + p.msg).join(' · ');
    row.appendChild(l); row.appendChild(v);
    container.appendChild(row);
  }

  /* ---------------- the formula with the reader's own numbers ---------------- */

  function renderWorking(spec, root, vals, res, ok) {
    if (typeof spec.filled !== 'function' && typeof spec.steps !== 'function') return;
    const pre = root.querySelector('pre.formula');
    if (!pre) return;
    let box = root.querySelector('.formula-filled');
    if (!box) {
      box = document.createElement('div');
      box.className = 'formula-filled';
      box.setAttribute('aria-live', 'polite');
      pre.parentNode.insertBefore(box, pre.nextSibling);
    }
    box.innerHTML = '';
    if (!ok) { box.hidden = true; return; }
    const k = kitFor(spec);
    let lines = [], steps = [];
    try { lines = typeof spec.filled === 'function' ? (spec.filled(vals, res, k) || []) : []; } catch (e) { lines = []; }
    try { steps = typeof spec.steps === 'function' ? (spec.steps(vals, res, k) || []) : []; } catch (e) { steps = []; }
    lines = lines.filter(Boolean); steps = steps.filter(Boolean);
    if (!lines.length && !steps.length) { box.hidden = true; return; }
    box.hidden = false;
    if (lines.length) {
      const h = document.createElement('h3');
      h.className = 'formula-filled-h';
      h.textContent = 'With your numbers';
      const p = document.createElement('pre');
      p.className = 'formula formula-mine';
      p.textContent = lines.join('\n');
      box.appendChild(h); box.appendChild(p);
    }
    if (steps.length) {
      const d = document.createElement('details');
      d.className = 'working';
      if (!lines.length) d.open = true;
      const s = document.createElement('summary');
      s.textContent = 'Step-by-step working';
      const ol = document.createElement('ol');
      ol.className = 'working-steps';
      steps.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ol.appendChild(li); });
      d.appendChild(s); d.appendChild(ol);
      box.appendChild(d);
    }
  }

  /* ---------------- the page ---------------- */

  window.MVRTool = {
    mount(spec, root) {
      /* i18n hook: a translated twin of this page (build-tools-hi.js) loads engine/i18n.js; English pages do not, so this is a no-op there */
      if (window.MVR_I18N) window.MVR_I18N.watch(root);
      const form = root.querySelector('.tool-form');
      const out = root.querySelector('.tool-results');
      const slug = root.getAttribute('data-tool') || String(spec.title || 'tool').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const store = toolStore(slug);

      /* fields, grouped where the spec groups them */
      const fields = [];
      let groupBox = null, groupName = null;
      spec.inputs.forEach(inp => {
        const f = isMeasure(inp) ? buildMeasure(inp, spec, store) : buildInput(inp, spec);
        fields.push(f);
        if (inp.group) {
          if (inp.group !== groupName) {
            groupName = inp.group;
            groupBox = document.createElement('details');
            groupBox.className = 'field-group';
            const sm = document.createElement('summary');
            sm.textContent = inp.group;
            groupBox.appendChild(sm);
            if (inp.groupOpen) groupBox.open = true;
            form.appendChild(groupBox);
          }
          groupBox.appendChild(f.wrap);
          f.group = groupBox;
        } else {
          groupName = null; groupBox = null;
          form.appendChild(f.wrap);
        }
      });
      const byKey = {};
      fields.forEach((f) => { byKey[f.input.key] = f; });

      /* Values from the URL are not a change the visitor made on this page,
         so the first run below still does not count as use. */
      const fromLink = prefill(spec, form) > 0;
      fields.forEach((f) => { if (f.sync) f.sync(); });

      /* A metric / imperial select of the spec's own (spec.unitSystem =
         { key, imperial, scale: { field: factor from metric }, dp }): it
         opens on the reader's units preference, and switching it converts
         the figures already in the boxes, so 70 kg becomes 154.3 lb rather
         than 70 lb. A link that names the system is left as it is. */
      const us = spec.unitSystem;
      if (us && byKey[us.key]) {
        const sel = byKey[us.key].el;
        sel.dataset.was = sel.value;
        const conv = (to) => Object.keys(us.scale || {}).forEach((k) => {
          const f = byKey[k];
          if (!f || f.el.value === '') return;
          const n = Number(f.el.value);
          if (!Number.isFinite(n)) return;
          const x = to === us.imperial ? n * us.scale[k] : n / us.scale[k];
          f.el.value = String(Number(x.toFixed(us.dp === undefined ? 1 : us.dp)));
          if (f.sync) f.sync();
        });
        let linked = false;
        try { linked = linkParams().has(us.key); } catch (e) { linked = false; }
        if (!linked && P() && P().units() === 'imperial' && sel.value !== us.imperial) { sel.value = us.imperial; conv(us.imperial); sel.dataset.was = us.imperial; }
        const flip = () => { if (sel.value !== sel.dataset.was) { conv(sel.value); sel.dataset.was = sel.value; } };
        sel.addEventListener('input', flip);
        sel.addEventListener('change', flip);
      }

      const showing = (f) => {
        const c = f.input.showIf;
        if (!c) return true;
        const other = byKey[c.key];
        if (!other) return true;
        const v = String(other.el.value);
        return Array.isArray(c.is) ? c.is.map(String).indexOf(v) >= 0 : String(c.is) === v;
      };
      const applyShowIf = () => fields.forEach((f) => { if (f.input.showIf) f.wrap.hidden = !showing(f); });

      const setMsg = (f, msg) => {
        if (!msg) {
          if (f.msg) { f.msg.remove(); f.msg = null; }
          f.wrap.classList.remove('is-invalid');
          (f.measure ? f.wrap.querySelectorAll('.measure-boxes input') : [f.el]).forEach((x) => x.removeAttribute('aria-invalid'));
          return;
        }
        if (!f.msg) {
          f.msg = document.createElement('p');
          f.msg.className = 'field-msg';
          f.msg.id = 'msg-' + f.input.key;
          f.wrap.appendChild(f.msg);
        }
        f.msg.textContent = msg;
        f.wrap.classList.add('is-invalid');
        (f.measure ? f.wrap.querySelectorAll('.measure-boxes input') : [f.el]).forEach((x) => {
          x.setAttribute('aria-invalid', 'true');
          const d = (x.getAttribute('aria-describedby') || '').split(' ').filter((t) => t && t !== f.msg.id);
          d.push(f.msg.id);
          x.setAttribute('aria-describedby', d.join(' '));
        });
        if (f.group && !f.group.open) f.group.open = true;
      };

      let chartHost = root.querySelector('.tool-chart');
      const tableHost = () => root.querySelector('.tool-table');
      const clearExtras = () => {
        const host = tableHost();
        if (host) window.MVRTool.renderTable(null, host);
        if (chartHost) { chartHost.innerHTML = ''; chartHost.hidden = true; }
      };

      let last = null;
      const run = () => {
        applyShowIf();
        if (us && byKey[us.key]) byKey[us.key].el.dataset.was = byKey[us.key].el.value;
        const k = kitFor(spec);
        const problems = [];
        fields.forEach((f) => {
          const msg = f.wrap.hidden ? null : checkField(spec, f, k);
          setMsg(f, msg);
          if (msg) problems.push({ key: f.input.key, label: f.input.label, msg });
        });
        const vals = readValues(spec, form);
        if (!problems.length && typeof spec.validate === 'function') {
          let extra = null;
          try { extra = spec.validate(vals); } catch (e) { extra = null; }
          Object.keys(extra || {}).forEach((key) => {
            if (!extra[key]) return;
            if (byKey[key]) setMsg(byKey[key], extra[key]);
            problems.push({ key, label: byKey[key] ? byKey[key].input.label : '', msg: extra[key] });
          });
        }
        if (problems.length) {
          renderProblems(out, problems);
          clearExtras();
          renderWorking(spec, root, vals, null, false);
          last = null;
          announce({ kind: 'calc', params: paramsOf(spec, form), summary: null, changed: touched || fromLink });
          return;
        }
        try {
          const res = spec.compute(vals) || {};
          if (res._invalid && Object.keys(res._invalid).length) {
            const list = Object.keys(res._invalid).map((key) => {
              if (byKey[key]) setMsg(byKey[key], res._invalid[key]);
              return { key, label: byKey[key] ? byKey[key].input.label : '', msg: res._invalid[key] };
            });
            renderProblems(out, list);
            clearExtras();
            renderWorking(spec, root, vals, null, false);
            last = null;
            announce({ kind: 'calc', params: paramsOf(spec, form), summary: null, changed: touched || fromLink });
            return;
          }
          renderResults(spec, res, out);
          last = { params: paramsOf(spec, form), summary: summaryOf(spec, res) };
          announce({ kind: 'calc', params: last.params, summary: last.summary, changed: touched || fromLink });
          /* Tells the install offer this tool has earned its place on someone's
             home screen. Every tool computes once on load to show a worked
             example, and that is not use: only a change the visitor made counts.
             Nothing else listens for this. */
          if (touched) document.dispatchEvent(new CustomEvent('mvr:tool-used'));
          const host = tableHost();
          if (host) window.MVRTool.renderTable(res._table, host, spec, { store, slug, inputs: describeInputs() });
          if (res._chart) {
            if (!chartHost) {
              chartHost = document.createElement('div');
              chartHost.className = 'tool-chart';
              const calc = root.querySelector('.calc');
              if (calc && calc.parentNode) calc.parentNode.insertBefore(chartHost, calc.nextSibling);
            }
            window.MVRTool.renderCharts(res._chart, chartHost, spec);
          } else if (chartHost) { chartHost.innerHTML = ''; chartHost.hidden = true; }
          renderWorking(spec, root, vals, res, true);
          if (touched) noteRecent();
        } catch (e) {
          const msg = e && e.userMessage ? e.userMessage : 'These figures cannot be worked out together. Check each one, or reset to the example.';
          renderProblems(out, [{ label: '', msg }]);
          clearExtras();
          last = null;
          announce({ kind: 'calc', params: {}, summary: null, changed: touched || fromLink });
        }
        if (compare && !compare.hidden) drawCompare();
      };

      /* the inputs in words, for the head of a printed schedule */
      const describeInputs = () => fields.filter((f) => !f.wrap.hidden).map((f) => {
        const inp = f.input;
        let v = f.el.value;
        if (inp.type === 'select') { const o = (inp.options || []).find((x) => String(x.value) === String(v)); v = o ? o.label : v; }
        else if (f.measure) v = v === '' ? '—' : measureText(Number(v), inp, f.unit());
        else if (inp.type === 'number' && v !== '') v = kitFor(spec).upto(Number(v), 6) + (inp.unit ? ' ' + unitText(spec, inp.unit) : '');
        return [inp.label, v === '' ? '—' : String(v)];
      });

      let touched = false;
      const touchedRun = (e) => {
        /* a link, "Try these numbers" or a saved scenario wrote the
           base value of a height or weight: redraw its boxes from it */
        const t = e && e.target;
        if (t && t.classList && t.classList.contains('measure-value')) { const f = byKey[t.name]; if (f && f.sync) f.sync(); }
        else if (t && t.name && byKey[t.name] && byKey[t.name].slider && e.type === 'change') byKey[t.name].sync();
        touched = true; run();
      };
      /* A preference changed here or in another tab repaints the page,
         without counting as use: the reader did not touch the inputs. */
      if (window.Prefs) window.Prefs.onChange((all, changed) => {
        fields.forEach((f) => { if (f.relabel) f.relabel(); });
        if (changed && changed.indexOf('units') >= 0) fields.forEach((f) => { if (f.measure && !f.chosen) f.setUnit(f.prefUnit(), false); });
        run();
      });
      form.addEventListener('input', touchedRun);
      form.addEventListener('change', touchedRun);

      /* ---------- scenarios, recent results, reset ---------- */

      const bar = document.createElement('div');
      bar.className = 'calc-bar';
      const btn = (text, act) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-ghost'; b.textContent = text; b.setAttribute('data-act', act); bar.appendChild(b); return b; };
      const saveBtn = btn('Save scenario', 'save');
      const cmpBtn = btn('Compare', 'compare');
      cmpBtn.setAttribute('aria-expanded', 'false');
      const resetBtn = btn('Reset to example', 'reset');
      if (typeof spec.report === 'function') {
        const pdfBtn = btn('Download as PDF', 'pdf');
        pdfBtn.addEventListener('click', () => {
          if (!last) { say('Fix the figures first: there is nothing to download.'); return; }
          let rep;
          try { rep = spec.report(readValues(spec, form), spec.compute(readValues(spec, form)) || {}, kitFor(spec)); } catch (e) { say('The computation could not be written.'); return; }
          pdfBtn.disabled = true;
          say('Writing the PDF…');
          window.MVRTool.reportPdf(rep, spec).then((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = slug + '-computation.' + (blob.type === 'application/pdf' ? 'pdf' : 'bin');
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);
            say('Saved ' + a.download + '.');
          }, (e) => say(e.message || 'The PDF could not be written.')).then(() => { pdfBtn.disabled = false; });
        });
      }
      const recentBox = document.createElement('details');
      recentBox.className = 'calc-recent';
      const recentSum = document.createElement('summary');
      const recentList = document.createElement('ol');
      const recentClear = document.createElement('button');
      recentClear.type = 'button'; recentClear.className = 'btn-ghost calc-recent-clear'; recentClear.textContent = 'Clear';
      recentBox.appendChild(recentSum); recentBox.appendChild(recentList); recentBox.appendChild(recentClear);
      bar.appendChild(recentBox);
      const barMsg = document.createElement('p');
      barMsg.className = 'calc-bar-msg'; barMsg.setAttribute('role', 'status');
      bar.appendChild(barMsg);
      form.appendChild(bar);

      const say = (t) => { barMsg.textContent = t; clearTimeout(say.t); say.t = setTimeout(() => { barMsg.textContent = ''; }, 4000); };
      const scenarios = () => (store.get('scenarios') || []).slice(0, 4);
      const paintCount = () => { const n = scenarios().length; cmpBtn.textContent = n ? 'Compare (' + n + ')' : 'Compare'; cmpBtn.disabled = n === 0; };

      const load = (params) => {
        fields.forEach((f) => {
          const inp = f.input;
          let raw = Object.prototype.hasOwnProperty.call(params, inp.key) ? String(params[inp.key]) : null;
          if (raw === null) {
            let d = inp.default;
            if (d === 'TODAY') { const n = new Date(); d = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); }
            raw = d === null || d === undefined ? '' : String(d);
          }
          if (inp.type === 'select' && !(inp.options || []).some((o) => String(o.value) === raw)) return;
          f.el.value = raw;
          if (f.sync) f.sync();
        });
        touched = true;
        run();
      };

      saveBtn.addEventListener('click', () => {
        if (!last) { say('Fix the figures first: there is no result to save.'); return; }
        const list = scenarios();
        const same = list.findIndex((s) => JSON.stringify(s.params) === JSON.stringify(last.params));
        if (same >= 0) { say('Already saved as scenario ' + (same + 1) + '.'); return; }
        if (list.length >= 4) { say('Four scenarios are saved: remove one in Compare to save another.'); return; }
        list.push({ params: last.params, at: Date.now() });
        if (!store.set('scenarios', list)) { say('This browser will not let the page save anything, so the scenario is not kept.'); return; }
        paintCount();
        say('Saved as scenario ' + list.length + ' on this device.');
        if (compare && !compare.hidden) drawCompare();
      });

      resetBtn.addEventListener('click', () => {
        load({});
        say('Back to the worked example.');
      });

      /* compare: the saved scenarios side by side with what is on screen now */
      let compare = null;
      const drawCompare = () => {
        const list = scenarios();
        compare.innerHTML = '';
        const head = document.createElement('div');
        head.className = 'calc-compare-head';
        const h = document.createElement('h2');
        h.textContent = 'Compare scenarios';
        const close = document.createElement('button');
        close.type = 'button'; close.className = 'btn-ghost'; close.textContent = 'Close';
        close.addEventListener('click', () => { compare.hidden = true; cmpBtn.setAttribute('aria-expanded', 'false'); cmpBtn.focus(); });
        head.appendChild(h); head.appendChild(close);
        compare.appendChild(head);
        if (!list.length) { const p = document.createElement('p'); p.textContent = 'Nothing saved yet. Use "Save scenario" to keep the figures on screen.'; compare.appendChild(p); return; }
        const cols = [{ name: 'Now', params: last ? last.params : paramsOf(spec, form), now: true }].concat(list.map((s, i) => ({ name: 'Scenario ' + (i + 1), params: s.params, i })));
        const code = curFor(spec);
        const results = cols.map((c) => { try { return spec.compute(valuesFrom(spec, c.params)) || {}; } catch (e) { return {}; } });
        const wrap = document.createElement('div');
        wrap.className = 'table-scroll';
        const t = document.createElement('table');
        t.className = 'schedule calc-compare-table';
        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        const th0 = document.createElement('th'); th0.textContent = ''; th0.scope = 'col'; hr.appendChild(th0);
        cols.forEach((c) => {
          const th = document.createElement('th'); th.scope = 'col'; th.className = 'num';
          const nm = document.createElement('span'); nm.textContent = c.name; th.appendChild(nm);
          if (!c.now) {
            const acts = document.createElement('span'); acts.className = 'calc-compare-acts';
            const ld = document.createElement('button'); ld.type = 'button'; ld.className = 'btn-ghost'; ld.textContent = 'Load';
            ld.setAttribute('aria-label', 'Load ' + c.name);
            ld.addEventListener('click', () => { load(c.params); say(c.name + ' is on screen.'); });
            const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'btn-ghost'; rm.textContent = 'Remove';
            rm.setAttribute('aria-label', 'Remove ' + c.name);
            rm.addEventListener('click', () => { const l = scenarios(); l.splice(c.i, 1); store.set('scenarios', l); paintCount(); drawCompare(); });
            acts.appendChild(ld); acts.appendChild(rm); th.appendChild(acts);
          }
          hr.appendChild(th);
        });
        thead.appendChild(hr); t.appendChild(thead);
        const tb = document.createElement('tbody');
        const addRow = (label, cells, cls) => {
          const tr = document.createElement('tr'); if (cls) tr.className = cls;
          const th = document.createElement('th'); th.scope = 'row'; th.textContent = label; tr.appendChild(th);
          cells.forEach((v) => { const td = document.createElement('td'); td.className = 'num'; td.textContent = v; tr.appendChild(td); });
          tb.appendChild(tr);
        };
        spec.inputs.forEach((inp) => {
          if (inp.showIf && !cols.some((c) => { const v = String(c.params[inp.showIf.key] !== undefined ? c.params[inp.showIf.key] : (byKey[inp.showIf.key] ? byKey[inp.showIf.key].input.default : '')); return Array.isArray(inp.showIf.is) ? inp.showIf.is.map(String).indexOf(v) >= 0 : String(inp.showIf.is) === v; })) return;
          addRow(inp.label + (inp.unit ? ' (' + unitText(spec, inp.unit) + ')' : ''), cols.map((c) => {
            const v = c.params[inp.key];
            if (v === undefined || v === '') return '—';
            if (inp.type === 'select') { const o = (inp.options || []).find((x) => String(x.value) === String(v)); return o ? o.label : String(v); }
            if (isMeasure(inp)) return measureText(Number(v), inp, byKey[inp.key] ? byKey[inp.key].unit() : MEASURES[inp.type].base);
            return inp.type === 'number' ? kitFor(spec).upto(Number(v), 6) : String(v);
          }), 'calc-compare-in');
        });
        spec.outputs.forEach((o) => {
          if (o.format === 'text') return;
          if (!results.some((r) => r[o.key] !== undefined)) return;
          addRow(o.label || o.key, results.map((r) => r[o.key] === undefined ? '—' : (fmt[o.format] || fmt.number)(r[o.key], unitText(spec, o.unit), code)), o.primary ? 'calc-compare-primary' : '');
        });
        t.appendChild(tb); wrap.appendChild(t); compare.appendChild(wrap);
      };
      cmpBtn.addEventListener('click', () => {
        if (!compare) {
          compare = document.createElement('section');
          compare.className = 'panel calc-compare';
          compare.setAttribute('aria-label', 'Compare scenarios');
          const calc = root.querySelector('.calc');
          const after = root.querySelector('.tool-chart') || calc;
          after.parentNode.insertBefore(compare, after.nextSibling);
          compare.hidden = true;
        }
        compare.hidden = !compare.hidden;
        cmpBtn.setAttribute('aria-expanded', String(!compare.hidden));
        if (!compare.hidden) { drawCompare(); compare.scrollIntoView({ block: 'nearest' }); }
      });

      /* the last eight results of this visit, newest first */
      const paintRecent = () => {
        const list = store.recent();
        recentBox.hidden = list.length === 0;
        recentSum.textContent = 'Recent results (' + list.length + ')';
        recentList.innerHTML = '';
        list.forEach((r) => {
          const li = document.createElement('li');
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'calc-recent-item';
          b.textContent = r.summary || '—';
          b.addEventListener('click', () => load(r.params));
          li.appendChild(b); recentList.appendChild(li);
        });
      };
      let recentTimer = null;
      const noteRecent = () => {
        clearTimeout(recentTimer);
        const snap = last;
        recentTimer = setTimeout(() => {
          if (!snap || !snap.summary) return;
          const list = store.recent().filter((r) => JSON.stringify(r.params) !== JSON.stringify(snap.params));
          list.unshift({ params: snap.params, summary: snap.summary, at: Date.now() });
          store.setRecent(list.slice(0, 8));
          paintRecent();
        }, 1500);
      };
      recentClear.addEventListener('click', () => { store.setRecent([]); paintRecent(); });

      paintCount();
      paintRecent();
      run();
    },

    mountConverter(dim, dimData, rawConvert, root, preset) {
      /* Temperature is the one family with offsets, and subtracting them
         leaves float dust where the answer is exactly zero: 32 °F showed
         as 5.684342e-14 °C. Nothing measured in degrees is meaningful at
         a billionth of one, so snap it. Other families only multiply, and
         a genuinely tiny result (a nanometre in light years) is kept. */
      const convert = dim === 'temperature'
        ? (v, f, t, d) => { const r = rawConvert(v, f, t, d); return Math.abs(r) < 1e-9 ? 0 : r; }
        : rawConvert;
      const form = root.querySelector('.tool-form');
      const out = root.querySelector('.tool-results');
      const keys = Object.keys(dimData.units);
      const UK = (window.UNIT_PARSE && window.UNIT_PARSE.ukName) || ((u) => u.name);
      const P2 = window.UNIT_PARSE || null;

      const mk = (key, label, def) => {
        const w = document.createElement('div');
        w.className = 'field';
        const l = document.createElement('label');
        l.setAttribute('for', 'u-' + key); l.textContent = label;
        const s = document.createElement('select');
        s.id = 'u-' + key; s.name = key; s.className = 'control';
        keys.forEach(k => {
          const o = document.createElement('option');
          o.value = k; o.textContent = `${UK(dimData.units[k], k)} (${dimData.units[k].symbol})`;
          if (k === def) o.selected = true;
          s.appendChild(o);
        });
        w.appendChild(l); w.appendChild(s);
        return w;
      };

      const vw = document.createElement('div');
      vw.className = 'field';
      vw.innerHTML = '<label for="u-value">Value</label>';
      /* Text, not a number box: it takes 5' 11", 5 ft 11 in, 11 st 4 lb,
         5 3/4 and 1.2e3 as well as plain numbers. The parse is shown under it. */
      const vi = document.createElement('input');
      vi.id = 'u-value'; vi.type = 'text'; vi.className = 'control';
      vi.inputMode = 'decimal'; vi.autocomplete = 'off'; vi.spellcheck = false;
      vi.setAttribute('aria-describedby', 'u-value-note');
      /* The Tool Finder sends "5 km to miles" here as ?v=5, so the answer is
         on screen as the page opens. Anything that is not a number keeps the
         worked example of 1. */
      let asked = NaN, qf = null, qt = null, qp = null;
      try {
        const q = linkParams();
        const g = q.get('v');
        if (g !== null && g.trim() !== '') asked = Number(g);
        qf = q.get('from'); qt = q.get('to'); qp = q.get('p');
      } catch (e) { /* no URL, no prefill */ }
      vi.value = Number.isFinite(asked) ? String(asked) : '1';
      vw.appendChild(vi);
      const vnote = document.createElement('p');
      vnote.className = 'field-hint calc-hint'; vnote.id = 'u-value-note';
      vw.appendChild(vnote);

      /* A shared link names the units too. Only units this page converts
         between are taken; anything else keeps the page's own pair. */
      const has = k => k !== null && Object.prototype.hasOwnProperty.call(dimData.units, k);
      const fromLink = Number.isFinite(asked) || has(qf) || has(qt);

      form.appendChild(vw);
      form.appendChild(mk('from', 'From', has(qf) ? qf : (preset?.from || keys[0])));
      form.appendChild(mk('to', 'To', has(qt) ? qt : (preset?.to || keys[1])));

      /* precision: "auto" is the converter's own rule; otherwise a fixed
         number of decimals or of significant figures, remembered here */
      const PKEY = '1234tools.conv.v1.precision';
      const pw = document.createElement('div');
      pw.className = 'field';
      pw.innerHTML = '<label for="u-precision">Precision</label>';
      const ps = document.createElement('select');
      ps.id = 'u-precision'; ps.className = 'control';
      [['auto', 'Automatic'], ['d0', 'Whole number'], ['d1', '1 decimal place'], ['d2', '2 decimal places'], ['d3', '3 decimal places'], ['d4', '4 decimal places'], ['d6', '6 decimal places'],
        ['s3', '3 significant figures'], ['s4', '4 significant figures'], ['s6', '6 significant figures'], ['s10', '10 significant figures']].forEach(([v, t]) => {
        const o = document.createElement('option'); o.value = v; o.textContent = t; ps.appendChild(o);
      });
      let savedP = null;
      try { savedP = localStorage.getItem(PKEY); } catch (e) { savedP = null; }
      const validP = (v) => Array.prototype.some.call(ps.options, (o) => o.value === v);
      ps.value = qp && validP(qp) ? qp : savedP && validP(savedP) ? savedP : 'auto';
      pw.appendChild(ps);
      form.appendChild(pw);

      const swap = document.createElement('button');
      swap.type = 'button'; swap.className = 'swap'; swap.textContent = '⇅ Swap units';
      form.appendChild(swap);

      /* batch: a pasted list, one value a line, converted as a column */
      const bd = document.createElement('details');
      bd.className = 'conv-batch';
      bd.innerHTML = '<summary>Convert a list</summary>';
      const bl = document.createElement('label');
      bl.setAttribute('for', 'u-batch'); bl.className = 'visually-hidden'; bl.textContent = 'Values to convert, one a line';
      const bt = document.createElement('textarea');
      bt.id = 'u-batch'; bt.className = 'control'; bt.rows = 5; bt.spellcheck = false;
      bt.placeholder = 'One value a line, or separated by commas';
      const bo = document.createElement('div');
      bo.className = 'conv-batch-out';
      const bact = document.createElement('div');
      bact.className = 'io-actions';
      const bcopy = document.createElement('button'); bcopy.type = 'button'; bcopy.className = 'btn-ghost'; bcopy.textContent = 'Copy results';
      const bcsv = document.createElement('button'); bcsv.type = 'button'; bcsv.className = 'btn-ghost'; bcsv.textContent = 'Download CSV';
      bact.appendChild(bcopy); bact.appendChild(bcsv);
      bd.appendChild(bl); bd.appendChild(bt); bd.appendChild(bo); bd.appendChild(bact);
      form.appendChild(bd);

      const fmtP = (r) => {
        const p = ps.value;
        if (p === 'auto' || typeof r !== 'number' || !isFinite(r)) return fmt.number(r);
        if (p[0] === 'd') return r.toLocaleString(locFor(), { minimumFractionDigits: Number(p.slice(1)), maximumFractionDigits: Number(p.slice(1)) });
        const sf = Number(p.slice(1));
        if (r === 0) return '0';
        const abs = Math.abs(r);
        if (abs < 1e-6 || abs >= 1e15) return r.toExponential(sf - 1).replace(/\.?0+e/, 'e');
        return Number(r.toPrecision(sf)).toLocaleString(locFor(), { maximumSignificantDigits: sf });
      };
      /* the answer in the "to" unit, written the way the unit is read:
         feet and inches, stones and pounds, or the inch to the nearest 1/16 */
      const extra = (r, t) => (P2 && P2.compound ? P2.compound(dim, t, r) : null);

      const parse = (txt, f) => {
        if (P2 && P2.parse) return P2.parse(txt, dim, f);
        const n = Number(String(txt).trim());
        return String(txt).trim() !== '' && Number.isFinite(n) ? { value: n } : null;
      };

      const tableBox = document.createElement('div');
      tableBox.className = 'conv-live';

      const runBatch = (f, t) => {
        bo.innerHTML = '';
        const lines = bt.value.split(/[\n,;\t]+/).map((s) => s.trim()).filter(Boolean).slice(0, 500);
        bact.hidden = lines.length === 0;
        if (!lines.length) return [];
        const rows = lines.map((s) => { const p = parse(s, f); return { s, p, r: p ? convert(p.value, f, t, dim) : NaN }; });
        const tb = document.createElement('table');
        tb.className = 'schedule conv-batch-table';
        tb.innerHTML = '<thead><tr><th scope="col">' + UK(dimData.units[f], f) + ' (' + dimData.units[f].symbol + ')</th><th scope="col" class="num">' + UK(dimData.units[t], t) + ' (' + dimData.units[t].symbol + ')</th></tr></thead>';
        const body = document.createElement('tbody');
        rows.forEach((x) => {
          const tr = document.createElement('tr');
          const a = document.createElement('td'); a.textContent = x.s;
          const b = document.createElement('td'); b.className = 'num';
          b.textContent = x.p ? fmtP(x.r) + ' ' + dimData.units[t].symbol : 'not a number';
          if (!x.p) tr.className = 'is-bad';
          tr.appendChild(a); tr.appendChild(b); body.appendChild(tr);
        });
        tb.appendChild(body);
        const w = document.createElement('div'); w.className = 'table-scroll'; w.appendChild(tb);
        bo.appendChild(w);
        const bad = rows.filter((x) => !x.p).length;
        if (bad) { const m = document.createElement('p'); m.className = 'field-msg'; m.textContent = bad + (bad === 1 ? ' line is' : ' lines are') + ' not a value this page can read, marked in the list.'; bo.appendChild(m); }
        return rows;
      };
      let batchRows = [];
      const batchText = (sep) => {
        const f = form.querySelector('[name="from"]').value, t = form.querySelector('[name="to"]').value;
        return [UK(dimData.units[f], f) + ' (' + dimData.units[f].symbol + ')', UK(dimData.units[t], t) + ' (' + dimData.units[t].symbol + ')'].join(sep) + '\n' +
          batchRows.map((x) => [x.s, x.p ? (sep === ',' ? String(Number(x.r.toPrecision(12))) : fmtP(x.r)) : ''].map((c) => sep === ',' && /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c).join(sep)).join('\n');
      };
      bcopy.addEventListener('click', () => { navigator.clipboard?.writeText(batchText('\t')).then(() => { bcopy.textContent = 'Copied'; setTimeout(() => (bcopy.textContent = 'Copy results'), 1200); }); });
      bcsv.addEventListener('click', () => {
        const blob = new Blob([batchText(',')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'conversions.' + (blob.type === 'text/csv' ? 'csv' : 'txt');
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      });

      const run = () => {
        const f = form.querySelector('[name="from"]').value;
        const t = form.querySelector('[name="to"]').value;
        out.innerHTML = '';
        batchRows = runBatch(f, t);
        const raw = vi.value;
        const parsed = raw.trim() === '' ? null : parse(raw, f);
        vnote.textContent = '';
        vi.removeAttribute('aria-invalid');
        if (raw.trim() !== '' && !parsed) {
          vi.setAttribute('aria-invalid', 'true');
          vnote.textContent = 'Not a value this page can read. Try 12.5, 5 3/4, 5′ 11″ or 11 st 4 lb.';
        } else if (parsed && parsed.note) vnote.textContent = parsed.note;
        const v = parsed ? parsed.value : null;

        if (v === null) { tableBox.innerHTML = ''; announce({ kind: 'converter', params: {}, summary: null, changed: touched || fromLink }); return; }

        const r = convert(v, f, t, dim);
        const main = document.createElement('div');
        main.className = 'result result-primary';
        const lab = document.createElement('span'); lab.className = 'result-label';
        lab.textContent = `${fmt.number(v)} ${dimData.units[f].symbol} =`;
        const val = document.createElement('span'); val.className = 'result-value';
        val.textContent = `${fmtP(r)} ${dimData.units[t].symbol}`;
        main.appendChild(lab); main.appendChild(val);
        out.appendChild(main);
        const ex = extra(r, t);
        if (ex) {
          const row = document.createElement('div');
          row.className = 'result result-compound';
          row.innerHTML = '<span class="result-label">Written as</span>';
          const s = document.createElement('span'); s.className = 'result-value'; s.textContent = ex;
          row.appendChild(s); out.appendChild(row);
        }

        const tbl = document.createElement('div');
        tbl.className = 'all-units';
        tbl.innerHTML = '<h3>The same value in every unit</h3>';
        keys.forEach(k => {
          if (k === f) return;
          const row = document.createElement('div');
          row.className = 'result';
          row.innerHTML =
            `<span class="result-label">${UK(dimData.units[k], k)}</span>` +
            `<span class="result-value">${fmtP(convert(v, f, k, dim))} ${dimData.units[k].symbol}</span>`;
          tbl.appendChild(row);
        });
        out.appendChild(tbl);
        drawLive(v, f, t);
        const params = { v: String(v), from: f, to: t };
        if (ps.value !== 'auto') params.p = ps.value;
        announce({
          kind: 'converter',
          params,
          summary: `${fmt.number(v)} ${dimData.units[f].symbol} = ${fmtP(r)} ${dimData.units[t].symbol}`,
          changed: touched || fromLink
        });
      };

      /* a live table around the value entered: the same steps the page's
         own table uses, scaled so the entered value sits in the middle */
      const drawLive = (v, f, t) => {
        if (!tableBox.isConnected) {
          const after = root.querySelector('.calc');
          if (after && after.parentNode) after.parentNode.insertBefore(tableBox, after.nextSibling);
        }
        tableBox.innerHTML = '';
        if (!Number.isFinite(v)) return;
        const mags = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 10];
        const vals = (v === 0 ? [0, 1, 2, 5, 10, 20, 50, 100] : mags.map((m) => v * m)).map((x) => Number(x.toPrecision(10)));
        const h = document.createElement('h2'); h.className = 'conv-live-h';
        h.textContent = UK(dimData.units[f], f) + ' to ' + UK(dimData.units[t], t) + ' around ' + fmt.number(v) + ' ' + dimData.units[f].symbol;
        const tb = document.createElement('table'); tb.className = 'schedule conv-live-table';
        tb.innerHTML = '<thead><tr><th scope="col">' + dimData.units[f].symbol + '</th><th scope="col" class="num">' + dimData.units[t].symbol + '</th></tr></thead>';
        const body = document.createElement('tbody');
        vals.forEach((x) => {
          const tr = document.createElement('tr');
          if (x === v) tr.className = 'is-mine';
          const a = document.createElement('td'); a.textContent = fmt.number(x) + ' ' + dimData.units[f].symbol;
          const b = document.createElement('td'); b.className = 'num'; b.textContent = fmtP(convert(x, f, t, dim)) + ' ' + dimData.units[t].symbol;
          tr.appendChild(a); tr.appendChild(b); body.appendChild(tr);
        });
        tb.appendChild(body);
        const w = document.createElement('div'); w.className = 'table-scroll'; w.appendChild(tb);
        const sec = document.createElement('section');
        sec.className = 'panel conv-live-panel'; sec.setAttribute('aria-label', h.textContent);
        sec.appendChild(h); sec.appendChild(w);
        tableBox.appendChild(sec);
      };

      /* Same rule as the calculators: the worked example shown on load is not
         use, so the install offer waits for a change the visitor made. */
      let touched = false;
      const used = () => { touched = true; document.dispatchEvent(new CustomEvent('mvr:tool-used')); run(); };

      swap.addEventListener('click', () => {
        const fs = form.querySelector('[name="from"]');
        const ts = form.querySelector('[name="to"]');
        [fs.value, ts.value] = [ts.value, fs.value];
        used();
      });
      ps.addEventListener('change', () => { try { localStorage.setItem(PKEY, ps.value); } catch (e) { /* not kept */ } });

      form.addEventListener('input', used);
      form.addEventListener('change', used);
      run();
    },

    /* For an engine that wants the same hand-off without its own copy. */
    announceShare: announce,
    /* lent to tests and to the other engines */
    _internals: { fmt, unitText, kitFor, splitMeasure, joinMeasure, MEASURES, checkField, curFor, symOf }
  };
})();

/* ============================================================
   Schedule tables — amortisation, depreciation, DCF, commission
   ============================================================ */
(function () {
  'use strict';
  window.MVRTool = window.MVRTool || {};
  const I = () => window.MVRTool._internals || null;

  function cellText(v, col, spec) {
    if (typeof v === 'string') return v;
    if (v === null || v === undefined) return '';
    const i = I();
    if (!i) return String(v);
    const code = spec ? i.curFor(spec) : 'GBP';
    const f = i.fmt;
    if (col === 'currency') return f.currency(v, null, code);
    if (col === 'int') return f.int(v, null, code);
    if (col === 'percent') return f.percent(v, null, code);
    if (col === 'text') return String(v);
    if (col && typeof col === 'object' && col.dp !== undefined) return i.kitFor(spec || {}).num(v, col.dp);
    return f.number(v, null, code);
  }
  /* a spreadsheet wants the number, not "₹1,23,456" */
  function csvCell(v) {
    if (typeof v === 'number') return isFinite(v) ? String(Math.round(v * 100) / 100) : '';
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /* A computation as a PDF, drawn by the site's own PDF writer
     (engine/pdfcore.bundle.js), loaded only when somebody asks for one.
     rep = { title, subtitle, columns, rows, cols, notes } from spec.report. */
  function loadWriter() {
    return new Promise(function (resolve, reject) {
      if (window.MVRPdfCore) { resolve(window.MVRPdfCore); return; }
      const s = document.createElement('script');
      s.src = '/engine/pdfcore.bundle.js';
      s.onload = function () { window.MVRPdfCore ? resolve(window.MVRPdfCore) : reject(new Error('The PDF writer did not load.')); };
      s.onerror = function () { reject(new Error('The PDF writer could not be loaded. Check the connection and try again.')); };
      document.head.appendChild(s);
    });
  }
  window.MVRTool.reportPdf = function (rep, spec) {
    return loadWriter().then(function (C) {
      const P = window.Prefs;
      const paper = P && P.paper ? String(P.paper()).toLowerCase() : 'a4';
      const size = C.PAGE_SIZES[paper] ? paper : 'a4';
      const WH = C.PAGE_SIZES[size], W = WH[0], H = WH[1];
      /* the standard PDF fonts carry no rupee sign */
      const t = function (s) { return String(s === null || s === undefined ? '' : s).replace(/₹\s?/g, 'Rs ').replace(/[  ]/g, ' '); };
      const M = 48, pages = [];
      let ops = [], y = H - M;
      const newPage = function () { pages.push({ size: [W, H], ops: ops }); ops = []; y = H - M; };
      const need = function (h) { if (y - h < M) newPage(); };
      ops.push({ text: t(rep.title), x: M, y: y, size: 16, font: 'Helvetica-Bold' }); y -= 22;
      C.wrapText(t(rep.subtitle || ''), 'Helvetica', 9, W - 2 * M).forEach(function (l) { ops.push({ text: l, x: M, y: y, size: 9, colour: '#444444' }); y -= 12; });
      y -= 8;
      const cols = rep.columns || [];
      const nc = Math.max(cols.length, 1);
      const first = (W - 2 * M) * (nc > 2 ? 0.46 : 0.6);
      const rest = nc > 1 ? (W - 2 * M - first) / (nc - 1) : 0;
      const xRight = function (i) { return M + first + rest * i; };
      const head = function () {
        ops.push({ rect: [M, y - 5, W - 2 * M, 18], fill: '#eeeeee' });
        cols.forEach(function (c, i) { ops.push(i === 0 ? { text: t(c), x: M + 4, y: y, size: 9, font: 'Helvetica-Bold' } : { text: t(c), x: xRight(i) - 4, y: y, size: 9, font: 'Helvetica-Bold', align: 'right' }); });
        y -= 20;
      };
      if (cols.length) head();
      (rep.rows || []).forEach(function (row, k) {
        need(16);
        if (y === H - M && cols.length) head();
        if (k % 2) ops.push({ rect: [M, y - 4, W - 2 * M, 15], fill: '#f7f7f7' });
        row.forEach(function (cell, i) {
          const s = t(cellText(cell, (rep.cols || [])[i], spec));
          ops.push(i === 0 ? { text: s, x: M + 4, y: y, size: 9 } : { text: s, x: xRight(i) - 4, y: y, size: 9, align: 'right' });
        });
        y -= 15;
      });
      y -= 10;
      (rep.notes || []).forEach(function (n) {
        C.wrapText(t(n), 'Helvetica', 8.5, W - 2 * M).forEach(function (l) { need(12); ops.push({ text: l, x: M, y: y, size: 8.5, colour: '#444444' }); y -= 11; });
        y -= 3;
      });
      newPage();
      const bytes = C.createPDF(pages, { pageSize: size, info: { Title: t(rep.title) } });
      return new Blob([bytes], { type: 'application/pdf' });
    });
  };

  window.MVRTool.renderTable = function (table, host, spec, ctx) {
    host.innerHTML = '';
    if (!table || !table.rows || !table.rows.length) { host.hidden = true; return; }
    host.hidden = false;
    ctx = ctx || {};
    const unitText = I() ? I().unitText : (s, u) => u;

    const views = Array.isArray(table.views) && table.views.length ? table.views : [table];
    let current = 0;
    const want = ctx.store ? ctx.store.get('tableView') : null;
    views.forEach((v, i) => { if (want && v.id === want) current = i; });

    if (table.title) {
      const h = document.createElement('h2');
      h.className = 'table-title';
      h.textContent = table.title;
      host.appendChild(h);
    }
    /* what the printout is a schedule of: the inputs, in words */
    if (ctx.inputs && ctx.inputs.length) {
      const ph = document.createElement('dl');
      ph.className = 'print-head';
      ctx.inputs.forEach(([k, v]) => { const d = document.createElement('div'); const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; d.appendChild(dt); d.appendChild(dd); ph.appendChild(d); });
      host.appendChild(ph);
    }

    let toggle = null;
    if (views.length > 1) {
      toggle = document.createElement('div');
      toggle.className = 'table-views';
      toggle.setAttribute('role', 'group');
      toggle.setAttribute('aria-label', 'Show the schedule');
      views.forEach((v, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn-ghost';
        b.textContent = v.label || (i === 0 ? 'Yearly' : 'Monthly');
        b.setAttribute('aria-pressed', String(i === current));
        b.addEventListener('click', () => {
          current = i;
          if (ctx.store && v.id) ctx.store.set('tableView', v.id);
          Array.prototype.forEach.call(toggle.children, (c, j) => { c.setAttribute('aria-pressed', String(j === i)); c.classList.toggle('is-active', j === i); });
          draw();
        });
        if (i === current) b.classList.add('is-active');
        toggle.appendChild(b);
      });
      host.appendChild(toggle);
    }

    const wrap = document.createElement('div');
    wrap.className = 'table-scroll';
    host.appendChild(wrap);

    function draw() {
      const view = views[current];
      const head = view.head || table.head;
      const cols = view.cols || table.cols || [];
      wrap.innerHTML = '';
      const t = document.createElement('table');
      t.className = 'schedule';
      const thead = document.createElement('thead');
      const hr = document.createElement('tr');
      head.forEach(function (h, i) {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = unitText(spec, h);
        if (i > 0) th.className = 'num';
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      t.appendChild(thead);
      const tb = document.createElement('tbody');
      const rowsOf = (rows, body, cls) => rows.forEach(function (row) {
        const tr = document.createElement('tr');
        if (cls) tr.className = cls;
        row.forEach(function (cell, i) {
          const td = document.createElement('td');
          td.textContent = cellText(cell, cols[i], spec);
          if (i > 0) td.className = 'num';
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
      rowsOf(view.rows, tb);
      t.appendChild(tb);
      if (view.foot) {
        const tf = document.createElement('tfoot');
        rowsOf([view.foot], tf, 'table-foot');
        t.appendChild(tf);
      }
      wrap.appendChild(t);
    }
    draw();

    // CSV export — schedules are the thing people paste into a spreadsheet
    const bar = document.createElement('div');
    bar.className = 'io-actions table-actions';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-ghost';
    btn.textContent = 'Download CSV';
    btn.addEventListener('click', function () {
      const view = views[current];
      const head = (view.head || table.head).map((h) => unitText(spec, h));
      const rows = view.rows.concat(view.foot ? [view.foot] : []);
      const csv = [head.map(csvCell).join(',')]
        .concat(rows.map(function (r) { return r.map(csvCell).join(','); })).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const name = (ctx.slug ? ctx.slug + '-' : '') + 'schedule' + (views.length > 1 && view.id ? '-' + view.id : '');
      a.href = url; a.download = name + '.' + (blob.type === 'text/csv' ? 'csv' : 'txt');
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    });
    bar.appendChild(btn);
    /* print: the schedule and what it was worked out from, nothing else */
    const pr = document.createElement('button');
    pr.type = 'button';
    pr.className = 'btn-ghost';
    pr.textContent = 'Print';
    pr.addEventListener('click', function () {
      document.body.classList.add('print-schedule');
      const done = function () { document.body.classList.remove('print-schedule'); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      try { window.print(); } finally { setTimeout(done, 1000); }
    });
    bar.appendChild(pr);
    host.appendChild(bar);
  };
})();

/* ============================================================
   Charts — line, stacked bar and donut, as inline SVG
   ============================================================ */
(function () {
  'use strict';
  window.MVRTool = window.MVRTool || {};
  const NS = 'http://www.w3.org/2000/svg';
  const I = () => window.MVRTool._internals || null;
  const svg = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  };

  function valueText(v, kind, spec) {
    const i = I();
    if (typeof v !== 'number' || !isFinite(v)) return '—';
    if (!i) return String(Math.round(v * 100) / 100);
    const code = i.curFor(spec || {});
    if (kind === 'currency') return i.fmt.currency(v, null, code);
    if (kind === 'percent') return i.fmt.percent(v, null, code);
    if (kind === 'int') return i.fmt.int(v, null, code);
    return i.fmt.number(v, null, code);
  }
  function axisText(v, kind, spec) {
    const i = I();
    const code = i ? i.curFor(spec || {}) : 'GBP';
    const loc = i ? i.kitFor(spec || {}).locale : 'en-GB';
    try {
      if (kind === 'currency') return new Intl.NumberFormat(loc, { style: 'currency', currency: code, notation: 'compact', maximumFractionDigits: 1 }).format(v);
      if (kind === 'percent') return new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(v) + '%';
      return new Intl.NumberFormat(loc, { notation: 'compact', maximumFractionDigits: 1 }).format(v);
    } catch (e) { return String(Math.round(v)); }
  }
  /* 1, 2, 2.5 or 5 times a power of ten: ticks a reader can add up */
  function niceStep(span, n) {
    if (!(span > 0)) return 1;
    const raw = span / n;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }

  function legend(host, items) {
    const ul = document.createElement('ul');
    ul.className = 'ch-legend';
    items.forEach((it, i) => {
      const li = document.createElement('li');
      const sw = document.createElement('span');
      sw.className = 'ch-sw ch-c' + (it.c === undefined ? i : it.c);
      sw.setAttribute('aria-hidden', 'true');
      li.appendChild(sw);
      li.appendChild(document.createTextNode(it.text));
      ul.appendChild(li);
    });
    host.appendChild(ul);
  }

  /* the chart as a PNG on the clipboard: its colours are the page's, so
     they are written onto each element before the SVG leaves the page */
  function toPng(svgEl, bg) {
    const clone = svgEl.cloneNode(true);
    const src = svgEl.querySelectorAll('*');
    const dst = clone.querySelectorAll('*');
    const props = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'fill-opacity', 'stroke-opacity', 'font-size', 'font-family', 'font-weight'];
    for (let i = 0; i < src.length; i++) {
      const cs = getComputedStyle(src[i]);
      dst[i].setAttribute('style', props.map((p) => p + ':' + cs.getPropertyValue(p)).join(';'));
    }
    clone.querySelectorAll('.ch-hover, .ch-guide, .ch-dot').forEach((n) => n.remove());
    const w = Number(svgEl.getAttribute('width')), h = Number(svgEl.getAttribute('height'));
    const back = document.createElementNS(NS, 'rect');
    back.setAttribute('width', w); back.setAttribute('height', h); back.setAttribute('fill', bg);
    clone.insertBefore(back, clone.firstChild);
    clone.setAttribute('xmlns', NS);
    const text = new XMLSerializer().serializeToString(clone);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = w * 2; c.height = h * 2;
        const x = c.getContext('2d');
        x.scale(2, 2); x.drawImage(img, 0, 0);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png');
      };
      img.onerror = () => reject(new Error('the chart could not be drawn'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
    });
  }

  function chartBox(cfg, host, spec, index) {
    const box = document.createElement('figure');
    box.className = 'ch-box';
    const cap = document.createElement('figcaption');
    cap.className = 'ch-title';
    cap.textContent = cfg.title || '';
    box.appendChild(cap);
    const stage = document.createElement('div');
    stage.className = 'ch-stage';
    box.appendChild(stage);
    const tip = document.createElement('div');
    tip.className = 'ch-tip';
    tip.hidden = true;
    tip.setAttribute('aria-live', 'polite');
    stage.appendChild(tip);
    host.appendChild(box);

    const W = Math.max(280, Math.round(stage.clientWidth || host.clientWidth || 600));
    const H = cfg.type === 'donut' ? Math.min(260, Math.max(200, Math.round(W * 0.55))) : Math.max(200, Math.min(300, Math.round(W * 0.48)));
    const s = svg('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, class: 'ch-svg', role: 'img', tabindex: '0', focusable: 'true' });
    stage.insertBefore(s, tip);
    const kind = cfg.format || 'number';
    const hint = 'Arrow keys read the values.';
    let label = (cfg.title || 'Chart') + '. ';

    const showTip = (x, y, lines) => {
      tip.innerHTML = '';
      lines.forEach((l, i) => { const d = document.createElement('div'); if (i === 0) d.className = 'ch-tip-h'; d.textContent = l; tip.appendChild(d); });
      tip.hidden = false;
      const tw = tip.offsetWidth || 160;
      tip.style.left = Math.max(0, Math.min(W - tw, x - tw / 2)) + 'px';
      tip.style.top = Math.max(0, y - (tip.offsetHeight || 40) - 10) + 'px';
    };
    const hideTip = () => { tip.hidden = true; };

    if (cfg.type === 'scale') {
      /* one horizontal bar of coloured bands, with the reader's value marked */
      const bands = cfg.bands || [];
      const lo = cfg.min, hi = cfg.max;
      const padX = 12, barY = 34, barH = 22;
      const Xs = (v) => padX + (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (W - 2 * padX);
      s.setAttribute('height', 110); s.setAttribute('viewBox', '0 0 ' + W + ' 110');
      let from = lo;
      bands.forEach((b, i) => {
        svg('rect', { x: Xs(from).toFixed(1), y: barY, width: Math.max(0, Xs(b.to) - Xs(from)).toFixed(1), height: barH, class: 'ch-band ch-f' + (b.c === undefined ? i : b.c) }, s);
        if (i < bands.length - 1) svg('text', { x: Xs(b.to).toFixed(1), y: barY + barH + 16, 'text-anchor': 'middle', class: 'ch-axis' }, s).textContent = String(b.to);
        from = b.to;
      });
      const mx = Xs(cfg.value);
      svg('path', { d: 'M' + mx.toFixed(1) + ' ' + (barY - 2) + 'l-7 -10h14z', class: 'ch-marker' }, s);
      svg('line', { x1: mx.toFixed(1), x2: mx.toFixed(1), y1: barY - 2, y2: barY + barH + 2, class: 'ch-marker-line' }, s);
      const tx = svg('text', { x: Math.max(40, Math.min(W - 40, mx)).toFixed(1), y: 14, 'text-anchor': 'middle', class: 'ch-center-v' }, s);
      tx.textContent = cfg.valueLabel || String(cfg.value);
      const inBand = bands.find((b, i) => cfg.value < b.to || i === bands.length - 1);
      label += (cfg.valueLabel || cfg.value) + (inBand ? ', in the band ' + inBand.name : '') + '.';
      legend(box, bands.map((b, i) => ({ text: b.name, c: b.c === undefined ? i : b.c })));
      s.removeAttribute('tabindex');
    } else if (cfg.type === 'donut') {
      const slices = (cfg.slices || []).filter((sl) => sl.value > 0);
      const total = slices.reduce((a, b) => a + b.value, 0);
      const r = Math.min(H / 2 - 8, W / 4), r0 = r * 0.58;
      const cx = Math.min(W / 2, r + 12), cy = H / 2;
      let a = -Math.PI / 2;
      const arcs = [];
      slices.forEach((sl, i) => {
        const frac = total ? sl.value / total : 0;
        const a2 = a + frac * Math.PI * 2;
        let d;
        if (frac >= 0.9999) {
          d = 'M' + (cx + r) + ' ' + cy + 'A' + r + ' ' + r + ' 0 1 1 ' + (cx - r) + ' ' + cy + 'A' + r + ' ' + r + ' 0 1 1 ' + (cx + r) + ' ' + cy +
            'M' + (cx + r0) + ' ' + cy + 'A' + r0 + ' ' + r0 + ' 0 1 0 ' + (cx - r0) + ' ' + cy + 'A' + r0 + ' ' + r0 + ' 0 1 0 ' + (cx + r0) + ' ' + cy + 'Z';
        } else {
          const big = a2 - a > Math.PI ? 1 : 0;
          const p = (ang, rr) => (cx + rr * Math.cos(ang)).toFixed(2) + ' ' + (cy + rr * Math.sin(ang)).toFixed(2);
          d = 'M' + p(a, r) + 'A' + r + ' ' + r + ' 0 ' + big + ' 1 ' + p(a2, r) + 'L' + p(a2, r0) + 'A' + r0 + ' ' + r0 + ' 0 ' + big + ' 0 ' + p(a, r0) + 'Z';
        }
        const path = svg('path', { d, class: 'ch-slice ch-f' + (sl.c === undefined ? i : sl.c), 'fill-rule': 'evenodd' }, s);
        const mid = (a + a2) / 2;
        arcs.push({ path, sl, frac, x: cx + (r * 0.8) * Math.cos(mid), y: cy + (r * 0.8) * Math.sin(mid) });
        a = a2;
      });
      if (cfg.center) {
        svg('text', { x: cx, y: cy - 4, 'text-anchor': 'middle', class: 'ch-center-k' }, s).textContent = cfg.center.label || '';
        svg('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', class: 'ch-center-v' }, s).textContent = valueText(cfg.center.value !== undefined ? cfg.center.value : total, kind, spec);
      }
      const lineOf = (x) => [x.sl.name, valueText(x.sl.value, x.sl.format || kind, spec) + ' · ' + (x.frac * 100).toFixed(1) + '%'];
      let at = -1;
      const pickArc = (i) => { at = i; arcs.forEach((x, j) => x.path.classList.toggle('is-on', j === i)); if (i >= 0) showTip(arcs[i].x, arcs[i].y, lineOf(arcs[i])); else hideTip(); };
      arcs.forEach((x, i) => {
        x.path.addEventListener('pointerenter', () => pickArc(i));
        x.path.addEventListener('pointerleave', () => pickArc(-1));
      });
      s.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { pickArc((at + 1) % arcs.length); e.preventDefault(); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { pickArc((at - 1 + arcs.length) % arcs.length); e.preventDefault(); }
        else if (e.key === 'Escape') pickArc(-1);
      });
      s.addEventListener('blur', () => pickArc(-1));
      label += arcs.map((x) => lineOf(x).join(' ')).join('; ') + '. ' + hint;
      legend(box, arcs.map((x, i) => ({ text: x.sl.name + ': ' + lineOf(x)[1], c: x.sl.c === undefined ? i : x.sl.c })));
    } else {
      const labels = cfg.labels || [];
      const series = (cfg.series || []).filter((x) => Array.isArray(x.values));
      const n = labels.length;
      const stacked = cfg.type === 'bar' && cfg.stacked !== false;
      let lo = 0, hi = 0;
      for (let k = 0; k < n; k++) {
        if (stacked) {
          let pos = 0, neg = 0;
          series.forEach((x) => { const v = Number(x.values[k]) || 0; if (v >= 0) pos += v; else neg += v; });
          hi = Math.max(hi, pos); lo = Math.min(lo, neg);
        } else series.forEach((x) => { const v = Number(x.values[k]); if (isFinite(v)) { hi = Math.max(hi, v); lo = Math.min(lo, v); } });
      }
      if (hi === lo) hi = lo + 1;
      const step = niceStep(hi - lo, 4);
      const top = Math.ceil(hi / step) * step, bottom = Math.floor(lo / step) * step;
      const ticks = [];
      for (let v = bottom; v <= top + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
      const tickLabels = ticks.map((t) => axisText(t, kind, spec));
      const padL = Math.min(90, 14 + Math.max.apply(null, tickLabels.map((t) => t.length)) * 7);
      const padR = 12, padT = 10, padB = 26;
      const pw = W - padL - padR, ph = H - padT - padB;
      const X = (k) => padL + (n <= 1 ? pw / 2 : (cfg.type === 'bar' ? (k + 0.5) * (pw / n) : k * (pw / (n - 1))));
      const Y = (v) => padT + ph - ((v - bottom) / (top - bottom)) * ph;
      const grid = svg('g', { class: 'ch-grid' }, s);
      ticks.forEach((t, i) => {
        svg('line', { x1: padL, x2: W - padR, y1: Y(t).toFixed(1), y2: Y(t).toFixed(1), class: t === 0 ? 'ch-zero' : 'ch-rule' }, grid);
        svg('text', { x: padL - 6, y: (Y(t) + 4).toFixed(1), 'text-anchor': 'end', class: 'ch-axis' }, grid).textContent = tickLabels[i];
      });
      const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 56))));
      labels.forEach((l, k) => {
        if (k % every !== 0 && k !== n - 1) return;
        if (k === n - 1 && k % every !== 0 && (n - 1) % every < every / 2) return;
        svg('text', { x: X(k).toFixed(1), y: H - 8, 'text-anchor': 'middle', class: 'ch-axis' }, grid).textContent = String(l);
      });
      const plot = svg('g', { class: 'ch-plot' }, s);
      if (cfg.type === 'bar') {
        const bw = Math.max(2, (pw / n) * 0.7);
        for (let k = 0; k < n; k++) {
          let pos = 0, neg = 0;
          series.forEach((x, i) => {
            const v = Number(x.values[k]) || 0;
            if (!stacked) {
              const w = bw / series.length;
              const x0 = X(k) - bw / 2 + i * w;
              svg('rect', { x: x0.toFixed(1), y: Y(Math.max(0, v)).toFixed(1), width: Math.max(1, w - 1).toFixed(1), height: Math.abs(Y(v) - Y(0)).toFixed(1), class: 'ch-f' + (x.c === undefined ? i : x.c) }, plot);
              return;
            }
            const from = v >= 0 ? pos : neg;
            const to = from + v;
            if (v >= 0) pos = to; else neg = to;
            svg('rect', { x: (X(k) - bw / 2).toFixed(1), y: Y(Math.max(from, to)).toFixed(1), width: bw.toFixed(1), height: Math.abs(Y(from) - Y(to)).toFixed(1), class: 'ch-f' + (x.c === undefined ? i : x.c) }, plot);
          });
        }
      } else {
        series.forEach((x, i) => {
          const pts = x.values.map((v, k) => (isFinite(Number(v)) ? X(k).toFixed(1) + ',' + Y(Number(v)).toFixed(1) : null)).filter(Boolean);
          if (!pts.length) return;
          if (x.area) svg('path', { d: 'M' + pts[0].split(',')[0] + ',' + Y(Math.max(0, bottom)).toFixed(1) + 'L' + pts.join('L') + 'L' + pts[pts.length - 1].split(',')[0] + ',' + Y(Math.max(0, bottom)).toFixed(1) + 'Z', class: 'ch-area ch-f' + (x.c === undefined ? i : x.c) }, plot);
          svg('polyline', { points: pts.join(' '), class: 'ch-line ch-s' + (x.c === undefined ? i : x.c) + (x.dashed ? ' ch-dashed' : ''), fill: 'none' }, plot);
        });
      }
      /* hover and keys: one column at a time, every series' value in it */
      const guide = svg('line', { y1: padT, y2: padT + ph, class: 'ch-guide', visibility: 'hidden' }, s);
      const dots = series.map((x, i) => svg('circle', { r: 4, class: 'ch-dot ch-f' + (x.c === undefined ? i : x.c), visibility: 'hidden' }, s));
      const hover = svg('rect', { x: padL, y: padT, width: pw, height: ph, class: 'ch-hover', fill: 'transparent' }, s);
      let at = -1;
      const pick = (k) => {
        at = k;
        if (k < 0 || k >= n) { guide.setAttribute('visibility', 'hidden'); dots.forEach((d) => d.setAttribute('visibility', 'hidden')); hideTip(); return; }
        guide.setAttribute('x1', X(k)); guide.setAttribute('x2', X(k)); guide.setAttribute('visibility', 'visible');
        let acc = 0, yTop = padT + ph;
        series.forEach((x, i) => {
          const v = Number(x.values[k]);
          if (!isFinite(v)) { dots[i].setAttribute('visibility', 'hidden'); return; }
          acc += v;
          const yy = Y(stacked ? acc : v);
          yTop = Math.min(yTop, yy);
          if (cfg.type === 'bar') { dots[i].setAttribute('visibility', 'hidden'); return; }
          dots[i].setAttribute('cx', X(k)); dots[i].setAttribute('cy', yy); dots[i].setAttribute('visibility', 'visible');
        });
        const lines = [(cfg.xLabel ? cfg.xLabel + ' ' : '') + labels[k]].concat(series.map((x) => x.name + ': ' + valueText(Number(x.values[k]), x.format || kind, spec)));
        if (stacked && series.length > 1 && cfg.totalLabel) lines.push(cfg.totalLabel + ': ' + valueText(acc, kind, spec));
        showTip(X(k), yTop, lines);
      };
      const nearest = (px) => {
        if (cfg.type === 'bar') return Math.max(0, Math.min(n - 1, Math.floor((px - padL) / (pw / n))));
        return Math.max(0, Math.min(n - 1, Math.round(n <= 1 ? 0 : (px - padL) / (pw / (n - 1)))));
      };
      const localX = (e) => { const b = s.getBoundingClientRect(); return (e.clientX - b.left) * (W / (b.width || W)); };
      hover.addEventListener('pointermove', (e) => pick(nearest(localX(e))));
      hover.addEventListener('pointerdown', (e) => pick(nearest(localX(e))));
      hover.addEventListener('pointerleave', () => pick(-1));
      s.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { pick(Math.min(n - 1, at + 1)); e.preventDefault(); }
        else if (e.key === 'ArrowLeft') { pick(at <= 0 ? 0 : at - 1); e.preventDefault(); }
        else if (e.key === 'Home') { pick(0); e.preventDefault(); }
        else if (e.key === 'End') { pick(n - 1); e.preventDefault(); }
        else if (e.key === 'Escape') pick(-1);
      });
      s.addEventListener('blur', () => pick(-1));
      const lastK = n - 1;
      label += n ? (labels[0] + ' to ' + labels[lastK] + '. At ' + labels[lastK] + ': ' + series.map((x) => x.name + ' ' + valueText(Number(x.values[lastK]), x.format || kind, spec)).join(', ') + '. ') : '';
      label += hint;
      legend(box, series.map((x, i) => ({ text: x.name, c: x.c === undefined ? i : x.c })));
    }
    s.setAttribute('aria-label', label);

    const acts = document.createElement('div');
    acts.className = 'io-actions ch-actions';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn-ghost'; b.textContent = 'Copy chart as PNG';
    b.addEventListener('click', () => {
      const bg = getComputedStyle(box).backgroundColor && getComputedStyle(box).backgroundColor !== 'rgba(0, 0, 0, 0)' ? getComputedStyle(box).backgroundColor : getComputedStyle(document.body).backgroundColor || '#ffffff';
      toPng(s, bg).then((blob) => {
        const fallback = () => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url;
          a.download = 'chart' + (index ? '-' + (index + 1) : '') + '.' + (blob.type === 'image/png' ? 'png' : 'img');
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
          b.textContent = 'Saved as PNG';
        };
        if (navigator.clipboard && window.ClipboardItem) {
          navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]).then(() => { b.textContent = 'Copied'; }, fallback);
        } else fallback();
        setTimeout(() => { b.textContent = 'Copy chart as PNG'; }, 1600);
      }, () => { b.textContent = 'Could not copy the chart'; setTimeout(() => { b.textContent = 'Copy chart as PNG'; }, 2000); });
    });
    acts.appendChild(b);
    box.appendChild(acts);
    return box;
  }

  window.MVRTool.chart = function (host, cfg, spec) { return chartBox(cfg, host, spec, 0); };
  window.MVRTool.renderCharts = function (charts, host, spec) {
    const list = (Array.isArray(charts) ? charts : [charts]).filter(Boolean);
    host.innerHTML = '';
    host.hidden = list.length === 0;
    host.__charts = { list, spec };
    list.forEach((c, i) => chartBox(c, host, spec, i));
    /* redrawn at the new width when the column changes size, not stretched */
    if (!host.__ro && window.ResizeObserver) {
      let w = host.clientWidth, t = null;
      host.__ro = new ResizeObserver(() => {
        if (Math.abs(host.clientWidth - w) < 24) return;
        w = host.clientWidth;
        clearTimeout(t);
        t = setTimeout(() => { const c = host.__charts; if (c) { host.innerHTML = ''; c.list.forEach((x, i) => chartBox(x, host, c.spec, i)); } }, 120);
      });
      host.__ro.observe(host);
    }
  };
})();
