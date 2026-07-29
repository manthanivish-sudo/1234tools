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
      const toNum = (v) => {
        if (names) {
          const i = names.indexOf(v.slice(0, 3));
          if (i >= 0) return i + (names === CRON_NAMES.month ? 1 : 0);
        }
        const n = parseInt(v, 10);
        if (!isFinite(n)) throw new Error(`"${v}" is not a valid value`);
        return n;
      };
      if (range.length === 1) { lo = toNum(range[0]); hi = step > 1 ? max : lo; }
      else if (range.length === 2) { lo = toNum(range[0]); hi = toNum(range[1]); }
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
  const dows  = parseCronField(dowF.replace(/7/g, '0'), 0, 6, CRON_NAMES.dow);

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
  if (allDom && allDow) onDays = 'every day';
  else if (!allDom && allDow) onDays = `on day ${list(doms, d => String(d))} of the month`;
  else if (allDom && !allDow) onDays = `on ${list(dows, d => DAYS[d])}`;
  else onDays = `on day ${list(doms, d => String(d))} of the month, and on ${list(dows, d => DAYS[d])}`;

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

function markdownToHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const blocks = [];
  let src = String(md);

  // pull fenced code out first so nothing else touches it
  src = src.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) => {
    blocks.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${esc(code.replace(/\n$/, ''))}</code></pre>`);
    return `\u0000BLOCK${blocks.length - 1}\u0000`;
  });

  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/(^|\s)__([^_]+)__/g, '$1<strong>$2</strong>');

  const lines = src.split('\n');
  const out = [];
  let inList = null, inQuote = false, para = [];

  const flushPara = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
  };
  const closeList = () => { if (inList) { out.push(`</${inList}>`); inList = null; } };
  const closeQuote = () => { if (inQuote) { out.push('</blockquote>'); inQuote = false; } };

  for (let raw of lines) {
    const line = raw.replace(/\s+$/, '');

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
window.DEV_TOOLS["regex-tester"] = {
"title": "Regex Tester",
"kind": "code",
"description": "Test regular expressions against sample text with live match highlighting and capture groups.",
"keywords": ["regex tester","regular expression tester","regex online","regex match","test regex pattern"],
"inputLabel": "Test text",
"outputLabel": "Matches",
"placeholder": "Paste the text you want to match against…",
"sample": "Contact us at hello@mvritservices.com or support@example.co.uk\nCall 0118 496 0000 or 020 7946 0958\nOrder #12345 shipped on 2026-07-28",
"options": [{"key":"pattern","label":"Pattern","type":"text","default":"[\\w.-]+@[\\w.-]+\\.\\w{2,}"},{"key":"flags","label":"Flags","type":"select","default":"g","options":[{"value":"g","label":"g — global"},{"value":"gi","label":"gi — global, ignore case"},{"value":"gm","label":"gm — global, multiline"},{"value":"gim","label":"gim — global, ignore case, multiline"},{"value":"gs","label":"gs — global, dot matches newline"},{"value":"","label":"(none) — first match only"}]},{"key":"view","label":"Show","type":"select","default":"matches","options":[{"value":"matches","label":"Matches with groups"},{"value":"highlight","label":"Text with matches marked"},{"value":"replace","label":"Replace result"},{"value":"split","label":"Split result"}]},{"key":"replacement","label":"Replacement (for replace mode)","type":"text","default":"[$&]"}],
"transform": (text, o) => {
      const src = String(text || '');
      if (!o.pattern) return { output: '', note: 'Enter a pattern above.' };
      if (!src) return { output: '', note: 'Paste some text to match against.' };

      let re;
      try { re = new RegExp(o.pattern, o.flags || ''); }
      catch (e) { return { error: `Invalid pattern: ${e.message}` }; }

      /* A pattern that can match an empty string will loop forever under a
         global exec. Guard the iteration count rather than hanging. */
      const matches = [];
      let m, guard = 0;
      const g = new RegExp(o.pattern, (o.flags || '').includes('g') ? o.flags : (o.flags || '') + 'g');
      while ((m = g.exec(src)) !== null && guard < 10000) {
        guard++;
        matches.push({ text: m[0], index: m.index, groups: m.slice(1), named: m.groups || null });
        if (m[0] === '') g.lastIndex++;
        if (!(o.flags || '').includes('g')) break;
      }

      if (o.view === 'replace') {
        let result;
        try { result = src.replace(re, o.replacement || ''); }
        catch (e) { return { error: `Replacement failed: ${e.message}` }; }
        return { output: result, stats: [['Matches replaced', String(matches.length)], ['Pattern', o.pattern]] };
      }

      if (o.view === 'split') {
        const parts = src.split(re);
        return {
          output: parts.map((p, i) => `${String(i).padStart(3)}  ${p}`).join('\n'),
          stats: [['Parts', String(parts.length)], ['Pattern', o.pattern]]
        };
      }

      if (o.view === 'highlight') {
        let out = '', last = 0;
        matches.forEach(mt => {
          out += src.slice(last, mt.index) + '«' + mt.text + '»';
          last = mt.index + mt.text.length;
        });
        out += src.slice(last);
        return { output: out, stats: [['Matches', String(matches.length)], ['Pattern', o.pattern]] };
      }

      if (!matches.length) {
        return { output: '', note: 'No matches. Check the pattern and flags — a common cause is a missing g flag when you expected several results.' };
      }

      const output = matches.map((mt, i) => {
        let s = `${String(i + 1).padStart(3)}. "${mt.text}"  at index ${mt.index}`;
        mt.groups.forEach((gp, gi) => {
          s += `\n       group ${gi + 1}: ${gp === undefined ? '(no match)' : `"${gp}"`}`;
        });
        if (mt.named) {
          Object.entries(mt.named).forEach(([k, v]) => {
            s += `\n       <${k}>: ${v === undefined ? '(no match)' : `"${v}"`}`;
          });
        }
        return s;
      }).join('\n');

      return {
        output,
        stats: [
          ['Matches', String(matches.length)],
          ['Capture groups', String(matches[0].groups.length)],
          ['Pattern', o.pattern],
          ['Flags', o.flags || '(none)'],
          ['First match at', String(matches[0].index)]
        ],
        warn: guard >= 10000 ? 'Stopped after 10,000 matches to avoid hanging the page.' : ''
      };
    },
"tips": ["Without the g flag only the first match is returned. That is the single most common reason a pattern \"does not work\".","The m flag makes ^ and $ match at line boundaries rather than only at the start and end of the whole string.","This uses the JavaScript regex engine. PCRE, Python and Go differ in places — lookbehind support and named-group syntax in particular.","Nested quantifiers such as (a+)+ can trigger catastrophic backtracking on non-matching input. If a pattern hangs elsewhere, that is usually why.","In replace mode, $& is the whole match, $1 is the first group, and $<name> is a named group."],
"faq": [{"q":"Why does my pattern behave differently in my code?","a":"Check the flags and the escaping. A pattern written in a string literal needs its backslashes doubled — \\\\d in JavaScript source is \\d in the pattern. Entering it here directly avoids that layer."}]
};
})();