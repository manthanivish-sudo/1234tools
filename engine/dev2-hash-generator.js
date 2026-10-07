(function(){
/**
 * Developer tools, second set.
 *
 * Hashing is implemented in plain JavaScript rather than via SubtleCrypto.
 * SubtleCrypto is async, which the code-pane renderer is not, and it is
 * unavailable on insecure origins. Plain implementations are synchronous,
 * work everywhere, and — more usefully — can be verified in Node against
 * the published test vectors, which an async browser API cannot be.
 */

/* ============================================================
   Hash implementations
   ============================================================ */

function utf8Bytes(str) {
  const out = [];
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return out;
}

const hex = (arr) => arr.map(b => b.toString(16).padStart(2, '0')).join('');

/* ---------- SHA-256 (FIPS 180-4) ---------- */
const K256 = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
];

function sha256(bytes) {
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const msg = bytes.slice();
  const bitLen = msg.length * 8;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  // 64-bit length, big-endian; the high word is zero for anything realistic
  const hi = Math.floor(bitLen / 4294967296);
  msg.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255);
  msg.push((bitLen >>> 24) & 255, (bitLen >>> 16) & 255, (bitLen >>> 8) & 255, bitLen & 255);

  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  for (let i = 0; i < msg.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = (msg[i + t * 4] << 24) | (msg[i + t * 4 + 1] << 16) |
             (msg[i + t * 4 + 2] << 8) | msg[i + t * 4 + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K256[t] + w[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = [];
  H.forEach(x => out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255));
  return hex(out);
}

/* ---------- SHA-1 (FIPS 180-4) ---------- */
function sha1(bytes) {
  const H = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
  const msg = bytes.slice();
  const bitLen = msg.length * 8;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  const hi = Math.floor(bitLen / 4294967296);
  msg.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255);
  msg.push((bitLen >>> 24) & 255, (bitLen >>> 16) & 255, (bitLen >>> 8) & 255, bitLen & 255);

  const w = new Uint32Array(80);
  const rotl = (x, n) => (x << n) | (x >>> (32 - n));

  for (let i = 0; i < msg.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = (msg[i + t * 4] << 24) | (msg[i + t * 4 + 1] << 16) |
             (msg[i + t * 4 + 2] << 8) | msg[i + t * 4 + 3];
    }
    for (let t = 16; t < 80; t++) w[t] = rotl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);

    let [a, b, c, d, e] = H;
    for (let t = 0; t < 80; t++) {
      let f, k;
      if (t < 20)      { f = (b & c) | (~b & d);            k = 0x5A827999; }
      else if (t < 40) { f = b ^ c ^ d;                     k = 0x6ED9EBA1; }
      else if (t < 60) { f = (b & c) | (b & d) | (c & d);   k = 0x8F1BBCDC; }
      else             { f = b ^ c ^ d;                     k = 0xCA62C1D6; }
      const tmp = (rotl(a, 5) + f + e + k + w[t]) >>> 0;
      e = d; d = c; c = rotl(b, 30) >>> 0; b = a; a = tmp;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0; H[4] = (H[4] + e) >>> 0;
  }
  const out = [];
  H.forEach(x => out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255));
  return hex(out);
}

/* ---------- MD5 (RFC 1321) — for checksums only, never for security ---------- */
function md5(bytes) {
  const S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
             5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
             4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
             6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;

  const msg = bytes.slice();
  const bitLen = msg.length * 8;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  // MD5 length is little-endian
  const lo = bitLen >>> 0, hi = Math.floor(bitLen / 4294967296);
  msg.push(lo & 255, (lo >>> 8) & 255, (lo >>> 16) & 255, (lo >>> 24) & 255);
  msg.push(hi & 255, (hi >>> 8) & 255, (hi >>> 16) & 255, (hi >>> 24) & 255);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const rotl = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;
  const M = new Uint32Array(16);

  for (let i = 0; i < msg.length; i += 64) {
    for (let j = 0; j < 16; j++) {
      M[j] = (msg[i + j * 4]) | (msg[i + j * 4 + 1] << 8) |
             (msg[i + j * 4 + 2] << 16) | (msg[i + j * 4 + 3] << 24);
    }
    let A = a0, B = b0, C = c0, D = d0;
    for (let j = 0; j < 64; j++) {
      let F, g;
      if (j < 16)      { F = (B & C) | (~B & D);        g = j; }
      else if (j < 32) { F = (D & B) | (~D & C);        g = (5 * j + 1) % 16; }
      else if (j < 48) { F = B ^ C ^ D;                 g = (3 * j + 5) % 16; }
      else             { F = C ^ (B | ~D);              g = (7 * j) % 16; }
      F = (F + A + K[j] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + rotl(F, S[j])) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const le = (x) => [x & 255, (x >>> 8) & 255, (x >>> 16) & 255, (x >>> 24) & 255];
  return hex([...le(a0), ...le(b0), ...le(c0), ...le(d0)]);
}

/* ---------- CRC32 ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return ((c ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
}

/* ============================================================
   Cron expression parsing
   ============================================================ */

const CRON_NAMES = {
  month: ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],
  dow: ['sun','mon','tue','wed','thu','fri','sat']
};

/* Day of week runs 0-7, both ends Sunday, as in Vixie cron: so 1-7 is Monday
   to Sunday and 5-7 Friday to Sunday. The caller folds 7 into 0. The name
   sun at the end of a range means that 7, so mon-sun is the whole week. */
function parseCronField(field, min, max, names) {
  const out = new Set();
  for (let part of String(field).split(',')) {
    part = part.trim().toLowerCase();
    if (!part) throw new Error('empty field element');

    let step = 1;
    const slash = part.split('/');
    if (slash.length === 2) {
      step = parseInt(slash[1], 10);
      if (!isFinite(step) || step < 1) throw new Error(`invalid step "${slash[1]}"`);
      part = slash[0];
    } else if (slash.length > 2) throw new Error('more than one / in a field');

    let lo, hi;
    if (part === '*') { lo = min; hi = max; }
    else {
      const range = part.split('-');
      const toNum = (v, isEnd) => {
        if (names) {
          const i = names.indexOf(v.slice(0, 3));
          if (i >= 0) {
            if (names === CRON_NAMES.dow && isEnd && i === 0) return 7;
            return i + (names === CRON_NAMES.month ? 1 : 0);
          }
        }
        const n = parseInt(v, 10);
        if (!isFinite(n)) throw new Error(`"${v}" is not a valid value`);
        return n;
      };
      if (range.length === 1) { lo = toNum(range[0]); hi = step > 1 ? max : lo; }
      else if (range.length === 2) { lo = toNum(range[0]); hi = toNum(range[1], true); }
      else throw new Error('more than one - in a field element');
    }
    if (lo < min || hi > max || lo > hi) throw new Error(`${lo}-${hi} is outside the allowed range ${min}-${max}`);
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return [...out].sort((a, b) => a - b);
}

function describeCron(expr) {
  const parts = String(expr).trim().split(/\s+/);
  const PRESETS = {
    '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *',
    '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *',
    '@hourly': '0 * * * *'
  };
  if (parts.length === 1 && PRESETS[parts[0].toLowerCase()]) {
    return describeCron(PRESETS[parts[0].toLowerCase()]);
  }
  if (parts.length !== 5) {
    throw new Error(`A cron expression has five fields (minute hour day month weekday). This has ${parts.length}.`);
  }

  const [minF, hourF, domF, monF, dowF] = parts;
  const mins  = parseCronField(minF, 0, 59);
  const hours = parseCronField(hourF, 0, 23);
  const doms  = parseCronField(domF, 1, 31);
  const mons  = parseCronField(monF, 1, 12, CRON_NAMES.month);
  /* 0-7 with 7 folded into 0. Rewriting every 7 to 0 in the text first, as
     this once did, turned 1-7 into 1-0 and refused it. */
  const dows  = [...new Set(parseCronField(dowF, 0, 7, CRON_NAMES.dow).map(d => d % 7))].sort((a, b) => a - b);

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const list = (arr, fmt) => arr.length === 1 ? fmt(arr[0])
    : arr.length === 2 ? `${fmt(arr[0])} and ${fmt(arr[1])}`
    : arr.slice(0, -1).map(fmt).join(', ') + ' and ' + fmt(arr[arr.length - 1]);
  const pad = (n) => String(n).padStart(2, '0');

  let when;
  if (mins.length === 60 && hours.length === 24) when = 'Every minute';
  else if (mins.length === 60) when = `Every minute during ${list(hours, h => pad(h) + ':00')}`;
  else if (hours.length === 24) when = `At ${list(mins, m => 'minute ' + m)} of every hour`;
  else if (mins.length <= 4 && hours.length <= 4) {
    const times = [];
    hours.forEach(h => mins.forEach(m => times.push(`${pad(h)}:${pad(m)}`)));
    when = `At ${list(times, t => t)}`;
  } else {
    when = `At ${list(mins, m => 'minute ' + m)} past ${list(hours, h => pad(h) + ':00')}`;
  }

  let onDays = '';
  const allDom = doms.length === 31, allDow = dows.length === 7;
  // days are named Monday first, so 5-7 reads Friday, Saturday and Sunday
  const weekOrder = dows.slice().sort((a, b) => (a + 6) % 7 - (b + 6) % 7);
  if (allDom && allDow) onDays = 'every day';
  else if (!allDom && allDow) onDays = `on day ${list(doms, d => String(d))} of the month`;
  else if (allDom && !allDow) onDays = `on ${list(weekOrder, d => DAYS[d])}`;
  else onDays = `on day ${list(doms, d => String(d))} of the month, and on ${list(weekOrder, d => DAYS[d])}`;

  const inMonths = mons.length === 12 ? '' : `, in ${list(mons, m => MONTHS[m - 1])}`;

  return {
    text: `${when}, ${onDays}${inMonths}.`,
    fields: { mins, hours, doms, mons, dows },
    runsPerDay: mins.length * hours.length,
    normalised: parts.join(' ')
  };
}

/** Next N times the expression fires, walking forward minute by minute. */
function nextCronRuns(parsed, from, count) {
  const { mins, hours, doms, mons, dows } = parsed.fields;
  const mSet = new Set(mins), hSet = new Set(hours);
  const domSet = new Set(doms), monSet = new Set(mons), dowSet = new Set(dows);
  const allDom = doms.length === 31, allDow = dows.length === 7;

  const out = [];
  const t = new Date(from.getTime());
  t.setSeconds(0, 0);
  t.setMinutes(t.getMinutes() + 1);

  // a year of minutes is the practical ceiling for a five-field expression
  for (let i = 0; i < 527040 && out.length < count; i++) {
    if (mSet.has(t.getMinutes()) && hSet.has(t.getHours()) && monSet.has(t.getMonth() + 1)) {
      // cron ORs day-of-month and day-of-week when both are restricted
      const dayOk = (allDom && allDow) ? true
        : (!allDom && allDow) ? domSet.has(t.getDate())
        : (allDom && !allDow) ? dowSet.has(t.getDay())
        : (domSet.has(t.getDate()) || dowSet.has(t.getDay()));
      if (dayOk) out.push(new Date(t.getTime()));
    }
    t.setMinutes(t.getMinutes() + 1);
  }
  return out;
}

/* ============================================================
   Markdown -> HTML
   ============================================================ */

/**
 * The address a link or picture may carry, or null when it may not.
 *
 * Allowed: http, https, mailto and tel (http and https only for a picture),
 * and relative addresses: /path, ../x, page.html, #part, ?q=1. Anything else
 * with a scheme (javascript:, vbscript:, data:, file: …) is refused, and the
 * link or picture is written as its plain text instead. Browsers skip tabs,
 * line breaks and control characters when they read a scheme, so the test
 * strips them first: "java\tscript:" is still javascript:.
 */
function mdSafeUrl(url, forImage) {
  const raw = String(url);
  const probe = raw.replace(/[\u0000- \u007f-\u009f]/g, '').toLowerCase();
  const m = /^([a-z][a-z0-9+.\-]*):/.exec(probe);
  if (m) {
    const ok = forImage ? ['http', 'https'] : ['http', 'https', 'mailto', 'tel'];
    return ok.indexOf(m[1]) >= 0 ? raw : null;
  }
  // a colon before the first / ? or # would be read as some other scheme
  if (/^[^\/?#]*:/.test(probe)) return null;
  return raw;
}

function markdownToHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  /* An attribute value is quoted with ", so " and ' are escaped as well as
     & < and >: a quote in an address can no longer close the attribute and
     open a new one, as [x](a"onmouseover="…) once did. */
  const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const blocks = [];
  // \u0000 to \u0003 mark the pieces lifted out below, so none may come in
  let src = String(md).replace(/[\u0000-\u0003]/g, '');

  // pull fenced code out first so nothing else touches it
  src = src.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) => {
    blocks.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${esc(code.replace(/\n$/, ''))}</code></pre>`);
    return `\u0000BLOCK${blocks.length - 1}\u0000`;
  });

  /* Code spans, pictures and the tags of links are lifted out as \u0001n\u0002
     once written, so the emphasis rules that follow cannot reach into an
     address or a code span. An address may hold one level of brackets, as
     in https://en.wikipedia.org/wiki/Cron_(software); a title after it, as
     in [x](url "title"), is accepted and dropped. */
  const LINK_URL = '\\(\\s*((?:[^()\\s]|\\([^()\\s]*\\))+)(?:\\s+[^)]*)?\\)';
  const IMG_RE = new RegExp('!\\[([^\\]]*)\\]' + LINK_URL, 'g');
  const LINK_RE = new RegExp('\\[([^\\]]+)\\]' + LINK_URL, 'g');
  const inline = (s) => {
    const kept = [];
    const keep = (html) => '\u0001' + (kept.push(html) - 1) + '\u0002';
    const t = esc(s)
      .replace(/`([^`]+)`/g, (m, code) => keep('<code>' + code + '</code>'))
      .replace(IMG_RE, (m, alt, url) => {
        const u = mdSafeUrl(unesc(url), true);
        return u === null ? alt : keep('<img src="' + attr(u) + '" alt="' + attr(unesc(alt)) + '">');
      })
      .replace(LINK_RE, (m, text, url) => {
        const u = mdSafeUrl(unesc(url), false);
        return u === null ? text : keep('<a href="' + attr(u) + '" rel="noopener noreferrer">') + text + keep('</a>');
      })
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/(^|\s)__([^_]+)__/g, '$1<strong>$2</strong>');
    return t.replace(/\u0001(\d+)\u0002/g, (m, i) => kept[Number(i)]);
  };

  /* GitHub-style pipe tables. A row is split at every | that is not written
     \| (which becomes a plain | in the cell); one pipe at either end is
     optional. The line under the header must be a divider row of ---, :---,
     ---: or :---: with as many cells as the header, or neither line is a
     table. Body rows are padded with empty cells or cut to the header's
     width, and the table ends at a blank line or at a line that starts some
     other block (#, >, a bullet, a number, a rule, a code block); any other
     line is one more row, as on GitHub. Cells go through inline() above, so
     the same escaping as a paragraph, and the alignment is taken from the
     fixed list below, never copied from the text. */
  const ALIGN = { left: ' style="text-align:left"', center: ' style="text-align:center"', right: ' style="text-align:right"', none: '' };
  const splitRow = (row) => {
    const s = row.trim();
    const cells = [];
    let cur = '', endPipe = false;
    for (let i = 0; i < s.length; i++) {
      const c = s.charAt(i);
      endPipe = false;
      if (c === '\\' && s.charAt(i + 1) === '|') { cur += '|'; i++; }
      else if (c === '\\' && i + 1 < s.length) { cur += c + s.charAt(i + 1); i++; }
      else if (c === '|') { cells.push(cur.trim()); cur = ''; endPipe = true; }
      else cur += c;
    }
    if (!endPipe) cells.push(cur.trim());
    if (s.charAt(0) === '|') cells.shift();
    return cells;
  };
  const alignOf = (d) => d.charAt(0) === ':' ? (d.length > 1 && d.charAt(d.length - 1) === ':' ? 'center' : 'left')
    : d.charAt(d.length - 1) === ':' ? 'right' : 'none';
  const tableHead = (line, next) => {
    if (next === undefined || line.indexOf('|') < 0) return null;
    next = next.replace(/\s+$/, '');
    if (next.indexOf('|') < 0) return null;
    const delim = splitRow(next);
    if (!delim.length || !delim.every((d) => /^:?-+:?$/.test(d))) return null;
    const head = splitRow(line);
    if (head.length !== delim.length) return null;
    return { head, aligns: delim.map(alignOf) };
  };
  const startsBlock = (l) => !l.trim() || /^\u0000BLOCK\d+\u0000$/.test(l.trim()) || /^#{1,6}\s+/.test(l) ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(l.trim()) || /^>/.test(l) || /^\s*[-*+]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l);
  const tableHtml = (t, rows) => {
    const cell = (tag, text, i) => '<' + tag + ALIGN[t.aligns[i]] + '>' + inline(text) + '</' + tag + '>';
    let h = '<table>\n<thead>\n<tr>' + t.head.map((c, i) => cell('th', c, i)).join('') + '</tr>\n</thead>';
    if (rows.length) {
      h += '\n<tbody>\n' + rows.map((r) => '<tr>' + t.aligns.map((a, i) => cell('td', r[i] || '', i)).join('') + '</tr>').join('\n') + '\n</tbody>';
    }
    return h + '\n</table>';
  };

  const lines = src.split('\n');
  const out = [];
  let inList = null, inQuote = false, para = [];

  const flushPara = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
  };
  const closeList = () => { if (inList) { out.push(`</${inList}>`); inList = null; } };
  const closeQuote = () => { if (inQuote) { out.push('</blockquote>'); inQuote = false; } };

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].replace(/\s+$/, '');

    if (/^\u0000BLOCK\d+\u0000$/.test(line.trim())) {
      flushPara(); closeList(); closeQuote();
      out.push(line.trim());
      continue;
    }
    if (!line.trim()) { flushPara(); closeList(); closeQuote(); continue; }

    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      flushPara(); closeList(); closeQuote();
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushPara(); closeList(); closeQuote();
      out.push('<hr>');
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flushPara(); closeList();
      if (!inQuote) { out.push('<blockquote>'); inQuote = true; }
      out.push(`<p>${inline(m[1])}</p>`);
    } else if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) {
      flushPara(); closeQuote();
      if (inList !== 'ul') { closeList(); out.push('<ul>'); inList = 'ul'; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara(); closeQuote();
      if (inList !== 'ol') { closeList(); out.push('<ol>'); inList = 'ol'; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else {
      closeList(); closeQuote();
      const table = tableHead(line, lines[li + 1]);
      if (table) {
        flushPara();
        const rows = [];
        for (li += 2; li < lines.length && !startsBlock(lines[li].replace(/\s+$/, '')); li++) rows.push(splitRow(lines[li]));
        li--;
        out.push(tableHtml(table, rows));
        continue;
      }
      para.push(line.trim());
    }
  }
  flushPara(); closeList(); closeQuote();

  return out.join('\n').replace(/\u0000BLOCK(\d+)\u0000/g, (m, i) => blocks[Number(i)]);
}

/* ============================================================
   Tool specs
   ============================================================ */


window.DEV_TOOLS = window.DEV_TOOLS || {};

/* ============================================================
   Wave 3: incremental hashing (text, hex, Base64 and files)

   Every algorithm here is a streaming object, { update(bytes), digest() },
   so a file is read a slice at a time and never held whole, and HMAC wraps
   any of them. WebCrypto is not used: it has no SHA-3, no MD5 and no
   incremental digest, and it is async. The constants of SHA-512 and its
   relatives are worked out at load time from the primes, as FIPS 180-4
   defines them, rather than typed in; build/tests/w3-d.js checks every
   algorithm against Node's own crypto, including files fed in odd-sized
   slices.
   ============================================================ */

const HX = (function () {
  /* ---------- byte helpers ---------- */
  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(String(str));
    return Uint8Array.from(utf8Bytes(str));
  }
  function toHex(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i++) s += (u8[i] < 16 ? '0' : '') + u8[i].toString(16);
    return s;
  }
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function toB64(u8) {
    let out = '';
    for (let i = 0; i < u8.length; i += 3) {
      const a = u8[i], b = u8[i + 1], c = u8[i + 2];
      out += B64[a >> 2] + B64[((a & 3) << 4) | ((b || 0) >> 4)];
      out += b === undefined ? '=' : B64[((b & 15) << 2) | ((c || 0) >> 6)];
      out += c === undefined ? '=' : B64[c & 63];
    }
    return out;
  }
  /* Where a text box is read as bytes: the line and column of a character. */
  function lineCol(text, i) {
    const before = text.slice(0, i);
    const line = before.split('\n').length;
    return { line, col: i - before.lastIndexOf('\n') };
  }
  /** Hex digits to bytes. Spaces, line breaks, colons and a 0x prefix are allowed. */
  function fromHex(text) {
    const s = String(text);
    const digits = [];
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (/[0-9a-fA-F]/.test(c)) {
        digits.push(c);
      } else if (c === 'x' || c === 'X') {
        // 0x prefix: only right after a lone 0 at the start of a group
        if (digits.length && digits[digits.length - 1] === '0' && (i < 2 || /[\s:,]/.test(s[i - 2] || ' '))) { digits.pop(); continue; }
        const at = lineCol(s, i);
        throw Object.assign(new Error('"' + c + '" is not a hex digit (line ' + at.line + ', column ' + at.col + ').'), { at });
      } else if (!/[\s:,-]/.test(c)) {
        const at = lineCol(s, i);
        throw Object.assign(new Error('"' + c + '" is not a hex digit (line ' + at.line + ', column ' + at.col + ').'), { at });
      }
    }
    if (digits.length % 2) throw new Error('An odd number of hex digits (' + digits.length + '): every byte needs two.');
    const out = new Uint8Array(digits.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(digits[2 * i] + digits[2 * i + 1], 16);
    return out;
  }
  /** Base64 (standard or URL-safe) to bytes; spaces and line breaks are skipped, padding is optional. */
  function fromB64(text) {
    const s = String(text);
    const vals = [];
    let pad = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (/\s/.test(c)) continue;
      if (c === '=') { pad++; continue; }
      let v = B64.indexOf(c);
      if (c === '-') v = 62; else if (c === '_') v = 63;
      if (v < 0 || pad) {
        const at = lineCol(s, i);
        throw Object.assign(new Error((pad ? 'Text after the = padding' : '"' + c + '" is not a Base64 character') + ' (line ' + at.line + ', column ' + at.col + ').'), { at });
      }
      vals.push(v);
    }
    if (vals.length % 4 === 1) throw new Error('This Base64 is one character too long or too short: ' + vals.length + ' characters cannot make whole bytes.');
    const out = new Uint8Array(Math.floor(vals.length * 3 / 4));
    let o = 0;
    for (let i = 0; i < vals.length; i += 4) {
      const n = (vals[i] << 18) | (vals[i + 1] << 12) | ((vals[i + 2] || 0) << 6) | (vals[i + 3] || 0);
      out[o++] = n >>> 16;
      if (i + 2 < vals.length) out[o++] = (n >>> 8) & 255;
      if (i + 3 < vals.length) out[o++] = n & 255;
    }
    return out;
  }

  /* ---------- constants from the primes (FIPS 180-4, 4.2 and 5.3) ---------- */
  const primes = [];
  for (let n = 2; primes.length < 80; n++) if (primes.every((p) => n % p)) primes.push(n);
  function iroot(n, k) {           // floor(n^(1/k)) for a BigInt n
    const K = BigInt(k);
    let x = 1n << BigInt(Math.ceil(n.toString(2).length / k) + 1);
    for (;;) {
      const y = ((K - 1n) * x + n / (x ** (K - 1n))) / K;
      if (y >= x) return x;
      x = y;
    }
  }
  const M64 = (1n << 64n) - 1n;
  const frac64 = (p, k) => iroot(BigInt(p) << BigInt(64 * k), k) & M64;   // first 64 bits of the fraction of p^(1/k)
  const split = (v) => [Number(v >> 32n) | 0, Number(v & 0xffffffffn) | 0];
  const K512 = new Int32Array(160);
  primes.forEach((p, i) => { const [h, l] = split(frac64(p, 3)); K512[2 * i] = h; K512[2 * i + 1] = l; });
  const IV512 = [], IV384 = [];
  for (let i = 0; i < 8; i++) { IV512.push(...split(frac64(primes[i], 2))); IV384.push(...split(frac64(primes[i + 8], 2))); }
  const IV256 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  /* SHA-224 starts from the low halves of SHA-384's words */
  const IV224 = []; for (let i = 0; i < 8; i++) IV224.push(IV384[2 * i + 1] >>> 0);
  const K256I = Int32Array.from(K256);

  /* ---------- a Merkle–Damgård hash: buffer, blocks, padding ---------- */
  function md(cfg) {
    const block = cfg.block;
    const buf = new Uint8Array(block);
    let pos = 0, total = 0, done = false;
    const st = cfg.init();
    return {
      blockSize: block,
      update(data) {
        if (done) throw new Error('digest() was already called');
        let i = 0;
        const n = data.length;
        total += n;
        if (pos) {
          const take = Math.min(block - pos, n);
          buf.set(data.subarray(0, take), pos);
          pos += take; i = take;
          if (pos === block) { cfg.compress(st, buf, 0); pos = 0; }
        }
        for (; n - i >= block; i += block) cfg.compress(st, data, i);
        if (i < n) { buf.set(data.subarray(i), 0); pos = n - i; }
        return this;
      },
      digest() {
        done = true;
        const lenBytes = cfg.lenBytes;
        const bits = total * 8;
        buf[pos++] = 0x80;
        if (pos > block - lenBytes) { buf.fill(0, pos); cfg.compress(st, buf, 0); pos = 0; }
        buf.fill(0, pos);
        const hi = Math.floor(bits / 4294967296), lo = bits >>> 0;
        if (cfg.littleEndian) {
          const o = block - lenBytes;
          buf[o] = lo & 255; buf[o + 1] = (lo >>> 8) & 255; buf[o + 2] = (lo >>> 16) & 255; buf[o + 3] = lo >>> 24;
          buf[o + 4] = hi & 255; buf[o + 5] = (hi >>> 8) & 255; buf[o + 6] = (hi >>> 16) & 255; buf[o + 7] = hi >>> 24;
        } else {
          const o = block - 8;
          buf[o] = hi >>> 24; buf[o + 1] = (hi >>> 16) & 255; buf[o + 2] = (hi >>> 8) & 255; buf[o + 3] = hi & 255;
          buf[o + 4] = lo >>> 24; buf[o + 5] = (lo >>> 16) & 255; buf[o + 6] = (lo >>> 8) & 255; buf[o + 7] = lo & 255;
        }
        cfg.compress(st, buf, 0);
        return cfg.out(st);
      }
    };
  }
  const be32 = (d, o) => (d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3];
  function wordsOut(st, n, littleEndian) {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const w = st[i >> 2];
      out[i] = littleEndian ? (w >>> (8 * (i & 3))) & 255 : (w >>> (24 - 8 * (i & 3))) & 255;
    }
    return out;
  }

  /* ---------- MD5 (RFC 1321) ---------- */
  const MD5S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const MD5K = new Int32Array(64);
  for (let i = 0; i < 64; i++) MD5K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
  const md5X = new Int32Array(16);
  function md5Compress(st, d, o) {
    const X = md5X;
    for (let j = 0; j < 16; j++) X[j] = d[o + 4 * j] | (d[o + 4 * j + 1] << 8) | (d[o + 4 * j + 2] << 16) | (d[o + 4 * j + 3] << 24);
    let a = st[0], b = st[1], c = st[2], dd = st[3];
    for (let j = 0; j < 64; j++) {
      let f, g;
      if (j < 16) { f = (b & c) | (~b & dd); g = j; }
      else if (j < 32) { f = (dd & b) | (~dd & c); g = (5 * j + 1) & 15; }
      else if (j < 48) { f = b ^ c ^ dd; g = (3 * j + 5) & 15; }
      else { f = c ^ (b | ~dd); g = (7 * j) & 15; }
      const s = MD5S[(j >> 4) * 4 + (j & 3)];
      const t = (a + f + MD5K[j] + X[g]) | 0;
      a = dd; dd = c; c = b;
      b = (b + ((t << s) | (t >>> (32 - s)))) | 0;
    }
    st[0] = (st[0] + a) | 0; st[1] = (st[1] + b) | 0; st[2] = (st[2] + c) | 0; st[3] = (st[3] + dd) | 0;
  }
  const md5 = () => md({ block: 64, lenBytes: 8, littleEndian: true, init: () => Int32Array.of(0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476), compress: md5Compress, out: (st) => wordsOut(st, 16, true) });

  /* ---------- SHA-1 ---------- */
  const s1W = new Int32Array(80);
  function sha1Compress(st, d, o) {
    const W = s1W;
    for (let t = 0; t < 16; t++) W[t] = be32(d, o + 4 * t);
    for (let t = 16; t < 80; t++) { const x = W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16]; W[t] = (x << 1) | (x >>> 31); }
    let a = st[0], b = st[1], c = st[2], dd = st[3], e = st[4];
    for (let t = 0; t < 80; t++) {
      let f, k;
      if (t < 20) { f = (b & c) | (~b & dd); k = 0x5A827999; }
      else if (t < 40) { f = b ^ c ^ dd; k = 0x6ED9EBA1; }
      else if (t < 60) { f = (b & c) | (b & dd) | (c & dd); k = 0x8F1BBCDC | 0; }
      else { f = b ^ c ^ dd; k = 0xCA62C1D6 | 0; }
      const tmp = (((a << 5) | (a >>> 27)) + f + e + k + W[t]) | 0;
      e = dd; dd = c; c = (b << 30) | (b >>> 2); b = a; a = tmp;
    }
    st[0] = (st[0] + a) | 0; st[1] = (st[1] + b) | 0; st[2] = (st[2] + c) | 0; st[3] = (st[3] + dd) | 0; st[4] = (st[4] + e) | 0;
  }
  const sha1 = () => md({ block: 64, lenBytes: 8, init: () => Int32Array.of(0x67452301, 0xEFCDAB89 | 0, 0x98BADCFE | 0, 0x10325476, 0xC3D2E1F0 | 0), compress: sha1Compress, out: (st) => wordsOut(st, 20) });

  /* ---------- SHA-256 and SHA-224 ---------- */
  const s2W = new Int32Array(64);
  function sha256Compress(st, d, o) {
    const W = s2W, K = K256I;
    for (let t = 0; t < 16; t++) W[t] = be32(d, o + 4 * t);
    for (let t = 16; t < 64; t++) {
      const x = W[t - 15], y = W[t - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }
    let a = st[0], b = st[1], c = st[2], dd = st[3], e = st[4], f = st[5], g = st[6], h = st[7];
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[t] + W[t]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (dd + t1) | 0; dd = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    st[0] = (st[0] + a) | 0; st[1] = (st[1] + b) | 0; st[2] = (st[2] + c) | 0; st[3] = (st[3] + dd) | 0;
    st[4] = (st[4] + e) | 0; st[5] = (st[5] + f) | 0; st[6] = (st[6] + g) | 0; st[7] = (st[7] + h) | 0;
  }
  const sha256 = () => md({ block: 64, lenBytes: 8, init: () => Int32Array.from(IV256), compress: sha256Compress, out: (st) => wordsOut(st, 32) });
  const sha224 = () => md({ block: 64, lenBytes: 8, init: () => Int32Array.from(IV224), compress: sha256Compress, out: (st) => wordsOut(st, 28) });

  /* ---------- SHA-512 family, in pairs of 32-bit halves ---------- */
  const s5W = new Int32Array(160);
  function sha512Compress(st, d, o) {
    const W = s5W, K = K512;
    for (let t = 0; t < 32; t++) W[t] = be32(d, o + 4 * t);
    let h, l, xl, xh, yl;
    for (let t = 16; t < 80; t++) {
      // s0 = rotr1 ^ rotr8 ^ shr7 of W[t-15]
      h = W[2 * t - 30]; l = W[2 * t - 29];
      const s0h = ((h >>> 1) | (l << 31)) ^ ((h >>> 8) | (l << 24)) ^ (h >>> 7);
      const s0l = ((l >>> 1) | (h << 31)) ^ ((l >>> 8) | (h << 24)) ^ ((l >>> 7) | (h << 25));
      // s1 = rotr19 ^ rotr61 ^ shr6 of W[t-2]
      h = W[2 * t - 4]; l = W[2 * t - 3];
      const s1h = ((h >>> 19) | (l << 13)) ^ ((l >>> 29) | (h << 3)) ^ (h >>> 6);
      const s1l = ((l >>> 19) | (h << 13)) ^ ((h >>> 29) | (l << 3)) ^ ((l >>> 6) | (h << 26));
      /* 64-bit sums: add the low halves, carry when the unsigned result wrapped */
      xl = W[2 * t - 31]; xh = W[2 * t - 32];
      yl = (xl + s0l) | 0; xh = (xh + s0h + ((yl >>> 0) < (xl >>> 0) ? 1 : 0)) | 0; xl = yl;
      yl = (xl + s1l) | 0; xh = (xh + s1h + ((yl >>> 0) < (xl >>> 0) ? 1 : 0)) | 0; xl = yl;
      yl = (xl + W[2 * t - 13]) | 0; xh = (xh + W[2 * t - 14] + ((yl >>> 0) < (xl >>> 0) ? 1 : 0)) | 0; xl = yl;
      W[2 * t] = xh; W[2 * t + 1] = xl;
    }
    let ah = st[0], al = st[1], bh = st[2], bl = st[3], ch = st[4], cl = st[5], dh = st[6], dl = st[7];
    let eh = st[8], el = st[9], fh = st[10], fl = st[11], gh = st[12], gl = st[13], hh = st[14], hl = st[15];
    for (let t = 0; t < 80; t++) {
      // Σ1(e) = rotr14 ^ rotr18 ^ rotr41
      const S1h = ((eh >>> 14) | (el << 18)) ^ ((eh >>> 18) | (el << 14)) ^ ((el >>> 9) | (eh << 23));
      const S1l = ((el >>> 14) | (eh << 18)) ^ ((el >>> 18) | (eh << 14)) ^ ((eh >>> 9) | (el << 23));
      const chh = (eh & fh) ^ (~eh & gh), chl = (el & fl) ^ (~el & gl);
      // T1 = h + Σ1 + Ch + K[t] + W[t]
      xl = hl; xh = hh;
      yl = (xl + S1l) | 0; xh = (xh + S1h + ((yl >>> 0) < (xl >>> 0) ? 1 : 0)) | 0; xl = yl;
      yl = (xl + chl) | 0; xh = (xh + chh + ((yl >>> 0) < (xl >>> 0) ? 1 : 0)) | 0; xl = yl;
      yl = (xl + K[2 * t + 1]) | 0; xh = (xh + K[2 * t] + ((yl >>> 0) < (xl >>> 0) ? 1 : 0)) | 0; xl = yl;
      yl = (xl + W[2 * t + 1]) | 0; xh = (xh + W[2 * t] + ((yl >>> 0) < (xl >>> 0) ? 1 : 0)) | 0; xl = yl;
      const t1h = xh, t1l = xl;
      // Σ0(a) = rotr28 ^ rotr34 ^ rotr39; T2 = Σ0 + Maj
      const S0h = ((ah >>> 28) | (al << 4)) ^ ((al >>> 2) | (ah << 30)) ^ ((al >>> 7) | (ah << 25));
      const S0l = ((al >>> 28) | (ah << 4)) ^ ((ah >>> 2) | (al << 30)) ^ ((ah >>> 7) | (al << 25));
      const mjh = (ah & bh) ^ (ah & ch) ^ (bh & ch), mjl = (al & bl) ^ (al & cl) ^ (bl & cl);
      const t2l = (S0l + mjl) | 0;
      const t2h = (S0h + mjh + ((t2l >>> 0) < (S0l >>> 0) ? 1 : 0)) | 0;
      hh = gh; hl = gl; gh = fh; gl = fl; fh = eh; fl = el;
      el = (dl + t1l) | 0; eh = (dh + t1h + ((el >>> 0) < (dl >>> 0) ? 1 : 0)) | 0;
      dh = ch; dl = cl; ch = bh; cl = bl; bh = ah; bl = al;
      al = (t1l + t2l) | 0; ah = (t1h + t2h + ((al >>> 0) < (t1l >>> 0) ? 1 : 0)) | 0;
    }
    const add = (i, x, y) => { const s = (st[i + 1] + y) | 0; st[i] = (st[i] + x + ((s >>> 0) < (st[i + 1] >>> 0) ? 1 : 0)) | 0; st[i + 1] = s; };
    add(0, ah, al); add(2, bh, bl); add(4, ch, cl); add(6, dh, dl); add(8, eh, el); add(10, fh, fl); add(12, gh, gl); add(14, hh, hl);
  }
  const sha512With = (iv, n) => () => md({ block: 128, lenBytes: 16, init: () => Int32Array.from(iv), compress: sha512Compress, out: (st) => wordsOut(st, n) });
  const sha512 = sha512With(IV512, 64);
  const sha384 = sha512With(IV384, 48);
  /* SHA-512/t (FIPS 180-4, 5.3.6): the IV is SHA-512 of "SHA-512/256", started from SHA-512's IV with every byte xor a5 */
  const IV512_256 = (function () {
    const iv = IV512.map((w) => w ^ 0xa5a5a5a5);
    const h = md({ block: 128, lenBytes: 16, init: () => Int32Array.from(iv), compress: sha512Compress, out: (st) => Int32Array.from(st) });
    return Array.from(h.update(utf8('SHA-512/256')).digest());
  })();
  const sha512_256 = sha512With(IV512_256, 32);

  /* ---------- Keccak-f[1600], SHA-3 and Keccak-256 ---------- */
  const RC = new Int32Array(48);
  (function () {
    let R = 1;
    for (let ir = 0; ir < 24; ir++) {
      let hi = 0, lo = 0;
      for (let j = 0; j < 7; j++) {
        if (R & 1) { const bit = (1 << j) - 1; if (bit < 32) lo |= 1 << bit; else hi |= 1 << (bit - 32); }
        R = (R << 1) ^ ((R & 0x80) ? 0x171 : 0);
        R &= 0xff;
      }
      RC[2 * ir] = hi; RC[2 * ir + 1] = lo;
    }
  })();
  const ROT = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
  const PI = new Int32Array(25);                       // lane x+5y moves to y+5((2x+3y) mod 5)
  for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) PI[x + 5 * y] = y + 5 * ((2 * x + 3 * y) % 5);
  const kC = new Int32Array(10), kB = new Int32Array(50);
  function keccakF(A) {                                 // A: 25 lanes as [hi, lo] pairs
    const C = kC, B = kB;
    for (let r = 0; r < 24; r++) {
      for (let x = 0; x < 5; x++) {
        C[2 * x] = A[2 * x] ^ A[2 * x + 10] ^ A[2 * x + 20] ^ A[2 * x + 30] ^ A[2 * x + 40];
        C[2 * x + 1] = A[2 * x + 1] ^ A[2 * x + 11] ^ A[2 * x + 21] ^ A[2 * x + 31] ^ A[2 * x + 41];
      }
      for (let x = 0; x < 5; x++) {
        const p = (x + 4) % 5, q = (x + 1) % 5;
        const qh = C[2 * q], ql = C[2 * q + 1];
        const dh = C[2 * p] ^ ((qh << 1) | (ql >>> 31)), dl = C[2 * p + 1] ^ ((ql << 1) | (qh >>> 31));
        for (let y = 0; y < 25; y += 5) { A[2 * (x + y)] ^= dh; A[2 * (x + y) + 1] ^= dl; }
      }
      for (let i = 0; i < 25; i++) {
        const h = A[2 * i], l = A[2 * i + 1], n = ROT[i], j = PI[i];
        let rh, rl;
        if (n === 0) { rh = h; rl = l; }
        else if (n < 32) { rh = (h << n) | (l >>> (32 - n)); rl = (l << n) | (h >>> (32 - n)); }
        else if (n === 32) { rh = l; rl = h; }
        else { const m = n - 32; rh = (l << m) | (h >>> (32 - m)); rl = (h << m) | (l >>> (32 - m)); }
        B[2 * j] = rh; B[2 * j + 1] = rl;
      }
      for (let y = 0; y < 25; y += 5) {
        for (let x = 0; x < 5; x++) {
          const i = x + y, i1 = ((x + 1) % 5) + y, i2 = ((x + 2) % 5) + y;
          A[2 * i] = B[2 * i] ^ (~B[2 * i1] & B[2 * i2]);
          A[2 * i + 1] = B[2 * i + 1] ^ (~B[2 * i1 + 1] & B[2 * i2 + 1]);
        }
      }
      A[0] ^= RC[2 * r]; A[1] ^= RC[2 * r + 1];
    }
  }
  function keccak(outLen, domain) {
    const rate = 200 - 2 * outLen;
    const A = new Int32Array(50);
    const buf = new Uint8Array(rate);
    let pos = 0, done = false;
    const absorb = (d, o) => {
      for (let i = 0; i < rate; i += 8) {
        const lane = i >> 3;
        A[2 * lane + 1] ^= d[o + i] | (d[o + i + 1] << 8) | (d[o + i + 2] << 16) | (d[o + i + 3] << 24);
        A[2 * lane] ^= d[o + i + 4] | (d[o + i + 5] << 8) | (d[o + i + 6] << 16) | (d[o + i + 7] << 24);
      }
      keccakF(A);
    };
    return {
      blockSize: rate,
      update(data) {
        if (done) throw new Error('digest() was already called');
        let i = 0;
        const n = data.length;
        if (pos) {
          const take = Math.min(rate - pos, n);
          buf.set(data.subarray(0, take), pos);
          pos += take; i = take;
          if (pos === rate) { absorb(buf, 0); pos = 0; }
        }
        for (; n - i >= rate; i += rate) absorb(data, i);
        if (i < n) { buf.set(data.subarray(i), 0); pos = n - i; }
        return this;
      },
      digest() {
        done = true;
        buf.fill(0, pos);
        buf[pos] ^= domain;
        buf[rate - 1] ^= 0x80;
        absorb(buf, 0);
        const out = new Uint8Array(outLen);
        for (let i = 0; i < outLen; i++) {
          const lane = i >> 3, b = i & 7;
          const w = b < 4 ? A[2 * lane + 1] : A[2 * lane];
          out[i] = (w >>> (8 * (b & 3))) & 255;
        }
        return out;
      }
    };
  }

  /* ---------- CRC-32 (ISO-HDLC, as in ZIP and PNG) ---------- */
  function crc() {
    let c = -1;
    return {
      update(d) { for (let i = 0; i < d.length; i++) c = CRC_TABLE[(c ^ d[i]) & 255] ^ (c >>> 8); return this; },
      digest() { const v = (c ^ -1) >>> 0; return Uint8Array.of(v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); }
    };
  }

  /* ---------- the algorithms, in the order they are listed ---------- */
  const ALGOS = [
    { id: 'sha256', name: 'SHA-256', make: sha256, bits: 256 },
    { id: 'sha1', name: 'SHA-1', make: sha1, bits: 160, weak: true },
    { id: 'md5', name: 'MD5', make: md5, bits: 128, weak: true },
    { id: 'crc32', name: 'CRC32', make: crc, bits: 32, noHmac: true },
    { id: 'sha224', name: 'SHA-224', make: sha224, bits: 224 },
    { id: 'sha384', name: 'SHA-384', make: sha384, bits: 384 },
    { id: 'sha512', name: 'SHA-512', make: sha512, bits: 512 },
    { id: 'sha512_256', name: 'SHA-512/256', make: sha512_256, bits: 256 },
    { id: 'sha3_224', name: 'SHA3-224', make: () => keccak(28, 0x06), bits: 224 },
    { id: 'sha3_256', name: 'SHA3-256', make: () => keccak(32, 0x06), bits: 256 },
    { id: 'sha3_384', name: 'SHA3-384', make: () => keccak(48, 0x06), bits: 384 },
    { id: 'sha3_512', name: 'SHA3-512', make: () => keccak(64, 0x06), bits: 512 },
    { id: 'keccak256', name: 'Keccak-256', make: () => keccak(32, 0x01), bits: 256 }
  ];
  const BY_ID = {};
  ALGOS.forEach((a) => { BY_ID[a.id] = a; });
  const GROUPS = {
    all: ['sha256', 'sha1', 'md5', 'crc32'],
    sha2: ['sha224', 'sha256', 'sha384', 'sha512', 'sha512_256'],
    sha3: ['sha3_224', 'sha3_256', 'sha3_384', 'sha3_512', 'keccak256'],
    every: ALGOS.map((a) => a.id)
  };
  const chosen = (show) => GROUPS[show] || (BY_ID[show] ? [show] : GROUPS.all);

  /** A streaming hash, or an HMAC (RFC 2104) when a key is given. */
  function create(id, key) {
    const a = BY_ID[id];
    if (!key) return a.make();
    let k = key;
    const probe = a.make();
    const block = probe.blockSize;
    if (k.length > block) k = a.make().update(k).digest();
    const ipad = new Uint8Array(block).fill(0x36), opad = new Uint8Array(block).fill(0x5c);
    for (let i = 0; i < k.length; i++) { ipad[i] ^= k[i]; opad[i] ^= k[i]; }
    const inner = probe.update(ipad);
    return {
      blockSize: block,
      update(d) { inner.update(d); return this; },
      digest() { return a.make().update(opad).update(inner.digest()).digest(); }
    };
  }

  return { ALGOS, BY_ID, GROUPS, chosen, create, utf8, toHex, toB64, fromHex, fromB64 };
})();

/* ---------- reading the text box, the key and the expected value ---------- */

function hgBytes(text, how) {
  if (how === 'hex') return HX.fromHex(text);
  if (how === 'base64') return HX.fromB64(text);
  return HX.utf8(text);
}

function hgKey(o) {
  const k = String(o.key || '');
  if (!k) return null;
  const how = o.keyenc || 'text';
  try { return hgBytes(k, how); }
  catch (e) { throw new Error('The HMAC key is not valid ' + (how === 'hex' ? 'hex' : 'Base64') + ': ' + e.message.replace(/ \(line 1, column (\d+)\)/, ' (character $1)')); }
}

/** The expected value as hex, or as Base64 for a digest written that way. */
function hgExpected(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  // "d7a8…  file.iso" from sha256sum, "SHA256 (file) = d7a8…" from BSD tools, "sha256:d7a8…"
  let m = /^[A-Za-z0-9-]+\s*\([^)]*\)\s*=\s*(\S+)$/.exec(s);
  if (m) s = m[1];
  else s = s.split(/\s+/)[0];
  s = s.replace(/^[a-z0-9-]+:(?=[0-9a-f])/i, '');
  const hexish = s.replace(/[:\s]/g, '');
  if (/^[0-9a-f]+$/i.test(hexish) && hexish.length % 2 === 0) return { hex: hexish.toLowerCase(), b64: null };
  const b = s.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (/^[A-Za-z0-9+/]+$/.test(b)) return { hex: null, b64: b };
  return { bad: true };
}

/** Which of the computed digests the expected value is, if any. */
function hgCompare(expected, digests) {
  const e = hgExpected(expected);
  if (!e) return null;
  if (e.bad) return { ok: false, text: 'The expected value is neither hex nor Base64, so it was not compared.' };
  const hits = [];
  digests.forEach((d) => {
    if (e.hex && HX.toHex(d.bytes) === e.hex) hits.push(d.label);
    if (e.b64 && HX.toB64(d.bytes).replace(/=+$/, '') === e.b64) hits.push(d.label);
  });
  if (hits.length) return { ok: true, names: hits, text: 'Match: the expected value is the ' + hits.join(' and the ') + ' digest.' };
  const len = e.hex ? e.hex.length * 4 : Math.floor(e.b64.length * 6 / 8) * 8;
  const same = HX.ALGOS.filter((a) => a.bits === len).map((a) => a.name);
  return { ok: false, text: 'No match: the expected value is none of the ' + digests.length + ' digests here.' + (same.length ? ' Its length (' + len + ' bits) suits ' + same.join(', ').replace(/, ([^,]*)$/, ' or $1') + '.' : ' No algorithm here has its length (' + len + ' bits).') };
}

/** Digests for one input: bytes for text, or finished hashers for a file. */
function hgResult(o, input) {
  const ids = HX.chosen(o.show || o.algo);
  const key = input.key;
  const fmt = o.case === 'upper' ? (b) => HX.toHex(b).toUpperCase() : o.case === 'base64' ? HX.toB64 : HX.toHex;
  const shown = [], skipped = [];
  ids.forEach((id) => {
    const a = HX.BY_ID[id];
    if (key && a.noHmac) { skipped.push(a.name); return; }
    const bytes = input.digests[id];
    if (!bytes) return;
    shown.push({ id, label: (key ? 'HMAC-' : '') + a.name, bytes, weak: !!a.weak });
  });
  const width = Math.max(0, ...shown.map((d) => d.label.length));
  const output = shown.map((d) => d.label.padEnd(width) + '  ' + fmt(d.bytes)).join('\n');
  /* compare against everything computed, not only what is shown */
  const all = Object.keys(input.digests).filter((id) => !(key && HX.BY_ID[id].noHmac))
    .map((id) => ({ label: (key ? 'HMAC-' : '') + HX.BY_ID[id].name, bytes: input.digests[id] }));
  const cmp = hgCompare(o.expect, all);
  const stats = [['Input length', input.length]];
  if (key) stats.push(['HMAC key', key.length + ' byte' + (key.length === 1 ? '' : 's')]);
  if (input.extra) input.extra.forEach((r) => stats.push(r));
  if (cmp) stats.push(['Compare', cmp.ok ? 'Match: ' + cmp.names.join(', ') : 'No match']);
  const warns = [];
  if (shown.some((d) => d.weak) && !key) warns.push('MD5 and SHA-1 are broken for security purposes — practical collision attacks exist for both. Use them only for non-adversarial checksums.');
  if (skipped.length) warns.push('CRC32 is a checksum, not a hash, and has no HMAC form, so it is left out while a key is set.');
  return { output, stats, warn: warns.join(' '), compare: cmp, digests: shown.map((d) => ({ label: d.label, hex: HX.toHex(d.bytes) })) };
}

function hgTransform(text, o) {
  const raw = String(text || '');
  if (!raw) return { output: '', note: 'Type or paste something above, or open a file.', compare: null };
  const how = o.input || 'text';
  let bytes, key;
  try { bytes = hgBytes(raw, how); }
  catch (e) { return e.at ? { error: e.message, errorAt: e.at } : { error: e.message }; }
  try { key = hgKey(o); } catch (e) { return { error: e.message }; }
  /* all of them, so the comparison can name an algorithm that is not shown */
  const digests = {};
  HX.ALGOS.forEach((a) => {
    if (key && a.noHmac) return;
    digests[a.id] = HX.create(a.id, key).update(bytes).digest();
  });
  const length = how === 'text' ? [...raw].length + ' characters, ' + bytes.length + ' bytes'
    : (how === 'hex' ? 'hex' : 'Base64') + ' read as ' + bytes.length + ' byte' + (bytes.length === 1 ? '' : 's');
  return hgResult(o, { digests, key, length });
}

/* ---------- files: read a slice at a time, with progress and Cancel ---------- */

const HG_SLICE = 4 * 1024 * 1024;     // read from the file at a time
const HG_STEP = 256 * 1024;           // hashed between pauses, so the page keeps responding

function hgHashFile(file, ids, key, onProgress, isCancelled) {
  const hashers = ids.map((id) => [id, HX.create(id, key)]);
  const size = file.size;
  let off = 0;
  /* hash for about 40 ms, then let the page breathe (and Cancel be clicked) */
  let since = Date.now();
  const pause = () => { if (Date.now() - since < 40) return null; return new Promise((r) => setTimeout(r, 0)).then(() => { since = Date.now(); }); };
  return (async function () {
    while (off < size) {
      const end = Math.min(size, off + HG_SLICE);
      const buf = new Uint8Array(await file.slice(off, end).arrayBuffer());
      for (let i = 0; i < buf.length; i += HG_STEP) {
        if (isCancelled()) return null;
        const part = buf.subarray(i, Math.min(buf.length, i + HG_STEP));
        hashers.forEach((h) => h[1].update(part));
        onProgress(off + i + part.length, size);
        const p = pause();
        if (p) await p;
      }
      off = end;
    }
    const digests = {};
    hashers.forEach((h) => { digests[h[0]] = h[1].digest(); });
    return digests;
  })();
}

window.DEV_TOOLS["hash-generator"] = {
"title": "Hash Generator (SHA-256, SHA-1, MD5, CRC32)",
"kind": "code",
"description": "Hash text, hex, Base64 or a file of any size with SHA-256, SHA-512, SHA-3, MD5, CRC32 and HMAC, and check the result against an expected value. Runs in your browser.",
"keywords": ["hash generator","sha256 generator","sha512 hash","sha3 hash","hmac generator","file checksum","md5 hash","sha1 hash","checksum calculator","crc32"],
"inputLabel": "Text to hash",
"outputLabel": "Hashes",
"placeholder": "Type or paste anything, or open a file…",
"sample": "MVR IT Services",
"files": {"label": "Hash a file"},
"download": {"ext": "txt", "type": "text/plain", "suffix": "-hashes"},
"filename": "hashes.txt",
/* the key is a secret: never in a link, never kept on the device (see mount) */
"share": ["algo", "case", "input", "keyenc", "expect"],
"options": [
  {"key":"algo","label":"Show","type":"select","default":"all","options":[
    {"value":"all","label":"Common four (SHA-256, SHA-1, MD5, CRC32)"},
    {"value":"sha2","label":"SHA-2 family"},
    {"value":"sha3","label":"SHA-3 family and Keccak-256"},
    {"value":"every","label":"All 13 algorithms"},
    {"value":"md5","label":"MD5 only"},{"value":"sha1","label":"SHA-1 only"},
    {"value":"sha224","label":"SHA-224 only"},{"value":"sha256","label":"SHA-256 only"},
    {"value":"sha384","label":"SHA-384 only"},{"value":"sha512","label":"SHA-512 only"},
    {"value":"sha512_256","label":"SHA-512/256 only"},
    {"value":"sha3_224","label":"SHA3-224 only"},{"value":"sha3_256","label":"SHA3-256 only"},
    {"value":"sha3_384","label":"SHA3-384 only"},{"value":"sha3_512","label":"SHA3-512 only"},
    {"value":"keccak256","label":"Keccak-256 only"},{"value":"crc32","label":"CRC32 only"}]},
  {"key":"input","label":"Read the text as","type":"select","default":"text","options":[{"value":"text","label":"Text (UTF-8)"},{"value":"hex","label":"Hex bytes"},{"value":"base64","label":"Base64 bytes"}]},
  {"key":"case","label":"Output","type":"select","default":"lower","options":[{"value":"lower","label":"hex, lowercase"},{"value":"upper","label":"HEX, UPPERCASE"},{"value":"base64","label":"Base64"}]},
  {"key":"key","label":"HMAC key (optional)","type":"text","default":""},
  {"key":"keyenc","label":"Key is","type":"select","default":"text","options":[{"value":"text","label":"Text (UTF-8)"},{"value":"hex","label":"Hex"},{"value":"base64","label":"Base64"}]},
  {"key":"expect","label":"Expected hash (optional)","type":"text","default":""}
],
"transform": hgTransform,
"openFile": function (file, ctx) {
  return hgOpen(file, ctx);
},
"mount": function (ctx) { hgMount(ctx); },
"render": function (res, ctx) { hgRender(res, ctx); },
"tips": [
  "SHA-256 is the right default. MD5 and SHA-1 are included because file checksums still use them widely, not because they are safe.",
  "Hash a file of any size: it is read 4 MB at a time and never uploaded, with progress and a Cancel button. Paste the published checksum into Expected hash to check a download.",
  "Expected hash accepts hex in either case, Base64, a sha256sum line or a BSD-style SHA256 (file) = … line, and names the algorithm that matches.",
  "An HMAC key turns every digest into an HMAC, as webhook signatures use. The key never goes into a share link and is not kept on this device.",
  "Hashing is not encryption. It is one-way — there is no way to recover the input, and no tool that claims to \"decrypt\" a hash is doing anything but looking it up in a table.",
  "Never hash a password with a plain hash function. Passwords need a slow, salted algorithm such as Argon2, bcrypt or scrypt, and that belongs on your server."
],
"faq": [
  {"q":"Why is the same text always the same hash?","a":"That is the point — a hash is deterministic. It is what makes checksums useful for verifying a download arrived intact. It is also why unsalted password hashes are weak: identical passwords produce identical hashes."},
  {"q":"Can I hash a file?","a":"Yes. Choose Hash a file or drop it on the text box. It is read in 4 MB slices on your device, so even a disk image of several gigabytes works, and nothing is uploaded. Paste the checksum the publisher gives into Expected hash to check it."},
  {"q":"What is the difference between SHA-3 and Keccak-256?","a":"They use the same permutation but pad the last block differently, so their digests differ. Ethereum adopted Keccak-256 before SHA-3 was finalised; most other standards mean SHA3-256."}
]
};

/* ---------- the page side: files, the verdict, the key kept off the device ---------- */

function hgMount(ctx) {
  const st = { file: null, digests: null, key: null, ids: null, painting: false, busy: null };
  ctx.hg = st;
  /* The shell keeps the settings on the device; the key and the expected
     value are not settings, so they are taken out before anything is saved. */
  const set = ctx.store.set;
  ctx.store.set = function (k, v) {
    if (k === 'opts' && v && typeof v === 'object') { v = Object.assign({}, v); delete v.key; delete v.expect; }
    return set.call(ctx.store, k, v);
  };
  set.call(ctx.store, 'opts', (function () { const o = ctx.store.get('opts'); if (!o) return o; const c = Object.assign({}, o); delete c.key; delete c.expect; return c; })());
  const keyBox = ctx.optBar.querySelector('#f-key');
  if (keyBox) { keyBox.autocomplete = 'off'; keyBox.spellcheck = false; keyBox.setAttribute('autocapitalize', 'off'); }
  const exp = ctx.optBar.querySelector('#f-expect');
  if (exp) { exp.autocomplete = 'off'; exp.spellcheck = false; exp.placeholder = 'Paste a checksum to compare'; }
  /* typing, Clear or Load example leave the file behind */
  const bar = ctx.el('div', 'dev-bar hg-file');
  bar.hidden = true;
  const barText = ctx.el('span');
  const close = ctx.el('button', 'btn-ghost', 'Close file');
  close.type = 'button';
  bar.appendChild(barText);
  bar.appendChild(close);
  const head = ctx.inputPane.querySelector('.io-head');
  ctx.inputPane.insertBefore(bar, head ? head.nextSibling : ctx.inputPane.firstChild);
  st.bar = function (text) { bar.hidden = !text; barText.textContent = text || ''; };
  const leave = function () {
    if (st.busy) { st.busy.cancel(); st.busy = null; }
    if (st.file) { st.file = null; st.digests = null; ctx.openedName = null; }
    st.bar('');
  };
  close.addEventListener('click', function () { leave(); ctx.run(); ctx.input.focus(); });
  ctx.input.addEventListener('input', leave);
  ctx.inputTools.addEventListener('click', function (e) {
    const b = e.target.closest && e.target.closest('button');
    if (b && /^(Clear|Load example)$/.test(b.textContent)) leave();
  }, true);
  const v = ctx.el('div', 'hg-verdict');
  v.setAttribute('role', 'status');
  v.hidden = true;
  ctx.outputPane.insertBefore(v, ctx.output);
  st.verdict = v;
}

function hgOpen(file, ctx) {
  const st = ctx.hg;
  if (st.busy) st.busy.cancel();
  if (ctx.input.value) { st.file = null; ctx.setText(''); }
  st.file = file;
  st.digests = null;
  ctx.openedName = file.name;
  return hgHashOpened(ctx);
}

function hgHashOpened(ctx) {
  const st = ctx.hg, file = st.file, o = ctx.opts();
  let key;
  try { key = hgKey(o); } catch (e) { ctx.show({ error: e.message }); return Promise.resolve(); }
  const ids = HX.chosen(o.algo).filter((id) => !(key && HX.BY_ID[id].noHmac));
  let cancelled = false;
  const t0 = Date.now();
  const job = { cancel: function () { cancelled = true; bar.done(); } };   // bar is set below, before any cancel can come
  st.busy = job;
  st.bar(file.name + ' (' + ctx.fmtSize(file.size) + ') is being read on this device; nothing is uploaded.');
  const label = (n, size) => 'Hashing ' + file.name + ': ' + Math.floor(n / Math.max(1, size) * 100) + '% (' + ctx.fmtSize(n) + ' of ' + ctx.fmtSize(size) + ')';
  const bar = ctx.busy(label(0, file.size), function () {
    cancelled = true;
    bar.done();
    st.busy = null;
    st.file = null;
    ctx.openedName = null;
    st.bar('');
    ctx.message('warn', 'Stopped hashing ' + file.name + '. Open it again to start over.');
  });
  let last = 0;
  return hgHashFile(file, ids, key, function (n, size) {
    const now = Date.now();
    if (now - last > 100) { last = now; bar.update(label(n, size)); }
  }, function () { return cancelled; }).then(function (digests) {
    if (cancelled || !digests) return;
    bar.done();
    st.busy = null;
    st.digests = digests;
    st.key = o.key || '';
    st.keyenc = o.keyenc;
    st.ids = ids;
    st.secs = (Date.now() - t0) / 1000;
    st.bar(file.name + ' (' + ctx.fmtSize(file.size) + ') was hashed on this device. Change the options to see other digests of it.');
    hgShowFile(ctx);
  }, function (e) {
    bar.done();
    st.busy = null;
    st.file = null;
    st.bar('');
    ctx.show({ error: file.name + ' could not be read: ' + ((e && e.message) || 'unknown error') + '.' });
  });
}

function hgFileResult(ctx) {
  const st = ctx.hg, o = ctx.opts();
  let key = null;
  try { key = hgKey(o); } catch (e) { return { error: e.message }; }
  const secs = st.secs;
  const rate = secs > 0.05 ? ' (' + ctx.fmtSize(Math.round(st.file.size / secs)) + '/s)' : '';
  const res = hgResult(o, {
    digests: st.digests, key,
    length: st.file.name + ', ' + st.file.size.toLocaleString('en-GB') + ' bytes',
    extra: [['Read in', (secs < 1 ? secs.toFixed(2) : secs.toFixed(1)) + ' s' + rate]]
  });
  res.fromFile = true;
  return res;
}

function hgShowFile(ctx) {
  const st = ctx.hg;
  st.painting = true;
  try { ctx.show(hgFileResult(ctx)); } finally { st.painting = false; }
}

function hgRender(res, ctx) {
  const st = ctx.hg;
  if (!st) return;
  /* a file is open and the box is empty: an option changed, so the file's
     digests are shown again for it, or the file is read again when the new
     option needs digests that were not made (a new key, more algorithms) */
  if (st.file && !res.fromFile && !st.painting && !ctx.input.value) {
    if (st.busy) return;
    const o = ctx.opts();
    let need = false;
    try {
      const key = hgKey(o);
      const ids = HX.chosen(o.algo).filter((id) => !(key && HX.BY_ID[id].noHmac));
      need = !st.digests || (o.key || '') !== st.key || o.keyenc !== st.keyenc || ids.some((id) => !st.digests[id]);
    } catch (e) { need = false; }
    if (need) { hgHashOpened(ctx); return; }
    hgShowFile(ctx);
    return;
  }
  const v = st.verdict;
  const cmp = res && res.compare;
  if (!cmp || res.error) { v.hidden = true; v.textContent = ''; return; }
  v.hidden = false;
  v.className = 'hg-verdict ' + (cmp.ok ? 'is-ok' : 'is-bad');
  v.textContent = (cmp.ok ? '✓ ' : '✗ ') + cmp.text;
}

/* for build/tests/w3-d.js */
window.DEV_TOOLS["hash-generator"]._hx = HX;
window.DEV_TOOLS["hash-generator"]._hashFile = hgHashFile;
})();
