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

/* One formatter per zone: making an Intl.DateTimeFormat costs far more
   than using one, and a year of daily steps asks for thousands. */
const PARTS_FMT = Object.create(null);
function partsIn(ms, zone) {
  let f = PARTS_FMT[zone];
  if (!f) {
    f = PARTS_FMT[zone] = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, hourCycle: 'h23', weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
  const p = {};
  f.formatToParts(new Date(ms)).forEach(x => { if (x.type !== 'literal') p[x.type] = x.value; });
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second, dow: WD[p.weekday] };
}
/** Offset in minutes at an instant (ms), with the cached formatter. */
function offsetAt(ms, zone) {
  const p = partsIn(ms, zone);
  return Math.round((Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000) / 60000);
}

/**
 * A wall-clock time in a zone, resolved the way calendars do it: a time
 * that does not exist (the hour skipped when clocks go forward) moves on by
 * the length of the gap, and a time that happens twice (the hour repeated
 * when clocks go back) is the first of the two.
 *   { at: ms, status: 'ok' | 'gap' | 'overlap', wall: {y,mo,d,h,mi}, later?: ms }
 */
function resolveWallTime(y, mo, d, h, mi, zone) {
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const offs = [...new Set([offsetAt(wall - 86400000, zone), offsetAt(wall, zone), offsetAt(wall + 86400000, zone)])];
  const hits = [];
  offs.forEach(o => {
    const at = wall - o * 60000;
    if (offsetAt(at, zone) === o && hits.indexOf(at) < 0) hits.push(at);
  });
  hits.sort((a, b) => a - b);
  if (hits.length >= 2) return { at: hits[0], later: hits[hits.length - 1], status: 'overlap', wall: partsIn(hits[0], zone) };
  if (hits.length === 1) return { at: hits[0], status: 'ok', wall: partsIn(hits[0], zone) };
  /* in a gap: the offset in force before it, which lands after it */
  const before = offsetAt(wall - 86400000, zone);
  const at = wall - Math.min(...offs.concat(before)) * 60000;
  return { at, status: 'gap', wall: partsIn(at, zone) };
}

/**
 * The instants a zone's offset changes between two moments, to the minute:
 * [{ at, from, to }] with offsets in minutes. Daily steps, then halving.
 */
function zoneTransitions(zone, fromMs, toMs) {
  const out = [];
  const MIN = 60000, DAY = 86400000;
  let t = Math.floor(fromMs / MIN) * MIN;
  let off = offsetAt(t, zone);
  while (t < toMs) {
    const n = Math.min(t + DAY, Math.ceil(toMs / MIN) * MIN);
    const o2 = offsetAt(n, zone);
    if (o2 !== off) {
      let lo = t, hi = n;
      while (hi - lo > MIN) {
        const mid = lo + Math.floor((hi - lo) / (2 * MIN)) * MIN;
        if (offsetAt(mid, zone) === off) lo = mid; else hi = mid;
      }
      if (hi > fromMs && hi <= toMs) out.push({ at: hi, from: off, to: offsetAt(hi, zone) });
      off = offsetAt(hi, zone);
      t = hi;
      continue;
    }
    t = n;
  }
  return out;
}

/* ---------- zone search ---------- */

const fold = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[_/\-.,()']+/g, ' ').replace(/\s+/g, ' ').trim();
/** "America/Argentina/Buenos_Aires" → "Buenos Aires". */
const cityOf = (id) => id === 'UTC' ? 'UTC' : id.split('/').pop().replace(/_/g, ' ');

/**
 * The search index over MVRZones (engine/live-zones.js).
 *   opts.valid(id)    false drops a zone this browser cannot use
 *   opts.country(cc)  the country's name, e.g. from Intl.DisplayNames
 */
function buildZoneIndex(data, opts) {
  opts = opts || {};
  const valid = opts.valid || (() => true);
  const country = opts.country || ((cc) => cc);
  const byId = Object.create(null);
  const list = [{ id: 'UTC', cc: '', note: 'Coordinated Universal Time' }].concat(data.zones || []);
  list.forEach(z => {
    if (byId[z.id] || !valid(z.id)) return;
    const cn = z.cc ? country(z.cc) : '';
    byId[z.id] = {
      id: z.id, city: cityOf(z.id), country: cn, note: z.note || '',
      /* a country or the database's comment ranks just below a place's own name */
      keys: [[cityOf(z.id), 0], [z.id, 0], [cn, 0.2], [z.note || '', 0.3]].filter(k => k[0]).map(k => [fold(k[0]), k[1]]),
      names: []
    };
  });
  (data.aliases || []).forEach(a => { const e = byId[a.id]; if (e) a.names.forEach(n => e.names.push(n)); });
  const abbr = (data.abbr || []).filter(a => byId[a.id]);
  return { byId, entries: Object.keys(byId).map(k => byId[k]), abbr, links: data.links || {} };
}

/** A zone name as the index knows it: old names (Asia/Calcutta) become the current one. */
function canonicalZone(index, id) {
  if (!id) return null;
  if (id === 'Etc/UTC' || id === 'Etc/GMT' || id === 'GMT' || id === 'UTC' || id === 'Etc/Universal' || id === 'Zulu') return 'UTC';
  if (index.byId[id]) return id;
  const to = index.links[id];
  return to && index.byId[to] ? to : null;
}

function score(key, q) {
  if (key === q) return 0;
  if (key.startsWith(q)) return 1;
  if ((' ' + key).indexOf(' ' + q) >= 0) return 2;
  if (key.indexOf(q) >= 0) return 3;
  return 9;
}

/**
 * Up to `limit` zones for what somebody typed: a city, a country, a zone
 * name, an abbreviation, or an offset ("UTC+5:30", "+9", "GMT-3", which
 * needs opts.offsetOf(id) → minutes now). Each result:
 *   { id, title, detail, via: 'zone' | 'alias' | 'abbr' | 'offset' }
 */
function searchZones(index, query, limit, opts) {
  limit = limit || 12;
  opts = opts || {};
  const q = fold(query);
  if (!q) return [];
  const best = Object.create(null);
  const put = (id, s, title, via) => {
    const cur = best[id];
    if (!cur || s < cur.s || (s === cur.s && title.length < cur.title.length)) best[id] = { s, title, via };
  };
  const m = /^(?:utc|gmt)?\s*([+\-\u2212])\s*(\d{1,2})(?:\s*:?\s*(\d{2}))?$/.exec(String(query).trim().toLowerCase());
  if (m && opts.offsetOf) {
    const want = (m[1] === '+' ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3] || 0));
    index.entries.forEach(e => { if (opts.offsetOf(e.id) === want) put(e.id, 1, e.city, 'offset'); });
  }
  index.abbr.forEach(a => { if (fold(a.abbr) === q) put(a.id, 0.5, a.abbr, 'abbr'); });
  index.entries.forEach(e => {
    let s = 9;
    e.keys.forEach(([k, w]) => { const sk = score(k, q); if (sk < 9) s = Math.min(s, sk + w); });
    if (s < 9) put(e.id, s, e.city, 'zone');
    e.names.forEach(n => {
      const sn = score(fold(n), q);
      if (sn < 9) put(e.id, sn + 0.1, n, 'alias');
    });
  });
  return Object.keys(best)
    .map(id => ({ id, s: best[id].s, title: best[id].title, via: best[id].via }))
    .sort((a, b) => a.s - b.s || a.title.length - b.title.length || (a.title < b.title ? -1 : 1))
    .slice(0, limit)
    .map(r => {
      const e = index.byId[r.id];
      const where = [e.country, r.via === 'zone' ? '' : e.city].filter(Boolean).join(' · ');
      return { id: r.id, title: r.title, via: r.via,
        detail: (r.via === 'abbr' ? 'abbreviation, taken as ' : '') + (where ? where + ' · ' : '') + r.id };
    });
}

/* ---------- meeting planner ---------- */

/**
 * One row per zone for the day that starts at home midnight `dayStart`
 * (ms) and lasts `hours` (23, 24 or 25 on a clock-change day), a cell per
 * home hour: { at, h, mi, label, shift, cls } where shift is the local
 * date's difference from the home date in days (−1, 0, +1) and cls is
 * 'work' (inside working hours on a weekday), 'edge' (the two hours before
 * work or four after it), 'night', or 'off' (a weekend day).
 *   work: { start: 9, end: 17, weekend: [0, 6] } (hours may be fractional)
 */
function plannerRows(dayStart, hours, zones, homeZone, work) {
  work = work || {};
  const ws = work.start === undefined ? 9 : work.start, we = work.end === undefined ? 17 : work.end;
  const weekend = work.weekend || [0, 6];
  const home = partsIn(dayStart, homeZone);
  const homeDay = Date.UTC(home.y, home.mo - 1, home.d);
  return zones.map(z => {
    const cells = [];
    for (let i = 0; i < hours; i++) {
      const at = dayStart + i * 3600000;
      const p = partsIn(at, z);
      const t = p.h + p.mi / 60;
      const shift = Math.round((Date.UTC(p.y, p.mo - 1, p.d) - homeDay) / 86400000);
      let cls;
      if (weekend.indexOf(p.dow) >= 0) cls = 'off';
      else if (t >= ws && t < we) cls = 'work';
      else if ((t >= ws - 2 && t < ws) || (t >= we && t < Math.min(24, we + 4))) cls = 'edge';
      else cls = 'night';
      cells.push({ at, h: p.h, mi: p.mi, label: String(p.h).padStart(2, '0') + (p.mi ? ':' + String(p.mi).padStart(2, '0') : ''), shift, cls });
    }
    return { zone: z, cells };
  });
}
/** Runs of columns where every row is 'work': [{ from, to }] as column indexes, to exclusive. */
function sharedWorkHours(rows) {
  const n = rows.length ? rows[0].cells.length : 0;
  const runs = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const all = i < n && rows.every(r => r.cells[i].cls === 'work');
    if (all && start < 0) start = i;
    if (!all && start >= 0) { runs.push({ from: start, to: i }); start = -1; }
  }
  return runs;
}

/**
 * The stretches of [from, to) (ms) inside working hours in every zone at
 * once, to the minute: each zone's working day (work.start to work.end on
 * its own weekdays) as instants, intersected. → [{ from, to }]
 */
function sharedWorkTimes(from, to, zones, work) {
  work = work || {};
  const ws = work.start === undefined ? 9 : work.start, we = work.end === undefined ? 17 : work.end;
  const weekend = work.weekend || [0, 6];
  let shared = [{ from, to }];
  zones.forEach(z => {
    const spans = [];
    const a = partsIn(from - 86400000, z);
    for (let i = 0; i < 4; i++) {
      const dt = new Date(Date.UTC(a.y, a.mo - 1, a.d + i));
      if (weekend.indexOf(dt.getUTCDay()) >= 0) continue;
      const y = dt.getUTCFullYear(), mo = dt.getUTCMonth() + 1, d = dt.getUTCDate();
      const at = (hours) => {
        const n = new Date(Date.UTC(y, mo - 1, d + Math.floor(hours / 24)));
        const h = hours % 24;
        return resolveWallTime(n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate(), Math.floor(h), Math.round((h % 1) * 60), z).at;
      };
      const s = at(ws), e = at(we);
      if (e > s) spans.push({ from: s, to: e });
    }
    const next = [];
    shared.forEach(x => spans.forEach(y => {
      const f = Math.max(x.from, y.from), t = Math.min(x.to, y.to);
      if (t > f) next.push({ from: f, to: t });
    }));
    shared = next;
  });
  return shared.sort((p, q) => p.from - q.from);
}

/* ---------- calendar file ---------- */

const icsText = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsStamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
/** RFC 5545 folding: lines of at most 75 octets, continued with CRLF + space. */
function icsFold(line) {
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}
/**
 * One event as an iCalendar file. Times are written in UTC (…Z), which every
 * calendar converts to the reader's own zone.
 *   { title, start (ms), minutes, description, uid, now (ms) }
 */
function buildICS(ev) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//1234Tools//Time Zone Converter//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + (ev.uid || (icsStamp(ev.start) + '-' + Math.random().toString(36).slice(2, 10) + '@1234tools')),
    'DTSTAMP:' + icsStamp(ev.now === undefined ? Date.now() : ev.now),
    'DTSTART:' + icsStamp(ev.start),
    'DTEND:' + icsStamp(ev.start + Math.max(1, ev.minutes || 60) * 60000),
    'SUMMARY:' + icsText(ev.title || 'Meeting')
  ];
  if (ev.description) lines.push('DESCRIPTION:' + icsText(ev.description));
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

/* ---------- repeating countdowns ---------- */

const daysIn = (y, mo) => new Date(Date.UTC(y, mo, 0)).getUTCDate();
/**
 * The next time a repeating event comes round, at or after `now`:
 * repeat 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'. A day missing
 * from a month or year (the 31st, 29 February) is that month's last day.
 * The wall-clock time is kept in the event's zone across clock changes.
 *   → { at, y, mo, d, n } where n counts the repeats since the first.
 */
function nextOccurrence(ev, now) {
  const at = (y, mo, d) => resolveWallTime(y, mo, d, ev.h, ev.mi, ev.zone).at;
  const d0 = Math.min(ev.d, daysIn(ev.y, ev.mo));
  const first = at(ev.y, ev.mo, d0);
  if (!ev.repeat || ev.repeat === 'none' || first >= now) return { at: first, y: ev.y, mo: ev.mo, d: d0, n: 0 };
  const nth = (k) => {
    if (ev.repeat === 'daily' || ev.repeat === 'weekly') {
      const t = new Date(Date.UTC(ev.y, ev.mo - 1, d0 + k * (ev.repeat === 'daily' ? 1 : 7)));
      return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate() };
    }
    const months = ev.repeat === 'monthly' ? k : 12 * k;
    const y = ev.y + Math.floor((ev.mo - 1 + months) / 12), mo = ((ev.mo - 1 + months) % 12) + 1;
    return { y, mo, d: Math.min(ev.d, daysIn(y, mo)) };
  };
  const span = { daily: 86400000, weekly: 604800000, monthly: 28 * 86400000, yearly: 365 * 86400000 }[ev.repeat] || 86400000;
  let k = Math.max(0, Math.floor((now - first) / span) - 2);
  while (ev.repeat === 'monthly' || ev.repeat === 'yearly' ? k > 0 && at(nth(k).y, nth(k).mo, nth(k).d) >= now : false) k--;
  for (let guard = 0; guard < 100000; guard++, k++) {
    const c = nth(k), t = at(c.y, c.mo, c.d);
    if (t >= now) return { at: t, y: c.y, mo: c.mo, d: c.d, n: k };
  }
  return { at: first, y: ev.y, mo: ev.mo, d: d0, n: 0 };
}

/** A span in ms as { days, hours, minutes, seconds }, whole units. */
function splitSpan(ms) {
  const a = Math.max(0, Math.floor(Math.abs(ms) / 1000));
  return { days: Math.floor(a / 86400), hours: Math.floor(a / 3600) % 24, minutes: Math.floor(a / 60) % 60, seconds: a % 60 };
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
      "Daylight saving is handled by your browser’s IANA time zone database, so transitions are correct without any manual adjustment.",
      "Search by city, country, zone name, abbreviation or offset: “Mumbai”, “Japan”, “IST” and “+5:30” all work. Abbreviations are ambiguous — CST means Central Standard Time, China Standard Time and Cuba Standard Time — so the list says which zone it took.",
      "The offset shown is for the date you chose, not today. When a city changes its clocks within four weeks of that date, the page says so and gives the new gap.",
      "In the meeting planner, green hours are working hours on a weekday, amber the two hours before work and the four after, and striped hours fall on a weekend. Choose an hour along the top to set the time.",
      "The .ics file stores the time in UTC, so each person’s calendar shows it in their own zone."
    ],
    faq: [
      { q: "Why does the difference between two cities change during the year?", a: "Because they start and end daylight saving on different dates, and some observe none at all. London and New York are five hours apart most of the year, but four for three weeks in March and for one week around the start of November." },
      { q: "Is the list of zones complete?", a: "Yes. The search covers every location in the IANA time zone database (418 in release 2026e), the old names browsers still report, and a list of other cities, countries and abbreviations. A zone too new for your browser’s own copy of the database is left out rather than shown wrong." },
      { q: "What happens to a time that does not exist?", a: "On the morning clocks go forward an hour is skipped: 01:30 does not exist in London on Sunday 29 March 2026. The converter says so and takes it as 02:30. On the morning clocks go back, 01:30 happens twice; it uses the first and says so." },
      { q: "Can I share the comparison?", a: "Yes. Tick “Include my settings” in the share bar and the link carries the cities, the zone and the time you chose, after the # so it never reaches a server." }
    ]
  },

  'countdown-timer': {
    title: 'Countdown Timer',
    kind: 'countdown',
    category: 'time',
    description: 'Count down to any date and time, with a live display of days, hours, minutes and seconds.',
    keywords: ['countdown timer', 'days until', 'countdown to date', 'time until', 'event countdown'],
    tips: [
      "The countdown runs live in your browser and keeps working offline — nothing is fetched while it counts.",
      "Choose the time zone of the event: a launch at 09:00 in New York counts down to 09:00 there, and the page shows when that is where you are.",
      "Once the target passes, the display switches to counting up, which is often what you actually want. For an anniversary, choose “Time since it” to see the years, months and days as well.",
      "A repeating event — every day, week, month or year — moves on to the next time by itself. One set for the 31st falls on the last day of shorter months.",
      "Browsers block sound until you interact with the page, so click once on the page before relying on the sound at zero. The sound is timed by the audio clock, which keeps time in a background tab.",
      "Leaving the tab in the background may slow the update rate — browsers throttle inactive tabs — but the time shown stays correct, and the tab’s title shows the time left."
    ],
    faq: [
      { q: "Does the countdown keep running if I close the tab?", a: "No: once the page is closed nothing runs, so no sound or notification can come. Your last countdown is remembered in this browser, and reopening the page works out the time left again from the target." },
      { q: "How do I share a countdown?", a: "Tick “Include my settings” in the share bar. The link carries the event name, date, time, time zone, repeat and theme after the #, so they never reach a server, and whoever opens it sees the same moment in their own zone." },
      { q: "Why did I not get a notification?", a: "Notifications need your permission, asked for when you tick “Notify me at zero”, and the page must still be open in a tab. If your browser blocks them for this site, the page says so; allow them in the browser’s site settings." }
    ]
  },

  'stopwatch-timer': {
    title: 'Stopwatch, Timer & Pomodoro',
    kind: 'stopwatch',
    category: 'time',
    description: 'A stopwatch with lap times, a countdown timer, and a Pomodoro cycle with work and break intervals.',
    keywords: ['online stopwatch', 'timer online', 'pomodoro timer', 'lap timer', 'countdown timer online'],
    tips: [
      "The stopwatch measures elapsed time from a high-resolution clock, so it stays accurate even if the tab is throttled in the background.",
      "Lap times record the split since the previous lap alongside the total, which is what you want for intervals. With three laps or more the fastest and slowest are marked, and “Download laps (CSV)” saves them for a spreadsheet.",
      "Keys: Space starts or pauses what is on screen, L records a lap and R resets. They do nothing while you are typing in a box.",
      "The Pomodoro cycle defaults to 25 minutes of work and 5 of break, with a longer break every fourth cycle. You can change how many work sessions come before the long break, and whether breaks and work start by themselves.",
      "Browsers block sound until you interact with the page, so press start at least once before relying on the alert. The alert is set on the audio clock when you press Start, so it sounds on time even in a background tab."
    ],
    faq: [
      { q: "Is it accurate if I switch tabs?", a: "Yes. Elapsed time is computed from timestamps rather than counted tick by tick, so throttling affects how often the display refreshes but not the measurement. The alert is timed by the audio clock rather than the page’s timers, which a browser slows in a background tab." },
      { q: "Can I run more than one timer?", a: "Yes. Add up to eight, each with its own name, length and alert. The tab’s title shows the one that ends soonest." },
      { q: "What happens if I reload the page?", a: "Timers, the stopwatch and the Pomodoro carry on from where the clock says they are. A timer that ended while the page was closed says when it ended. The sound comes back after your next click or key press, as browsers require." },
      { q: "Can it notify me?", a: "Tick “Notify me when a timer or a Pomodoro phase ends” and allow notifications when the browser asks. A notification is shown while the page is in the background; it must still be open in a tab." }
    ]
  }
};


window.MVRLive={evaluate:evaluate,zoneOffset:zoneOffset,formatOffset:formatOffset,zonedTimeToInstant:zonedTimeToInstant,COMMON_ZONES:COMMON_ZONES,partsIn:partsIn,offsetAt:offsetAt,resolveWallTime:resolveWallTime,zoneTransitions:zoneTransitions,buildZoneIndex:buildZoneIndex,canonicalZone:canonicalZone,searchZones:searchZones,cityOf:cityOf,plannerRows:plannerRows,sharedWorkHours:sharedWorkHours,sharedWorkTimes:sharedWorkTimes,buildICS:buildICS,nextOccurrence:nextOccurrence,splitSpan:splitSpan};
})();