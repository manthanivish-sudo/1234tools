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
window.DEV_TOOLS["regex-tester"] = (function () {
'use strict';

/* ---------------- flags ----------------
   Any of JavaScript's eight flags, in any combination the browser takes.
   They are put in the order RegExp.prototype.flags uses (dgimsuvy), each
   once, so gi and ig are the same setting. */
const FLAG_ORDER = 'dgimsuvy';
const FLAG_INFO = {
  g: ['global', 'Global: every match, not only the first.'],
  i: ['ignore case', 'Ignore case: A and a match each other.'],
  m: ['multiline', 'Multiline: ^ and $ match at the start and end of every line.'],
  s: ['dot all', 'Dot all: . matches line breaks too.'],
  u: ['unicode', 'Unicode: the pattern reads code points, and allows \\p{…} and \\u{…}.'],
  v: ['unicode sets', 'Unicode sets: everything u does, plus nested classes, -- and && inside [ ], and \\q{…}.'],
  y: ['sticky', 'Sticky: each match must start exactly where the last one ended.'],
  d: ['indices', 'Indices: each match records where every group starts and ends.']
};
function normFlags(f) {
  const s = String(f == null ? '' : f).replace(/\s+/g, '');
  const bad = s.replace(/[dgimsuvy]/g, '');
  if (bad) return { error: 'Unknown flag "' + Array.from(bad)[0] + '". JavaScript has d, g, i, m, s, u, v and y.' };
  if (s.indexOf('u') >= 0 && s.indexOf('v') >= 0) return { error: 'The u and v flags cannot be used together: v already does everything u does.' };
  let out = '';
  for (const c of FLAG_ORDER) if (s.indexOf(c) >= 0) out += c;
  return { flags: out };
}

/* ---------------- the pattern explained ----------------
   A small parser of JavaScript's pattern syntax, written for this page: it
   builds a tree of alternatives, groups, classes, escapes and quantifiers,
   and says in words what each part matches. RegExp itself decides whether
   a pattern is valid; this parser's own complaints are only used to point
   at the spot when RegExp refuses one. */
function rxParse(src, flags) {
  const uni = /[uv]/.test(flags), vmode = flags.indexOf('v') >= 0;
  let i = 0, groupNo = 0, err = null;
  const groups = [];
  const fail = (msg, at) => { if (!err) err = { msg: msg, at: at }; };
  const QUANT = /^\{(\d+)(,(\d*))?\}/;

  function parseAlt(depth) {
    const s = i;
    const alts = [];
    let as = i;
    alts.push({ items: parseSeq(depth), s: as, e: i });
    while (src[i] === '|') { i++; as = i; alts.push({ items: parseSeq(depth), s: as, e: i }); }
    return { k: 'alt', alts: alts, s: s, e: i };
  }
  function parseSeq(depth) {
    const items = [];
    while (i < src.length && src[i] !== '|' && !(src[i] === ')' && depth > 0)) {
      if (src[i] === ')') { fail('this ) has no ( to close', i); items.push({ k: 'bad', s: i, e: i + 1 }); i++; continue; }
      const atom = parseAtom(depth);
      parseQuant(atom);
      items.push(atom);
    }
    return items;
  }
  function parseAtom(depth) {
    const s = i, c = src[i];
    if (c === '(') return parseGroup(depth);
    if (c === '[') return parseClass();
    if (c === '.') { i++; return { k: 'dot', s: s, e: i }; }
    if (c === '^' || c === '$') { i++; return { k: 'anchor', ch: c, s: s, e: i }; }
    if (c === '\\') return parseEscape(false);
    if (c === '*' || c === '+' || c === '?') { i++; fail('there is nothing before this ' + c + ' to repeat', s); return { k: 'bad', s: s, e: i }; }
    const q = c === '{' ? QUANT.exec(src.slice(i)) : null;
    if (q) { i += q[0].length; fail('there is nothing before this ' + q[0] + ' to repeat', s); return { k: 'bad', s: s, e: i }; }
    if (uni && (c === '{' || c === '}' || c === ']')) fail('a bare ' + c + ' must be escaped as \\' + c + ' with the ' + (vmode ? 'v' : 'u') + ' flag', s);
    const ch = uni ? String.fromCodePoint(src.codePointAt(i)) : c;
    i += ch.length;
    return { k: 'lit', ch: ch, s: s, e: i };
  }
  function parseGroup(depth) {
    const s = i;
    i++;
    let kind = 'cap', name = null, mods = null, m;
    if (src[i] === '?') {
      const rest = src.slice(i);
      if (rest.startsWith('?:')) { kind = 'nc'; i += 2; }
      else if (rest.startsWith('?=')) { kind = 'la'; i += 2; }
      else if (rest.startsWith('?!')) { kind = 'nla'; i += 2; }
      else if (rest.startsWith('?<=')) { kind = 'lb'; i += 3; }
      else if (rest.startsWith('?<!')) { kind = 'nlb'; i += 3; }
      else if ((m = /^\?<([^>]*)>/.exec(rest))) {
        kind = 'named'; name = m[1]; i += m[0].length;
        if (!/^[\p{ID_Start}$_][\p{ID_Continue}$‌‍]*$/u.test(name)) fail('"' + name + '" is not a valid group name', s);
      } else if ((m = /^\?([ims]*)(?:-([ims]*))?:/.exec(rest)) && (m[1] || m[2])) {
        kind = 'mod'; mods = { on: m[1], off: m[2] || '' }; i += m[0].length;
      } else { fail('(? must be followed by :, =, !, <=, <!, <name> or flags', s); kind = 'nc'; i += 1; }
    }
    let num = 0;
    if (kind === 'cap' || kind === 'named') { num = ++groupNo; groups.push({ num: num, name: name }); }
    const open = i;
    const body = parseAlt(depth + 1);
    if (src[i] === ')') i++; else fail('this ( is never closed', s);
    return { k: 'group', kind: kind, name: name, num: num, mods: mods, body: body, open: open, s: s, e: i };
  }
  function parseEscape(inClass) {
    const s = i;
    i++;
    const c = src[i];
    if (c === undefined) { fail('a \\ at the end escapes nothing', s); return { k: 'bad', s: s, e: i }; }
    const rest = src.slice(i);
    let m;
    const done = (node, len) => { i += len; node.s = s; node.e = i; return node; };
    if ('dDwWsS'.indexOf(c) >= 0) return done({ k: 'cls', ch: c }, 1);
    if (!inClass && (c === 'b' || c === 'B')) return done({ k: 'anchor', ch: '\\' + c }, 1);
    if (inClass && c === 'b') return done({ k: 'lit', ch: '\b', named: 'a backspace character' }, 1);
    if (c === 'k' && (m = /^k<([^>]*)>/.exec(rest))) return done({ k: 'bref', name: m[1] }, m[0].length);
    if (!inClass && (m = /^[1-9]\d*/.exec(rest))) return done({ k: 'bref', num: Number(m[0]) }, m[0].length);
    if (c === '0' && !/^0\d/.test(rest)) return done({ k: 'lit', ch: '\0', named: 'the null character' }, 1);
    if ((c === 'p' || c === 'P') && uni && (m = /^[pP]\{([^}]*)\}/.exec(rest))) return done({ k: 'prop', neg: c === 'P', prop: m[1] }, m[0].length);
    if ((m = /^x([0-9a-fA-F]{2})/.exec(rest))) return done({ k: 'lit', ch: String.fromCharCode(parseInt(m[1], 16)), code: true }, 3);
    if (uni && (m = /^u\{([0-9a-fA-F]+)\}/.exec(rest))) {
      const n = parseInt(m[1], 16);
      if (n > 0x10ffff) fail('\\u{' + m[1] + '} is beyond the last Unicode code point', s);
      return done({ k: 'lit', ch: String.fromCodePoint(Math.min(n, 0x10ffff)), code: true }, m[0].length);
    }
    if ((m = /^u([0-9a-fA-F]{4})/.exec(rest))) return done({ k: 'lit', ch: String.fromCharCode(parseInt(m[1], 16)), code: true }, 5);
    if ((m = /^c([A-Za-z])/.exec(rest))) return done({ k: 'lit', ch: String.fromCharCode(m[1].toUpperCase().charCodeAt(0) - 64), named: 'the control character Ctrl+' + m[1].toUpperCase() }, 2);
    const NAMED = { t: ['\t', 'a tab'], n: ['\n', 'a line feed (new line)'], r: ['\r', 'a carriage return'], v: ['\v', 'a vertical tab'], f: ['\f', 'a form feed'] };
    if (NAMED[c]) return done({ k: 'lit', ch: NAMED[c][0], named: NAMED[c][1] }, 1);
    if (vmode && inClass && (m = /^q\{([^}]*)\}/.exec(rest))) return done({ k: 'qstr', strs: m[1].split('|') }, m[0].length);
    const ch = uni ? String.fromCodePoint(src.codePointAt(i)) : c;
    if (uni && !/[\^$\\.*+?()[\]{}|\/-]/.test(ch) && !(vmode && /[&!#%,:;<=>@`~]/.test(ch))) fail('\\' + ch + ' is not a valid escape with the ' + (vmode ? 'v' : 'u') + ' flag', s);
    return done({ k: 'lit', ch: ch, escaped: true }, ch.length);
  }
  function classAtom() {
    const s = i;
    if (src[i] === '\\') return parseEscape(true);
    const ch = uni ? String.fromCodePoint(src.codePointAt(i)) : src[i];
    i += ch.length;
    return { k: 'lit', ch: ch, s: s, e: i };
  }
  function parseClass() {
    const s = i;
    i++;
    let neg = false;
    if (src[i] === '^') { neg = true; i++; }
    const items = [];
    while (i < src.length && src[i] !== ']') {
      if (vmode && src[i] === '[') { items.push(parseClass()); continue; }
      if (vmode && (src.startsWith('--', i) || src.startsWith('&&', i))) { items.push({ k: 'op', op: src.substr(i, 2), s: i, e: i + 2 }); i += 2; continue; }
      const a = classAtom();
      if (src[i] === '-' && i + 1 < src.length && src[i + 1] !== ']' && !(vmode && src[i + 1] === '-')) {
        const dash = i;
        i++;
        const b = classAtom();
        if (a.k === 'lit' && b.k === 'lit') {
          if (b.ch.codePointAt(0) < a.ch.codePointAt(0)) fail('the range ' + src.slice(a.s, b.e) + ' runs backwards', a.s);
          items.push({ k: 'range', a: a, b: b, s: a.s, e: b.e });
        } else {
          if (uni) fail('a class escape such as \\d cannot end a range with the ' + (vmode ? 'v' : 'u') + ' flag', a.s);
          items.push(a, { k: 'lit', ch: '-', s: dash, e: dash + 1 }, b);
        }
        continue;
      }
      items.push(a);
    }
    if (src[i] === ']') i++; else fail('this [ is never closed', s);
    return { k: 'class', neg: neg, items: items, s: s, e: i };
  }
  function parseQuant(atom) {
    const s = i, c = src[i];
    let min, max, m;
    if (c === '*') { min = 0; max = Infinity; i++; }
    else if (c === '+') { min = 1; max = Infinity; i++; }
    else if (c === '?') { min = 0; max = 1; i++; }
    else if (c === '{' && (m = QUANT.exec(src.slice(i)))) {
      min = Number(m[1]); max = m[2] ? (m[3] === '' ? Infinity : Number(m[3])) : min; i += m[0].length;
      if (max < min) fail(m[0] + ' has its numbers the wrong way round', s);
    } else return;
    let lazy = false;
    if (src[i] === '?') { lazy = true; i++; }
    if (atom.k === 'anchor' || (atom.k === 'group' && (atom.kind === 'lb' || atom.kind === 'nlb'))) fail('this cannot be repeated', s);
    atom.q = { min: min, max: max, lazy: lazy, s: s, e: i };
    atom.e = i;
  }

  const tree = parseAlt(0);
  if (i < src.length && !err) fail('unexpected ' + src[i], i);
  return { tree: tree, groups: groups, error: err };
}

const show = (ch) => {
  if (ch === ' ') return 'a space';
  const cp = ch.codePointAt(0);
  if (cp < 32 || cp === 127) return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
  return '“' + ch + '”';
};
const CLS = {
  d: 'a digit, 0 to 9', D: 'any character except a digit',
  w: 'a word character: A–Z, a–z, 0–9 or _', W: 'any character except a word character',
  s: 'a whitespace character: space, tab, line break and the like', S: 'any character except whitespace'
};
const PROPS = {
  L: 'a letter', Letter: 'a letter', Lu: 'an upper-case letter', Uppercase_Letter: 'an upper-case letter', Ll: 'a lower-case letter', Lowercase_Letter: 'a lower-case letter',
  N: 'a number character', Nd: 'a decimal digit in any script', P: 'a punctuation mark', S: 'a symbol', Sc: 'a currency symbol', Z: 'a separator', M: 'a combining mark',
  Emoji: 'an emoji character', Emoji_Presentation: 'a character shown as an emoji by default', Extended_Pictographic: 'a pictographic character (emoji and the like)',
  RGI_Emoji: 'a whole emoji, sequences included', White_Space: 'a whitespace character', Alphabetic: 'an alphabetic character', ASCII: 'an ASCII character', Any: 'any code point'
};
function propText(p) {
  if (PROPS[p]) return PROPS[p];
  const m = /^(?:Script|sc|Script_Extensions|scx)=(\w+)$/.exec(p);
  if (m) return 'a character of the ' + m[1].replace(/_/g, ' ') + ' script';
  return 'a character with the Unicode property ' + p;
}
function qText(q) {
  if (!q) return '';
  let t;
  if (q.min === 0 && q.max === Infinity) t = 'zero or more times';
  else if (q.min === 1 && q.max === Infinity) t = 'one or more times';
  else if (q.min === 0 && q.max === 1) t = 'optional (zero or one time)';
  else if (q.max === Infinity) t = q.min + ' or more times';
  else if (q.min === q.max) t = 'exactly ' + q.min + (q.min === 1 ? ' time' : ' times');
  else t = 'between ' + q.min + ' and ' + q.max + ' times';
  return t + (q.min === q.max ? '' : q.lazy ? ', as few as possible (lazy)' : ', as many as possible (greedy)');
}
function classItemText(it) {
  if (it.k === 'range') return it.a.named ? it.a.named + ' to ' + (it.b.named || show(it.b.ch)) : show(it.a.ch) + ' to ' + show(it.b.ch);
  if (it.k === 'lit') return it.named || show(it.ch);
  if (it.k === 'cls') return CLS[it.ch];
  if (it.k === 'prop') return (it.neg ? 'not ' : '') + propText(it.prop);
  if (it.k === 'qstr') return 'one of the strings ' + it.strs.map((x) => '“' + x + '”').join(', ');
  if (it.k === 'op') return it.op === '--' ? 'minus' : 'and also in';
  if (it.k === 'class') return (it.neg ? 'not one of [' : 'one of [') + it.items.map(classItemText).join(', ') + ']';
  return '?';
}

/** rows of { d: depth, tok: the source, txt: what it matches } */
function explainRows(src, flags, parsed) {
  const rows = [];
  const total = parsed.groups.length;
  const ic = flags.indexOf('i') >= 0;
  const named = {};
  parsed.groups.forEach((g) => { if (g.name) named[g.name] = g.num; });
  const add = (d, tok, txt) => rows.push({ d: d, tok: tok, txt: txt.charAt(0).toUpperCase() + txt.slice(1) });
  const withQ = (txt, node) => node.q ? txt + ', ' + qText(node.q) : txt;

  function walkAlt(alt, d) {
    if (alt.alts.length > 1) {
      add(d, '|', 'Either of ' + alt.alts.length + ' alternatives, tried left to right:');
      alt.alts.forEach((a, n) => {
        add(d + 1, src.slice(a.s, a.e) || '(empty)', 'Alternative ' + (n + 1) + (a.items.length ? ':' : ': matches the empty string'));
        walkSeq(a.items, d + 2);
      });
    } else walkSeq(alt.alts[0].items, d);
  }
  function walkSeq(items, d) {
    for (let n = 0; n < items.length; n++) {
      const it = items[n];
      if (it.k === 'lit' && !it.q && !it.named && !it.code) {
        // a run of plain characters reads as one piece of text
        let j = n, text = '';
        while (j < items.length && items[j].k === 'lit' && !items[j].q && !items[j].named && !items[j].code) { text += items[j].ch; j++; }
        if (j - n > 1) {
          add(d, src.slice(it.s, items[j - 1].e), 'The text “' + text + '”' + (ic ? ', in any case' : ''));
          n = j - 1;
          continue;
        }
      }
      node(it, d);
    }
  }
  function node(it, d) {
    const tok = src.slice(it.s, it.e);
    switch (it.k) {
      case 'lit': { const nm = show(it.ch); const base = it.named || (nm.charAt(0) === '“' ? 'the character ' + nm : nm) + (it.code ? ' (by its code)' : ''); add(d, tok, withQ(base + (ic && /[a-z]/i.test(it.ch) ? ', in any case' : ''), it)); break; }
      case 'dot': add(d, tok, withQ(flags.indexOf('s') >= 0 ? 'Any character, line breaks included (s flag)' : 'Any character except a line break', it)); break;
      case 'cls': add(d, tok, withQ(CLS[it.ch].charAt(0).toUpperCase() + CLS[it.ch].slice(1), it)); break;
      case 'prop': add(d, tok, withQ((it.neg ? 'Any character that is not ' : '') + (it.neg ? propText(it.prop) : propText(it.prop).replace(/^a/, 'A')), it)); break;
      case 'anchor': {
        const m = flags.indexOf('m') >= 0;
        const t = it.ch === '^' ? (m ? 'The start of a line (m flag)' : 'The start of the text')
          : it.ch === '$' ? (m ? 'The end of a line (m flag)' : 'The end of the text')
          : it.ch === '\\b' ? 'A word boundary: between a word character and anything else' : 'Not a word boundary';
        add(d, tok, t + (it.q ? ' (an anchor cannot be repeated)' : ''));
        break;
      }
      case 'class': {
        const list = it.items.map(classItemText).join(', ');
        add(d, tok, withQ((it.neg ? 'One character that is none of: ' : 'One character from: ') + (list || 'nothing') + (ic && /[a-z]/i.test(src.slice(it.s, it.e).replace(/\\./g, '')) ? ' (any case)' : ''), it));
        break;
      }
      case 'bref': {
        const n = it.name !== undefined ? named[it.name] : it.num;
        const what = it.name !== undefined ? 'group “' + it.name + '”' : 'group ' + it.num;
        add(d, tok, withQ(n && n <= total ? 'The same text ' + what + ' matched' : 'A reference to ' + what + ', which this pattern does not have', it));
        break;
      }
      case 'group': {
        const head = src.slice(it.s, it.open);
        const tail = it.q ? ')' + src.slice(it.q.s, it.q.e) : ')';
        const T = {
          cap: 'Group ' + it.num + ', captured',
          named: 'Group ' + it.num + ', named “' + it.name + '”, captured',
          nc: 'A group, not captured',
          la: 'Followed by this (lookahead; not part of the match)',
          nla: 'Not followed by this (negative lookahead)',
          lb: 'Preceded by this (lookbehind; not part of the match)',
          nlb: 'Not preceded by this (negative lookbehind)',
          mod: 'A group with ' + (it.mods ? [it.mods.on ? it.mods.on + ' on' : '', it.mods.off ? it.mods.off + ' off' : ''].filter(Boolean).join(' and ') : '') + ' inside it'
        };
        add(d, head + '…' + tail, withQ(T[it.kind], it) + ':');
        walkAlt(it.body, d + 1);
        break;
      }
      case 'bad': add(d, tok, 'Not valid here'); break;
      default: add(d, tok, '');
    }
  }
  walkAlt(parsed.tree, 0);
  return rows;
}

const cut = (s, n) => s === undefined ? null : (s.length > n ? s.slice(0, n) + '…' : s);
/* past an empty match, move on one character: a whole code point under u or v */
function advance(s, at, uni) {
  if (uni && at + 1 < s.length) {
    const c = s.charCodeAt(at);
    if (c >= 0xd800 && c <= 0xdbff) { const d = s.charCodeAt(at + 1); if (d >= 0xdc00 && d <= 0xdfff) return at + 2; }
  }
  return at + 1;
}

const MAX_SPANS = 2000, MAX_ROWS = 500;

/* ---------------- the page: flags, highlighting, panels ---------------- */
let UI = null;

const CHEAT = [
  ['Characters', [['.', 'any character except a line break'], ['\\d', 'a digit'], ['\\w', 'a word character'], ['\\s', 'whitespace'], ['\\D', 'not a digit'], ['\\W', 'not a word character'], ['\\S', 'not whitespace'], ['\\t', 'tab'], ['\\n', 'line feed'], ['\\u00e9', 'é by its code'], ['\\p{L}', 'any letter (u or v flag)']]],
  ['Sets', [['[abc]', 'a, b or c'], ['[^abc]', 'anything but a, b or c'], ['[a-z]', 'a to z'], ['[\\w.-]', 'word character, dot or hyphen']]],
  ['Anchors', [['^', 'start of text (of a line with m)'], ['$', 'end of text (of a line with m)'], ['\\b', 'word boundary'], ['\\B', 'not a word boundary']]],
  ['Repeats', [['*', 'zero or more'], ['+', 'one or more'], ['?', 'optional'], ['{3}', 'exactly 3'], ['{2,}', '2 or more'], ['{2,5}', '2 to 5'], ['*?', 'as few as possible']]],
  ['Groups', [['(…)', 'capture'], ['(?:…)', 'group, no capture'], ['(?<name>…)', 'named capture'], ['\\1', 'same text as group 1'], ['\\k<name>', 'same text as a named group'], ['a|b', 'a or b']]],
  ['Lookaround', [['(?=…)', 'followed by'], ['(?!…)', 'not followed by'], ['(?<=…)', 'preceded by'], ['(?<!…)', 'not preceded by']]],
  ['Replacement', [['$&', 'the whole match'], ['$1', 'group 1'], ['$<name>', 'a named group'], ['$`', 'text before the match'], ["$'", 'text after the match'], ['$$', 'a dollar sign']]]
];

function supportsV() { try { new RegExp('', 'v'); return true; } catch (e) { return false; } }

function mount(ctx) {
  const el = ctx.el;
  const hasV = supportsV();
  UI = { ctx: ctx, cur: -1, res: null };

  /* the flag buttons, beside the Flags box */
  const fIn = ctx.optBar.querySelector('#f-flags');
  const pIn = ctx.optBar.querySelector('#f-pattern');
  if (pIn) { pIn.spellcheck = false; pIn.setAttribute('autocapitalize', 'off'); pIn.setAttribute('autocomplete', 'off'); pIn.classList.add('rx-mono'); pIn.closest('.field').classList.add('rx-wide'); }
  if (fIn) {
    fIn.spellcheck = false; fIn.setAttribute('autocapitalize', 'off'); fIn.setAttribute('autocomplete', 'off'); fIn.classList.add('rx-mono');
    const chips = el('div', 'rx-flags');
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-label', 'Switch flags on or off');
    const btns = {};
    'gimsuvyd'.split('').forEach(function (f) {
      if (f === 'v' && !hasV) return;
      const b = el('button', 'rx-flag', f);
      b.type = 'button';
      b.title = FLAG_INFO[f][1];
      b.setAttribute('aria-label', f + ', ' + FLAG_INFO[f][0]);
      b.addEventListener('click', function () {
        const now = normFlags(fIn.value).flags || fIn.value.replace(/[^dgimsuvy]/g, '');
        let next = now.indexOf(f) >= 0 ? now.replace(f, '') : now + f;
        if (f === 'u') next = next.replace('v', '');
        if (f === 'v') next = next.replace('u', '');
        fIn.value = normFlags(next).flags || next;
        fIn.dispatchEvent(new Event('change', { bubbles: true }));
        sync();
      });
      btns[f] = b;
      chips.appendChild(b);
    });
    const sync = function () {
      Object.keys(btns).forEach(function (f) { btns[f].setAttribute('aria-pressed', String(fIn.value.indexOf(f) >= 0)); });
    };
    UI.syncFlags = sync;
    fIn.addEventListener('input', sync);
    fIn.closest('.field').appendChild(chips);
    fIn.closest('.field').classList.add('rx-flags-field');
    sync();
  }

  /* matches coloured in place: a backdrop under the (transparent) text box */
  const ta = ctx.input;
  const field = ta.parentNode;
  const back = el('div', 'rx-back');
  back.setAttribute('aria-hidden', 'true');
  const inner = el('div', 'rx-back-in');
  back.appendChild(inner);
  field.insertBefore(back, ta);
  field.classList.add('rx-on');
  const metrics = function () {
    const cs = getComputedStyle(ta);
    ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'wordSpacing', 'tabSize',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].forEach(function (k) { inner.style[k] = cs[k]; });
  };
  metrics();
  window.addEventListener('resize', metrics);
  const scroll = function () { inner.style.transform = 'translate(' + (-ta.scrollLeft) + 'px,' + (-ta.scrollTop) + 'px)'; };
  ta.addEventListener('scroll', scroll);
  ta.addEventListener('input', function () { inner.textContent = ''; });
  UI.back = inner; UI.scroll = scroll; UI.metrics = metrics;

  /* the panels under the tool */
  const box = el('div', 'rx-panels');
  const tabs = el('div', 'rx-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Regex tester panels');
  box.appendChild(tabs);
  const panels = {};
  const names = [['matches', 'Matches and groups'], ['explain', 'Explanation'], ['cheat', 'Cheat sheet'], ['saved', 'Saved tests']];
  const tabBtn = {};
  names.forEach(function (n, k) {
    const b = el('button', 'rx-tab', n[1]);
    b.type = 'button';
    b.id = 'rx-tab-' + n[0];
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', 'rx-panel-' + n[0]);
    tabs.appendChild(b);
    tabBtn[n[0]] = b;
    const p = el('div', 'rx-panel');
    p.id = 'rx-panel-' + n[0];
    p.setAttribute('role', 'tabpanel');
    p.setAttribute('aria-labelledby', b.id);
    p.tabIndex = 0;
    panels[n[0]] = p;
    box.appendChild(p);
    b.addEventListener('click', function () { pick(n[0], true); });
    b.addEventListener('keydown', function (e) {
      let j = -1;
      if (e.key === 'ArrowRight') j = (k + 1) % names.length;
      else if (e.key === 'ArrowLeft') j = (k + names.length - 1) % names.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = names.length - 1;
      if (j < 0) return;
      e.preventDefault();
      pick(names[j][0], true);
      tabBtn[names[j][0]].focus();
    });
  });
  function pick(id, save) {
    names.forEach(function (n) {
      const on = n[0] === id;
      tabBtn[n[0]].setAttribute('aria-selected', String(on));
      tabBtn[n[0]].tabIndex = on ? 0 : -1;
      panels[n[0]].hidden = !on;
    });
    if (save) ctx.store.set('tab', id);
  }
  const savedTab = ctx.store.get('tab');
  pick(panels[savedTab] ? savedTab : 'matches', false);
  ctx.extra.appendChild(box);
  UI.panels = panels;

  /* the cheat sheet: press a token to put it in the pattern */
  const cheat = panels.cheat;
  cheat.appendChild(el('p', 'rx-hint', 'Press a token to insert it into the pattern at the cursor.'));
  const grid = el('div', 'rx-cheat');
  CHEAT.forEach(function (sec) {
    const s = el('section', 'rx-cheat-sec');
    s.appendChild(el('h3', null, sec[0]));
    const dl = el('dl');
    sec[1].forEach(function (t) {
      const dt = el('dt');
      const b = el('button', 'rx-token', t[0]);
      b.type = 'button';
      b.setAttribute('aria-label', 'Insert ' + t[0] + ' (' + t[1] + ')');
      b.addEventListener('click', function () {
        const target = sec[0] === 'Replacement' ? ctx.optBar.querySelector('#f-replacement') : pIn;
        if (!target) return;
        const tok = t[0].replace('…', '');
        const a = target.selectionStart == null ? target.value.length : target.selectionStart;
        const z = target.selectionEnd == null ? a : target.selectionEnd;
        target.focus();
        target.setRangeText(tok, a, z, 'end');
        if (/\(…\)|\(\?[:=!<][^…]*…\)/.test(t[0])) { const p = a + t[0].indexOf('…'); target.setSelectionRange(p, p); }
        target.dispatchEvent(new Event('input', { bubbles: true }));
      });
      dt.appendChild(b);
      dl.appendChild(dt);
      dl.appendChild(el('dd', null, t[1]));
    });
    s.appendChild(dl);
    grid.appendChild(s);
  });
  cheat.appendChild(grid);

  /* saved tests, on this device only */
  const saved = panels.saved;
  saved.appendChild(el('p', 'rx-hint', 'Keep a pattern, its flags, its replacement and the test text on this device, to load again later. Nothing is sent anywhere.'));
  const form = el('div', 'rx-save');
  const nameIn = el('input', 'control');
  nameIn.type = 'text';
  nameIn.id = 'rx-save-name';
  nameIn.maxLength = 60;
  nameIn.placeholder = 'e.g. UK postcodes';
  const nameLab = el('label', null, 'Name');
  nameLab.setAttribute('for', 'rx-save-name');
  const saveBtn = el('button', 'btn-ghost', 'Save this test');
  saveBtn.type = 'button';
  form.appendChild(nameLab);
  form.appendChild(nameIn);
  form.appendChild(saveBtn);
  saved.appendChild(form);
  const savedMsg = el('p', 'rx-hint');
  savedMsg.setAttribute('role', 'status');
  saved.appendChild(savedMsg);
  const list = el('ul', 'rx-saved');
  saved.appendChild(list);
  const MAX_TESTS = 30, MAX_TEXT = 50000;
  const read = function () { const a = ctx.store.get('tests'); return Array.isArray(a) ? a.filter(function (t) { return t && typeof t.pattern === 'string'; }) : []; };
  function paintList() {
    list.textContent = '';
    const all = read();
    if (!all.length) { list.appendChild(el('li', 'rx-empty-list', 'No saved tests yet.')); return; }
    all.forEach(function (t, k) {
      const li = el('li');
      const head = el('div', 'rx-saved-head');
      head.appendChild(el('strong', null, t.name || 'Untitled'));
      head.appendChild(el('code', 'rx-mono', '/' + t.pattern + '/' + (t.flags || '')));
      li.appendChild(head);
      const acts = el('div', 'rx-saved-acts');
      const load = el('button', 'btn-ghost', 'Load');
      load.type = 'button';
      load.setAttribute('aria-label', 'Load ' + (t.name || 'Untitled'));
      load.addEventListener('click', function () {
        ['pattern', 'flags', 'view', 'replacement'].forEach(function (k2) { if (typeof t[k2] === 'string') ctx.setOption(k2, t[k2]); });
        if (UI.syncFlags) UI.syncFlags();
        ctx.setText(typeof t.text === 'string' ? t.text : '');
        savedMsg.textContent = 'Loaded “' + (t.name || 'Untitled') + '”.';
      });
      const del = el('button', 'btn-ghost', 'Delete');
      del.type = 'button';
      del.setAttribute('aria-label', 'Delete ' + (t.name || 'Untitled'));
      del.addEventListener('click', function () {
        const a = read();
        a.splice(k, 1);
        ctx.store.set('tests', a.length ? a : null);
        savedMsg.textContent = 'Deleted “' + (t.name || 'Untitled') + '”.';
        paintList();
      });
      acts.appendChild(load);
      acts.appendChild(del);
      li.appendChild(acts);
      list.appendChild(li);
    });
  }
  saveBtn.addEventListener('click', function () {
    const o = ctx.opts();
    const text = ctx.text;
    if (!o.pattern) { savedMsg.textContent = 'Enter a pattern first.'; return; }
    if (text.length > MAX_TEXT) { savedMsg.textContent = 'The test text is ' + text.length.toLocaleString('en-GB') + ' characters; a saved test keeps at most ' + MAX_TEXT.toLocaleString('en-GB') + '. Shorten it and save again.'; return; }
    const name = nameIn.value.trim().slice(0, 60) || ('Test ' + (read().length + 1));
    const a = read().filter(function (t) { return t.name !== name; });
    if (a.length >= MAX_TESTS) { savedMsg.textContent = 'You have ' + MAX_TESTS + ' saved tests, the most kept here. Delete one first.'; return; }
    a.unshift({ name: name, pattern: o.pattern, flags: o.flags, view: o.view, replacement: o.replacement, text: text, t: Date.now() });
    ctx.store.set('tests', a);
    const back2 = read();
    savedMsg.textContent = back2.length && back2[0].name === name ? 'Saved “' + name + '” on this device.' : 'This browser would not save it (storage full or blocked).';
    nameIn.value = '';
    paintList();
  });
  paintList();
}

/* the text, with every match and its groups coloured, behind the text box */
function paintBack(res, ta) {
  const inner = UI.back;
  inner.textContent = '';
  const text = ta.value;
  if (!res || !res.spans || res.len !== text.length || text.length > 300000) return;
  const frag = document.createDocumentFragment();
  let at = 0;
  res.spans.forEach(function (sp, n) {
    const s = sp[0], e = sp[1];
    if (s < at) return;
    if (s > at) frag.appendChild(document.createTextNode(text.slice(at, s)));
    const mk = document.createElement('mark');
    mk.className = 'rx-m rx-m' + (n % 2) + (n === UI.cur ? ' rx-cur' : '') + (s === e ? ' rx-zero' : '');
    const gs = sp[2];
    if (gs && e > s) {
      /* the innermost group at each point: inner groups have the higher numbers */
      const pts = [s, e];
      gs.forEach(function (g) { if (g) { pts.push(g[0], g[1]); } });
      const uniq = pts.filter(function (p) { return p >= s && p <= e; }).sort(function (a, b) { return a - b; }).filter(function (p, k, a) { return k === 0 || p !== a[k - 1]; });
      for (let k = 0; k + 1 < uniq.length; k++) {
        const a = uniq[k], b = uniq[k + 1];
        let g = 0;
        gs.forEach(function (x, gi) { if (x && x[0] <= a && x[1] >= b) g = gi + 1; });
        const piece = text.slice(a, b);
        if (g) { const sp2 = document.createElement('span'); sp2.className = 'rx-g rx-g' + (((g - 1) % 4) + 1); sp2.textContent = piece; mk.appendChild(sp2); }
        else mk.appendChild(document.createTextNode(piece));
      }
    } else mk.textContent = text.slice(s, e);
    frag.appendChild(mk);
    at = e;
  });
  if (at < text.length) frag.appendChild(document.createTextNode(text.slice(at)));
  frag.appendChild(document.createTextNode('\n'));
  inner.appendChild(frag);
  UI.scroll();
}

function selectMatch(n, ctx) {
  const res = UI.res;
  if (!res || !res.spans || !res.spans[n]) return;
  const ta = ctx.input;
  const sp = res.spans[n];
  UI.cur = n;
  ta.focus();
  ta.setSelectionRange(sp[0], sp[1]);
  // bring it into view: the line it is on, in the middle of the box
  const line = ta.value.slice(0, sp[0]).split('\n').length - 1;
  const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
  ta.scrollTop = Math.max(0, line * lh - ta.clientHeight / 2);
  paintBack(res, ta);
}

function render(res, ctx) {
  if (!UI) return;
  const el = ctx.el;
  UI.res = res;
  UI.cur = -1;
  if (UI.syncFlags) UI.syncFlags();
  UI.metrics();
  paintBack(res, ctx.input);

  /* matches and groups */
  const mp = UI.panels.matches;
  mp.textContent = '';
  if (res.error) mp.appendChild(el('p', 'rx-hint', 'Fix the pattern to see its matches.'));
  else if (!res.rows || !res.rows.length) mp.appendChild(el('p', 'rx-hint', res.rows ? 'No matches in this text.' : 'Matches appear here, with their groups.'));
  else {
    const gn = res.groupNames || [];
    const wrap = el('div', 'rx-table-wrap');
    const t = el('table', 'rx-table');
    const cap = el('caption', null, res.total > res.rows.length
      ? 'The first ' + res.rows.length.toLocaleString('en-GB') + ' of ' + res.total.toLocaleString('en-GB') + ' matches'
      : res.total.toLocaleString('en-GB') + (res.total === 1 ? ' match' : ' matches') + (gn.length ? ', ' + gn.length + (gn.length === 1 ? ' group' : ' groups') : ''));
    t.appendChild(cap);
    const thead = el('thead');
    const hr = el('tr');
    ['#', 'Match', 'At'].forEach(function (h) { const th = el('th', null, h); th.scope = 'col'; hr.appendChild(th); });
    gn.forEach(function (name, k) {
      const th = el('th', 'rx-gh rx-gh' + ((k % 4) + 1), String(k + 1) + (name ? ' ' + name : ''));
      th.scope = 'col';
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    t.appendChild(thead);
    const tb = el('tbody');
    res.rows.forEach(function (r, n) {
      const tr = el('tr');
      const c0 = el('td');
      const b = el('button', 'rx-pick', String(n + 1));
      b.type = 'button';
      b.setAttribute('aria-label', 'Select match ' + (n + 1) + ' in the text');
      b.addEventListener('click', function () { selectMatch(n, ctx); });
      c0.appendChild(b);
      tr.appendChild(c0);
      const c1 = el('td', 'rx-mono');
      c1.appendChild(r.t === '' ? el('em', 'rx-dim', 'empty') : document.createTextNode(r.t));
      tr.appendChild(c1);
      tr.appendChild(el('td', 'rx-num', r.i + '–' + r.e));
      gn.forEach(function (x, k) {
        const v = r.g[k];
        const td = el('td', 'rx-mono');
        td.appendChild(v === null || v === undefined ? el('em', 'rx-dim', 'no match') : v === '' ? el('em', 'rx-dim', 'empty') : document.createTextNode(v));
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    mp.appendChild(wrap);
  }

  /* the explanation */
  const ep = UI.panels.explain;
  ep.textContent = '';
  if (res.error) ep.appendChild(el('p', 'rx-hint', 'Fix the pattern to see it explained.'));
  else if (!res.explain) ep.appendChild(el('p', 'rx-hint', 'Enter a pattern to see it explained, part by part.'));
  else {
    const ol = el('ol', 'rx-explain');
    res.explain.forEach(function (r) {
      const li = el('li');
      li.style.setProperty('--rx-d', String(r.d));
      const code = el('code', 'rx-tok');
      const hl = ctx.highlight('regex', r.tok);
      if (hl) code.appendChild(hl); else code.textContent = r.tok;
      li.appendChild(code);
      li.appendChild(el('span', 'rx-txt', r.txt));
      ol.appendChild(li);
    });
    ep.appendChild(ol);
    if (res.flagRows && res.flagRows.length) {
      const fl = el('ul', 'rx-flaglist');
      res.flagRows.forEach(function (f) { const li = el('li'); li.appendChild(el('code', 'rx-tok', f[0])); li.appendChild(el('span', 'rx-txt', f[1])); fl.appendChild(li); });
      ep.appendChild(el('h3', 'rx-sub', 'Flags'));
      ep.appendChild(fl);
    }
  }
}

return {
"title": "Regex Tester",
"kind": "code",
"workerAlways": true,
"timeout": 2000,
"timeoutMessage": "Stopped after 2 seconds: this pattern is taking too long on this text. Nested quantifiers such as (a+)+ can backtrack exponentially; make the inner part match less, or anchor it.",
"description": "Test regular expressions against sample text: every JavaScript flag, matches coloured in place, a groups table, a plain-English explanation and saved tests.",
"keywords": ["regex tester","regular expression tester","regex online","regex match","test regex pattern","regex explainer"],
"inputLabel": "Test text",
"outputLabel": "Matches",
"placeholder": "Paste the text you want to match against…",
"sample": "Contact us at hello@example.com or support@example.co.uk\nCall 0118 496 0000 or 020 7946 0958\nOrder #12345 shipped on 2026-07-28",
"options": [{"key":"pattern","label":"Pattern","type":"text","default":"[\\w.-]+@[\\w.-]+\\.\\w{2,}"},{"key":"flags","label":"Flags","type":"text","default":"g"},{"key":"view","label":"Show","type":"select","default":"matches","options":[{"value":"matches","label":"Matches with groups"},{"value":"highlight","label":"Text with matches marked"},{"value":"replace","label":"Replace result"},{"value":"split","label":"Split result"}]},{"key":"replacement","label":"Replacement (for replace mode)","type":"text","default":"[$&]"}],
"mount": mount,
"render": render,
"normFlags": normFlags,
"parse": rxParse,
"explain": explainRows,
"transform": (text, o) => {
      const src = String(text || '');
      const pattern = String(o.pattern || '');
      if (!pattern) return { output: '', note: 'Enter a pattern above.' };
      const nf = normFlags(o.flags);
      if (nf.error) return { error: nf.error };
      const flags = nf.flags;

      let re;
      try { re = new RegExp(pattern, flags); }
      catch (e) {
        const p = rxParse(pattern, flags);
        return { error: 'Invalid pattern: ' + e.message + '.' + (p.error ? ' At character ' + (p.error.at + 1) + ': ' + p.error.msg + '.' : '') };
      }
      const parsed = rxParse(pattern, flags);
      const extra = {
        explain: explainRows(pattern, flags, parsed),
        flagRows: flags.split('').map((f) => [f, FLAG_INFO[f][1]]),
        groupNames: parsed.groups.map((g) => g.name || ''),
        len: src.length
      };
      if (!src) return Object.assign(extra, { output: '', note: 'Paste some text to match against.' });

      /* Every match, with where each group starts and ends (the d flag is
         added for that when the engine has it). A pattern that can match an
         empty string would loop for ever under a global exec, so an empty
         match moves on one character, and the loop stops at 10,000. */
      const global = flags.indexOf('g') >= 0;
      const uni = /[uv]/.test(flags);
      let it;
      try { it = new RegExp(pattern, normFlags(flags + (global ? '' : 'g') + (flags.indexOf('d') >= 0 ? '' : 'd')).flags); }
      catch (e) { it = new RegExp(pattern, global ? flags : flags + 'g'); }
      const matches = [];
      let m, guard = 0;
      while ((m = it.exec(src)) !== null && guard < 10000) {
        guard++;
        matches.push(m);
        if (m[0] === '') it.lastIndex = advance(src, it.lastIndex, uni);
        if (!global) break;
      }
      extra.total = matches.length;
      extra.spans = matches.slice(0, MAX_SPANS).map((x) => [x.index, x.index + x[0].length, x.indices ? x.indices.slice(1).map((g) => g ? [g[0], g[1]] : null) : null]);
      extra.rows = matches.slice(0, MAX_ROWS).map((x) => ({ i: x.index, e: x.index + x[0].length, t: cut(x[0], 300), g: x.slice(1).map((g) => cut(g, 300)) }));

      if (o.view === 'replace') {
        let result;
        try { result = src.replace(re, o.replacement || ''); }
        catch (e) { return { error: `Replacement failed: ${e.message}` }; }
        return Object.assign(extra, { output: result, stats: [['Matches replaced', String(matches.length)], ['Pattern', pattern]] });
      }

      if (o.view === 'split') {
        const parts = src.split(re);
        return Object.assign(extra, {
          output: parts.map((p, i) => `${String(i).padStart(3)}  ${p}`).join('\n'),
          stats: [['Parts', String(parts.length)], ['Pattern', pattern]]
        });
      }

      if (o.view === 'highlight') {
        let out = '', last = 0;
        matches.forEach(mt => {
          out += src.slice(last, mt.index) + '«' + mt[0] + '»';
          last = mt.index + mt[0].length;
        });
        out += src.slice(last);
        return Object.assign(extra, { output: out, stats: [['Matches', String(matches.length)], ['Pattern', pattern]] });
      }

      if (!matches.length) {
        return Object.assign(extra, { output: '', note: global ? 'No matches. Check the pattern and the flags.' : 'No matches. Without the g flag only the first match is looked for; check the pattern and the flags.' });
      }

      const output = matches.map((mt, i) => {
        let s = `${String(i + 1).padStart(3)}. "${mt[0]}"  at index ${mt.index}`;
        mt.slice(1).forEach((gp, gi) => {
          s += `\n       group ${gi + 1}: ${gp === undefined ? '(no match)' : `"${gp}"`}`;
        });
        if (mt.groups) {
          Object.entries(mt.groups).forEach(([k, v]) => {
            s += `\n       <${k}>: ${v === undefined ? '(no match)' : `"${v}"`}`;
          });
        }
        return s;
      }).join('\n');

      return Object.assign(extra, {
        output,
        stats: [
          ['Matches', String(matches.length)],
          ['Capture groups', String(matches[0].length - 1)],
          ['Pattern', pattern],
          ['Flags', flags || '(none)'],
          ['First match at', String(matches[0].index)]
        ],
        warn: guard >= 10000 ? 'Stopped after 10,000 matches to avoid hanging the page.' : ''
      });
    },
"tips": ["Without the g flag only the first match is returned. That is the single most common reason a pattern \"does not work\".","Press a flag button, or type the letters in the Flags box: g, i, m, s, u, v, y and d combine freely, and the browser decides which mixes are valid. The v flag's button only shows where the browser has it.","Matches are coloured in the text box itself, and each capture group in a colour of its own. Press a match's number in the table to select it in the text.","The Explanation tab reads the pattern back part by part, in plain English, and the Cheat sheet tab puts a token into the pattern at the cursor.","This uses the JavaScript regex engine. PCRE, Python and Go differ in places — lookbehind support and named-group syntax in particular.","Nested quantifiers such as (a+)+ can trigger catastrophic backtracking on non-matching input. Here the pattern runs in a background worker and is stopped after 2 seconds.","In replace mode, $& is the whole match, $1 is the first group, and $<name> is a named group.","Saved tests keep the pattern, flags, replacement and text in this browser only, up to 30 of them."],
"faq": [{"q":"Why does my pattern behave differently in my code?","a":"Check the flags and the escaping. A pattern written in a string literal needs its backslashes doubled — \\\\d in JavaScript source is \\d in the pattern. Entering it here directly avoids that layer."},{"q":"Where are my saved tests kept?","a":"In this browser's own storage on this device, under the tool's one settings entry. They are never uploaded, so they do not follow you to another browser, and clearing the site's data deletes them."}]
};
})();
})();
