(function(){
/* ============================================================
   Cron expressions: parsing (Unix, seconds-first and Quartz), plain
   English, and the next runs in any time zone. Written for this page
   from the crontab(5) manual page and the Quartz CronTrigger tutorial;
   no library.
   ============================================================ */

const CRON_NAMES = {
  month: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
  dow: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
};
const CRON_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CRON_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CRON_MACROS = {
  '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *'
};
/* the field definitions; dow is 0-7 (0 and 7 Sunday) for Unix and seconds-first, 1-7 (1 Sunday) for Quartz */
const CRON_DEF = {
  sec: { name: 'second', min: 0, max: 59 },
  min: { name: 'minute', min: 0, max: 59 },
  hour: { name: 'hour', min: 0, max: 23 },
  dom: { name: 'day of month', min: 1, max: 31 },
  mon: { name: 'month', min: 1, max: 12, names: CRON_NAMES.month, nameBase: 1 },
  dow: { name: 'day of week', min: 0, max: 7, names: CRON_NAMES.dow, nameBase: 0 },
  year: { name: 'year', min: 1970, max: 2199 }
};

class CronError extends Error {
  constructor(msg, field, from, to) { super(msg); this.field = field; this.from = from; this.to = to; }
}

/* one field: its values, and the Quartz extras. `col` is where the field starts in the line. */
function cronField(token, key, dialect, col) {
  const def = Object.assign({}, CRON_DEF[key]);
  const quartz = dialect === 'quartz';
  if (key === 'dow' && quartz) { def.min = 1; def.max = 7; }
  const spec = { key: key, raw: token, values: new Set(), star: false, none: false, last: false, lastOffset: null, lastWeekday: false, weekdayNear: [], dowLast: [], dowNth: [], from: col, to: col + token.length };
  const fail = (msg, a, b) => { throw new CronError(msg, key, col + (a || 0), col + (b === undefined ? token.length : b)); };
  const num = (v, at, isEnd) => {
    const low = v.toLowerCase();
    if (def.names && /^[a-z]{3}/.test(low)) {
      const i = def.names.indexOf(low.slice(0, 3));
      if (i < 0 || !(low.length === 3 || def.name === 'month' && CRON_MONTHS[i].toLowerCase() === low || def.name === 'day of week' && CRON_DAYS[i].toLowerCase() === low)) fail('"' + v + '" is not a ' + def.name + ' name', at, at + v.length);
      if (key === 'dow') { if (quartz) return i + 1; return isEnd && i === 0 ? 7 : i; }
      return i + def.nameBase;
    }
    if (!/^\d+$/.test(v)) fail('"' + v + '" is not a valid ' + def.name + ' value', at, at + v.length);
    return parseInt(v, 10);
  };
  let at = 0;
  token.split(',').forEach((part0) => {
    const start = at;
    at += part0.length + 1;
    let part = part0;
    if (!part) fail('empty element in the ' + def.name + ' field', start, start + 1);
    if (part === '?') {
      if (key !== 'dom' && key !== 'dow') fail('? is only allowed in the day-of-month and day-of-week fields', start, start + 1);
      if (!quartz) fail('? is Quartz syntax; with five fields write * instead (or choose Quartz in Format)', start, start + 1);
      if (token !== '?') fail('? has to stand alone in the field', start, start + 1);
      spec.none = true; spec.star = true;
      for (let v = def.min; v <= def.max; v++) spec.values.add(v);
      return;
    }
    if (key === 'dom') {
      let m;
      if (part === 'L') { spec.last = true; return; }
      if (part === 'LW') { spec.lastWeekday = true; return; }
      if ((m = /^L-(\d+)$/.exec(part))) { const n = parseInt(m[1], 10); if (n < 1 || n > 30) fail('L-' + n + ': the offset must be 1 to 30', start, start + part.length); spec.lastOffset = (spec.lastOffset || []).concat(n); return; }
      if ((m = /^(\d+)W$/.exec(part))) { const n = parseInt(m[1], 10); if (n < 1 || n > 31) fail(n + 'W: the day must be 1 to 31', start, start + part.length); spec.weekdayNear.push(n); return; }
      if (/[LW#]/.test(part)) fail('"' + part + '" is not valid in the day-of-month field (L, L-n, LW and nW are)', start, start + part.length);
    } else if (key === 'dow') {
      let m;
      if (part === 'L' && quartz) { spec.values.add(7); return; }
      if ((m = /^([A-Za-z0-9]+)L$/.exec(part)) && part !== 'L') { spec.dowLast.push(num(m[1], start, false)); return; }
      if ((m = /^([A-Za-z0-9]+)#(\d+)$/.exec(part))) { const n = parseInt(m[2], 10); if (n < 1 || n > 5) fail('#' + n + ': the occurrence must be 1 to 5', start, start + part.length); spec.dowNth.push([num(m[1], start, false), n]); return; }
      if (/[LW#]/.test(part.replace(/[A-Za-z]{3}/g, ''))) fail('"' + part + '" is not valid in the day-of-week field (nL and n#m are)', start, start + part.length);
    } else if (/[LW#?]/.test(part) && !/^[A-Za-z]{3}/.test(part)) {
      fail('L, W, # and ? are only for the day fields', start, start + part.length);
    }
    let step = 1;
    const slash = part.split('/');
    if (slash.length > 2) fail('more than one / in an element', start, start + part.length);
    if (slash.length === 2) {
      if (!/^\d+$/.test(slash[1]) || parseInt(slash[1], 10) < 1) fail('the step "' + slash[1] + '" must be a whole number of 1 or more', start + slash[0].length + 1, start + part.length);
      step = parseInt(slash[1], 10);
      part = slash[0];
    }
    let lo, hi;
    if (part === '*') { lo = def.min; hi = key === 'dow' && !quartz ? 6 : def.max; spec.star = true; if (slash.length === 2) spec.starStep = true; }
    else {
      const range = part.split('-');
      if (range.length === 1) { lo = num(range[0], start, false); hi = slash.length === 2 ? def.max : lo; }
      else if (range.length === 2) { lo = num(range[0], start, false); hi = num(range[1], start + range[0].length + 1, true); }
      else fail('more than one - in an element', start, start + part.length);
    }
    if (lo < def.min || hi > def.max) fail((lo < def.min ? lo : hi) + ' is outside the ' + def.name + ' range ' + def.min + '-' + def.max, start, start + part0.length);
    if (lo > hi) fail(lo + '-' + hi + ' goes backwards (the start must not be above the end)', start, start + part0.length);
    for (let v = lo; v <= hi; v += step) spec.values.add(v);
  });
  /* the values the engine works with: day of week folded to 0-6, Sunday 0 */
  let vals = Array.from(spec.values);
  if (key === 'dow') {
    if (quartz) vals = vals.map((v) => v - 1);
    else vals = vals.map((v) => v % 7);
    spec.dowLast = spec.dowLast.map((v) => quartz ? v - 1 : v % 7);
    spec.dowNth = spec.dowNth.map((p) => [quartz ? p[0] - 1 : p[0] % 7, p[1]]);
    spec.dowLast.concat(spec.dowNth.map((p) => p[0])).forEach((v) => { if (v < 0 || v > 6) fail('the day of week must be ' + (quartz ? '1 (Sunday) to 7 (Saturday)' : '0 or 7 (Sunday) to 6 (Saturday)'), 0); });
  }
  spec.list = Array.from(new Set(vals)).sort((a, b) => a - b);
  spec.set = new Set(spec.list);
  spec.special = spec.last || spec.lastWeekday || !!spec.lastOffset || spec.weekdayNear.length > 0 || spec.dowLast.length > 0 || spec.dowNth.length > 0;
  /* "restricted" as cron means it: a field is unrestricted only if it starts with * */
  spec.all = spec.star && !spec.starStep && spec.list.length === (key === 'dow' ? 7 : (def.max - def.min + 1)) || (spec.none === true);
  return spec;
}

/* a whole expression: splits it, picks the dialect, parses every field */
function cronParse(expr, format) {
  let line = String(expr).trim();
  const macro = CRON_MACROS[line.toLowerCase()];
  if (line.charAt(0) === '@') {
    if (line.toLowerCase() === '@reboot') throw new CronError('@reboot runs once, when the machine starts, so it has no schedule to show', null, 0, line.length);
    if (!macro) throw new CronError('"' + line + '" is not a known shortcut (@yearly, @annually, @monthly, @weekly, @daily, @midnight, @hourly)', null, 0, line.length);
    line = macro;
  }
  const tokens = [];
  line.replace(/\S+/g, (t, i) => { tokens.push([t, i]); return t; });
  const n = tokens.length;
  let dialect = format || 'auto';
  if (dialect === 'auto') {
    if (n === 5) dialect = 'unix';
    else if (n === 7) dialect = 'quartz';
    else if (n === 6) dialect = tokens.some((t, i) => (i === 3 || i === 5) && /[?LW#]/.test(t[0].replace(/[A-Za-z]{3}/g, ''))) ? 'quartz' : 'sec';
    else throw new CronError('A cron expression has 5 fields (minute hour day-of-month month day-of-week), or 6 with seconds first, or 7 with a year as well. This has ' + n + '.', null, 0, line.length);
  }
  const want = dialect === 'unix' ? [5] : dialect === 'sec' ? [6] : [6, 7];
  if (want.indexOf(n) < 0) throw new CronError((dialect === 'unix' ? 'Unix cron has 5 fields' : dialect === 'sec' ? 'Seconds-first cron has 6 fields' : 'Quartz has 6 fields, or 7 with a year') + ' (' + (dialect === 'unix' ? 'minute hour day-of-month month day-of-week' : dialect === 'sec' ? 'second minute hour day-of-month month day-of-week' : 'second minute hour day-of-month month day-of-week [year]') + '). This has ' + n + '.', null, 0, line.length);
  const keys = dialect === 'unix' ? ['min', 'hour', 'dom', 'mon', 'dow'] : dialect === 'sec' || n === 6 ? ['sec', 'min', 'hour', 'dom', 'mon', 'dow'] : ['sec', 'min', 'hour', 'dom', 'mon', 'dow', 'year'];
  const f = {};
  keys.forEach((k, i) => { f[k] = cronField(tokens[i][0], k, dialect, tokens[i][1]); });
  if (!f.sec) f.sec = { key: 'sec', raw: '0', list: [0], set: new Set([0]), all: false, from: 0, to: 0, star: false };
  if (dialect === 'quartz') {
    if (f.dom.none && f.dow.none) throw new CronError('Quartz wants a ? in only one of the day fields, not both', 'dow', f.dow.from, f.dow.to);
    if (!f.dom.none && !f.dow.none) {
      const err = f.dow;
      throw new CronError('Quartz needs a ? in the day-of-month or the day-of-week field: you cannot restrict both', 'dow', err.from, err.to);
    }
  }
  return { dialect: dialect, fields: f, keys: keys, hasSeconds: dialect !== 'unix', hasYear: !!f.year, line: line, macro: macro ? expr.trim() : null };
}

/* ---------- calendar helpers on plain (year, month, day) ---------- */
function cronDim(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }       // m is 1-12
function cronDow(y, m, d) { return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
/* does this day match the day-of-month and day-of-week fields, by cron's own rule? */
function cronDayOk(p, y, m, d) {
  const dom = p.fields.dom, dow = p.fields.dow;
  const last = cronDim(y, m), wd = cronDow(y, m, d);
  let domOk = dom.set.has(d);
  if (!domOk && dom.last && d === last) domOk = true;
  if (!domOk && dom.lastOffset && dom.lastOffset.some((n) => d === last - n)) domOk = true;
  if (!domOk && dom.lastWeekday) { let x = last; while (cronDow(y, m, x) === 0 || cronDow(y, m, x) === 6) x--; if (d === x) domOk = true; }
  if (!domOk && dom.weekdayNear.length) domOk = dom.weekdayNear.some((n) => {
    if (n > last) return false;
    const w = cronDow(y, m, n);
    let t = n;
    if (w === 6) t = n === 1 ? 3 : n - 1;
    else if (w === 0) t = n === last ? n - 2 : n + 1;
    return d === t;
  });
  let dowOk = dow.set.has(wd);
  if (!dowOk && dow.dowLast.length) dowOk = dow.dowLast.some((v) => wd === v && d + 7 > last);
  if (!dowOk && dow.dowNth.length) dowOk = dow.dowNth.some((p2) => wd === p2[0] && Math.ceil(d / 7) === p2[1]);
  if (p.dialect === 'quartz') return (dom.none ? true : domOk) && (dow.none ? true : dowOk);
  /* Vixie cron: if either day field starts with *, both must match; otherwise either may */
  if (dom.star || dow.star) return domOk && dowOk;
  return domOk || dowOk;
}

/* ---------- time zones, by Intl ---------- */
const CRON_FMT = {};
function cronFormatter(tz) {
  const k = tz || 'local';
  if (!CRON_FMT[k]) CRON_FMT[k] = new Intl.DateTimeFormat('en-GB', { timeZone: tz || undefined, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  return CRON_FMT[k];
}
function cronWall(ms, tz) {
  const o = {};
  cronFormatter(tz).formatToParts(new Date(ms)).forEach((p) => { if (p.type !== 'literal') o[p.type] = parseInt(p.value, 10); });
  return { y: o.year, mo: o.month, d: o.day, h: o.hour === 24 ? 0 : o.hour, mi: o.minute, s: o.second };
}
const cronKey = (w) => ((((w.y * 13 + w.mo) * 32 + w.d) * 24 + w.h) * 60 + w.mi) * 60 + w.s;
function cronOffset(ms, tz) { const w = cronWall(ms, tz); return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - Math.floor(ms / 1000) * 1000; }
/* the earliest instant whose wall clock in tz reads w; null if the clocks skip it */
function cronInstant(w, tz) {
  const guess = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
  const cands = new Set([guess - cronOffset(guess - 86400000, tz), guess - cronOffset(guess + 86400000, tz), guess - cronOffset(guess, tz)]);
  const ok = Array.from(cands).filter((t) => cronKey(cronWall(t, tz)) === cronKey(w)).sort((a, b) => a - b);
  return ok.length ? ok[0] : null;
}

/* the next `count` runs strictly after `fromMs`, as instants */
function cronNext(p, fromMs, count, tz, maxYears) {
  const f = p.fields;
  const w0 = cronWall(fromMs, tz), k0 = cronKey(w0);
  const out = [];
  const lastYear = w0.y + (maxYears || (p.hasYear ? 200 : 9));
  for (let y = w0.y; y <= lastYear && out.length < count; y++) {
    if (p.hasYear && !f.year.set.has(y)) continue;
    for (const mo of f.mon.list) {
      if (y === w0.y && mo < w0.mo) continue;
      const dim = cronDim(y, mo);
      for (let d = 1; d <= dim; d++) {
        if (cronKey({ y: y, mo: mo, d: d, h: 23, mi: 59, s: 59 }) <= k0) continue;
        if (!cronDayOk(p, y, mo, d)) continue;
        for (const h of f.hour.list) for (const mi of f.min.list) for (const s of f.sec.list) {
          const w = { y: y, mo: mo, d: d, h: h, mi: mi, s: s };
          if (cronKey(w) <= k0) continue;
          const t = cronInstant(w, tz);
          if (t === null) continue;
          out.push(t);
          if (out.length >= count) return out;
        }
      }
    }
  }
  return out;
}

/* ---------- plain English ---------- */
const cronPad = (n) => String(n).padStart(2, '0');
const cronList = (arr, fmt) => arr.length === 1 ? fmt(arr[0])
  : arr.length === 2 ? `${fmt(arr[0])} and ${fmt(arr[1])}`
  : arr.slice(0, -1).map(fmt).join(', ') + ' and ' + fmt(arr[arr.length - 1]);
const cronOrd = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
function cronDescribe(p) {
  const f = p.fields;
  const mins = f.min.list, hours = f.hour.list, secs = f.sec.list;
  const hasSec = p.hasSeconds && !(secs.length === 1 && secs[0] === 0);
  let when;
  const minAll = mins.length === 60, hourAll = hours.length === 24, secAll = secs.length === 60;
  if (!hasSec) {
    if (minAll && hourAll) when = 'Every minute';
    else if (minAll) when = `Every minute during ${cronList(hours, h => cronPad(h) + ':00')}`;
    else if (hourAll) when = `At ${cronList(mins, m => 'minute ' + m)} of every hour`;
    else if (mins.length <= 4 && hours.length <= 4) {
      const times = [];
      hours.forEach(h => mins.forEach(m => times.push(`${cronPad(h)}:${cronPad(m)}`)));
      when = `At ${cronList(times, t => t)}`;
    } else when = `At ${cronList(mins, m => 'minute ' + m)} past ${cronList(hours, h => cronPad(h) + ':00')}`;
  } else {
    const uniform = (arr, n) => { if (arr.length < 2) return 0; const st = arr[1] - arr[0]; if (arr[0] !== 0 || 60 % st !== 0 || arr.length !== 60 / st) return 0; return arr.every((v, i) => v === i * st) ? st : 0; };
    if (minAll && hourAll) {
      if (secAll) when = 'Every second';
      else if (uniform(secs)) when = `Every ${uniform(secs)} seconds`;
      else when = `At ${cronList(secs, s => 'second ' + s)} of every minute`;
    } else if (mins.length * hours.length * secs.length <= 4) {
      const times = [];
      hours.forEach(h => mins.forEach(m => secs.forEach(s => times.push(`${cronPad(h)}:${cronPad(m)}:${cronPad(s)}`))));
      when = `At ${cronList(times, t => t)}`;
    } else {
      const secPart = secAll ? 'every second' : uniform(secs) ? `every ${uniform(secs)} seconds` : cronList(secs, s => 'second ' + s);
      let base;
      if (minAll && !hourAll) base = `every minute during ${cronList(hours, h => cronPad(h) + ':00')}`;
      else if (hourAll) base = `${cronList(mins, m => 'minute ' + m)} of every hour`;
      else base = `${cronList(mins, m => 'minute ' + m)} past ${cronList(hours, h => cronPad(h) + ':00')}`;
      when = `At ${secPart} of ${base}`.replace('of every minute during', 'of every minute during');
    }
  }
  const dom = f.dom, dow = f.dow;
  const bits = [];
  const domAll = dom.none || (dom.list.length === 31 && !dom.special), dowAll = dow.none || (dow.list.length === 7 && !dow.special);
  const domParts = [], dowParts = [];
  if (!domAll && !dom.none) {
    if (dom.list.length) domParts.push(`day ${cronList(dom.list, d => String(d))} of the month`);
    if (dom.last) domParts.push('the last day of the month');
    if (dom.lastOffset) domParts.push(cronList(dom.lastOffset, n => n + (n === 1 ? ' day' : ' days') + ' before the last day of the month'));
    if (dom.lastWeekday) domParts.push('the last weekday of the month');
    if (dom.weekdayNear.length) domParts.push(cronList(dom.weekdayNear, n => 'the weekday nearest day ' + n + ' of the month'));
  }
  if (!dowAll && !dow.none) {
    const order = (a) => a.slice().sort((x, y) => (x + 6) % 7 - (y + 6) % 7);
    if (dow.list.length) dowParts.push(cronList(order(dow.list), d => CRON_DAYS[d]));
    if (dow.dowLast.length) dowParts.push(cronList(dow.dowLast, d => 'the last ' + CRON_DAYS[d] + ' of the month'));
    if (dow.dowNth.length) dowParts.push(cronList(dow.dowNth, q => 'the ' + cronOrd(q[1]) + ' ' + CRON_DAYS[q[0]] + ' of the month'));
  }
  let onDays;
  if (!domParts.length && !dowParts.length) onDays = 'every day';
  else if (domParts.length && !dowParts.length) onDays = 'on ' + domParts.join(' and on ');
  else if (!domParts.length) onDays = 'on ' + dowParts.join(' and on ');
  else onDays = 'on ' + domParts.join(' and on ') + ', and on ' + dowParts.join(' and on ');
  const inMonths = f.mon.list.length === 12 ? '' : `, in ${cronList(f.mon.list, m => CRON_MONTHS[m - 1])}`;
  let inYears = '';
  if (p.hasYear && !(f.year.all)) {
    const ys = f.year.list;
    if (ys.length > 2 && ys[ys.length - 1] - ys[0] === ys.length - 1) inYears = `, every year from ${ys[0]} through ${ys[ys.length - 1]}`;
    else if (ys.length > 6) inYears = `, in ${ys.length} years between ${ys[0]} and ${ys[ys.length - 1]}`;
    else inYears = `, in ${ys.length === 1 ? 'the year' : 'the years'} ${cronList(ys, y => String(y))}`;
  }
  return `${when}, ${onDays}${inMonths}${inYears}.`;
}
/* what one field means, for the help under the cursor */
function cronFieldHelp(spec, key, dialect) {
  const def = CRON_DEF[key];
  const unit = def.name;
  const show = (v) => key === 'mon' ? CRON_MONTHS[v - 1] : key === 'dow' ? CRON_DAYS[v] : String(v);
  const l = spec.list;
  const parts = [];
  if (spec.none) return 'no specific ' + unit + ' (the other day field decides)';
  if (spec.last) parts.push('the last day of the month');
  if (spec.lastOffset) parts.push(cronList(spec.lastOffset, n => n + ' day' + (n > 1 ? 's' : '') + ' before the last day'));
  if (spec.lastWeekday) parts.push('the last weekday of the month');
  if (spec.weekdayNear.length) parts.push(cronList(spec.weekdayNear, n => 'the weekday nearest the ' + cronOrd(n)));
  if (spec.dowLast.length) parts.push(cronList(spec.dowLast, v => 'the last ' + CRON_DAYS[v] + ' of the month'));
  if (spec.dowNth.length) parts.push(cronList(spec.dowNth, q => 'the ' + cronOrd(q[1]) + ' ' + CRON_DAYS[q[0]] + ' of the month'));
  if (l.length) {
    const full = key === 'dow' ? 7 : (def.max - def.min + 1);
    if (spec.all && l.length === full) parts.push('every ' + unit);
    else if (l.length > 12) parts.push(l.length + ' values from ' + show(l[0]) + ' to ' + show(l[l.length - 1]));
    else parts.push((spec.star && spec.starStep ? 'every step: ' : '') + cronList(key === 'dow' ? l.slice().sort((x, y) => (x + 6) % 7 - (y + 6) % 7) : l, show));
  }
  return parts.join(' and ');
}

const CRON_TZ_LOCAL = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } })();
const CRON_TZ_OPTIONS = (() => {
  let zones = [];
  try { zones = Intl.supportedValuesOf('timeZone'); } catch (e) { zones = []; }
  if (zones.indexOf('UTC') < 0) zones = ['UTC'].concat(zones);
  return [{ value: 'local', label: 'This device (' + CRON_TZ_LOCAL + ')' }].concat(zones.map((z) => ({ value: z, label: z })));
})();

window.DEV_TOOLS = window.DEV_TOOLS || {};
window.DEV_TOOLS["cron-parser"] = {
"title": "Cron Expression Parser",
"kind": "code",
"filename": "cron-schedule.txt",
"description": "Translate a cron expression into plain English and see its next runs in any time zone. Reads Unix, seconds-first and Quartz syntax, with L, W, # and ?, and has a builder and presets.",
"keywords": ["cron parser","crontab generator","cron expression","cron schedule explained","crontab guru","quartz cron","cron seconds","cron builder"],
"inputLabel": "Cron expressions (one per line)",
"outputLabel": "Explanation and next runs",
"placeholder": "0 9 * * 1-5",
"sample": "0 9 * * 1-5\n*/15 * * * *\n0 0 1 * *\n30 2 * * 0\n@daily",
"options": [
  {"key":"count","label":"Next runs to show","type":"select","default":"5","options":[{"value":"3","label":"3"},{"value":"5","label":"5"},{"value":"10","label":"10"},{"value":"20","label":"20"}]},
  {"key":"format","label":"Format","type":"select","default":"auto","options":[{"value":"auto","label":"Detect from the field count"},{"value":"unix","label":"Unix, 5 fields"},{"value":"sec","label":"Seconds first, 6 fields"},{"value":"quartz","label":"Quartz, 6 or 7 fields"}]},
  {"key":"tz","label":"Time zone","type":"select","default":"local","options": CRON_TZ_OPTIONS},
  {"key":"offset","label":"UTC offset on each run","type":"select","default":"hide","options":[{"value":"hide","label":"Hide"},{"value":"show","label":"Show"}]}
],
"transform": (text, o) => {
      const lines = String(text || '').split('\n').map((l, i) => [l.trim(), i + 1]).filter((x) => x[0]);
      if (!lines.length) return { output: '', note: 'Enter a cron expression, for example: 0 9 * * 1-5' };
      const n = Number(o.count) || 5;
      const tz = !o.tz || o.tz === 'local' ? undefined : o.tz;
      try { cronFormatter(tz); } catch (e) { return { error: '"' + o.tz + '" is not a time zone this browser knows.' }; }
      const nowMs = Date.now();
      const out = [];
      let ok = 0, bad = 0, firstBad = null, dialect = null, withSec = false;
      const raw = String(text || '').split('\n');
      lines.forEach(([expr, lineNo]) => {
        out.push(expr);
        try {
          const p = cronParse(expr, o.format);
          dialect = dialect || p.dialect;
          if (p.hasSeconds) withSec = true;
          out.push('  → ' + cronDescribe(p));
          const runs = cronNext(p, nowMs, n, tz);
          if (runs.length) {
            const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: p.hasSeconds ? '2-digit' : undefined, hourCycle: 'h23' });
            runs.forEach((t) => {
              let s = fmt.format(new Date(t));
              if (o.offset === 'show') { const off = cronOffset(t, tz) / 60000; s += ' UTC' + (off < 0 ? '−' : '+') + cronPad(Math.floor(Math.abs(off) / 60)) + ':' + cronPad(Math.abs(off) % 60); }
              out.push('     ' + s);
            });
          } else {
            out.push('     (no runs found within the next ' + (p.hasYear ? 'few' : '9') + ' years — the expression may be unsatisfiable, such as 30 February)');
          }
          ok++;
        } catch (e) {
          if (!(e instanceof CronError)) throw e;
          const col = e.from !== undefined && e.from !== null ? e.from + 1 : 1;
          out.push('  ✗ ' + e.message + (e.field ? ' (' + (CRON_DEF[e.field] || {}).name + ' field, column ' + col + ')' : ''));
          if (!firstBad) { const lead = raw[lineNo - 1].length - raw[lineNo - 1].replace(/^\s+/, '').length; firstBad = { line: lineNo, col: col + lead }; }
          bad++;
        }
        out.push('');
      });
      const res = {
        output: out.join('\n').trim(),
        stats: [
          ['Expressions', String(lines.length)],
          ['Valid', String(ok)],
          ['Invalid', String(bad)],
          ['Format', dialect === 'unix' ? 'Unix, 5 fields' : dialect === 'sec' ? 'Seconds first, 6 fields' : dialect === 'quartz' ? 'Quartz' : '—'],
          ['Times shown in', o.tz && o.tz !== 'local' ? o.tz : CRON_TZ_LOCAL]
        ],
        warn: bad ? `${bad} expression${bad > 1 ? 's' : ''} could not be parsed.` : ''
      };
      if (firstBad) res.errorAt = firstBad;
      return res;
    },
"tips": ["The five fields are minute, hour, day of month, month and day of week — in that order. A sixth field for seconds is a non-standard extension used by some schedulers.","When both day-of-month and day-of-week are restricted, cron runs on either — not both.","Day of week accepts 0 or 7 for Sunday, and three-letter names such as mon and fri.","Shortcuts @daily, @hourly, @weekly, @monthly and @yearly are supported, and expand to their five-field form.","Seconds-first (6 fields) and Quartz (6 or 7 fields, with a year) are read as well. Quartz counts Sunday as 1, needs a ? in one of the two day fields, and adds L (last), W (nearest weekday) and # (the nth weekday): 0 0 12 ? * 6#1 is noon on the first Friday of each month.","Choose a time zone to see the runs in it. A time that does not exist when the clocks go forward is skipped, and one that happens twice when they go back is shown once.","Click into a field and the line below the box explains that field and what it allows."],
"faq": [{"q":"Why does */5 in the hours field not mean every five hours from now?","a":"Steps count from the start of the range, not from the current time. */5 in hours means 0, 5, 10, 15 and 20 — fixed clock hours, not an interval since the last run."},{"q":"Which dialect do I need?","a":"Linux crontab, GitHub Actions and Kubernetes CronJobs use five fields. Spring, node-cron and many libraries put seconds first. Quartz, Jenkins and AWS EventBridge have their own rules: see the tip on Quartz."}],
"mount": (ctx) => { cronMount(ctx); },
"render": function (res, ctx) { cronRender(res, ctx); }
};

/* ===== the builder, presets and the field under the cursor ===== */
const CRON_PRESETS = [
  ['Every minute', '* * * * *'], ['Every 5 minutes', '*/5 * * * *'], ['Every 15 minutes', '*/15 * * * *'], ['Hourly', '0 * * * *'],
  ['Daily at midnight', '0 0 * * *'], ['Daily at 9:00', '0 9 * * *'], ['Weekdays at 9:00', '0 9 * * 1-5'], ['Every Monday at 8:30', '30 8 * * 1'],
  ['First of the month', '0 0 1 * *'], ['Every quarter', '0 0 1 */3 *'], ['Every year, 1 January', '0 0 1 1 *'],
  ['Every 30 seconds (6 fields)', '*/30 * * * * *'], ['Quartz: last day of the month at noon', '0 0 12 L * ?'], ['Quartz: first Friday at 9:00', '0 0 9 ? * 6#1']
];
const CRON_QUICK = {
  sec: ['0', '*', '*/5', '*/15', '*/30'],
  min: ['*', '*/5', '*/10', '*/15', '*/30', '0', '0,30', '15', '45'],
  hour: ['*', '*/2', '*/6', '0', '9', '12', '9-17', '9,17'],
  dom: ['*', '1', '15', '1,15', '1-7', '*/2', 'L', '?'],
  mon: ['*', '1', '*/3', '6', '1-3', 'JAN,JUL'],
  dow: ['*', 'MON-FRI', 'SAT,SUN', '1', '0', '5', '6#1', '?'],
  year: ['*', '2027', '2027-2030']
};
function cronMount(ctx) {
  const el = ctx.el;
  const st = { fields: [], line: 0 };
  ctx.cron = st;
  const wrap = el('div', 'io-pane cron-builder');
  const head = el('div', 'io-head');
  head.appendChild(el('span', 'io-label', 'Builder and presets'));
  wrap.appendChild(head);
  const body = el('div', 'cron-b-body');
  const presets = el('div', 'field');
  const pl = el('label', null, 'Start from a preset');
  const ps = el('select', 'control');
  pl.setAttribute('for', 'cron-preset'); ps.id = 'cron-preset';
  const o0 = el('option', null, 'Choose…'); o0.value = ''; ps.appendChild(o0);
  CRON_PRESETS.forEach((x, i) => { const o = el('option', null, x[0] + '  —  ' + x[1]); o.value = String(i); ps.appendChild(o); });
  ps.addEventListener('change', function () { if (ps.value === '') return; ctx.setText(CRON_PRESETS[Number(ps.value)][1]); ps.value = ''; });
  presets.appendChild(pl); presets.appendChild(ps);
  body.appendChild(presets);
  const grid = el('div', 'cron-b-grid');
  body.appendChild(grid);
  wrap.appendChild(body);
  const help = el('div', 'cron-help');
  help.setAttribute('aria-live', 'polite');
  wrap.appendChild(help);
  ctx.extra.appendChild(wrap);
  st.grid = grid; st.help = help;

  function firstLineInfo() {
    const text = ctx.input.value, nl = text.indexOf('\n');
    return { line: nl < 0 ? text : text.slice(0, nl), rest: nl < 0 ? '' : text.slice(nl) };
  }
  function build(keys) {
    grid.textContent = '';
    st.fields = [];
    keys.forEach(function (k, i) {
      const w = el('div', 'cron-b-field');
      const l = el('label', null, CRON_DEF[k].name);
      const inp = el('input', 'control');
      inp.type = 'text'; inp.spellcheck = false; inp.autocomplete = 'off';
      inp.id = 'cron-f-' + k;
      l.setAttribute('for', inp.id);
      const q = el('select', 'control cron-quick');
      q.setAttribute('aria-label', 'Common values for ' + CRON_DEF[k].name);
      const q0 = el('option', null, 'Pick…'); q0.value = ''; q.appendChild(q0);
      (CRON_QUICK[k] || []).forEach(function (v) { const o = el('option', null, v); o.value = v; q.appendChild(o); });
      q.addEventListener('change', function () { if (q.value) { inp.value = q.value; q.value = ''; push(); } });
      inp.addEventListener('input', push);
      w.appendChild(l); w.appendChild(inp); w.appendChild(q);
      grid.appendChild(w);
      st.fields.push({ key: k, input: inp });
    });
    st.keys = keys;
  }
  function push() {
    const info = firstLineInfo();
    const line = st.fields.map(function (f) { return f.input.value.trim() || '*'; }).join(' ');
    st.pushing = true;
    ctx.setText(line + info.rest);
    st.pushing = false;
  }
  function pull() {
    if (st.pushing) return;
    const info = firstLineInfo();
    const toks = info.line.trim().split(/\s+/).filter(Boolean);
    const o = ctx.opts();
    let keys = ['min', 'hour', 'dom', 'mon', 'dow'];
    if (toks.length === 6) keys = ['sec', 'min', 'hour', 'dom', 'mon', 'dow'];
    else if (toks.length === 7) keys = ['sec', 'min', 'hour', 'dom', 'mon', 'dow', 'year'];
    if (toks.length === 1 && toks[0].charAt(0) === '@') { grid.hidden = true; return; }
    if (toks.length < 5 || toks.length > 7) { grid.hidden = true; return; }
    grid.hidden = false;
    if (!st.keys || st.keys.join() !== keys.join()) build(keys);
    st.fields.forEach(function (f, i) { if (document.activeElement !== f.input) f.input.value = toks[i]; });
  }
  st.pull = pull;
  function caret() {
    const ta = ctx.input;
    const pos = ta.selectionStart || 0;
    const text = ta.value;
    const ls = text.lastIndexOf('\n', pos - 1) + 1;
    let le = text.indexOf('\n', pos); if (le < 0) le = text.length;
    const line = text.slice(ls, le);
    help.textContent = '';
    if (!line.trim()) { help.hidden = true; return; }
    const col = pos - ls;
    let p;
    try { p = cronParse(line, ctx.opts().format); }
    catch (e) { help.hidden = false; help.appendChild(el('p', 'cron-help-err', e.message)); return; }
    help.hidden = false;
    const row = el('div', 'cron-help-row');
    /* tokens by position in the original line */
    const toks = [];
    line.replace(/\S+/g, function (t, i) { toks.push([t, i]); return t; });
    const macro = line.trim().charAt(0) === '@';
    p.keys.forEach(function (k, i) {
      const f = p.fields[k];
      const t = macro ? [f.raw, 0] : toks[i];
      const on = !macro && col >= t[1] && col <= t[1] + t[0].length;
      const box = el('div', 'cron-hf' + (on ? ' is-on' : ''));
      box.appendChild(el('span', 'cron-hf-name', CRON_DEF[k].name));
      box.appendChild(el('code', 'cron-hf-tok', f.raw));
      box.appendChild(el('span', 'cron-hf-mean', cronFieldHelp(f, k, p.dialect)));
      row.appendChild(box);
    });
    help.appendChild(row);
    if (macro) help.appendChild(el('p', 'cron-help-note', line.trim() + ' stands for ' + p.line + '.'));
  }
  st.caret = caret;
  ['keyup', 'click', 'focus', 'input', 'select'].forEach(function (ev) { ctx.input.addEventListener(ev, caret); });
  ctx.input.addEventListener('input', pull);
  pull();
  caret();
}
function cronRender(res, ctx) {
  const st = ctx.cron;
  if (!st) return;
  st.pull();
  st.caret();
}
})();
