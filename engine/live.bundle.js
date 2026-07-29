(function(){
/**
 * Live tools — the ones that need a running clock or a custom keypad.
 *
 * The maths and time logic live here as pure functions so they can be tested
 * in Node; render-live.js owns only the UI and the timers.
 *
 * The calculator uses a real tokeniser and shunting-yard parser rather than
 * eval(). eval on user input is an injection vector, it cannot be tested
 * meaningfully, and it gives useless error messages.
 */

/* ============================================================
   Expression evaluator
   ============================================================ */

const FUNCS = Object.assign(Object.create(null), {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  ln: Math.log, log: Math.log10, log2: Math.log2,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
  exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  sign: Math.sign, fact: null       // handled specially
});

/* Null-prototype so that "constructor", "valueOf", "hasOwnProperty" and the
   rest of Object.prototype do not resolve as if they were constants. Built as
   a literal, CONSTS['constructor'] returns the Object constructor and the
   tokeniser happily accepts it. */
const CONSTS = Object.assign(Object.create(null),
  { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 });

const OPS = Object.assign(Object.create(null), {
  '+': { prec: 2, assoc: 'L', fn: (a, b) => a + b },
  '-': { prec: 2, assoc: 'L', fn: (a, b) => a - b },
  '*': { prec: 3, assoc: 'L', fn: (a, b) => a * b },
  '/': { prec: 3, assoc: 'L', fn: (a, b) => b === 0 ? NaN : a / b },
  '%': { prec: 3, assoc: 'L', fn: (a, b) => b === 0 ? NaN : a % b },
  '^': { prec: 5, assoc: 'R', fn: (a, b) => Math.pow(a, b) },
  'u-': { prec: 4, assoc: 'R', unary: true, fn: (a) => -a }
});

function factorial(n) {
  if (n < 0 || n !== Math.floor(n)) return NaN;
  if (n > 170) return Infinity;                // beyond double precision
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function tokenise(expr) {
  const tokens = [];
  const s = String(expr).replace(/\s+/g, '');
  let i = 0;
  while (i < s.length) {
    const c = s[i];

    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      // scientific notation
      if (s[j] === 'e' && /[0-9+-]/.test(s[j + 1] || '')) {
        j++;
        if (/[+-]/.test(s[j])) j++;
        while (j < s.length && /[0-9]/.test(s[j])) j++;
      }
      const raw = s.slice(i, j);
      if ((raw.match(/\./g) || []).length > 1) throw new Error(`"${raw}" has more than one decimal point`);
      tokens.push({ type: 'num', value: parseFloat(raw) });
      i = j;
      continue;
    }

    if (/[a-z]/i.test(c)) {
      let j = i;
      while (j < s.length && /[a-z0-9]/i.test(s[j])) j++;
      const name = s.slice(i, j).toLowerCase();
      if (Object.prototype.hasOwnProperty.call(CONSTS, name)) {
        tokens.push({ type: 'num', value: CONSTS[name] });
      } else if (Object.prototype.hasOwnProperty.call(FUNCS, name)) {
        tokens.push({ type: 'func', value: name });
      } else {
        throw new Error(`"${name}" is not a known function or constant`);
      }
      i = j;
      continue;
    }

    if (c === '(' || c === ')') { tokens.push({ type: c }); i++; continue; }
    if (c === ',') { tokens.push({ type: 'comma' }); i++; continue; }
    if (c === '!') { tokens.push({ type: 'fact' }); i++; continue; }

    if (Object.prototype.hasOwnProperty.call(OPS, c)) {
      const prev = tokens[tokens.length - 1];
      const isUnary = (c === '-' || c === '+') &&
        (!prev || prev.type === 'op' || prev.type === '(' || prev.type === 'comma');
      if (isUnary) {
        if (c === '-') tokens.push({ type: 'op', value: 'u-' });
        // unary + is a no-op
      } else {
        tokens.push({ type: 'op', value: c });
      }
      i++;
      continue;
    }

    throw new Error(`Unexpected character "${c}"`);
  }
  return tokens;
}

/** Shunting-yard to RPN, then evaluate. Angle unit applies to trig functions. */
function evaluate(expr, angleUnit) {
  if (!String(expr).trim()) return { value: NaN, empty: true };
  const tokens = tokenise(expr);
  if (!tokens.length) return { value: NaN, empty: true };

  const out = [], stack = [];
  for (const tk of tokens) {
    if (tk.type === 'num') out.push(tk);
    else if (tk.type === 'func') stack.push(tk);
    else if (tk.type === 'fact') out.push(tk);
    else if (tk.type === 'op') {
      const o1 = OPS[tk.value];
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type === 'func') { out.push(stack.pop()); continue; }
        if (top.type !== 'op') break;
        const o2 = OPS[top.value];
        if ((o1.assoc === 'L' && o1.prec <= o2.prec) || (o1.assoc === 'R' && o1.prec < o2.prec)) {
          out.push(stack.pop());
        } else break;
      }
      stack.push(tk);
    } else if (tk.type === '(') stack.push(tk);
    else if (tk.type === ')') {
      let found = false;
      while (stack.length) {
        const top = stack.pop();
        if (top.type === '(') { found = true; break; }
        out.push(top);
      }
      if (!found) throw new Error('Unmatched closing bracket');
      if (stack.length && stack[stack.length - 1].type === 'func') out.push(stack.pop());
    }
  }
  while (stack.length) {
    const top = stack.pop();
    if (top.type === '(') throw new Error('Unmatched opening bracket');
    out.push(top);
  }

  const toRad = (x) => angleUnit === 'deg' ? x * Math.PI / 180
    : angleUnit === 'grad' ? x * Math.PI / 200 : x;
  const fromRad = (x) => angleUnit === 'deg' ? x * 180 / Math.PI
    : angleUnit === 'grad' ? x * 200 / Math.PI : x;
  const TRIG_IN = new Set(['sin', 'cos', 'tan']);
  const TRIG_OUT = new Set(['asin', 'acos', 'atan']);

  const st = [];
  for (const tk of out) {
    if (tk.type === 'num') st.push(tk.value);
    else if (tk.type === 'fact') {
      if (!st.length) throw new Error('Nothing to apply ! to');
      st.push(factorial(st.pop()));
    } else if (tk.type === 'func') {
      if (!st.length) throw new Error(`${tk.value}() is missing its argument`);
      const a = st.pop();
      if (tk.value === 'fact') { st.push(factorial(a)); continue; }
      const fn = FUNCS[tk.value];
      const arg = TRIG_IN.has(tk.value) ? toRad(a) : a;
      const res = fn(arg);
      st.push(TRIG_OUT.has(tk.value) ? fromRad(res) : res);
    } else if (tk.type === 'op') {
      const o = OPS[tk.value];
      if (o.unary) {
        if (!st.length) throw new Error('Missing operand');
        st.push(o.fn(st.pop()));
      } else {
        if (st.length < 2) throw new Error(`Operator ${tk.value} is missing an operand`);
        const b = st.pop(), a = st.pop();
        st.push(o.fn(a, b));
      }
    }
  }
  if (st.length !== 1) throw new Error('That expression is incomplete');
  return { value: st[0], empty: false };
}

/* ============================================================
   Time zones
   ============================================================ */

const COMMON_ZONES = [
  'UTC','Europe/London','Europe/Dublin','Europe/Paris','Europe/Berlin','Europe/Madrid',
  'Europe/Rome','Europe/Amsterdam','Europe/Zurich','Europe/Stockholm','Europe/Warsaw',
  'Europe/Athens','Europe/Istanbul','Europe/Moscow','Africa/Cairo','Africa/Lagos',
  'Africa/Nairobi','Africa/Johannesburg','Asia/Jerusalem','Asia/Dubai','Asia/Karachi',
  'Asia/Kolkata','Asia/Kathmandu','Asia/Dhaka','Asia/Bangkok','Asia/Jakarta',
  'Asia/Singapore','Asia/Hong_Kong','Asia/Shanghai','Asia/Manila','Asia/Tokyo',
  'Asia/Seoul','Australia/Perth','Australia/Adelaide','Australia/Brisbane',
  'Australia/Sydney','Pacific/Auckland','Pacific/Fiji','America/Sao_Paulo',
  'America/Argentina/Buenos_Aires','America/Santiago','America/Bogota','America/Lima',
  'America/Mexico_City','America/New_York','America/Toronto','America/Chicago',
  'America/Denver','America/Phoenix','America/Los_Angeles','America/Vancouver',
  'America/Anchorage','Pacific/Honolulu'
];

/** Offset in minutes for a zone at a given instant, from Intl. */
function zoneOffset(date, zone) {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const p = {};
  dtf.formatToParts(date).forEach(x => { if (x.type !== 'literal') p[x.type] = x.value; });
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day,
    +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

function formatOffset(mins) {
  const sign = mins < 0 ? '-' : '+';
  const a = Math.abs(mins);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

/**
 * Interpret a wall-clock time in a source zone and return the instant.
 * Two passes: the offset depends on the instant, and the instant depends on
 * the offset, so the first guess is corrected once — which is enough for
 * every real zone.
 */
function zonedTimeToInstant(y, mo, d, h, mi, zone) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let off = zoneOffset(new Date(guess), zone);
  let inst = guess - off * 60000;
  const off2 = zoneOffset(new Date(inst), zone);
  if (off2 !== off) inst = guess - off2 * 60000;
  return new Date(inst);
}

const LIVE_TOOLS = {

  'scientific-calculator': {
    title: 'Scientific Calculator',
    kind: 'calculator',
    category: 'mathematics',
    description: 'A full scientific calculator with trigonometry, logarithms, powers, roots and constants.',
    keywords: ['scientific calculator', 'online calculator', 'trigonometry calculator', 'log calculator', 'square root calculator'],
    tips: [
      'Type expressions directly or use the keypad — both feed the same parser, so 2+3*4 correctly gives 14, not 20.',
      'Supported functions: sin, cos, tan and their inverses and hyperbolics, ln, log, log2, sqrt, cbrt, abs, exp, floor, ceil, round, sign. Use ! for factorial.',
      'Constants pi, e, tau and phi can be used anywhere a number can.',
      'The angle mode applies to trigonometric functions only, and is shown next to the display so it cannot be mistaken.',
      'Expressions are parsed with a proper tokeniser, not eval, so a typo produces a useful message rather than a broken page.'
    ],
    faq: [
      { q: 'Why does sin(90) give 1 in one mode and 0.894 in another?', a: 'Because 90 degrees is a right angle but 90 radians is about 14 full turns. Check the angle mode indicator — it is the most common source of confusion with any scientific calculator.' },
      { q: 'How precise is it?', a: 'It uses double-precision floating point, giving about 15–17 significant digits. That means 0.1 + 0.2 shows as 0.30000000000000004 if you ask for full precision — a property of binary floating point, not a bug.' }
    ]
  },

  'timezone-converter': {
    title: 'Time Zone Converter',
    kind: 'timezone',
    category: 'time',
    description: 'Convert a time between world time zones, with daylight saving handled automatically.',
    keywords: ['time zone converter', 'world clock', 'time difference', 'convert time zones', 'meeting planner', 'what time is it in'],
    tips: [
      'Daylight saving is handled by your browser\u2019s IANA time zone database, so transitions are correct without any manual adjustment.',
      'Zones are named by city rather than abbreviation because abbreviations are ambiguous — CST means Central Standard Time, China Standard Time and Cuba Standard Time.',
      'The offset shown is for the date you chose, not today. A meeting in three months may sit on the other side of a DST change.',
      'When scheduling across zones, agree the time in UTC and let each participant convert. That removes the commonest source of missed meetings.'
    ],
    faq: [
      { q: 'Why does the difference between two cities change during the year?', a: 'Because they start and end daylight saving on different dates, and some observe none at all. London and New York are five hours apart most of the year but four for a couple of weeks each spring.' },
      { q: 'Is the list of zones complete?', a: 'It covers the zones people schedule across. Your browser knows the full IANA database of several hundred; this shows a practical subset plus your own detected zone.' }
    ]
  },

  'countdown-timer': {
    title: 'Countdown Timer',
    kind: 'countdown',
    category: 'time',
    description: 'Count down to any date and time, with a live display of days, hours, minutes and seconds.',
    keywords: ['countdown timer', 'days until', 'countdown to date', 'time until', 'event countdown'],
    tips: [
      'The countdown runs live in your browser and keeps working offline — nothing is fetched while it counts.',
      'Times are interpreted in your own time zone. For an event elsewhere, convert it first with the time zone converter.',
      'Once the target passes, the display switches to counting up, which is often what you actually want.',
      'Leaving the tab in the background may slow the update rate — browsers throttle inactive tabs — but the elapsed time stays correct.'
    ],
    faq: [
      { q: 'Does the countdown keep running if I close the tab?', a: 'No. It is calculated from the target date each time the page is open, so closing and reopening gives the correct remaining time without anything being stored.' }
    ]
  },

  'stopwatch-timer': {
    title: 'Stopwatch, Timer & Pomodoro',
    kind: 'stopwatch',
    category: 'time',
    description: 'A stopwatch with lap times, a countdown timer, and a Pomodoro cycle with work and break intervals.',
    keywords: ['online stopwatch', 'timer online', 'pomodoro timer', 'lap timer', 'countdown timer online'],
    tips: [
      'The stopwatch measures elapsed time from a high-resolution clock, so it stays accurate even if the tab is throttled in the background.',
      'Lap times record the split since the previous lap alongside the total, which is what you want for intervals.',
      'The Pomodoro cycle defaults to 25 minutes of work and 5 of break, with a longer break every fourth cycle.',
      'Browsers block sound until you interact with the page, so press start at least once before relying on the alert.'
    ],
    faq: [
      { q: 'Is it accurate if I switch tabs?', a: 'Yes. Elapsed time is computed from timestamps rather than counted tick by tick, so throttling affects how often the display refreshes but not the measurement.' }
    ]
  }
};


window.MVRLive={evaluate:evaluate,zoneOffset:zoneOffset,formatOffset:formatOffset,zonedTimeToInstant:zonedTimeToInstant,COMMON_ZONES:COMMON_ZONES};
})();