/**
 * QR Code encoder, renderer and verifier — ISO/IEC 18004.
 * No dependencies, no network, no canvas required for encoding.
 *
 * Versions 1–40, EC levels L/M/Q/H, numeric / alphanumeric / byte modes with
 * optimal mixed-segment splitting, full styling (module and eye shapes,
 * gradients, logo) and a read-back decoder used to prove the code scans.
 *
 * Pipeline: text -> segments -> data codewords -> Reed-Solomon ECC
 *        -> interleave -> place in matrix -> mask -> format/version info.
 */
(function (root) {
'use strict';

/* ---------- GF(256) arithmetic, primitive polynomial 0x11D ---------- */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const gfMul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

/** Generator polynomial for `degree` error-correction codewords. */
function rsGenerator(degree) {
  let poly = [1];
  for (let d = 0; d < degree; d++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let i = 0; i < poly.length; i++) {
      next[i] ^= poly[i];
      next[i + 1] ^= gfMul(poly[i], EXP[d]);
    }
    poly = next;
  }
  return poly;
}

/** Reed-Solomon error-correction codewords for one block. */
function rsEncode(data, ecLen) {
  const gen = rsGenerator(ecLen);
  const res = new Array(ecLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ res[0];
    res.shift();
    res.push(0);
    for (let i = 0; i < ecLen; i++) res[i] ^= gfMul(gen[i + 1], factor);
  }
  return res;
}

/**
 * Syndromes of a received block. Every syndrome of an intact RS codeword is
 * zero, so this proves the ECC without needing a full decoder.
 */
function rsSyndromes(codewords, ecLen) {
  const out = [];
  for (let i = 0; i < ecLen; i++) {
    let s = 0;
    for (const c of codewords) s = gfMul(s, EXP[i]) ^ c;
    out.push(s);
  }
  return out;
}

/* ---------- Reed-Solomon error correction ----------
   Encoding only needs the generator polynomial. Reading a QR code off a
   camera needs the other half: locating and repairing the codewords the
   image got wrong. Berlekamp-Massey finds the error locator, Chien finds
   where the errors are and Forney works out what to subtract. */

const gfInv = (a) => EXP[255 - LOG[a]];

/** Berlekamp-Massey: the error locator polynomial for a syndrome list. */
function errorLocator(syn, ecLen) {
  let lambda = [1], prev = [1], shift = 1, lastDelta = 1, order = 0;

  for (let r = 0; r < ecLen; r++) {
    let delta = syn[r];
    for (let i = 1; i <= order; i++) delta ^= gfMul(lambda[i] || 0, syn[r - i]);

    if (delta === 0) {
      shift++;
      continue;
    }
    const scale = gfMul(delta, gfInv(lastDelta));
    const adjusted = lambda.slice();
    for (let i = 0; i < prev.length; i++) {
      adjusted[i + shift] = (adjusted[i + shift] || 0) ^ gfMul(scale, prev[i]);
    }
    if (2 * order <= r) {
      prev = lambda;
      lastDelta = delta;
      order = r + 1 - order;
      shift = 1;
    } else {
      shift++;
    }
    lambda = adjusted;
  }
  return { lambda: lambda, order: order };
}

/** Evaluate a polynomial (lowest degree first) at x. */
function polyEval(poly, x) {
  let sum = 0;
  for (let i = poly.length - 1; i >= 0; i--) sum = gfMul(sum, x) ^ (poly[i] || 0);
  return sum;
}

/**
 * Repair a block in place, as far as the error correction allows.
 * Returns the number of codewords corrected, or -1 if the block is beyond
 * repair — which is the signal to keep looking rather than trust the result.
 */
function rsCorrect(block, ecLen) {
  const syn = rsSyndromes(block, ecLen);
  if (syn.every((s) => s === 0)) return 0;

  const { lambda, order } = errorLocator(syn, ecLen);
  if (order === 0 || order > ecLen / 2) return -1;

  // Chien search: an error sits at exponent p wherever lambda(a^-p) is zero
  const n = block.length;
  const positions = [];
  for (let p = 0; p < n; p++) {
    if (polyEval(lambda, gfInv(EXP[p % 255])) === 0) positions.push(p);
  }
  if (positions.length !== order) return -1;

  // omega = syndromes * lambda, truncated to the syndrome count
  const omega = new Array(ecLen).fill(0);
  for (let i = 0; i < ecLen; i++) {
    for (let j = 0; j <= i; j++) omega[i] ^= gfMul(syn[j], lambda[i - j] || 0);
  }

  // lambda', which in this field keeps only the odd-degree terms
  const deriv = [];
  for (let i = 1; i < lambda.length; i += 2) deriv[(i - 1) / 2] = lambda[i] || 0;
  const derivPoly = [];
  for (let i = 0; i < deriv.length; i++) { derivPoly[i * 2] = deriv[i]; derivPoly[i * 2 + 1] = 0; }

  // Forney: magnitude = X * omega(X^-1) / lambda'(X^-1)
  for (const p of positions) {
    const xInv = gfInv(EXP[p % 255]);
    const denom = polyEval(derivPoly, xInv);
    if (denom === 0) return -1;
    const magnitude = gfMul(EXP[p % 255], gfMul(polyEval(omega, xInv), gfInv(denom)));
    block[n - 1 - p] ^= magnitude;
  }

  // a repair that does not clear every syndrome is a wrong guess, not a fix
  if (!rsSyndromes(block, ecLen).every((s) => s === 0)) return -1;
  return positions.length;
}

/* ---------- capacity tables, versions 1–40 ----------
   Indexed [ecLevel][version]; index 0 is unused. Data codeword counts are
   derived from these plus the raw module count, which keeps the tables small
   and removes any chance of the two disagreeing. */

const EC_LEVELS = ['L', 'M', 'Q', 'H'];
const EC_INDEX = { L: 0, M: 1, Q: 2, H: 3 };

const ECC_PER_BLOCK = [
  [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
];

const EC_BLOCKS = [
  [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
];

/** Modules available for data and ECC, before the format/version areas. */
function rawDataModules(version) {
  let n = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (version >= 7) n -= 36;
  }
  return n;
}

const totalCodewords = (version) => Math.floor(rawDataModules(version) / 8);

function dataCodewords(version, ecLevel) {
  const e = EC_INDEX[ecLevel];
  return totalCodewords(version) - ECC_PER_BLOCK[e][version] * EC_BLOCKS[e][version];
}

/** Centres of the alignment patterns for a version. */
function alignmentPositions(version) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const out = [6];
  for (let pos = version * 4 + 10; out.length < count; pos -= step) out.splice(1, 0, pos);
  return out;
}

/* format info: 15 bits, BCH(15,5) + mask 0x5412 */
function formatBits(ecLevel, mask) {
  const ecBits = { L: 1, M: 0, Q: 3, H: 2 }[ecLevel];
  const data = (ecBits << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

/* version info: 18 bits, BCH(18,6), versions 7+ only */
function versionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

/* ---------- segments: numeric, alphanumeric, byte ---------- */

const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

const MODE = {
  numeric: { bits: 0b0001, counts: [10, 12, 14] },
  alnum:   { bits: 0b0010, counts: [9, 11, 13] },
  byte:    { bits: 0b0100, counts: [8, 16, 16] }
};

/** Which of the three character-count-bit groups a version falls in. */
const countGroup = (version) => version <= 9 ? 0 : version <= 26 ? 1 : 2;
const countBits = (mode, version) => MODE[mode].counts[countGroup(version)];

function utf8Bytes(str) {
  const out = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return out;
}

const isDigit = (ch) => ch >= '0' && ch <= '9';
const isAlnum = (ch) => ALNUM.indexOf(ch) >= 0;

/**
 * Split text into the cheapest run of mode segments for a given version.
 *
 * Costs are tracked in sixths of a bit so the fractional per-character costs
 * (10 bits per 3 digits, 11 bits per 2 alphanumerics) stay exact in integers.
 * A plain "pick one mode for everything" encoder wastes a lot of room on
 * mixed content such as "ORDER-4471" or a URL with a long numeric id.
 */
function segmentsFor(text, version) {
  const chars = Array.from(text);
  if (!chars.length) return [];

  const MODES = ['byte', 'alnum', 'numeric'];
  const headBits = (m) => (4 + countBits(m, version)) * 6;

  // charCost[mode] = cost in sixths of a bit of one more character in that mode
  const charCost = (mode, ch) => {
    if (mode === 'numeric') return 20;                       // 10/3 bits
    if (mode === 'alnum') return 33;                         // 11/2 bits
    return utf8Bytes(ch).length * 48;                        // 8 bits per byte
  };

  let cost = MODES.map(headBits);
  const prev = [];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const allowed = {
      byte: true,
      alnum: isAlnum(ch),
      numeric: isDigit(ch)
    };
    const next = [Infinity, Infinity, Infinity];
    const from = [0, 0, 0];

    MODES.forEach((mode, mi) => {
      if (!allowed[mode]) return;
      MODES.forEach((was, wi) => {
        if (cost[wi] === Infinity) return;
        // staying in a mode costs the character; switching adds a new header
        const c = cost[wi] + (wi === mi ? 0 : headBits(mode)) + charCost(mode, ch);
        if (c < next[mi]) { next[mi] = c; from[mi] = wi; }
      });
    });

    // round each running total up to a whole bit so comparisons stay honest
    for (let mi = 0; mi < 3; mi++) if (next[mi] !== Infinity) next[mi] = Math.ceil(next[mi] / 6) * 6;

    prev.push(from);
    cost = next;
  }

  // walk back from the cheapest end state to recover the mode of each character
  let best = 0;
  for (let mi = 1; mi < 3; mi++) if (cost[mi] < cost[best]) best = mi;
  const modeOf = new Array(chars.length);
  let cur = best;
  for (let i = chars.length - 1; i >= 0; i--) {
    modeOf[i] = MODES[cur];
    cur = prev[i][cur];
  }

  // collapse runs of the same mode into segments
  const segs = [];
  for (let i = 0; i < chars.length; i++) {
    if (segs.length && segs[segs.length - 1].mode === modeOf[i]) segs[segs.length - 1].chars.push(chars[i]);
    else segs.push({ mode: modeOf[i], chars: [chars[i]] });
  }
  return segs.map((s) => ({ mode: s.mode, text: s.chars.join('') }));
}

/** Bit length of a segment list at a given version. */
function segmentBits(segs, version) {
  let bits = 0;
  for (const s of segs) {
    bits += 4 + countBits(s.mode, version);
    if (s.mode === 'numeric') {
      const n = s.text.length;
      bits += 10 * Math.floor(n / 3) + [0, 4, 7][n % 3];
    } else if (s.mode === 'alnum') {
      const n = s.text.length;
      bits += 11 * Math.floor(n / 2) + (n % 2 ? 6 : 0);
    } else {
      bits += utf8Bytes(s.text).length * 8;
    }
  }
  return bits;
}

/** Append a segment list to a bit array. */
function writeSegments(segs, version, push) {
  for (const s of segs) {
    push(MODE[s.mode].bits, 4);
    if (s.mode === 'numeric') {
      push(s.text.length, countBits('numeric', version));
      for (let i = 0; i < s.text.length; i += 3) {
        const chunk = s.text.substr(i, 3);
        push(Number(chunk), chunk.length * 3 + 1);
      }
    } else if (s.mode === 'alnum') {
      push(s.text.length, countBits('alnum', version));
      for (let i = 0; i < s.text.length; i += 2) {
        if (i + 1 < s.text.length) push(ALNUM.indexOf(s.text[i]) * 45 + ALNUM.indexOf(s.text[i + 1]), 11);
        else push(ALNUM.indexOf(s.text[i]), 6);
      }
    } else {
      const b = utf8Bytes(s.text);
      push(b.length, countBits('byte', version));
      for (const byte of b) push(byte, 8);
    }
  }
}

/**
 * Smallest version that fits the text at the requested EC level.
 * The segmentation is recomputed per version group because the character-count
 * field widens at versions 10 and 27, which can change the optimal split.
 */
function pickVersion(text, ecLevel, minVersion) {
  let segs = null, group = -1;
  for (let v = Math.max(1, minVersion || 1); v <= 40; v++) {
    if (countGroup(v) !== group) { group = countGroup(v); segs = segmentsFor(text, v); }
    if (segmentBits(segs, v) <= dataCodewords(v, ecLevel) * 8) return { version: v, segs: segs };
  }
  return null;
}

/* ---------- codewords: block split, ECC, interleave ---------- */

function buildCodewords(segs, version, ecLevel) {
  const e = EC_INDEX[ecLevel];
  const ecLen = ECC_PER_BLOCK[e][version];
  const numBlocks = EC_BLOCKS[e][version];
  const rawCw = totalCodewords(version);
  const dataCw = dataCodewords(version, ecLevel);

  const bits = [];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  writeSegments(segs, version, push);

  // terminator, up to 4 zero bits, then pad to a whole byte
  for (let i = 0; i < 4 && bits.length < dataCw * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    data.push(b);
  }
  const PAD = [0xec, 0x11];
  let p = 0;
  while (data.length < dataCw) data.push(PAD[p++ % 2]);

  // short blocks first, then the ones carrying one extra data codeword
  const shortTotal = Math.floor(rawCw / numBlocks);
  const numShort = numBlocks - (rawCw % numBlocks);
  const blocks = [], eccs = [];
  let pos = 0;
  for (let i = 0; i < numBlocks; i++) {
    const len = shortTotal - ecLen + (i < numShort ? 0 : 1);
    const block = data.slice(pos, pos + len);
    pos += len;
    blocks.push(block);
    eccs.push(rsEncode(block, ecLen));
  }

  // interleave: one codeword from each block in turn, data first then ECC
  const out = [];
  const owner = [];
  const maxData = Math.max.apply(null, blocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) {
    for (let j = 0; j < numBlocks; j++) {
      if (i < blocks[j].length) { out.push(blocks[j][i]); owner.push(j); }
    }
  }
  for (let i = 0; i < ecLen; i++) {
    for (let j = 0; j < numBlocks; j++) { out.push(eccs[j][i]); owner.push(j); }
  }

  return { codewords: out, owner: owner, blocks: blocks, eccs: eccs, ecLen: ecLen, numBlocks: numBlocks };
}

/* ---------- matrix ---------- */

function buildMatrix(version) {
  const size = version * 4 + 17;
  const m = [];
  const fn = [];
  for (let i = 0; i < size; i++) { m.push(new Int8Array(size)); fn.push(new Uint8Array(size)); }

  const set = (r, c, v) => { if (r >= 0 && r < size && c >= 0 && c < size) { m[r][c] = v; fn[r][c] = 1; } };

  // finder patterns and their separators
  const finders = [[0, 0], [0, size - 7], [size - 7, 0]];
  for (let k = 0; k < 3; k++) {
    const R = finders[k][0], C = finders[k][1];
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const inR = r >= 0 && r < 7, inC = c >= 0 && c < 7;
      const on = inR && inC && (r === 0 || r === 6 || c === 0 || c === 6 ||
                                (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      set(R + r, C + c, on ? 1 : 0);
    }
  }

  // timing patterns
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0 ? 1 : 0); set(i, 6, i % 2 === 0 ? 1 : 0); }

  // alignment patterns, skipping the three that would sit on a finder
  const al = alignmentPositions(version);
  const last = al.length - 1;
  for (let i = 0; i <= last; i++) for (let j = 0; j <= last; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      set(al[i] + dr, al[j] + dc, (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)) ? 1 : 0);
    }
  }

  // Reserve the format areas, then the dark module. The two modules where the
  // format strip crosses a timing pattern, (6,8) and (8,6), belong to the
  // timing pattern and must survive: format information skips them.
  const reserve = (r, c) => { if (!fn[r][c]) { m[r][c] = 0; fn[r][c] = 1; } };
  for (let i = 0; i < 9; i++) { reserve(8, i); reserve(i, 8); }
  for (let i = 0; i < 8; i++) { reserve(8, size - 1 - i); reserve(size - 1 - i, 8); }
  set(size - 8, 8, 1);

  // reserve the version areas (v7 and up)
  if (version >= 7) {
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      set(size - 11 + j, i, 0);
      set(i, size - 11 + j, 0);
    }
  }

  return { m: m, fn: fn, size: size };
}

/**
 * Zigzag the codeword bits into the matrix, bottom-right to top-left.
 * cwAt records which codeword each module carries, so the logo check can later
 * work out which error-correction blocks a covered area damages.
 */
function placeData(m, fn, size, codewords, cwAt) {
  let bitIdx = 0;
  const totalBits = codewords.length * 8;

  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;                       // skip the vertical timing column
    for (let i = 0; i < size; i++) {
      const row = up ? size - 1 - i : i;
      for (let k = 0; k < 2; k++) {
        const c = col - k;
        if (fn[row][c]) continue;
        if (bitIdx < totalBits) {
          m[row][c] = (codewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
          if (cwAt) cwAt[row][c] = bitIdx >> 3;
          bitIdx++;
        } else {
          m[row][c] = 0;                        // remainder bits are always light
          if (cwAt) cwAt[row][c] = -1;
        }
      }
    }
    up = !up;
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
];

/* ---------- mask penalty, ISO/IEC 18004 section 7.8.3 ---------- */

/** Count 1:1:3:1:1 finder-lookalikes in the last seven run lengths. */
function finderLookalikes(hist) {
  const n = hist[1];
  const core = n > 0 && hist[2] === n && hist[3] === n * 3 && hist[4] === n && hist[5] === n;
  return (core && hist[0] >= n * 4 && hist[6] >= n ? 1 : 0) +
         (core && hist[6] >= n * 4 && hist[0] >= n ? 1 : 0);
}

function addRun(len, hist, size) {
  if (hist[0] === 0) len += size;               // the quiet zone counts as light
  hist.pop();
  hist.unshift(len);
}

function endRun(dark, len, hist, size) {
  if (dark) { addRun(len, hist, size); len = 0; }
  len += size;                                  // trailing quiet zone
  addRun(len, hist, size);
  return finderLookalikes(hist);
}

function penalty(m, size) {
  let score = 0;

  // rules 1 and 3, scanned once across every row and once down every column
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < size; i++) {
      let dark = false, run = 0;
      const hist = [0, 0, 0, 0, 0, 0, 0];
      for (let j = 0; j < size; j++) {
        const v = pass ? m[j][i] : m[i][j];
        if (v === (dark ? 1 : 0)) {
          run++;
          if (run === 5) score += 3;
          else if (run > 5) score++;
        } else {
          addRun(run, hist, size);
          if (!dark) score += finderLookalikes(hist) * 40;
          dark = v === 1;
          run = 1;
        }
      }
      score += endRun(dark, run, hist, size) * 40;
    }
  }

  // rule 2: 2x2 blocks of a single colour
  for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
    const v = m[r][c];
    if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
  }

  // rule 4: deviation from an even split of dark and light
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += m[r][c];
  const total = size * size;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;

  return score;
}

/**
 * Write the 15 format bits in both of their positions.
 *
 * Getting this wrong is the classic silent QR failure: the matrix looks right
 * to the eye, but the scanner reads the wrong mask and unmasks to noise.
 * Bit 0 is the least significant. Copy 1 runs down column 8 and then left
 * along row 8; copy 2 runs left along row 8 from the right edge and then up
 * column 8 from the bottom.
 */
function writeFormat(m, size, ecLevel, mask) {
  const fmt = formatBits(ecLevel, mask);
  const bit = (i) => (fmt >> i) & 1;

  for (let i = 0; i <= 5; i++) m[i][8] = bit(i);
  m[7][8] = bit(6);
  m[8][8] = bit(7);
  m[8][7] = bit(8);
  for (let i = 9; i <= 14; i++) m[8][14 - i] = bit(i);

  for (let i = 0; i < 8; i++) m[8][size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) m[size - 15 + i][8] = bit(i);

  m[size - 8][8] = 1;                           // dark module
}

function writeVersion(m, size, version) {
  if (version < 7) return;
  const vb = versionBits(version);
  for (let i = 0; i < 18; i++) {
    const bit = (vb >> i) & 1;
    const a = size - 11 + (i % 3), b = Math.floor(i / 3);
    m[b][a] = bit;
    m[a][b] = bit;
  }
}

/* ---------- encode ---------- */

/**
 * Encode text into a QR matrix.
 *
 * @param {string} text
 * @param {string} ecLevel  L, M, Q or H
 * @param {object} [opts]   minVersion, mask (0-7, otherwise chosen by penalty)
 * @returns {{matrix:number[][], size:number, version:number, ecLevel:string,
 *            mask:number, text:string, segments:object[], fn:Uint8Array[],
 *            cwAt:Int32Array[], ecLen:number, numBlocks:number}}
 */
function encodeQR(text, ecLevel, opts) {
  ecLevel = ecLevel || 'M';
  opts = opts || {};
  text = String(text == null ? '' : text);
  if (!text) throw new Error('Nothing to encode');
  if (!EC_INDEX.hasOwnProperty(ecLevel)) throw new Error('Error-correction level must be L, M, Q or H');

  const fit = pickVersion(text, ecLevel, opts.minVersion);
  if (!fit) {
    throw new Error('Too much data for one QR code at level ' + ecLevel +
      ' (limit ' + capacity(40, ecLevel).bytes + ' bytes). Shorten the content or lower the error correction.');
  }

  const version = fit.version;
  const built = buildCodewords(fit.segs, version, ecLevel);

  const base = buildMatrix(version);
  const cwAt = [];
  for (let i = 0; i < base.size; i++) cwAt.push(new Int32Array(base.size).fill(-1));
  placeData(base.m, base.fn, base.size, built.codewords, cwAt);
  writeVersion(base.m, base.size, version);

  // try every mask, keep the one the spec's penalty rules like best
  let best = null;
  const forced = typeof opts.mask === 'number' ? opts.mask : -1;
  for (let mask = 0; mask < 8; mask++) {
    if (forced >= 0 && mask !== forced) continue;
    const m = base.m.map((row) => row.slice());
    for (let r = 0; r < base.size; r++) {
      for (let c = 0; c < base.size; c++) if (!base.fn[r][c] && MASKS[mask](r, c)) m[r][c] ^= 1;
    }
    writeFormat(m, base.size, ecLevel, mask);
    const p = penalty(m, base.size);
    if (!best || p < best.penalty) best = { matrix: m, penalty: p, mask: mask };
  }

  return {
    matrix: best.matrix,
    size: base.size,
    version: version,
    ecLevel: ecLevel,
    mask: best.mask,
    text: text,
    segments: fit.segs.map((s) => ({ mode: s.mode, length: Array.from(s.text).length })),
    fn: base.fn,
    cwAt: cwAt,
    owner: built.owner,
    ecLen: built.ecLen,
    numBlocks: built.numBlocks
  };
}

/** How much a version and EC level can hold, per mode. */
function capacity(version, ecLevel) {
  const bits = dataCodewords(version, ecLevel) * 8;
  const room = (mode) => bits - 4 - countBits(mode, version);
  return {
    version: version,
    ecLevel: ecLevel,
    codewords: dataCodewords(version, ecLevel),
    bytes: Math.floor(room('byte') / 8),
    alnum: Math.floor(room('alnum') * 2 / 11),
    numeric: Math.floor(room('numeric') * 3 / 10)
  };
}

/* ---------- decode: read a finished matrix back ---------- */

/** All 32 valid format strings, for nearest-match correction. */
const VALID_FORMATS = (function () {
  const out = [];
  for (let ec = 0; ec < 4; ec++) {
    for (let mask = 0; mask < 8; mask++) out.push({ bits: formatBits(EC_LEVELS[ec], mask), ecLevel: EC_LEVELS[ec], mask: mask });
  }
  return out;
})();

const popcount = (n) => { let c = 0; while (n) { c += n & 1; n >>>= 1; } return c; };

function readFormat(m, size) {
  const read = (positions) => {
    let bits = 0;
    for (let i = 0; i < positions.length; i++) bits |= (m[positions[i][0]][positions[i][1]] & 1) << i;
    return bits;
  };
  const copy1 = [];
  for (let i = 0; i <= 5; i++) copy1.push([i, 8]);
  copy1.push([7, 8], [8, 8], [8, 7]);
  for (let i = 9; i <= 14; i++) copy1.push([8, 14 - i]);

  const copy2 = [];
  for (let i = 0; i < 8; i++) copy2.push([8, size - 1 - i]);
  for (let i = 8; i < 15; i++) copy2.push([size - 15 + i, 8]);

  let best = null;
  for (const raw of [read(copy1), read(copy2)]) {
    for (const cand of VALID_FORMATS) {
      const d = popcount(raw ^ cand.bits);
      if (!best || d < best.distance) best = { ecLevel: cand.ecLevel, mask: cand.mask, distance: d };
    }
  }
  return best;
}

function utf8Decode(bytes) {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  let s = '';
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i];
    let cp, n;
    if (b < 0x80) { cp = b; n = 1; }
    else if (b < 0xe0) { cp = b & 0x1f; n = 2; }
    else if (b < 0xf0) { cp = b & 0x0f; n = 3; }
    else { cp = b & 0x07; n = 4; }
    for (let k = 1; k < n; k++) cp = (cp << 6) | (bytes[i + k] & 0x3f);
    s += String.fromCodePoint(cp);
    i += n;
  }
  return s;
}

/**
 * Decode a QR matrix the way a scanner does: read the format info, undo the
 * mask, lift the codewords out in zigzag order, de-interleave the blocks,
 * check every Reed-Solomon syndrome, then read the segments back out.
 *
 * Returns { ok, text, version, ecLevel, mask, blockErrors, error }.
 */
function decodeQR(matrix) {
  const size = matrix.length;
  if (!size || matrix[0].length !== size) return { ok: false, error: 'Not a square matrix' };
  if (size < 21 || size > 177 || (size - 17) % 4) return { ok: false, error: 'Not a valid QR size' };
  const version = (size - 17) / 4;

  const fmt = readFormat(matrix, size);
  if (fmt.distance > 3) return { ok: false, error: 'Format information is unreadable' };
  const ecLevel = fmt.ecLevel, mask = fmt.mask;

  // undo the mask over the non-function modules only
  const base = buildMatrix(version);
  const m = [];
  for (let r = 0; r < size; r++) {
    const row = new Int8Array(size);
    for (let c = 0; c < size; c++) row[c] = (matrix[r][c] & 1) ^ (!base.fn[r][c] && MASKS[mask](r, c) ? 1 : 0);
    m.push(row);
  }

  // lift the raw codewords out in the same zigzag order they were written
  const raw = [];
  let acc = 0, nbits = 0;
  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < size; i++) {
      const row = up ? size - 1 - i : i;
      for (let k = 0; k < 2; k++) {
        const c = col - k;
        if (base.fn[row][c]) continue;
        acc = (acc << 1) | m[row][c];
        if (++nbits === 8) { raw.push(acc & 0xff); acc = 0; nbits = 0; }
      }
    }
    up = !up;
  }

  // de-interleave back into blocks
  const e = EC_INDEX[ecLevel];
  const ecLen = ECC_PER_BLOCK[e][version];
  const numBlocks = EC_BLOCKS[e][version];
  const rawCw = totalCodewords(version);
  const shortTotal = Math.floor(rawCw / numBlocks);
  const numShort = numBlocks - (rawCw % numBlocks);

  const dataLens = [];
  for (let i = 0; i < numBlocks; i++) dataLens.push(shortTotal - ecLen + (i < numShort ? 0 : 1));
  const maxData = Math.max.apply(null, dataLens);

  const blocks = [];
  for (let i = 0; i < numBlocks; i++) blocks.push([]);
  let p = 0;
  for (let i = 0; i < maxData; i++) {
    for (let j = 0; j < numBlocks; j++) if (i < dataLens[j]) blocks[j].push(raw[p++]);
  }
  const eccs = [];
  for (let i = 0; i < numBlocks; i++) eccs.push([]);
  for (let i = 0; i < ecLen; i++) {
    for (let j = 0; j < numBlocks; j++) eccs[j].push(raw[p++]);
  }

  // Repair what the error correction can, and note what it could not. A block
  // that comes back unrecoverable means the read is wrong, not merely noisy.
  const blockErrors = [];
  let corrected = 0, unrecoverable = false;
  for (let j = 0; j < numBlocks; j++) {
    const full = blocks[j].concat(eccs[j]);
    const fixed = rsCorrect(full, ecLen);
    if (fixed < 0) {
      blockErrors.push(true);
      unrecoverable = true;
    } else {
      blockErrors.push(false);
      corrected += fixed;
      for (let i = 0; i < blocks[j].length; i++) blocks[j][i] = full[i];
    }
  }
  if (unrecoverable) {
    return { ok: false, error: 'Error correction could not repair this code', blockErrors: blockErrors };
  }

  // read the segments out of the concatenated data codewords
  const bits = [];
  for (let j = 0; j < numBlocks; j++) {
    for (const b of blocks[j]) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  }
  let pos = 0;
  const take = (n) => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | (bits[pos++] || 0); return v; };

  let text = '';
  try {
    while (pos + 4 <= bits.length) {
      const mode = take(4);
      if (mode === 0) break;                                    // terminator
      if (mode === 0b0111) { take(8); continue; }               // ECI, ignored
      const name = mode === 0b0001 ? 'numeric' : mode === 0b0010 ? 'alnum' : mode === 0b0100 ? 'byte' : null;
      if (!name) return { ok: false, error: 'Unsupported mode ' + mode.toString(2) };
      const n = take(countBits(name, version));
      if (name === 'numeric') {
        for (let i = 0; i < n;) {
          const left = n - i;
          const chunk = Math.min(3, left);
          const val = take(chunk * 3 + 1);
          text += String(val).padStart(chunk, '0');
          i += chunk;
        }
      } else if (name === 'alnum') {
        for (let i = 0; i < n;) {
          if (n - i >= 2) { const v = take(11); text += ALNUM[Math.floor(v / 45)] + ALNUM[v % 45]; i += 2; }
          else { text += ALNUM[take(6)]; i += 1; }
        }
      } else {
        const bytes = [];
        for (let i = 0; i < n; i++) bytes.push(take(8));
        text += utf8Decode(bytes);
      }
    }
  } catch (err) {
    return { ok: false, error: 'Data stream ended early' };
  }

  return {
    ok: true,
    text: text,
    version: version,
    ecLevel: ecLevel,
    mask: mask,
    corrected: corrected,
    blockErrors: blockErrors,
    formatDistance: fmt.distance,
    error: null
  };
}

/* ---------- verification ---------- */

/** Modules a centred logo of `fraction` width would cover, plus its padding. */
function logoRect(qr, fraction, padding) {
  const span = Math.max(1, Math.round(qr.size * fraction));
  const start = Math.floor((qr.size - span) / 2);
  const pad = padding || 0;
  return { r0: start - pad, c0: start - pad, r1: start + span - 1 + pad, c1: start + span - 1 + pad, span: span };
}

/**
 * Would the code still decode with a logo dropped on top of it?
 *
 * Reed-Solomon corrects up to ecLen/2 damaged codewords per block, so the
 * honest test is per block rather than "logo under 30% of the area". A logo
 * sitting over one block's codewords can break a code that is well inside the
 * headline percentage for the level.
 */
function logoImpact(qr, fraction, padding) {
  const rect = logoRect(qr, fraction, padding);
  const hitPerBlock = [];
  for (let i = 0; i < qr.numBlocks; i++) hitPerBlock.push(new Set());

  for (let r = Math.max(0, rect.r0); r <= Math.min(qr.size - 1, rect.r1); r++) {
    for (let c = Math.max(0, rect.c0); c <= Math.min(qr.size - 1, rect.c1); c++) {
      const cw = qr.cwAt[r][c];
      if (cw >= 0) hitPerBlock[qr.owner[cw]].add(cw);
    }
  }

  const budget = Math.floor(qr.ecLen / 2);
  let worst = 0;
  for (const set of hitPerBlock) worst = Math.max(worst, set.size);
  const covered = (rect.r1 - rect.r0 + 1) * (rect.c1 - rect.c0 + 1) / (qr.size * qr.size);

  return {
    rect: rect,
    budget: budget,
    worstBlock: worst,
    used: budget ? worst / budget : 1,
    coverage: covered,
    safe: worst <= budget * 0.7,                 // leave room for print and camera noise
    fatal: worst > budget
  };
}

/**
 * Decode the finished matrix and confirm it gives back exactly what went in.
 * This is the check that would have caught the format-information bug that
 * made every earlier code on this page unscannable.
 */
function verifyQR(qr, opts) {
  opts = opts || {};
  const got = decodeQR(qr.matrix);
  const matches = got.ok && got.text === qr.text && !got.corrected && !got.formatDistance;
  const out = {
    ok: matches,
    decoded: got.text,
    version: got.version,
    ecLevel: got.ecLevel,
    mask: got.mask,
    error: matches ? null : (got.error || 'Decoded content did not match the input')
  };
  if (opts.logo) out.logo = logoImpact(qr, opts.logo.size, opts.logo.padding);
  return out;
}

/* ---------- SVG rendering ---------- */

/* Everything below works in module units: one unit is one QR module, and the
   scale only ever reaches the width and height attributes. That keeps the path
   data short and the output resolution-independent. */

const nf = (v) => {
  const s = (Math.round(v * 1000) / 1000).toString();
  return s === '-0' ? '0' : s;
};

/** Rounded rectangle with per-corner radii [topLeft, topRight, bottomRight, bottomLeft]. */
function rrect(x, y, w, h, radii) {
  const r = typeof radii === 'number' ? [radii, radii, radii, radii] : radii;
  const tl = r[0], tr = r[1], br = r[2], bl = r[3];
  let d = 'M' + nf(x + tl) + ' ' + nf(y);
  d += 'H' + nf(x + w - tr);
  if (tr) d += 'A' + nf(tr) + ' ' + nf(tr) + ' 0 0 1 ' + nf(x + w) + ' ' + nf(y + tr);
  d += 'V' + nf(y + h - br);
  if (br) d += 'A' + nf(br) + ' ' + nf(br) + ' 0 0 1 ' + nf(x + w - br) + ' ' + nf(y + h);
  d += 'H' + nf(x + bl);
  if (bl) d += 'A' + nf(bl) + ' ' + nf(bl) + ' 0 0 1 ' + nf(x) + ' ' + nf(y + h - bl);
  d += 'V' + nf(y + tl);
  if (tl) d += 'A' + nf(tl) + ' ' + nf(tl) + ' 0 0 1 ' + nf(x + tl) + ' ' + nf(y);
  return d + 'Z';
}

function circlePath(cx, cy, r) {
  return 'M' + nf(cx - r) + ' ' + nf(cy) +
         'a' + nf(r) + ' ' + nf(r) + ' 0 1 0 ' + nf(r * 2) + ' 0' +
         'a' + nf(r) + ' ' + nf(r) + ' 0 1 0 ' + nf(-r * 2) + ' 0Z';
}

const MODULE_SHAPES = ['square', 'rounded', 'fluid', 'dots', 'classy', 'vertical', 'horizontal'];
const EYE_FRAME_SHAPES = ['square', 'rounded', 'leaf', 'petal'];
const EYE_BALL_SHAPES = ['square', 'rounded', 'leaf'];

/**
 * Path for the data modules - everything except the three finder eyes, which
 * are drawn separately so they can carry their own shape and colour.
 */
function modulePath(qr, shape, quiet) {
  const size = qr.size;
  const inEye = (r, c) =>
    (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);
  const on = (r, c) =>
    r >= 0 && r < size && c >= 0 && c < size && !inEye(r, c) && qr.matrix[r][c] === 1;

  let d = '';
  const X = (c) => c + quiet;
  const Y = (r) => r + quiet;

  if (shape === 'vertical' || shape === 'horizontal') {
    // merge neighbouring modules into one capsule so the bars read as bars
    const vertical = shape === 'vertical';
    const thick = 0.94;
    const seen = [];
    for (let i = 0; i < size; i++) seen.push(new Uint8Array(size));
    for (let a = 0; a < size; a++) {
      for (let b = 0; b < size; b++) {
        const r = vertical ? b : a, c = vertical ? a : b;
        if (!on(r, c) || seen[r][c]) continue;
        seen[r][c] = 1;
        if (r === 6 || c === 6) {                 // timing pattern, kept solid
          d += 'M' + nf(X(c)) + ' ' + nf(Y(r)) + 'h1v1h-1Z';
          continue;
        }
        let len = 1;
        for (;;) {
          const nr = vertical ? r + len : r, nc = vertical ? c : c + len;
          if (!on(nr, nc) || nr === 6 || nc === 6) break;
          seen[nr][nc] = 1;
          len++;
        }
        const inset = (1 - thick) / 2;
        const w = vertical ? thick : len - (1 - thick);
        const h = vertical ? len - (1 - thick) : thick;
        d += rrect(X(c) + inset, Y(r) + inset, w, h, thick / 2);
      }
    }
    return d;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!on(r, c)) continue;
      const x = X(c), y = Y(r);

      /* The timing patterns stay solid whatever the body shape is. Scanners
         walk row 6 and column 6 to work out where the module grid falls, and
         a dotted or inset timing line measurably costs reads on denser codes
         for the sake of two lines of decoration nobody looks at. */
      if (shape === 'square' || r === 6 || c === 6) {
        d += 'M' + nf(x) + ' ' + nf(y) + 'h1v1h-1Z';
      } else if (shape === 'dots') {
        /* Overlapping rather than touching. Measured against an independent
           decoder across every eye combination, 0.58 failed a sixth as often
           as 0.55; pushing further to 0.62 got worse again, so this is the
           bottom of the curve, not a guess. */
        d += circlePath(x + 0.5, y + 0.5, 0.58);
      } else if (shape === 'rounded') {
        d += rrect(x, y, 1, 1, 0.3);
      } else if (shape === 'classy') {
        d += rrect(x, y, 1, 1, [0.32, 0, 0.32, 0]);
      } else {
        // fluid: round only the corners with no neighbour, so runs of modules
        // join into continuous strokes
        const up = on(r - 1, c), down = on(r + 1, c), left = on(r, c - 1), right = on(r, c + 1);
        const k = 0.5;
        d += rrect(x, y, 1, 1, [
          !up && !left ? k : 0,
          !up && !right ? k : 0,
          !down && !right ? k : 0,
          !down && !left ? k : 0
        ]);
      }
    }
  }
  return d;
}

/** The 1-module-thick ring of a finder pattern, as an even-odd path. */
function eyeFramePath(x, y, shape) {
  const ix = x + 1, iy = y + 1;
  if (shape === 'rounded') return rrect(x, y, 7, 7, 2) + rrect(ix, iy, 5, 5, 1.3);
  if (shape === 'leaf') return rrect(x, y, 7, 7, [2.5, 0, 2.5, 0]) + rrect(ix, iy, 5, 5, [1.7, 0, 1.7, 0]);
  if (shape === 'petal') return rrect(x, y, 7, 7, [2.5, 0.6, 2.5, 0.6]) + rrect(ix, iy, 5, 5, [1.7, 0.4, 1.7, 0.4]);
  return rrect(x, y, 7, 7, 0) + rrect(ix, iy, 5, 5, 0);
}

function eyeBallPath(x, y, shape) {
  const bx = x + 2, by = y + 2;
  if (shape === 'rounded') return rrect(bx, by, 3, 3, 1);
  if (shape === 'leaf') return rrect(bx, by, 3, 3, [1, 0, 1, 0]);
  return rrect(bx, by, 3, 3, 0);
}

let gradSeq = 0;

/** Gradient definition and the fill that references it. */
function gradientDef(g, uid) {
  const id = uid + 'g';
  let def;
  if (g.type === 'radial') {
    def = '<radialGradient id="' + id + '" cx="50%" cy="50%" r="70%">';
  } else {
    const a = ((typeof g.angle === 'number' ? g.angle : 45) % 360) * Math.PI / 180;
    def = '<linearGradient id="' + id + '" x1="' + nf(50 - Math.cos(a) * 50) + '%" y1="' +
          nf(50 - Math.sin(a) * 50) + '%" x2="' + nf(50 + Math.cos(a) * 50) + '%" y2="' +
          nf(50 + Math.sin(a) * 50) + '%">';
  }
  def += '<stop offset="0%" stop-color="' + g.from + '"/><stop offset="100%" stop-color="' + g.to + '"/>';
  def += g.type === 'radial' ? '</radialGradient>' : '</linearGradient>';
  return { def: def, fill: 'url(#' + id + ')' };
}

/**
 * Render a matrix to a standalone SVG string.
 *
 * @param {object} qr    result of encodeQR
 * @param {object} opts  scale, quiet, dark, light, shape, eyeFrame, eyeBall,
 *                       eyeFrameColour, eyeBallColour, gradient, logo, radius
 */
function qrToSVG(qr, opts) {
  opts = opts || {};
  const scale = opts.scale || 8;
  const quiet = opts.quiet === undefined ? 4 : Math.max(0, opts.quiet);
  const dark = opts.dark || '#000000';
  const light = opts.light === undefined ? '#ffffff' : opts.light;
  const shape = MODULE_SHAPES.indexOf(opts.shape) >= 0 ? opts.shape : 'square';
  const eyeFrame = EYE_FRAME_SHAPES.indexOf(opts.eyeFrame) >= 0 ? opts.eyeFrame : 'square';
  const eyeBall = EYE_BALL_SHAPES.indexOf(opts.eyeBall) >= 0 ? opts.eyeBall : 'square';

  const dim = qr.size + quiet * 2;
  const px = Math.round(dim * scale);
  const uid = 'q' + (++gradSeq).toString(36) + Math.random().toString(36).slice(2, 6);

  let defs = '';
  let moduleFill = dark;
  if (opts.gradient && opts.gradient.from && opts.gradient.to) {
    const g = gradientDef(opts.gradient, uid);
    defs += g.def;
    moduleFill = g.fill;
  }
  const frameFill = opts.eyeFrameColour || moduleFill;
  const ballFill = opts.eyeBallColour || moduleFill;

  const solid = light && light !== 'none' && light !== 'transparent';
  let body = '';
  if (solid) {
    body += opts.radius
      ? '<path d="' + rrect(0, 0, dim, dim, Math.min(opts.radius, dim / 2)) + '" fill="' + light + '"/>'
      : '<rect width="' + dim + '" height="' + dim + '" fill="' + light + '"/>';
  }

  body += '<path d="' + modulePath(qr, shape, quiet) + '" fill="' + moduleFill + '"/>';

  const eyes = [[quiet, quiet], [quiet, quiet + qr.size - 7], [quiet + qr.size - 7, quiet]];
  let frames = '', balls = '';
  for (let i = 0; i < eyes.length; i++) {
    frames += eyeFramePath(eyes[i][1], eyes[i][0], eyeFrame);
    balls += eyeBallPath(eyes[i][1], eyes[i][0], eyeBall);
  }
  body += '<path d="' + frames + '" fill="' + frameFill + '" fill-rule="evenodd"/>';
  body += '<path d="' + balls + '" fill="' + ballFill + '"/>';

  if (opts.logo && opts.logo.href) {
    const L = opts.logo;
    const span = Math.max(1, Math.round(qr.size * (L.size || 0.2)));
    const start = quiet + Math.floor((qr.size - span) / 2);
    const pad = L.padding === undefined ? 1 : L.padding;
    if (L.background !== 'none' && pad > 0) {
      body += '<path d="' + rrect(start - pad, start - pad, span + pad * 2, span + pad * 2,
        L.backgroundRadius === undefined ? 1 : L.backgroundRadius) +
        '" fill="' + (L.background || (solid ? light : '#ffffff')) + '"/>';
    }
    body += '<image href="' + L.href + '" x="' + nf(start) + '" y="' + nf(start) +
            '" width="' + span + '" height="' + span + '" preserveAspectRatio="xMidYMid meet"/>';
  }

  const crisp = shape === 'square' && eyeFrame === 'square' && eyeBall === 'square' && !opts.gradient
    ? ' shape-rendering="crispEdges"' : '';

  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + px + '" height="' + px +
         '" viewBox="0 0 ' + dim + ' ' + dim + '"' + crisp + '>' +
         (defs ? '<defs>' + defs + '</defs>' : '') + body + '</svg>';
}

/* ---------- exports ---------- */

const QR = {
  encode: encodeQR,
  toSVG: qrToSVG,
  decode: decodeQR,
  verify: verifyQR,
  capacity: capacity,
  logoImpact: logoImpact,
  shapes: { module: MODULE_SHAPES, eyeFrame: EYE_FRAME_SHAPES, eyeBall: EYE_BALL_SHAPES },
  levels: EC_LEVELS
};

root.encodeQR = encodeQR;
root.qrToSVG = qrToSVG;
root.decodeQR = decodeQR;
root.verifyQR = verifyQR;
root.QR = QR;
if (typeof module !== 'undefined' && module.exports) module.exports = QR;

})(typeof window !== 'undefined' ? window : globalThis);
