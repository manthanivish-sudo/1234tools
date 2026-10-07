/**
 * Scientific calculator: the parser and the keypad, for
 * /mathematics/scientific-calculator/ alone.
 *
 * The parser is a tokeniser and a shunting-yard evaluator (never eval):
 *
 *   numbers     12, 0.5, .5, 1.2e3, 1.2E3 (the EE key types E)
 *   operators   + − × ÷ ^, unary minus, postfix ! (factorial) and postfix %
 *               (a percentage: 15% is 0.15, so 15% × 80 = 12)
 *   functions   sin cos tan asin acos atan sinh cosh tanh asinh acosh atanh,
 *               ln log (base 10) log2 sqrt cbrt abs exp floor ceil round sign,
 *               and with two arguments mod(a, b), ncr(n, r), npr(n, r),
 *               root(x, n)
 *   constants   pi, e, tau, phi, and ans (the last result)
 *
 * Angles: radians, degrees or gradians, for the trigonometric functions and
 * their inverses. % used to be the remainder; it is a percentage now, as on
 * a desk calculator, and the remainder is mod(a, b).
 *
 * nCr and nPr are computed by multiplying ratios, so ncr(1000, 500) does not
 * pass through 1000! (which overflows); both need whole n ≥ r ≥ 0.
 *
 * A result can be shown as a fraction: the continued fraction of the value,
 * stopping when it is within 1e-14 of it (relative) with a denominator up to 10⁶.
 *
 * Saved on this device (localStorage, one key, versioned): the angle unit
 * and the last 20 lines of history. A link can carry an expression
 * (#expr=…&angle=deg) and the share bar sends one; nothing leaves the page.
 */
(function () {
  'use strict';

  const F1 = Object.assign(Object.create(null), {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
    ln: Math.log, log: Math.log10, log2: Math.log2,
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
    exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round,
    sign: Math.sign, fact: null
  });
  function factorial(n) {
    if (n < 0 || n !== Math.floor(n)) return NaN;
    if (n > 170) return Infinity;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }
  function ncr(n, r) {
    if (!(Number.isInteger(n) && Number.isInteger(r)) || r < 0 || n < r) return NaN;
    r = Math.min(r, n - r);
    let v = 1;
    for (let i = 1; i <= r; i++) v = v * (n - r + i) / i;
    return v < 2 ** 53 ? Math.round(v) : v;
  }
  function npr(n, r) {
    if (!(Number.isInteger(n) && Number.isInteger(r)) || r < 0 || n < r) return NaN;
    let v = 1;
    for (let i = 0; i < r; i++) v *= (n - i);
    return v;
  }
  const F2 = Object.assign(Object.create(null), {
    mod: (a, b) => (b === 0 ? NaN : a - b * Math.floor(a / b)),
    ncr, npr,
    root: (x, n) => (n === 0 ? NaN : (x < 0 && Math.abs(n % 2) === 1 ? -Math.pow(-x, 1 / n) : Math.pow(x, 1 / n)))
  });
  const CONSTS = Object.assign(Object.create(null),
    { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 });
  const OPS = Object.assign(Object.create(null), {
    '+': { prec: 2, assoc: 'L', fn: (a, b) => a + b },
    '-': { prec: 2, assoc: 'L', fn: (a, b) => a - b },
    '*': { prec: 3, assoc: 'L', fn: (a, b) => a * b },
    '/': { prec: 3, assoc: 'L', fn: (a, b) => (b === 0 ? NaN : a / b) },
    '^': { prec: 5, assoc: 'R', fn: (a, b) => Math.pow(a, b) },
    'u-': { prec: 4, assoc: 'R', unary: true, fn: (a) => -a }
  });

  function tokenise(expr, ans) {
    const tokens = [];
    const s = String(expr).replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi');
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/[0-9.]/.test(c)) {
        let j = i;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        if ((s[j] === 'e' || s[j] === 'E') && /[0-9+-]/.test(s[j + 1] || '') && (s[j + 1] !== '+' && s[j + 1] !== '-' || /[0-9]/.test(s[j + 2] || ''))) {
          j++;
          if (/[+-]/.test(s[j])) j++;
          while (j < s.length && /[0-9]/.test(s[j])) j++;
        }
        const raw = s.slice(i, j);
        if ((raw.match(/\./g) || []).length > 1) throw new Error(`"${raw}" has more than one decimal point`);
        if (raw === '.') throw new Error('A decimal point needs a digit');
        tokens.push({ type: 'num', value: parseFloat(raw) });
        i = j;
        continue;
      }
      if (/[a-z]/i.test(c)) {
        let j = i;
        while (j < s.length && /[a-z0-9]/i.test(s[j])) j++;
        const name = s.slice(i, j).toLowerCase();
        if (name === 'ans') {
          if (ans === null || ans === undefined || !isFinite(ans)) throw new Error('There is no answer yet to use as Ans');
          tokens.push({ type: 'num', value: ans });
        } else if (Object.prototype.hasOwnProperty.call(CONSTS, name)) tokens.push({ type: 'num', value: CONSTS[name] });
        else if (Object.prototype.hasOwnProperty.call(F1, name)) tokens.push({ type: 'func', value: name, arity: 1 });
        else if (Object.prototype.hasOwnProperty.call(F2, name)) tokens.push({ type: 'func', value: name, arity: 2 });
        else throw new Error(`"${name}" is not a known function or constant`);
        i = j;
        continue;
      }
      if (c === '(' || c === ')') { tokens.push({ type: c }); i++; continue; }
      if (c === ',') { tokens.push({ type: 'comma' }); i++; continue; }
      if (c === '!') { tokens.push({ type: 'post', value: '!' }); i++; continue; }
      if (c === '%') { tokens.push({ type: 'post', value: '%' }); i++; continue; }
      if (Object.prototype.hasOwnProperty.call(OPS, c)) {
        const prev = tokens[tokens.length - 1];
        const isUnary = (c === '-' || c === '+') && (!prev || prev.type === 'op' || prev.type === '(' || prev.type === 'comma');
        if (isUnary) { if (c === '-') tokens.push({ type: 'op', value: 'u-' }); }
        else tokens.push({ type: 'op', value: c });
        i++;
        continue;
      }
      throw new Error(`Unexpected character "${c}"`);
    }
    /* implicit multiplication: 2pi, 3(4), (2)(3), 2sin(x) */
    const out = [];
    tokens.forEach((t, k) => {
      const p = out[out.length - 1];
      const endsValue = p && (p.type === 'num' || p.type === ')' || p.type === 'post');
      const startsValue = t.type === 'num' || t.type === '(' || t.type === 'func';
      if (k && endsValue && startsValue) out.push({ type: 'op', value: '*' });
      out.push(t);
    });
    return out;
  }

  function evaluate(expr, angleUnit, ans) {
    if (!String(expr).trim()) return { value: NaN, empty: true };
    const tokens = tokenise(expr, ans);
    if (!tokens.length) return { value: NaN, empty: true };
    const out = [], stack = [], args = [];
    for (const tk of tokens) {
      if (tk.type === 'num' || tk.type === 'post') out.push(tk);
      else if (tk.type === 'func') stack.push(tk);
      else if (tk.type === 'op') {
        const o1 = OPS[tk.value];
        while (stack.length) {
          const top = stack[stack.length - 1];
          if (top.type === 'func') { out.push(stack.pop()); continue; }
          if (top.type !== 'op') break;
          const o2 = OPS[top.value];
          if ((o1.assoc === 'L' && o1.prec <= o2.prec) || (o1.assoc === 'R' && o1.prec < o2.prec && !o1.unary)) out.push(stack.pop());
          else break;
        }
        stack.push(tk);
      } else if (tk.type === '(') { stack.push(tk); args.push(1); }
      else if (tk.type === 'comma') {
        while (stack.length && stack[stack.length - 1].type !== '(') out.push(stack.pop());
        if (!stack.length || !args.length) throw new Error('A comma belongs inside a function’s brackets, as in mod(17, 5)');
        args[args.length - 1]++;
      } else if (tk.type === ')') {
        let found = false;
        while (stack.length) {
          const top = stack.pop();
          if (top.type === '(') { found = true; break; }
          out.push(top);
        }
        if (!found) throw new Error('Unmatched closing bracket');
        const n = args.pop();
        if (stack.length && stack[stack.length - 1].type === 'func') {
          const f = stack.pop();
          if (n !== f.arity) throw new Error(`${f.value}() takes ${f.arity === 1 ? 'one number' : 'two numbers, separated by a comma'}`);
          out.push(f);
        } else if (n !== 1) throw new Error('A comma belongs inside a function’s brackets, as in mod(17, 5)');
      }
    }
    while (stack.length) {
      const top = stack.pop();
      if (top.type === '(') throw new Error('Unmatched opening bracket');
      out.push(top);
    }
    const toRad = (x) => (angleUnit === 'deg' ? x * Math.PI / 180 : angleUnit === 'grad' ? x * Math.PI / 200 : x);
    const fromRad = (x) => (angleUnit === 'deg' ? x * 180 / Math.PI : angleUnit === 'grad' ? x * 200 / Math.PI : x);
    const TRIG_IN = new Set(['sin', 'cos', 'tan']);
    const TRIG_OUT = new Set(['asin', 'acos', 'atan']);
    /* sin(180°) is 0, not 1.2e-16: exact at the multiples where it is exact */
    const trig = (name, x) => {
      const r = toRad(x);
      const v = F1[name](r);
      if (angleUnit !== 'rad') {
        const q = angleUnit === 'deg' ? x / 90 : x / 100;
        if (Number.isInteger(q)) {
          const k = ((q % 4) + 4) % 4;
          if (name === 'sin') return [0, 1, 0, -1][k];
          if (name === 'cos') return [1, 0, -1, 0][k];
          if (name === 'tan') return k % 2 ? NaN : 0;
        }
      }
      return v;
    };
    const st = [];
    for (const tk of out) {
      if (tk.type === 'num') st.push(tk.value);
      else if (tk.type === 'post') {
        if (!st.length) throw new Error(`Nothing to apply ${tk.value} to`);
        const a = st.pop();
        st.push(tk.value === '!' ? factorial(a) : a / 100);
      } else if (tk.type === 'func') {
        if (tk.arity === 2) {
          if (st.length < 2) throw new Error(`${tk.value}() takes two numbers, separated by a comma`);
          const b = st.pop(), a = st.pop();
          st.push(F2[tk.value](a, b));
          continue;
        }
        if (!st.length) throw new Error(`${tk.value}() is missing its argument`);
        const a = st.pop();
        if (tk.value === 'fact') { st.push(factorial(a)); continue; }
        if (TRIG_IN.has(tk.value)) { st.push(trig(tk.value, a)); continue; }
        const res = F1[tk.value](a);
        st.push(TRIG_OUT.has(tk.value) ? fromRad(res) : res);
      } else if (tk.type === 'op') {
        const o = OPS[tk.value];
        if (o.unary) { if (!st.length) throw new Error('Missing operand'); st.push(o.fn(st.pop())); }
        else {
          if (st.length < 2) throw new Error(`Operator ${tk.value} is missing an operand`);
          const b = st.pop(), a = st.pop();
          st.push(o.fn(a, b));
        }
      }
    }
    if (st.length !== 1) throw new Error('That expression is incomplete');
    return { value: st[0], empty: false };
  }

  /* the nearest fraction p/q, q ≤ 10⁶, within 1e-12 of v (relative), or null */
  function toFraction(v) {
    if (!isFinite(v)) return null;
    if (Number.isInteger(v)) return { n: v, d: 1 };
    const sign = v < 0 ? -1 : 1;
    let x = Math.abs(v), h0 = 0, h1 = 1, k0 = 1, k1 = 0;
    for (let i = 0; i < 40; i++) {
      const a = Math.floor(x);
      const h2 = a * h1 + h0, k2 = a * k1 + k0;
      if (k2 > 1e6) break;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (Math.abs(h1 / k1 - Math.abs(v)) <= 1e-14 * Math.max(1, Math.abs(v))) return { n: sign * h1, d: k1 };
      const f = x - a;
      if (f < 1e-15) break;
      x = 1 / f;
    }
    return null;
  }

  window.MVRSci = { evaluate, toFraction, factorial, ncr, npr };

  /* ============================================================
     The page
     ============================================================ */
  if (typeof document === 'undefined') return;
  window.MVRTool = window.MVRTool || {};
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const KEY = '1234tools.scientific.v1';
  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
  const save = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* not kept */ } };
  const linkParams = () => { const q = new URLSearchParams(location.search); try { new URLSearchParams(location.hash.replace(/^#/, '')).forEach((v, k) => q.set(k, v)); } catch (e) { /* none */ } return q; };
  function announce(state) {
    (window.MVRTool = window.MVRTool || {}).shareState = function () { return state; };
    document.dispatchEvent(new CustomEvent('mvr:result', { detail: state }));
  }
  const show = (v) => (Math.abs(v) >= 1e15 || (Math.abs(v) < 1e-6 && v !== 0)
    ? v.toExponential(9).replace(/\.?0+e/, 'e').replace(/e\+?/, ' × 10^')
    : Number(v.toPrecision(14)).toLocaleString('en-GB', { maximumFractionDigits: 12 }));

  window.MVRTool.mountScientific = function (root) {
    const io = root.querySelector('.tool-io');
    const saved = load();
    let angle = ['rad', 'deg', 'grad'].indexOf(saved.angle) >= 0 ? saved.angle : 'rad';
    let hist = Array.isArray(saved.history) ? saved.history.slice(0, 20) : [];
    let memory = typeof saved.memory === 'number' && isFinite(saved.memory) ? saved.memory : 0;
    let ans = typeof saved.ans === 'number' && isFinite(saved.ans) ? saved.ans : null;
    let asFraction = false;
    const persist = () => save({ angle, history: hist, memory, ans });

    const shell = el('div', 'calc-shell');
    const display = el('div', 'calc-display');
    const modeTag = el('span', 'calc-mode', angle.toUpperCase());
    const memTag = el('span', 'calc-mode calc-mem', 'M');
    memTag.title = 'A number is in memory';
    const expr = el('input', 'calc-expr');
    expr.type = 'text'; expr.spellcheck = false; expr.autocomplete = 'off';
    expr.setAttribute('aria-label', 'Expression'); expr.placeholder = '0';
    const result = el('div', 'calc-result', '0');
    result.setAttribute('aria-live', 'polite');
    display.appendChild(modeTag); display.appendChild(memTag); display.appendChild(expr); display.appendChild(result);

    const histBox = el('div', 'calc-history');
    const histHead = el('div', 'calc-hist-head');
    const histTitle = el('span', null, 'History, kept on this device');
    const histClear = el('button', 'btn-ghost', 'Clear');
    histClear.type = 'button';
    histHead.appendChild(histTitle); histHead.appendChild(histClear);
    const histList = el('div', 'calc-hist-list');

    const insert = (txt, caretBack) => {
      const s = expr.selectionStart ?? expr.value.length;
      const e2 = expr.selectionEnd ?? expr.value.length;
      expr.value = expr.value.slice(0, s) + txt + expr.value.slice(e2);
      const pos = s + txt.length - (caretBack || 0);
      expr.setSelectionRange(pos, pos);
      expr.focus();
      run(true);
    };
    let last = null;
    const memKey = (op) => {
      const v = last !== null ? last : 0;
      if (op === 'mc') memory = 0;
      else if (op === 'm+') memory += v;
      else if (op === 'm-') memory -= v;
      else if (op === 'mr') { insert('(' + String(memory) + ')'); return; }
      memTag.hidden = memory === 0;
      persist();
      say(op === 'mc' ? 'Memory cleared' : 'Memory: ' + show(memory));
    };
    const say = (t) => { status.textContent = t; };

    const KEYS = [
      ['sin(', 'sin'], ['cos(', 'cos'], ['tan(', 'tan'], ['^', 'xʸ'], ['^2', 'x²'], ['sqrt(', '√'],
      ['asin(', 'sin⁻¹'], ['acos(', 'cos⁻¹'], ['atan(', 'tan⁻¹'], ['10^(', '10ˣ'], ['1/(', '1/x'], ['cbrt(', '∛'],
      ['ln(', 'ln'], ['log(', 'log'], ['exp(', 'eˣ'], ['!', 'n!'], ['ncr(', 'nCr'], ['npr(', 'nPr'],
      ['pi', 'π'], ['e', 'e'], ['ans', 'Ans'], ['E', 'EE'], ['%', '%'], ['mod(', 'mod'],
      ['abs(', '|x|'], ['floor(', '⌊x⌋'], ['ceil(', '⌈x⌉'], [',', ','], ['(', '('], [')', ')'],
      ['7', '7'], ['8', '8'], ['9', '9'], ['/', '÷'], [':mc', 'MC'], [':mr', 'MR'],
      ['4', '4'], ['5', '5'], ['6', '6'], ['*', '×'], [':m+', 'M+'], [':m-', 'M−'],
      ['1', '1'], ['2', '2'], ['3', '3'], ['-', '−'], [':frac', 'a/b'], ['+', '+'],
      ['0', '0'], ['.', '.']
    ];
    const LABELS = { '^2': 'square', '10^(': 'ten to the power', '1/(': 'reciprocal', 'ans': 'last answer', E: 'times ten to the power (EE)', '%': 'percent', ':mc': 'memory clear', ':mr': 'memory recall', ':m+': 'add to memory', ':m-': 'subtract from memory', ':frac': 'show as a fraction', 'ncr(': 'combinations, n choose r', 'npr(': 'permutations' };
    const pads = el('div', 'calc-pad');
    const angleRow = el('div', 'calc-angle');
    [['rad', 'RAD'], ['deg', 'DEG'], ['grad', 'GRAD']].forEach(([v, label]) => {
      const b = el('button', 'calc-key calc-key-mode', label);
      b.type = 'button'; b.dataset.angle = v;
      b.setAttribute('aria-pressed', String(v === angle));
      b.addEventListener('click', () => {
        angle = v; modeTag.textContent = v.toUpperCase();
        angleRow.querySelectorAll('[data-angle]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.angle === v)));
        persist(); run(true);
      });
      angleRow.appendChild(b);
    });
    const clr = el('button', 'calc-key calc-key-warn', 'AC');
    clr.type = 'button';
    clr.addEventListener('click', () => { expr.value = ''; run(true); expr.focus(); });
    const del = el('button', 'calc-key calc-key-warn', '⌫');
    del.type = 'button'; del.setAttribute('aria-label', 'Delete');
    del.addEventListener('click', () => {
      const s = expr.selectionStart ?? expr.value.length;
      if (s > 0) { expr.value = expr.value.slice(0, s - 1) + expr.value.slice(s); expr.setSelectionRange(s - 1, s - 1); }
      run(true); expr.focus();
    });
    angleRow.appendChild(clr); angleRow.appendChild(del);
    const grid = el('div', 'calc-grid');
    let fracKey = null;
    KEYS.forEach(([val, label]) => {
      const b = el('button', 'calc-key', label);
      b.type = 'button';
      if (LABELS[val]) b.setAttribute('aria-label', LABELS[val]);
      if (/^[0-9.]$/.test(val)) b.classList.add('calc-key-num');
      if (val[0] === ':' && val !== ':frac') b.classList.add('calc-key-mem');
      if (val === ':frac') { fracKey = b; b.setAttribute('aria-pressed', 'false'); }
      b.addEventListener('click', () => {
        if (val === ':frac') { asFraction = !asFraction; b.setAttribute('aria-pressed', String(asFraction)); run(false); return; }
        if (val[0] === ':') { memKey(val.slice(1)); return; }
        insert(val);
      });
      grid.appendChild(b);
    });
    const eq = el('button', 'calc-key calc-key-eq', '=');
    eq.type = 'button';
    eq.addEventListener('click', () => commit());
    grid.appendChild(eq);
    pads.appendChild(angleRow); pads.appendChild(grid);
    const status = el('p', 'calc-status');
    status.setAttribute('role', 'status');
    shell.appendChild(display); shell.appendChild(pads);
    io.appendChild(shell); io.appendChild(status);
    histBox.appendChild(histHead); histBox.appendChild(histList);
    io.appendChild(histBox);
    void fracKey;

    function paintHist() {
      histList.innerHTML = '';
      histBox.hidden = hist.length === 0;
      hist.forEach((h) => {
        const row = el('button', 'calc-hist-row');
        row.type = 'button';
        row.appendChild(el('span', 'calc-hist-expr', h.expr));
        row.appendChild(el('span', 'calc-hist-val', '= ' + h.shown));
        row.title = 'Use this expression again';
        row.addEventListener('click', () => { expr.value = h.expr; run(true); expr.focus(); });
        histList.appendChild(row);
      });
    }
    histClear.addEventListener('click', () => { hist = []; persist(); paintHist(); });

    let touched = false, fromLink = false;
    function tell(summary) {
      announce({ kind: 'io', params: expr.value.trim() ? { expr: expr.value.slice(0, 300), angle } : {}, summary, changed: touched || fromLink });
    }
    function run(byUser) {
      if (byUser) touched = true;
      const raw = expr.value;
      result.className = 'calc-result';
      if (!raw.trim()) { result.textContent = '0'; last = null; tell(null); return; }
      try {
        const r = evaluate(raw, angle, ans);
        if (r.empty) { result.textContent = '0'; last = null; tell(null); return; }
        if (!isFinite(r.value)) {
          result.textContent = Number.isNaN(r.value) ? 'undefined' : (r.value > 0 ? '∞' : '−∞');
          last = null; tell(null); return;
        }
        last = r.value;
        let shown = show(r.value);
        if (asFraction) {
          const f = toFraction(r.value);
          if (f && f.d !== 1) {
            const whole = Math.trunc(f.n / f.d), rest = Math.abs(f.n % f.d);
            shown = f.n + '/' + f.d + (Math.abs(f.n) > f.d ? '  =  ' + whole + ' ' + rest + '/' + f.d : '');
          } else if (!f) shown += '  (no simple fraction)';
        }
        result.textContent = shown;
        tell(raw.trim() + ' = ' + shown);
      } catch (e) {
        result.textContent = e.message;
        result.className = 'calc-result is-err';
        last = null;
        tell(null);
      }
    }
    function commit() {
      if (last === null || !expr.value.trim()) return;
      hist.unshift({ expr: expr.value, shown: result.textContent });
      hist = hist.filter((h, k) => k === 0 || h.expr !== hist[0].expr).slice(0, 20);
      ans = last;
      persist();
      paintHist();
      say('Ans = ' + show(ans));
      /* the full value goes back in the entry line, to carry on from */
      expr.value = String(ans);
      expr.setSelectionRange(expr.value.length, expr.value.length);
      run(false);
      document.dispatchEvent(new CustomEvent('mvr:tool-used'));
    }
    expr.addEventListener('input', () => run(true));
    expr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { expr.value = ''; run(true); }
    });

    try {
      const q = linkParams();
      const x = q.get('expr'), a = q.get('angle');
      if (a && ['rad', 'deg', 'grad'].indexOf(a) >= 0) { angle = a; modeTag.textContent = a.toUpperCase(); angleRow.querySelectorAll('[data-angle]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.angle === a))); }
      if (x !== null && x.trim()) { expr.value = x.slice(0, 300); fromLink = true; }
    } catch (e) { /* no link */ }
    memTag.hidden = memory === 0;
    paintHist();
    run(false);
  };
})();
