(function () {
'use strict';
/* Unix timestamp converter: epoch numbers to dates and dates to epoch numbers,
   one per line, in any IANA time zone. Own code; the browser's Intl supplies
   the time-zone rules (the IANA database it ships with). */

window.DEV_TOOLS = window.DEV_TOOLS || {};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MAX_MS = 8.64e15;
const pad = (n, w) => { const s = String(Math.abs(n)); return (n < 0 ? '-' : '') + (s.length < (w || 2) ? '0'.repeat((w || 2) - s.length) + s : s); };

function deviceZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; }
}
function zoneList() {
  let z = [];
  try { z = Intl.supportedValuesOf('timeZone'); } catch (e) { z = []; }
  if (!z.length) z = ['Europe/London', 'Europe/Paris', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'];
  return z.filter((x) => x !== 'UTC');
}
function zoneOk(z) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return true; } catch (e) { return false; }
}
function resolveZone(opt) { return opt === 'local' || !opt ? deviceZone() : opt; }

/* ---------- offsets from Intl ---------- */
const fmtCache = {};
function partsFmt(zone) {
  if (!fmtCache[zone]) fmtCache[zone] = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', era: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  return fmtCache[zone];
}
function utcOf(y, mo, d, h, mi, s) {
  const t = new Date(0);
  t.setUTCFullYear(y, mo - 1, d);
  t.setUTCHours(h, mi, s, 0);
  return t.getTime();
}
/** The wall clock in a zone at an instant (whole ms), and its offset in ms. */
function wallAt(zone, ms) {
  const sec = Math.floor(ms / 1000) * 1000;
  const p = {};
  partsFmt(zone).formatToParts(new Date(sec)).forEach((x) => { p[x.type] = x.value; });
  let y = Number(p.year);
  if (/^B/i.test(p.era || '')) y = 1 - y;
  const w = { y: y, mo: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, mi: Number(p.minute), s: Number(p.second) };
  w.offset = utcOf(w.y, w.mo, w.d, w.h, w.mi, w.s) - sec;
  return w;
}
const offsetAt = (zone, ms) => wallAt(zone, ms).offset;

/** A wall time in a zone → the instant. Gaps move forward by the gap; in an
    overlap the earlier instant is taken and the later one reported. */
function wallToMs(zone, w) {
  const t0 = utcOf(w.y, w.mo, w.d, w.h, w.mi, w.s);
  const offs = [offsetAt(zone, t0 - 86400000), offsetAt(zone, t0), offsetAt(zone, t0 + 86400000)];
  const uniq = offs.filter((o, i) => offs.indexOf(o) === i);
  const valid = uniq.map((o) => t0 - o).filter((c) => offsetAt(zone, c) === t0 - c).sort((a, b) => a - b);
  if (valid.length === 1) return { ms: valid[0] };
  if (valid.length > 1) return { ms: valid[0], later: valid[valid.length - 1] };
  /* a gap: read with the offset in force before it, which lands after it */
  return { ms: t0 - offs[0], gap: true };
}

/* ---------- reading one line ---------- */
function bigFloorDiv(a, b) { const q = a / b; return (a % b !== 0n && (a < 0n) !== (b < 0n)) ? q - 1n : q; }
const UNIT_NS = { s: 1000000000n, ms: 1000000n, us: 1000n, ns: 1n };
const UNIT_NAME = { s: 'seconds', ms: 'milliseconds', us: 'microseconds', ns: 'nanoseconds' };

function autoUnit(intDigits) {
  if (intDigits <= 11) return 's';
  if (intDigits <= 14) return 'ms';
  if (intDigits <= 17) return 'us';
  return 'ns';
}

function readNumber(s, unitOpt) {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return null;
  const intDigits = m[2].replace(/^0+(?=\d)/, '').length;
  const unit = unitOpt === 'auto' ? autoUnit(intDigits) : unitOpt;
  const scale = UNIT_NS[unit];
  let frac = m[3] || '';
  const fracDigits = String(scale).length - 1;
  if (frac.length > fracDigits) return { error: 'has more decimal places than a ' + UNIT_NAME[unit].replace(/s$/, '') + ' timestamp can carry (nanoseconds are the finest)' };
  let ns = BigInt(m[2]) * scale + (frac ? BigInt(frac.padEnd(fracDigits, '0')) : 0n);
  if (m[1] === '-') ns = -ns;
  const ms = bigFloorDiv(ns, 1000000n);
  if (ms > BigInt(MAX_MS) || ms < -BigInt(MAX_MS)) return { error: 'is outside the range a date can hold (about 271,821 BC to AD 275,760)' };
  const notes = [];
  if (unitOpt === 'auto' && /^\d{8}$/.test(m[2]) && !m[3] && !m[1]) {
    const y = +m[2].slice(0, 4), mo = +m[2].slice(4, 6), d = +m[2].slice(6, 8);
    if (y >= 1900 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) notes.push(s + ' was read as seconds; if it is the date ' + m[2].slice(0, 4) + '-' + m[2].slice(4, 6) + '-' + m[2].slice(6, 8) + ', type it with hyphens');
  }
  return { ns: ns, ms: Number(ms), unit: unit, auto: unitOpt === 'auto', notes: notes };
}

function monthOf(t) { const i = MONTHS.indexOf(String(t).slice(0, 3).toLowerCase()); return i < 0 ? 0 : i + 1; }
const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const WD = '(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\\.?,?\\s+)?';
const TIME = '(?:(?:,?\\s+|\\s*t\\s*|\\s+at\\s+)(\\d{1,2}):(\\d{2})(?::(\\d{2})(?:[.,](\\d{1,9}))?)?\\s*(am|pm)?)?';
const ZONE = '\\s*(z|utc|gmt|ut|[+-]\\d{2}(?::?\\d{2})?|(?:utc|gmt)[+-]\\d{1,2}(?::?\\d{2})?)?';
const RE_ISO = /^([+-]\d{6}|\d{4})-(\d{1,2})-(\d{1,2})(?:(?:t|\s+)(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?)?\s*(z|utc|gmt|[+-]\d{2}(?::?\d{2})?)?$/i;
const RE_DMY_NAME = new RegExp('^' + WD + '(\\d{1,2})(?:st|nd|rd|th)?\\s+' + MON + ',?\\s+(\\d{4})' + TIME + ZONE + '$', 'i');
const RE_MDY_NAME = new RegExp('^' + WD + MON + '\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})' + TIME + ZONE + '$', 'i');
const RE_SLASH = new RegExp('^(\\d{1,2})[/.](\\d{1,2})[/.](\\d{4})' + TIME + ZONE + '$', 'i');
const RE_CLF = /^\[?(\d{1,2})\/([a-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})(?:\s+([+-]\d{4}))?\]?$/i;

function zoneMinutes(z) {
  if (!z) return null;
  const t = z.toLowerCase();
  if (t === 'z' || t === 'utc' || t === 'gmt' || t === 'ut') return 0;
  const m = /^(?:utc|gmt)?([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(t);
  if (!m) return null;
  const v = Number(m[2]) * 60 + Number(m[3] || 0);
  if (Number(m[2]) > 23 || Number(m[3] || 0) > 59) return NaN;
  return m[1] === '-' ? -v : v;
}

function hour12(h, ap) {
  if (!ap) return h;
  if (h < 1 || h > 12) return NaN;
  return ap.toLowerCase() === 'pm' ? (h % 12) + 12 : h % 12;
}

/** text → { wall, offsetMin|null, fracNs } or { error } or null (not a date). */
function readDate(s, dmy) {
  let m, w = null, z = null, frac = '';
  if ((m = RE_ISO.exec(s))) {
    w = { y: Number(m[1]), mo: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0) };
    frac = m[7] || ''; z = m[8];
  } else if ((m = RE_DMY_NAME.exec(s))) {
    w = { y: +m[3], mo: monthOf(m[2]), d: +m[1], h: hour12(+(m[4] || 0), m[8]), mi: +(m[5] || 0), s: +(m[6] || 0) };
    frac = m[7] || ''; z = m[9];
  } else if ((m = RE_MDY_NAME.exec(s))) {
    w = { y: +m[3], mo: monthOf(m[1]), d: +m[2], h: hour12(+(m[4] || 0), m[8]), mi: +(m[5] || 0), s: +(m[6] || 0) };
    frac = m[7] || ''; z = m[9];
  } else if ((m = RE_SLASH.exec(s))) {
    const a = +m[1], b = +m[2];
    const dayFirst = dmy !== 'mdy';
    w = { y: +m[3], mo: dayFirst ? b : a, d: dayFirst ? a : b, h: hour12(+(m[4] || 0), m[8]), mi: +(m[5] || 0), s: +(m[6] || 0) };
    frac = m[7] || ''; z = m[9];
  } else if ((m = RE_CLF.exec(s))) {
    w = { y: +m[3], mo: monthOf(m[2]), d: +m[1], h: +m[4], mi: +m[5], s: +m[6] };
    z = m[7];
  } else return null;
  if (!(w.mo >= 1 && w.mo <= 12)) return { error: 'has no month ' + w.mo + (RE_SLASH.test(s) ? ' (Slashed dates is set to ' + (dmy === 'mdy' ? 'month first' : 'day first') + ')' : '') };
  const dim = new Date(Date.UTC(2000, w.mo, 0)).getUTCDate();
  const leap = (w.y % 4 === 0 && w.y % 100 !== 0) || w.y % 400 === 0;
  const maxD = w.mo === 2 ? (leap ? 29 : 28) : dim;
  if (!(w.d >= 1 && w.d <= maxD)) return { error: 'has no day ' + w.d + ' in ' + MONTH_NAMES[w.mo - 1] + ' ' + w.y };
  const notes = [];
  if (w.h === 24 && w.mi === 0 && w.s === 0 && !frac) { w.h = 0; const t = new Date(utcOf(w.y, w.mo, w.d, 0, 0, 0) + 86400000); w.y = t.getUTCFullYear(); w.mo = t.getUTCMonth() + 1; w.d = t.getUTCDate(); }
  if (!(w.h >= 0 && w.h <= 23) || w.mi > 59) return { error: 'is not a time of day' };
  if (w.s === 60) { notes.push('the leap second :60 was read as the first second of the next minute, as Unix time has no leap seconds'); }
  else if (w.s > 60) return { error: 'has ' + w.s + ' seconds' };
  const off = zoneMinutes(z);
  if (z && (off === null || isNaN(off))) return { error: 'has an offset that cannot be read: ' + z };
  return { wall: w, offsetMin: off, fracNs: frac ? Number(frac.padEnd(9, '0')) : 0, notes: notes };
}

/** One line → an instant, or { error }. */
function readLine(raw, o, zone, now) {
  const s = raw.trim();
  const low = s.toLowerCase();
  const num = readNumber(s.replace(/[_\s]/g, '').replace(/,(?=\d{3}\b)/g, ''), o.unit);
  if (num) return num.error ? num : { ms: num.ms, ns: num.ns, kind: 'number', unit: num.unit, auto: num.auto, notes: num.notes };
  if (low === 'now') return { ms: now, ns: BigInt(now) * 1000000n, kind: 'now', notes: [] };
  if (low === 'today' || low === 'yesterday' || low === 'tomorrow') {
    const w = wallAt(zone, now);
    const base = utcOf(w.y, w.mo, w.d, 12, 0, 0) + (low === 'yesterday' ? -86400000 : low === 'tomorrow' ? 86400000 : 0);
    const b = new Date(base);
    const r = wallToMs(zone, { y: b.getUTCFullYear(), mo: b.getUTCMonth() + 1, d: b.getUTCDate(), h: 0, mi: 0, s: 0 });
    return { ms: r.ms, ns: BigInt(r.ms) * 1000000n, kind: 'date', notes: [low + ' is midnight at the start of the day in ' + zone] };
  }
  const d = readDate(s, o.dmy);
  if (!d) return { error: 'is not a number or a date this tool reads. Try 1791374400, 2026-10-07T13:00:00+01:00 or 7 Oct 2026 13:00' };
  if (d.error) return d;
  let ms, notes = d.notes.slice();
  if (d.offsetMin !== null) {
    ms = utcOf(d.wall.y, d.wall.mo, d.wall.d, d.wall.h, d.wall.mi, d.wall.s) - d.offsetMin * 60000;
  } else {
    const r = wallToMs(zone, d.wall);
    ms = r.ms;
    if (r.gap) notes.push(fmtWall(d.wall) + ' does not exist in ' + zone + ' (the clocks went forward); read as ' + isoIn(zone, ms, 0n));
    if (r.later !== undefined) notes.push(fmtWall(d.wall) + ' happens twice in ' + zone + ' (the clocks went back); the first was taken, ' + Math.floor(ms / 1000) + '; the second is ' + Math.floor(r.later / 1000));
  }
  if (Math.abs(ms) > MAX_MS) return { error: 'is outside the range a date can hold' };
  const ns = BigInt(ms) * 1000000n + BigInt(d.fracNs);
  return { ms: ms, ns: ns, kind: 'date', zoned: d.offsetMin === null, notes: notes };
}
const fmtWall = (w) => pad(w.y, 4) + '-' + pad(w.mo) + '-' + pad(w.d) + ' ' + pad(w.h) + ':' + pad(w.mi) + ':' + pad(w.s);

/* ---------- writing ---------- */
function fracOf(ns) {
  const r = ((ns % 1000000000n) + 1000000000n) % 1000000000n;
  if (r === 0n) return '';
  let f = String(r).padStart(9, '0');
  while (f.length > 3 && f.slice(-3) === '000') f = f.slice(0, -3);
  return '.' + f;
}
function offStr(off, colon) {
  const m = Math.round(off / 60000), a = Math.abs(m);
  return (m < 0 ? '-' : '+') + pad(Math.floor(a / 60)) + (colon ? ':' : '') + pad(a % 60);
}
function yearStr(y) { return y >= 0 && y <= 9999 ? pad(y, 4) : (y < 0 ? '-' : '+') + pad(Math.abs(y), 6); }
function isoIn(zone, ms, ns) {
  const w = wallAt(zone, ms);
  const f = ns === null ? '' : fracOf(ns);
  return yearStr(w.y) + '-' + pad(w.mo) + '-' + pad(w.d) + 'T' + pad(w.h) + ':' + pad(w.mi) + ':' + pad(w.s) + f + (zone === 'UTC' ? 'Z' : offStr(w.offset, true));
}
function dow(w) { return new Date(utcOf(w.y, w.mo, w.d, 12, 0, 0)).getUTCDay(); }
function rfc2822(zone, ms) {
  const w = wallAt(zone, ms);
  return DAYS[dow(w)].slice(0, 3) + ', ' + pad(w.d) + ' ' + MONTH_NAMES[w.mo - 1].slice(0, 3) + ' ' + yearStr(w.y) + ' ' + pad(w.h) + ':' + pad(w.mi) + ':' + pad(w.s) + ' ' + offStr(w.offset, false);
}
function abbrev(zone, ms) {
  if (zone === 'UTC') return 'UTC';
  try {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: zone, timeZoneName: 'short' }).formatToParts(new Date(Math.floor(ms / 1000) * 1000));
    const n = (p.find((x) => x.type === 'timeZoneName') || {}).value || '';
    return /^(GMT|UTC)[+-−]/.test(n) ? '' : n;
  } catch (e) { return ''; }
}
function readable(zone, ms) {
  const w = wallAt(zone, ms);
  const ab = abbrev(zone, ms);
  return DAYS[dow(w)] + ' ' + w.d + ' ' + MONTH_NAMES[w.mo - 1] + ' ' + (w.y > 0 ? w.y : (1 - w.y) + ' BC') + ', ' + pad(w.h) + ':' + pad(w.mi) + ':' + pad(w.s) + ' ' + (ab || offStr(w.offset, true).replace(/^/, 'UTC'));
}
function isoWeek(w) {
  const t = new Date(utcOf(w.y, w.mo, w.d, 0, 0, 0));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const wy = t.getUTCFullYear();
  const first = new Date(utcOf(wy, 1, 4, 0, 0, 0));
  const week = 1 + Math.round(((t - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return wy + '-W' + pad(week);
}
function dayOfYear(w) { return Math.round((utcOf(w.y, w.mo, w.d, 0, 0, 0) - utcOf(w.y, 1, 1, 0, 0, 0)) / 86400000) + 1; }
function secStr(ns) {
  const s = bigFloorDiv(ns, 1000000000n);
  return String(s) + fracOf(ns);
}
function msStr(ns) {
  const ms = bigFloorDiv(ns, 1000000n);
  const r = ns - ms * 1000000n;
  return String(ms) + (r ? '.' + String(r).padStart(6, '0').replace(/0+$/, '') : '');
}
function span(ms) {
  ms = Math.abs(ms);
  if (ms < 1000) return ms + ' ms';
  const parts = [];
  const d = Math.floor(ms / 86400000); ms -= d * 86400000;
  const h = Math.floor(ms / 3600000); ms -= h * 3600000;
  const mi = Math.floor(ms / 60000); ms -= mi * 60000;
  const s = ms / 1000;
  if (d) parts.push(d.toLocaleString('en-GB') + ' d');
  if (h) parts.push(h + ' h');
  if (mi) parts.push(mi + ' min');
  if (s) parts.push((Math.round(s * 1000) / 1000) + ' s');
  return parts.join(' ');
}
function relative(ms, now) {
  const d = ms - now, a = Math.abs(d);
  if (a < 1000) return 'now';
  const units = [[31556952000, 'year'], [2629746000, 'month'], [604800000, 'week'], [86400000, 'day'], [3600000, 'hour'], [60000, 'minute'], [1000, 'second']];
  for (const [u, name] of units) {
    if (a >= u) { const n = Math.floor(a / u); const t = n + ' ' + name + (n === 1 ? '' : 's'); return d > 0 ? 'in ' + t : t + ' ago'; }
  }
  return 'now';
}

const T32 = 2147483647;

window.DEV_TOOLS['unix-timestamp'] = {
  title: 'Unix Timestamp Converter',
  category: 'developer',
  icon: '⏱',
  kind: 'code',
  description: 'Convert Unix timestamps to dates and dates to timestamps, in any time zone, many lines at once. Seconds, milliseconds, microseconds or nanoseconds, worked out for you.',
  keywords: ['unix timestamp converter', 'epoch converter', 'timestamp to date', 'date to timestamp', 'epoch time', 'unix time', 'milliseconds to date', 'posix time'],
  inputLabel: 'Timestamps or dates (one per line)',
  outputLabel: 'Converted',
  placeholder: '1791374400',
  sample: '1791374400\n1791374400123\n2026-10-07T13:00:00+01:00\n7 Oct 2026 13:00\n[07/Oct/2026:12:00:00 +0000]\n2026-03-29 01:30\n2147483647',
  worker: false,
  share: ['zone', 'unit', 'out', 'dmy'],
  options: [
    { key: 'zone', label: 'Time zone', type: 'select', default: 'local',
      options: [{ value: 'local', label: 'This device (' + deviceZone() + ')' }, { value: 'UTC', label: 'UTC' }].concat(zoneList().map((z) => ({ value: z, label: z.replace(/_/g, ' ') }))) },
    { key: 'unit', label: 'Numbers are in', type: 'select', default: 'auto',
      options: [{ value: 'auto', label: 'Work it out (by digits)' }, { value: 's', label: 'Seconds' }, { value: 'ms', label: 'Milliseconds' }, { value: 'us', label: 'Microseconds' }, { value: 'ns', label: 'Nanoseconds' }] },
    { key: 'out', label: 'Output', type: 'select', default: 'all',
      options: [{ value: 'all', label: 'Everything, per line' }, { value: 'iso', label: 'ISO 8601 in the zone, one per line' }, { value: 'utc', label: 'ISO 8601 in UTC, one per line' }, { value: 'rfc', label: 'RFC 2822, one per line' }, { value: 'human', label: 'Readable, one per line' }, { value: 's', label: 'Unix seconds, one per line' }, { value: 'ms', label: 'Unix milliseconds, one per line' }] },
    { key: 'dmy', label: 'Slashed dates', type: 'select', default: 'dmy',
      options: [{ value: 'dmy', label: 'Day first (07/10/2026)' }, { value: 'mdy', label: 'Month first (10/07/2026)' }] }
  ],
  transform: function (text, o) {
    const zone = resolveZone(o.zone);
    if (!zoneOk(zone)) return { error: 'This browser does not know the time zone ' + zone + '.' };
    const now = typeof o.now === 'number' ? o.now : Date.now();
    const lines = String(text).split(/\r?\n/);
    const out = [], bad = [], notes = [];
    let ok = 0, lo = null, hi = null, firstBad = null;
    const per = o.out && o.out !== 'all';
    lines.forEach((raw, i) => {
      if (!raw.trim()) { if (per) out.push(''); return; }
      const r = readLine(raw, o, zone, now);
      if (r.error) {
        bad.push('Line ' + (i + 1) + ': ' + raw.trim().slice(0, 40) + ' ' + r.error + '.');
        if (!firstBad) firstBad = { line: i + 1, col: raw.search(/\S/) + 1 };
        if (per) out.push(''); else out.push(raw.trim() + '\n  ' + r.error + '.\n');
        return;
      }
      ok++;
      if (lo === null || r.ms < lo) lo = r.ms;
      if (hi === null || r.ms > hi) hi = r.ms;
      (r.notes || []).forEach((n) => notes.push('Line ' + (i + 1) + ': ' + n + '.'));
      const sec = Number(bigFloorDiv(r.ns, 1000000000n));
      if (sec > T32 || sec < -T32 - 1) notes.push('Line ' + (i + 1) + ': past the range of a signed 32-bit time_t (1901-12-13 to 2038-01-19), which older systems still use.');
      if (per) {
        out.push(o.out === 'iso' ? isoIn(zone, r.ms, r.ns) : o.out === 'utc' ? isoIn('UTC', r.ms, r.ns) : o.out === 'rfc' ? rfc2822(zone, r.ms)
          : o.out === 'human' ? readable(zone, r.ms) : o.out === 's' ? secStr(r.ns) : msStr(r.ns));
        return;
      }
      const w = wallAt(zone, r.ms);
      const head = raw.trim() + (r.kind === 'number' ? '  (' + UNIT_NAME[r.unit] + (r.auto ? ', by digits' : '') + ')' : r.kind === 'date' && r.zoned ? '  (read in ' + zone + ')' : '');
      const rows = [['UTC', isoIn('UTC', r.ms, r.ns)]];
      if (zone !== 'UTC') rows.push([zone, isoIn(zone, r.ms, r.ns)]);
      rows.push(['RFC 2822', rfc2822(zone, r.ms)], ['Readable', readable(zone, r.ms)],
        ['Unix', secStr(r.ns) + ' s · ' + msStr(r.ns) + ' ms'],
        ['Calendar', 'day ' + dayOfYear(w) + ' of ' + w.y + ' · ISO week ' + isoWeek(w)],
        ['From now', relative(r.ms, now)]);
      const width = Math.max.apply(null, rows.map((x) => x[0].length));
      out.push(head + '\n' + rows.map((x) => '  ' + x[0].padEnd(width + 2) + x[1]).join('\n') + '\n');
    });
    if (!ok && !bad.length) return { output: '', note: 'Type or paste a timestamp or a date, one per line. Now is ' + Math.floor(now / 1000) + '.' };
    const stats = [['Converted', String(ok)], ['Not understood', String(bad.length)]];
    if (ok) stats.push(['Earliest', isoIn(zone, lo, null)], ['Latest', isoIn(zone, hi, null)]);
    if (ok > 1) stats.push(['Span', span(hi - lo)]);
    stats.push(['Time zone', zone + ' (' + (zone === 'UTC' ? 'UTC' : 'UTC' + offStr(offsetAt(zone, now), true) + ' now') + ')']);
    const res = { output: per ? out.join('\n') : out.join('\n').replace(/\n+$/, ''), stats: stats };
    if (bad.length) { res.warn = bad.join(' ') + (notes.length ? ' ' + notes.join(' ') : ''); res.errorAt = firstBad; }
    else if (notes.length) res.note = notes.join(' ');
    return res;
  },
  tips: [
    'Paste a whole column of timestamps or dates: each line is converted on its own, and a line the tool cannot read is named without stopping the rest.',
    'Numbers are read by their digits: up to 11 as seconds, 12 to 14 as milliseconds, 15 to 17 as microseconds and 18 or more as nanoseconds. Set Numbers are in when yours are otherwise.',
    'A date with no offset, such as 2026-10-07 13:00, is read in the time zone you pick. One with Z or +01:00 is exact whatever the zone.',
    'Choose a one-per-line output to paste a converted column straight back into a spreadsheet: the lines stay in step with the input, blanks included.',
    'Ctrl+Enter converts again, so From now and the clock lines catch up.'
  ],
  faq: [
    { q: 'What is the current Unix timestamp?', a: 'The live clock above the converter shows it in seconds and milliseconds, read from this device’s clock. Insert now adds it to the list.' },
    { q: 'What happens to a time the clocks skip or repeat?', a: 'When the clocks go forward, a wall time in the gap does not exist; it is read with the offset before the change, so 01:30 on 29 March 2026 in London becomes 02:30 BST. When they go back, a time happens twice; the first is used and the second is named in the note.' },
    { q: 'Does Unix time count leap seconds?', a: 'No. Every day is exactly 86,400 seconds in Unix time, so a leap second is not counted. A time written with :60 is read as the first second of the next minute.' }
  ],
  shortcuts: [['Ctrl + Enter', 'Convert again (refreshes From now)']],
  mount: function (ctx) { utsMount(ctx); }
};

/* ---------- the live clock and the date picker (page only) ---------- */
function utsMount(ctx) {
  const el = ctx.el;
  const bar = el('div', 'uts-now');
  bar.setAttribute('aria-label', 'Current time');
  const lab = el('span', 'uts-now-label', 'Now');
  const sEl = el('code', 'uts-now-s', '');
  const msEl = el('code', 'uts-now-ms', '');
  const mk = (label, get) => { const b = el('button', 'btn-ghost', label); b.type = 'button'; b.addEventListener('click', () => ctx.copyText(get(), b)); return b; };
  const ins = el('button', 'btn-ghost', 'Insert now');
  ins.type = 'button';
  ins.addEventListener('click', () => addLine(String(Math.floor(Date.now() / 1000))));
  const pick = el('input', 'control uts-pick');
  pick.type = 'datetime-local';
  pick.step = '1';
  pick.setAttribute('aria-label', 'Pick a date and time to add (read in the chosen time zone)');
  const add = el('button', 'btn-ghost', 'Add date');
  add.type = 'button';
  add.addEventListener('click', () => { if (pick.value) addLine(pick.value.replace('T', ' ')); });
  pick.addEventListener('keydown', (e) => { if (e.key === 'Enter' && pick.value) { e.preventDefault(); addLine(pick.value.replace('T', ' ')); } });
  function addLine(t) {
    const cur = ctx.input.value.replace(/\s+$/, '');
    ctx.setText(cur ? cur + '\n' + t : t);
  }
  const g1 = el('span', 'uts-grp'); g1.append(lab, sEl, mk('Copy seconds', () => sEl.textContent));
  const g2 = el('span', 'uts-grp'); g2.append(msEl, mk('Copy ms', () => msEl.textContent), ins);
  const g3 = el('span', 'uts-grp'); g3.append(pick, add);
  bar.append(g1, g2, g3);
  ctx.io.insertBefore(bar, ctx.io.firstChild);
  const tick = () => { const n = Date.now(); sEl.textContent = String(Math.floor(n / 1000)); msEl.textContent = String(n); };
  tick();
  setInterval(() => { if (!document.hidden) tick(); }, 250);
}

/* for tests: the pieces, without a DOM */
window.DEV_TOOLS['unix-timestamp']._lib = { wallToMs: wallToMs, wallAt: wallAt, readLine: readLine, isoIn: isoIn, isoWeek: isoWeek };
})();
