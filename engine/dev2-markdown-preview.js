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
window.DEV_TOOLS["markdown-preview"] = (function () {
'use strict';

/* ============================================================
   The converter, extended (wave 3): task lists, footnotes, reference
   links and maths, on top of the shared markdownToHtml above, which stays
   as it was because the other dev2 engines carry the same copy. For the
   syntax both handle, the HTML written is the same, byte for byte.
   It also returns `rich`: the same HTML with data-line="n" on each block,
   the Markdown line it came from, for the preview's scroll sync.
   ============================================================ */
function mdConvert(md, opt) {
  opt = opt || {};
  const useMath = opt.math !== false;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const norm = (s) => String(s).trim().replace(/\s+/g, ' ').toLowerCase();
  const slug = (s) => String(s).replace(/[^\w-]/g, '_').slice(0, 60);
  const blocks = [];
  let mathCount = 0;
  // \u0000 to \u0003 mark the pieces lifted out below, so none may come in
  let src = String(md).replace(/[\u0000-\u0003]/g, '').replace(/\r\n?/g, '\n');

  /* A lifted block keeps its line count, so the lines after it are still
     numbered as in the source: the placeholder is followed by as many line
     breaks as the block held, when the block sits on lines of its own. */
  const lift = (whole, offset, all, html) => {
    blocks.push(html);
    const own = (offset === 0 || all.charAt(offset - 1) === '\n') && /^(\n|$)/.test(all.slice(offset + whole.length, offset + whole.length + 1));
    return '\u0000BLOCK' + (blocks.length - 1) + '\u0000' + (own ? '\n'.repeat((whole.match(/\n/g) || []).length) : '');
  };
  src = src.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code, off, all) =>
    lift(m, off, all, `<pre><code${lang ? ` class="language-${lang}"` : ''}>${esc(code.replace(/\n$/, ''))}</code></pre>`));
  if (useMath) {
    src = src.replace(/^\$\$[ \t]*\n([\s\S]*?)\n[ \t]*\$\$[ \t]*$/gm, (m, tex, off, all) => {
      mathCount++;
      return lift(m, off, all, '<div class="math display">\\[' + esc(tex) + '\\]</div>');
    });
  }

  /* Reference definitions, [label]: address "title", and footnotes,
     [^id]: text (with lines indented under it), are taken out of the flow;
     each line they held becomes a blank one. */
  const refs = Object.create(null);
  const fnDefs = Object.create(null);
  {
    const L = src.split('\n');
    for (let k = 0; k < L.length; k++) {
      let m = /^ {0,3}\[\^([^\]\s]+)\]:[ \t]?(.*)$/.exec(L[k]);
      if (m) {
        const parts = [m[2]];
        L[k] = '';
        while (k + 1 < L.length && /^(?: {2,}|\t)\S/.test(L[k + 1])) { parts.push(L[k + 1].trim()); L[++k] = ''; }
        if (!(m[1] in fnDefs)) fnDefs[m[1]] = parts.join(' ').trim();
        continue;
      }
      m = /^ {0,3}\[([^\]^][^\]]*)\]:[ \t]*<?([^\s<>]+)>?(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*$/.exec(L[k]);
      if (m) { const key = norm(m[1]); if (!(key in refs)) refs[key] = m[2]; L[k] = ''; }
    }
    src = L.join('\n');
  }
  const fnOrder = [], fnNum = Object.create(null), fnSeen = Object.create(null);

  const LINK_URL = '\\(\\s*((?:[^()\\s]|\\([^()\\s]*\\))+)(?:\\s+[^)]*)?\\)';
  const IMG_RE = new RegExp('!\\[([^\\]]*)\\]' + LINK_URL, 'g');
  const LINK_RE = new RegExp('\\[([^\\]]+)\\]' + LINK_URL, 'g');
  const MATH_RE = /(?<!\\)\$\$([^$]+?)\$\$|(?<!\\)\$(?=[^\s$])([^$\n]*?[^\s$\\])\$(?!\d)/g;
  const inline = (s) => {
    const kept = [];
    const keep = (html) => '\u0001' + (kept.push(html) - 1) + '\u0002';
    let t = esc(s).replace(/`([^`]+)`/g, (m, code) => keep('<code>' + code + '</code>'));
    if (useMath) {
      t = t.replace(MATH_RE, (m, d, i) => {
        mathCount++;
        return keep(d !== undefined ? '<span class="math display">\\[' + d + '\\]</span>' : '<span class="math inline">\\(' + i + '\\)</span>');
      });
    }
    t = t.replace(/\[\^([^\]\s]+)\]/g, (m, id) => {
      const raw = unesc(id);
      if (!(raw in fnDefs)) return m;
      if (!(raw in fnNum)) { fnOrder.push(raw); fnNum[raw] = fnOrder.length; }
      const first = !fnSeen[raw];
      fnSeen[raw] = true;
      return keep('<sup class="footnote-ref"><a href="#fn-' + slug(raw) + '"' + (first ? ' id="fnref-' + slug(raw) + '"' : '') + '>' + fnNum[raw] + '</a></sup>');
    });
    const img = (alt, url) => { const u = mdSafeUrl(url, true); return u === null ? alt : keep('<img src="' + attr(u) + '" alt="' + attr(unesc(alt)) + '">'); };
    const link = (text, url) => { const u = mdSafeUrl(url, false); return u === null ? text : keep('<a href="' + attr(u) + '" rel="noopener noreferrer">') + text + keep('</a>'); };
    const ref = (label) => refs[norm(unesc(label))];
    t = t
      .replace(IMG_RE, (m, alt, url) => img(alt, unesc(url)))
      .replace(LINK_RE, (m, text, url) => link(text, unesc(url)))
      .replace(/!\[([^\]]*)\]\[([^\]]*)\]/g, (m, alt, label) => { const r = ref(label || alt); return r === undefined ? m : img(alt, r); })
      .replace(/\[([^\]]+)\]\[([^\]]*)\]/g, (m, text, label) => { const r = ref(label || text); return r === undefined ? m : link(text, r); })
      .replace(/!\[([^\]]+)\](?![(\[:])/g, (m, alt) => { const r = ref(alt); return r === undefined ? m : img(alt, r); })
      .replace(/\[([^\]]+)\](?![(\[:])/g, (m, text) => { const r = ref(text); return r === undefined ? m : link(text, r); })
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/(^|\s)__([^_]+)__/g, '$1<strong>$2</strong>');
    return t.replace(/\u0001(\d+)\u0002/g, (m, i) => kept[Number(i)]);
  };

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
  const out = [], at = [];
  const push = (h, ln) => { out.push(h); at.push(ln || 0); };
  let inList = null, inQuote = false, para = [], paraLine = 0;
  let tasks = 0, done = 0;

  const flushPara = () => {
    if (para.length) { push(`<p>${inline(para.join(' '))}</p>`, paraLine); para = []; }
  };
  const closeList = () => { if (inList) { push(`</${inList}>`); inList = null; } };
  const closeQuote = () => { if (inQuote) { push('</blockquote>'); inQuote = false; } };
  const item = (body, ln) => {
    const tm = /^\[([ xX])\]\s+(.*)$/.exec(body);
    if (!tm) { push(`<li>${inline(body)}</li>`, ln); return; }
    tasks++;
    if (tm[1] !== ' ') done++;
    push(`<li class="task-list-item"><input type="checkbox"${tm[1] !== ' ' ? ' checked' : ''} disabled> ${inline(tm[2])}</li>`, ln);
  };

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].replace(/\s+$/, '');
    const ln = li + 1;

    if (/^\u0000BLOCK\d+\u0000$/.test(line.trim())) {
      flushPara(); closeList(); closeQuote();
      push(line.trim(), ln);
      continue;
    }
    if (!line.trim()) { flushPara(); closeList(); closeQuote(); continue; }

    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      flushPara(); closeList(); closeQuote();
      push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`, ln);
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushPara(); closeList(); closeQuote();
      push('<hr>', ln);
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flushPara(); closeList();
      if (!inQuote) { push('<blockquote>', ln); inQuote = true; }
      push(`<p>${inline(m[1])}</p>`, ln);
    } else if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) {
      flushPara(); closeQuote();
      if (inList !== 'ul') { closeList(); push('<ul>'); inList = 'ul'; }
      item(m[1], ln);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara(); closeQuote();
      if (inList !== 'ol') { closeList(); push('<ol>'); inList = 'ol'; }
      item(m[1], ln);
    } else {
      closeList(); closeQuote();
      const table = tableHead(line, lines[li + 1]);
      if (table) {
        flushPara();
        const rows = [];
        for (li += 2; li < lines.length && !startsBlock(lines[li].replace(/\s+$/, '')); li++) rows.push(splitRow(lines[li]));
        li--;
        push(tableHtml(table, rows), ln);
        continue;
      }
      if (!para.length) paraLine = ln;
      para.push(line.trim());
    }
  }
  flushPara(); closeList(); closeQuote();

  /* the footnotes, numbered in the order they are first referred to */
  if (fnOrder.length) {
    const items = [];
    for (let k = 0; k < fnOrder.length; k++) {
      const id = fnOrder[k];
      items.push('<li id="fn-' + slug(id) + '">' + inline(fnDefs[id]) + ' <a href="#fnref-' + slug(id) + '" class="footnote-backref">↩</a></li>');
    }
    push('<section class="footnotes">\n<ol>\n' + items.join('\n') + '\n</ol>\n</section>');
  }

  const fill = (h) => h.replace(/\u0000BLOCK(\d+)\u0000/g, (m, i) => blocks[Number(i)]);
  return {
    html: out.map(fill).join('\n'),
    rich: out.map((h, k) => { h = fill(h); return at[k] ? h.replace(/^<([a-z][a-z0-9]*)/, '<$1 data-line="' + at[k] + '"') : h; }).join('\n'),
    tasks: tasks, done: done, footnotes: fnOrder.length, math: mathCount
  };
}

/* ============================================================
   Code colours for the preview and the styled export: a small scanner per
   language family that cuts the code into [class, text] runs. The runs
   joined are the code exactly; nothing is ever parsed as HTML.
   ============================================================ */
const KW = {
  js: 'break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new of return super switch this throw try typeof var void while with yield async await static get set null undefined true false NaN Infinity from as',
  py: 'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield self match case',
  sh: 'if then else elif fi for while until do done case esac function in return local export exit set unset readonly shift source echo cd',
  sql: 'select from where and or not insert into values update set delete create table alter drop index join left right inner outer full cross on as group by order having limit offset distinct union all null is in like between case when then else end primary key foreign references default exists count sum avg min max asc desc with view',
  c: 'auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while class public private protected new delete this true false null nullptr namespace using template typename try catch throw import package interface extends implements final abstract boolean byte string var val func go defer chan map range type fn let mut impl trait pub use mod match self loop where async await fun object override when is in readonly'
};
KW.ts = KW.js + ' interface type enum implements namespace declare readonly private public protected abstract keyof any number string boolean never unknown';
const LANG = {
  js: { kw: 'js', line: '//', block: true, q: '"\'`' }, ts: { kw: 'ts', line: '//', block: true, q: '"\'`' },
  py: { kw: 'py', line: '#', q: '"\'', triple: true }, sh: { kw: 'sh', line: '#', q: '"\'', vars: true },
  sql: { kw: 'sql', line: '--', block: true, q: '\'"', ci: true }, c: { kw: 'c', line: '//', block: true, q: '"\'`' }
};
const ALIAS = {
  javascript: 'js', jsx: 'js', mjs: 'js', cjs: 'js', node: 'js', typescript: 'ts', tsx: 'ts', python: 'py', py3: 'py',
  bash: 'sh', shell: 'sh', zsh: 'sh', console: 'sh', shellscript: 'sh', postgres: 'sql', mysql: 'sql', sqlite: 'sql', plsql: 'sql',
  java: 'c', cpp: 'c', 'c++': 'c', h: 'c', cs: 'c', csharp: 'c', go: 'c', golang: 'c', rust: 'c', rs: 'c', php: 'c', swift: 'c', kotlin: 'c', kt: 'c', scala: 'c', dart: 'c'
};
const SHELL_LANGS = { json: 'json', html: 'html', xml: 'xml', svg: 'xml', css: 'css', scss: 'css', yaml: 'yaml', yml: 'yaml', md: 'md', markdown: 'md', regex: 'regex' };
const kwSets = {};
function codeRuns(lang, s) {
  const id = LANG[lang] ? lang : ALIAS[lang];
  const L = LANG[id];
  if (!L) return null;
  const set = kwSets[id] || (kwSets[id] = new Set(KW[L.kw].split(' ')));
  const out = [];
  const n = s.length;
  let i = 0, plain = '';
  const flush = () => { if (plain) { out.push([null, plain]); plain = ''; } };
  const put = (c, t) => { flush(); out.push([c, t]); };
  while (i < n) {
    const ch = s[i];
    if (L.block && s.startsWith('/*', i)) { let j = s.indexOf('*/', i + 2); j = j < 0 ? n : j + 2; put('com', s.slice(i, j)); i = j; continue; }
    if (s.startsWith(L.line, i) && !(L.line === '#' && id === 'sh' && i > 0 && /[\w$]/.test(s[i - 1]))) { let j = s.indexOf('\n', i); if (j < 0) j = n; put('com', s.slice(i, j)); i = j; continue; }
    if (L.q.indexOf(ch) >= 0) {
      const tq = L.triple && s.startsWith(ch + ch + ch, i);
      const close = tq ? ch + ch + ch : ch;
      let j = i + close.length;
      while (j < n) {
        if (s[j] === '\\' && !(id === 'sql')) { j += 2; continue; }
        if (s.startsWith(close, j)) { j += close.length; break; }
        if (!tq && ch !== '`' && s[j] === '\n') break;
        j++;
      }
      put('str', s.slice(i, Math.min(j, n)));
      i = Math.min(j, n);
      continue;
    }
    if (L.vars && ch === '$') { const m = /^\$(\{[^}\n]*\}|[A-Za-z_]\w*|[0-9#?@*$!-])/.exec(s.slice(i, i + 200)); if (m) { put('attr', m[0]); i += m[0].length; continue; } }
    if (/[0-9]/.test(ch) && !(i > 0 && /[\w$]/.test(s[i - 1]))) {
      const m = /^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|\d[\d_]*(\.\d+)?([eE][+-]?\d+)?)[a-zA-Z]*/.exec(s.slice(i, i + 80));
      put('num', m[0]); i += m[0].length; continue;
    }
    if (/[A-Za-z_$@]/.test(ch)) {
      const m = /^[A-Za-z_$@][\w$]*/.exec(s.slice(i, i + 200));
      const w = m[0];
      if (set.has(L.ci ? w.toLowerCase() : w)) put('kw', w);
      else if (s[i + w.length] === '(') put('key', w);
      else plain += w;
      i += w.length;
      continue;
    }
    if (/[{}()[\];,.:=+\-*/%<>!&|^~?]/.test(ch)) { put('punc', ch); i++; continue; }
    plain += ch;
    i++;
  }
  flush();
  return out;
}

/* ============================================================
   The page: preview beside the Markdown, scroll sync, outline, export
   ============================================================ */
let UI = null;

/* The rich HTML is parsed into an inert document and rebuilt here with
   createElement, keeping only the tags this converter writes and these
   attributes: a block's data-line, a checked link address, a footnote's
   id, a code block's language class, a cell's alignment, and a task box
   (always disabled). Pictures are labelled boxes and never fetched. */
const KEEP = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'em', 'strong', 'b', 'i', 'del', 's', 'hr', 'br',
  'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'sup', 'section', 'input', 'span', 'div']);
const DROP = new Set(['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'template', 'noscript', 'svg', 'math', 'link', 'meta', 'base',
  'title', 'head', 'form', 'button', 'textarea', 'select', 'option', 'audio', 'video', 'source', 'track', 'canvas', 'portal', 'xmp', 'plaintext', 'noembed', 'noframes']);
const CLASSES = { li: ['task-list-item'], sup: ['footnote-ref'], section: ['footnotes'], a: ['footnote-backref'], span: ['math inline', 'math display'], div: ['math display'] };
function safeHref(h, forExport) {
  if (/^#fn(ref)?-[\w-]+$/.test(h)) return { local: h.slice(1) };
  try {
    const u = new URL(String(h), location.href);
    if (['http:', 'https:', 'mailto:', 'tel:'].indexOf(u.protocol) < 0) return null;
    return { href: forExport && !/^[a-z][a-z0-9+.-]*:/i.test(h) ? h : u.href };
  } catch (e) { return null; }
}
function build(html, forExport) {
  const frag = document.createDocumentFragment();
  let doc;
  try { doc = new DOMParser().parseFromString('<!DOCTYPE html><body>' + String(html || ''), 'text/html'); } catch (e) { return frag; }
  (function copy(from, to) {
    Array.prototype.forEach.call(from.childNodes, function (n) {
      if (n.nodeType === 3) { to.appendChild(document.createTextNode(n.nodeValue)); return; }
      if (n.nodeType !== 1) return;
      const tag = n.localName;
      if (DROP.has(tag)) return;
      if (!KEEP.has(tag)) { copy(n, to); return; }
      if (tag === 'img') {
        const alt = n.getAttribute('alt') || '';
        const src = n.getAttribute('src') || '';
        if (forExport) {
          const ok = safeHref(src, true);
          if (ok && ok.href && /^(https?:|[^:]*$)/i.test(src)) { const im = document.createElement('img'); im.src = ok.href; im.alt = alt; to.appendChild(im); }
          else to.appendChild(document.createTextNode(alt));
          return;
        }
        const box = document.createElement('span');
        box.className = 'md-img';
        box.textContent = 'Image: ' + (alt || 'no description') + ' (not loaded in the preview)';
        if (src) box.title = src;
        to.appendChild(box);
        return;
      }
      if (tag === 'input') {
        if ((n.getAttribute('type') || '').toLowerCase() !== 'checkbox') return;
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.disabled = true;
        box.checked = n.hasAttribute('checked');
        if (box.checked) box.setAttribute('checked', '');
        box.setAttribute('disabled', '');
        box.setAttribute('aria-label', box.checked ? 'Done' : 'Not done');
        to.appendChild(box);
        return;
      }
      const out = document.createElement(tag);
      const line = n.getAttribute('data-line');
      if (!forExport && line && /^\d{1,7}$/.test(line)) out.setAttribute('data-line', line);
      const cls = n.getAttribute('class') || '';
      if (tag === 'code' && /^language-[\w+-]+$/.test(cls)) out.className = cls;
      else if (CLASSES[tag] && CLASSES[tag].indexOf(cls) >= 0) out.className = cls;
      const id = n.getAttribute('id') || '';
      if ((tag === 'li' || tag === 'a') && /^fn(ref)?-[\w-]+$/.test(id)) out.id = forExport ? id : 'mdp-' + id;
      if (tag === 'a') {
        const h = safeHref(n.getAttribute('href') || '', forExport);
        if (h && h.local) out.setAttribute('href', '#' + (forExport ? h.local : 'mdp-' + h.local));
        else if (h) {
          out.setAttribute('href', h.href);
          if (!forExport) { out.target = '_blank'; out.referrerPolicy = 'no-referrer'; }
          out.rel = 'noopener noreferrer nofollow';
        }
      } else if (tag === 'th' || tag === 'td') {
        const al = /^text-align:(left|center|right)$/.exec(n.getAttribute('style') || '');
        if (al) out.style.textAlign = al[1];
      }
      copy(n, out);
      to.appendChild(out);
    });
  })(doc.body, frag);
  return frag;
}

/* colour every fenced block that names a language */
function colourCode(root, ctx) {
  root.querySelectorAll('pre > code[class^="language-"]').forEach(function (code) {
    const lang = code.className.slice(9).toLowerCase();
    const text = code.textContent;
    if (text.length > 200000) return;
    let frag = null;
    if (SHELL_LANGS[lang] && ctx && ctx.highlight) frag = ctx.highlight(SHELL_LANGS[lang], text);
    else {
      const runs = codeRuns(lang, text);
      if (runs && runs.map(function (r) { return r[1]; }).join('') === text) {
        frag = document.createDocumentFragment();
        runs.forEach(function (r) {
          if (!r[0]) { frag.appendChild(document.createTextNode(r[1])); return; }
          const sp = document.createElement('span');
          sp.className = 'hl-' + r[0];
          sp.textContent = r[1];
          frag.appendChild(sp);
        });
      }
    }
    if (frag) { code.textContent = ''; code.appendChild(frag); }
  });
}

/* maths: the vendored Temml (MIT) writes MathML; loaded the first time a
   formula appears, from this site only */
let temmlState = 0;   // 0 not asked, 1 loading, 2 ready, 3 failed
const temmlWaiters = [];
function withTemml(fn) {
  if (temmlState === 2) { fn(); return; }
  if (temmlState === 3) return;
  temmlWaiters.push(fn);
  if (temmlState === 1) return;
  temmlState = 1;
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = (window.__BASE__ || '/') + 'engine/vendor/temml/temml-local.css';
  document.head.appendChild(css);
  const sc = document.createElement('script');
  sc.src = (window.__BASE__ || '/') + 'engine/vendor/temml/temml.min.js';
  sc.onload = function () { temmlState = window.temml ? 2 : 3; if (temmlState === 2) temmlWaiters.splice(0).forEach(function (f) { f(); }); };
  sc.onerror = function () { temmlState = 3; };
  document.head.appendChild(sc);
}
function typeset(root, then) {
  const spans = root.querySelectorAll('.math');
  if (!spans.length) { if (then) then(); return; }
  withTemml(function () {
    spans.forEach(function (sp) {
      if (sp.getAttribute('data-done')) return;
      const t = sp.textContent;
      const display = /^\\\[[\s\S]*\\\]$/.test(t);
      const tex = t.replace(/^\\[([]/, '').replace(/\\[)\]]$/, '');
      const holder = document.createElement(sp.localName);
      holder.className = sp.className;
      holder.setAttribute('data-done', '1');
      try {
        window.temml.render(tex, holder, { displayMode: display, throwOnError: true, trust: false });
      } catch (e) {
        holder.textContent = t;
        holder.classList.add('mdp-math-err');
        holder.title = 'Not shown as maths: ' + String((e && e.message) || e).slice(0, 200);
      }
      sp.replaceWith(holder);
    });
    if (then) then();
  });
}

const EXPORT_CSS = [
  'body{margin:0 auto;max-width:46rem;padding:2rem 1.25rem 4rem;font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1d2330;background:#fff}',
  'h1,h2,h3,h4,h5,h6{line-height:1.25;margin:1.6em 0 .6em}h1{font-size:2em}h2{font-size:1.5em;border-bottom:1px solid #d8dde6;padding-bottom:.3em}h3{font-size:1.25em}',
  'p,ul,ol,blockquote,table,pre{margin:0 0 1em}a{color:#0b5cad}img{max-width:100%}',
  'blockquote{margin-left:0;padding-left:1em;border-left:4px solid #d8dde6;color:#4a5266}',
  'code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em;background:#f2f4f8;padding:.1em .3em;border-radius:4px}',
  'pre{padding:1em;overflow:auto;background:#f6f8fa;border:1px solid #e1e5ec;border-radius:6px}pre code{background:none;padding:0}',
  'table{border-collapse:collapse}th,td{border:1px solid #c5ccd8;padding:6px 12px;text-align:left;vertical-align:top}th{background:#f2f4f8}',
  'hr{border:0;border-top:1px solid #d8dde6;margin:2em 0}li.task-list-item{list-style:none}li.task-list-item input{margin:0 .5em 0 -1.3em}',
  '.footnotes{font-size:.9em;border-top:1px solid #d8dde6;margin-top:2em;padding-top:1em}.footnote-backref{text-decoration:none}',
  'div.math,span.math.display{display:block;margin:1em 0;overflow-x:auto}math{font-family:"Cambria Math","STIX Two Math","Latin Modern Math",math}',
  '.hl-kw{color:#b0245a}.hl-str{color:#1d7a2c}.hl-num{color:#9a5b00}.hl-com{color:#6b7385;font-style:italic}.hl-key{color:#0b5cad}.hl-tag{color:#0b6f8f}',
  '.hl-attr{color:#8a4b00}.hl-punc{color:#4a5266}.hl-ent{color:#7a33b8}.hl-meta{color:#6b7385}',
  '@media print{body{max-width:none;padding:0}pre{white-space:pre-wrap}a{color:inherit}}'
].join('\n');

function firstHeading(root) { const h = root.querySelector('h1,h2'); return h ? h.textContent.trim().slice(0, 120) : ''; }

function mount(ctx) {
  const el = ctx.el;
  UI = { ctx: ctx, mode: ctx.store.get('mdView') === 'html' ? 'html' : 'preview', sync: ctx.store.get('mdSync') !== false, lock: 0 };
  /* the shell's own sanitised preview pane is kept (it is what the
     hostile-HTML tests read) but out of sight: this view replaces it */
  const shellPane = ctx.io.querySelector('.io-preview');
  if (shellPane) shellPane.hidden = true;

  const view = el('div', 'mdp-view');
  view.tabIndex = 0;
  view.setAttribute('role', 'document');
  view.setAttribute('aria-label', 'Rendered preview');
  ctx.output.parentNode.insertBefore(view, ctx.output.nextSibling);
  UI.view = view;
  const label = ctx.outputPane.querySelector('.io-label');
  UI.label = label;

  const seg = el('div', 'mdp-seg');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Show the rendered preview or the HTML');
  const bPrev = el('button', 'btn-ghost', 'Preview');
  const bHtml = el('button', 'btn-ghost', 'HTML');
  [bPrev, bHtml].forEach(function (b) { b.type = 'button'; seg.appendChild(b); });
  ctx.outputTools.insertBefore(seg, ctx.outputTools.firstChild);
  function setMode(m, save) {
    UI.mode = m;
    bPrev.setAttribute('aria-pressed', String(m === 'preview'));
    bHtml.setAttribute('aria-pressed', String(m === 'html'));
    view.hidden = m !== 'preview';
    ctx.output.hidden = m === 'preview';
    ctx.outputPane.classList.toggle('mdp-is-preview', m === 'preview');
    if (label) label.textContent = m === 'preview' ? 'Preview' : 'HTML';
    if (save) ctx.store.set('mdView', m);
  }
  bPrev.addEventListener('click', function () { setMode('preview', true); });
  bHtml.addEventListener('click', function () { setMode('html', true); });
  setMode(UI.mode, false);
  UI.setMode = setMode;

  /* in-page links (footnotes) move within the preview */
  view.addEventListener('click', function (e) {
    const a = e.target.closest && e.target.closest('a[href^="#mdp-"]');
    if (!a) return;
    e.preventDefault();
    const t = view.querySelector('#' + CSS.escape(a.getAttribute('href').slice(1)));
    if (t) { view.scrollTop += t.getBoundingClientRect().top - view.getBoundingClientRect().top - 12; t.focus && t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  });

  /* scroll sync, both ways: the text box's top line <-> the block it made */
  const ta = ctx.input;
  const lineH = function () { return parseFloat(getComputedStyle(ta).lineHeight) || 20; };
  const padT = function () { return parseFloat(getComputedStyle(ta).paddingTop) || 0; };
  function marks() { return Array.prototype.slice.call(view.querySelectorAll('[data-line]')); }
  function viewTopOf(node) { return node.getBoundingClientRect().top - view.getBoundingClientRect().top + view.scrollTop; }
  ta.addEventListener('scroll', function () {
    if (!UI.sync || UI.mode !== 'preview' || Date.now() < UI.lock) return;
    const line = (ta.scrollTop - padT()) / lineH() + 1;
    const ms = marks();
    if (!ms.length) return;
    let a = null, b = null;
    for (let k = 0; k < ms.length; k++) { const n = Number(ms[k].getAttribute('data-line')); if (n <= line) a = ms[k]; else { b = ms[k]; break; } }
    let y;
    if (!a) y = 0;
    else {
      const la = Number(a.getAttribute('data-line')), ya = viewTopOf(a);
      if (b) { const lb = Number(b.getAttribute('data-line')), yb = viewTopOf(b); y = ya + (yb - ya) * (line - la) / Math.max(1, lb - la); }
      else y = ya + (line - la) * lineH();
    }
    if (ta.scrollTop + ta.clientHeight >= ta.scrollHeight - 2) y = view.scrollHeight;
    UI.lock = Date.now() + 120;
    view.scrollTop = y;
  });
  view.addEventListener('scroll', function () {
    if (!UI.sync || Date.now() < UI.lock) return;
    const ms = marks();
    if (!ms.length) return;
    const top = view.scrollTop;
    let a = null, b = null;
    for (let k = 0; k < ms.length; k++) { if (viewTopOf(ms[k]) <= top + 1) a = ms[k]; else { b = ms[k]; break; } }
    let line;
    if (!a) line = 1;
    else {
      const la = Number(a.getAttribute('data-line')), ya = viewTopOf(a);
      if (b) { const lb = Number(b.getAttribute('data-line')), yb = viewTopOf(b); line = la + (lb - la) * (top - ya) / Math.max(1, yb - ya); }
      else line = la;
    }
    UI.lock = Date.now() + 120;
    ta.scrollTop = view.scrollTop + view.clientHeight >= view.scrollHeight - 2 ? ta.scrollHeight : (line - 1) * lineH();
  });

  /* under the panes: export, print, sync and the outline */
  const box = el('div', 'mdp-extra');
  const bar = el('div', 'mdp-bar');
  const exp = el('button', 'btn-ghost', 'Export styled .html');
  exp.type = 'button';
  const prn = el('button', 'btn-ghost', 'Print or save as PDF');
  prn.type = 'button';
  const syncLab = el('label', 'mdp-sync');
  const syncBox = el('input');
  syncBox.type = 'checkbox';
  syncBox.checked = UI.sync;
  syncLab.appendChild(syncBox);
  syncLab.appendChild(el('span', null, 'Scroll the preview with the text'));
  syncBox.addEventListener('change', function () { UI.sync = syncBox.checked; ctx.store.set('mdSync', syncBox.checked ? null : false); });
  bar.appendChild(exp);
  bar.appendChild(prn);
  bar.appendChild(syncLab);
  box.appendChild(bar);
  const msg = el('p', 'mdp-msg');
  msg.setAttribute('role', 'status');
  box.appendChild(msg);
  const nav = el('nav', 'mdp-outline');
  nav.setAttribute('aria-labelledby', 'mdp-outline-h');
  const h = el('h3', null, 'Outline');
  h.id = 'mdp-outline-h';
  nav.appendChild(h);
  const list = el('ol');
  nav.appendChild(list);
  box.appendChild(nav);
  ctx.extra.appendChild(box);
  UI.outline = list;
  UI.msg = msg;

  function exportDoc(then) {
    const res = ctx.result || {};
    if (!res.rich) { msg.textContent = 'There is nothing to export yet.'; return; }
    const holder = document.createElement('div');
    holder.appendChild(build(res.rich, true));
    colourCode(holder, ctx);
    typeset(holder, function () {
      const title = firstHeading(holder) || (ctx.openedName ? ctx.openedName.replace(/\.[^.]+$/, '') : 'Document');
      const t = document.createElement('title');
      t.textContent = title;
      const doc = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
        t.outerHTML + '\n<style>\n' + EXPORT_CSS + '\n</style>\n</head>\n<body>\n' + holder.innerHTML + '\n</body>\n</html>\n';
      then(doc, title);
    });
  }
  UI.exportDoc = exportDoc;
  exp.addEventListener('click', function () {
    exportDoc(function (doc, title) {
      const blob = new Blob([doc], { type: 'text/html' });
      const base = ctx.openedName ? ctx.openedName.replace(/\.[^.]+$/, '') : (title.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'markdown');
      ctx.saveBlob(blob, base + (blob.type === 'text/html' ? '.html' : '.txt'));
      msg.textContent = 'Saved ' + base + '.html (' + ctx.fmtSize(blob.size) + '), with its styles inside it.';
    });
  });
  /* printing: the rendered document alone, in a block of its own that the
     print styles show while hiding the rest of the page */
  prn.addEventListener('click', function () {
    const res = ctx.result || {};
    if (!res.rich) { msg.textContent = 'There is nothing to print yet.'; return; }
    const out = document.createElement('div');
    out.className = 'mdp-printout';
    out.appendChild(build(res.rich, true));
    colourCode(out, ctx);
    document.body.appendChild(out);
    typeset(out, function () {
      document.documentElement.classList.add('mdp-print');
      let ended = false;
      const done = function () {
        if (ended) return;
        ended = true;
        document.documentElement.classList.remove('mdp-print');
        out.remove();
        window.removeEventListener('afterprint', done);
      };
      window.addEventListener('afterprint', done);
      window.print();
      setTimeout(done, 1000);
    });
  });
}

function paintOutline(ctx) {
  const list = UI.outline;
  list.textContent = '';
  const hs = UI.view.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (!hs.length) { list.appendChild(ctx.el('li', 'mdp-none', 'Headings appear here as you write them.')); return; }
  Array.prototype.forEach.call(hs, function (hd) {
    const li = ctx.el('li');
    li.style.setProperty('--mdp-lv', String(Number(hd.localName.charAt(1)) - 1));
    const b = ctx.el('button', 'mdp-jump', hd.textContent || '(empty heading)');
    b.type = 'button';
    b.addEventListener('click', function () {
      const line = Number(hd.getAttribute('data-line')) || 1;
      const ta = ctx.input;
      const lines = ta.value.split('\n');
      const pos = lines.slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0);
      UI.lock = Date.now() + 300;
      if (UI.mode !== 'preview') UI.setMode('preview', true);
      UI.view.scrollTop += hd.getBoundingClientRect().top - UI.view.getBoundingClientRect().top - 8;
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(pos, pos + (lines[line - 1] || '').length);
      ta.scrollTop = Math.max(0, (line - 1) * (parseFloat(getComputedStyle(ta).lineHeight) || 20) - 8);
    });
    li.appendChild(b);
    list.appendChild(li);
  });
}

function render(res, ctx) {
  if (!UI) return;
  const view = UI.view;
  const keep = view.scrollTop;
  view.textContent = '';
  UI.msg.textContent = '';
  if (res.rich) {
    view.appendChild(build(res.rich, false));
    colourCode(view, ctx);
    typeset(view);
    view.scrollTop = keep;
  }
  paintOutline(ctx);
}

return {
"title": "Markdown to HTML Converter",
"kind": "code",
"files": {"accept": ".md,.markdown,.mdown,.txt,text/markdown,text/plain", "label": "Open file"},
"download": {"ext": "html", "type": "text/html"},
"highlight": "html",
"description": "Convert Markdown to clean HTML with a live preview beside it: tables, task lists, footnotes, reference links, coloured code and maths, with a styled .html export and print to PDF.",
"keywords": ["markdown to html","markdown converter","markdown preview","md to html","markdown editor","markdown to pdf"],
"inputLabel": "Markdown",
"outputLabel": "HTML",
"livePreview": true,
"placeholder": "# Heading\n\nSome **bold** text and a [link](https://example.com).",
"sample": "# 1234Tools\n\nOver a thousand **free** tools, and all but the AI ones run in your *browser*.\n\n## Features\n\n- No sign-up for the calculators\n- Most tools work offline\n- Files stay on your device outside the AI tools\n\n> Each tool page says what, if anything, it sends.\n\n```js\nconst total = 1000;\n```\n\n1. First\n2. Second\n\n---\n\nSee the [guides](https://www.1234tools.com/guides/).",
"options": [{"key":"wrap","label":"Output","type":"select","default":"fragment","options":[{"value":"fragment","label":"HTML fragment"},{"value":"document","label":"Full HTML document"}]},{"key":"math","label":"Maths between $ signs","type":"check","default":"yes"}],
"mount": mount,
"render": render,
"convert": mdConvert,
"codeRuns": codeRuns,
"transform": (text, o) => {
      const md = String(text || '');
      if (!md.trim()) return { output: '', note: 'Type or paste some Markdown above.' };

      let r;
      try { r = mdConvert(md, { math: o.math !== 'no' }); }
      catch (e) { return { error: 'Could not convert that Markdown: ' + e.message }; }
      let html = r.html;
      // the Preview pane shows the body alone, through the page's sanitiser
      const fragment = html;

      if (o.wrap === 'document') {
        html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n` +
               `<meta name="viewport" content="width=device-width,initial-scale=1">\n` +
               `<title>Document</title>\n</head>\n<body>\n${html}\n</body>\n</html>`;
      }

      const count = (re) => (html.match(re) || []).length;
      const stats = [
        ['Markdown in', `${md.length.toLocaleString('en-GB')} characters`],
        ['HTML out', `${html.length.toLocaleString('en-GB')} characters`],
        ['Headings', String(count(/<h[1-6]>/g))],
        ['Paragraphs', String(count(/<p>/g))],
        ['Links', String(count(/<a href="(?!#fn)/g))],
        ['Code blocks', String(count(/<pre>/g))],
        ['Lists', String(count(/<[uo]l>/g) - (r.footnotes ? 1 : 0))],
        ['Tables', String(count(/<table>/g))]
      ];
      if (r.tasks) stats.push(['Task items', `${r.done} of ${r.tasks} done`]);
      if (r.footnotes) stats.push(['Footnotes', String(r.footnotes)]);
      if (r.math) stats.push(['Maths', r.math + (r.math === 1 ? ' formula' : ' formulas')]);
      return { output: html, preview: fragment, rich: r.rich, stats };
    },
"tips": ["Supported: headings, bold, italic, strikethrough, inline code, fenced code blocks, links, images, blockquotes, ordered and unordered lists, horizontal rules, GitHub-style pipe tables, task lists, footnotes, reference links and maths.","A table is a header row of cells between pipes, then a row of --- under it. Write :---, :---: or ---: to align a column left, centre or right, and \\| for a pipe inside a cell.","Write - [ ] for an open task and - [x] for a done one; [^1] in the text with a line [^1]: … anywhere below makes a numbered footnote; [text][ref] with a line [ref]: https://… is a reference link.","Maths goes between dollar signs: $E = mc^2$ inline, or $$ on lines of its own around a display formula. The opening $ must touch the formula, so prices such as $5 and $10 stay as text. Switch it off under Maths between $ signs.","HTML characters in your Markdown are escaped rather than passed through. That is deliberate — it means pasting untrusted Markdown cannot inject markup.","Links keep only http, https, mailto and tel addresses or relative ones, and images only http and https. Anything else, such as a javascript: address, is written as plain text.","The Preview shows the result beside your Markdown and scrolls with it; code in a fence that names its language, such as ```js or ```python, is coloured. Images are shown as a labelled box rather than fetched, so nothing leaves your device.","Export styled .html saves one file with its styles inside it; Print or save as PDF prints the rendered document alone, without the page around it.","Fenced code blocks are extracted before anything else runs, so asterisks and underscores inside them stay literal."],
"faq": [{"q":"Why is my raw HTML escaped instead of rendered?","a":"Because passing HTML through unchanged is how Markdown converters become an injection vector. Everything is escaped, which is the safe default for a tool that people paste other people’s text into."},{"q":"How are maths formulas drawn?","a":"The HTML marks each formula the way Pandoc does, as \\(…\\) inside a span with the class math, which MathJax and KaTeX pick up. The preview, the styled export and the printout draw them as MathML with Temml, an MIT-licensed library kept on this site and loaded only when a formula appears."}]
};
})();
})();
