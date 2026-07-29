/**
 * QR Code encoder — ISO/IEC 18004, written from scratch.
 * No dependencies. Byte mode, versions 1–10, EC levels L/M/Q/H.
 *
 * Pipeline: text -> UTF-8 bytes -> data codewords -> Reed-Solomon ECC
 *        -> interleave -> place in matrix -> mask -> format/version info.
 */

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

/** Reed-Solomon error-correction codewords for a block. */
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
 * Syndrome check — used by the test suite.
 * A correct RS codeword evaluates to zero at each root a^i, so all
 * syndromes must be zero. This proves the ECC without needing a decoder.
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

/* ---------- capacity tables, versions 1–10 ----------
   [total codewords, ecCodewordsPerBlock, group1Blocks, group1DataCw,
    group2Blocks, group2DataCw] */
const RS_BLOCKS = {
  L: [[19,7,1,19,0,0],[34,10,1,34,0,0],[55,15,1,55,0,0],[80,20,1,80,0,0],
      [108,26,1,108,0,0],[136,18,2,68,0,0],[156,20,2,78,0,0],[194,24,2,97,0,0],
      [232,30,2,116,0,0],[274,18,2,68,2,69]],
  M: [[16,10,1,16,0,0],[28,16,1,28,0,0],[44,26,1,44,0,0],[64,18,2,32,0,0],
      [86,24,2,43,0,0],[108,16,4,27,0,0],[124,18,4,31,0,0],[154,22,2,38,2,39],
      [182,22,3,36,2,37],[216,26,4,43,1,44]],
  Q: [[13,13,1,13,0,0],[22,22,1,22,0,0],[34,18,2,17,0,0],[48,26,2,24,0,0],
      [62,18,2,15,2,16],[76,24,4,19,0,0],[88,18,2,14,4,15],[110,22,4,18,2,19],
      [132,20,4,16,4,17],[154,24,6,19,2,20]],
  H: [[9,17,1,9,0,0],[16,28,1,16,0,0],[26,22,2,13,0,0],[36,16,4,9,0,0],
      [46,22,2,11,2,12],[60,28,4,15,0,0],[66,26,4,13,1,14],[86,26,4,14,2,15],
      [100,24,4,12,4,13],[122,28,6,15,2,16]]
};

const ALIGNMENT = {
  1: [], 2: [6,18], 3: [6,22], 4: [6,26], 5: [6,30],
  6: [6,34], 7: [6,22,38], 8: [6,24,42], 9: [6,26,46], 10: [6,28,50]
};

/* format info: 15 bits, BCH(15,5) + mask 0x5412 */
function formatBits(ecLevel, mask) {
  const ecBits = { L: 1, M: 0, Q: 3, H: 2 }[ecLevel];
  let data = (ecBits << 3) | mask;
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

/** Smallest version that fits the payload at the requested EC level. */
function pickVersion(byteLen, ecLevel) {
  for (let v = 1; v <= 10; v++) {
    const [, ecCw, g1, g1cw, g2, g2cw] = RS_BLOCKS[ecLevel][v - 1];
    const dataCw = g1 * g1cw + g2 * g2cw;
    const lenBits = v < 10 ? 8 : 16;
    const needed = Math.ceil((4 + lenBits + byteLen * 8) / 8);
    if (needed <= dataCw) return v;
  }
  return null;
}

function buildCodewords(bytes, version, ecLevel) {
  const [, ecCw, g1, g1cw, g2, g2cw] = RS_BLOCKS[ecLevel][version - 1];
  const dataCw = g1 * g1cw + g2 * g2cw;
  const lenBits = version < 10 ? 8 : 16;

  // bit stream: mode (0100 = byte) + length + payload
  const bits = [];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, lenBits);
  for (const b of bytes) push(b, 8);

  // terminator, up to 4 zero bits
  for (let i = 0; i < 4 && bits.length < dataCw * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    data.push(b);
  }
  // pad alternately with 0xEC / 0x11
  const PAD = [0xec, 0x11];
  let p = 0;
  while (data.length < dataCw) data.push(PAD[p++ % 2]);

  // split into blocks, compute ECC per block
  const blocks = [], eccs = [];
  let pos = 0;
  for (let i = 0; i < g1; i++) { blocks.push(data.slice(pos, pos + g1cw)); pos += g1cw; }
  for (let i = 0; i < g2; i++) { blocks.push(data.slice(pos, pos + g2cw)); pos += g2cw; }
  for (const b of blocks) eccs.push(rsEncode(b, ecCw));

  // interleave data, then ECC
  const out = [];
  const maxData = Math.max(...blocks.map(b => b.length));
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecCw; i++) for (const e of eccs) out.push(e[i]);

  return { codewords: out, blocks, eccs, ecCw };
}

function buildMatrix(version) {
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(null));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const setF = (r, c, v) => { if (r >= 0 && r < size && c >= 0 && c < size) { m[r][c] = v; reserved[r][c] = true; } };

  // finder patterns + separators
  for (const [R, C] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const inR = r >= 0 && r < 7, inC = c >= 0 && c < 7;
      const on = inR && inC && (r === 0 || r === 6 || c === 0 || c === 6 ||
                                (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      setF(R + r, C + c, on ? 1 : 0);
    }
  }

  // timing patterns
  for (let i = 8; i < size - 8; i++) { setF(6, i, i % 2 === 0 ? 1 : 0); setF(i, 6, i % 2 === 0 ? 1 : 0); }

  // alignment patterns
  const al = ALIGNMENT[version];
  for (const r of al) for (const c of al) {
    if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      setF(r + dr, c + dc, (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)) ? 1 : 0);
    }
  }

  // dark module
  setF(size - 8, 8, 1);

  // reserve format areas
  for (let i = 0; i < 9; i++) { if (!reserved[8][i]) { m[8][i] = 0; reserved[8][i] = true; }
                                if (!reserved[i][8]) { m[i][8] = 0; reserved[i][8] = true; } }
  for (let i = 0; i < 8; i++) { if (!reserved[8][size - 1 - i]) { m[8][size - 1 - i] = 0; reserved[8][size - 1 - i] = true; }
                                if (!reserved[size - 1 - i][8]) { m[size - 1 - i][8] = 0; reserved[size - 1 - i][8] = true; } }

  // reserve version areas (v7+)
  if (version >= 7) {
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      m[size - 11 + j][i] = 0; reserved[size - 11 + j][i] = true;
      m[i][size - 11 + j] = 0; reserved[i][size - 11 + j] = true;
    }
  }

  return { m, reserved, size };
}

function placeData(m, reserved, size, codewords) {
  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  const nextBit = () => {
    if (bitIdx >= totalBits) return 0;
    const b = (codewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
    bitIdx++;
    return b;
  };

  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;                       // skip the vertical timing column
    for (let i = 0; i < size; i++) {
      const row = up ? size - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (!reserved[row][c]) m[row][c] = nextBit();
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

function penalty(m, size) {
  let score = 0;

  // rule 1: runs of 5+ same-colour modules
  for (let i = 0; i < size; i++) {
    for (const line of [m[i], m.map(row => row[i])]) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        if (line[j] === line[j - 1]) { run++; if (run === 5) score += 3; else if (run > 5) score++; }
        else run = 1;
      }
    }
  }

  // rule 2: 2x2 blocks of one colour
  for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
    const v = m[r][c];
    if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
  }

  // rule 3: finder-like 1:1:3:1:1 patterns
  const P1 = [1,0,1,1,1,0,1,0,0,0,0], P2 = [0,0,0,0,1,0,1,1,1,0,1];
  const match = (line, i, pat) => pat.every((v, k) => line[i + k] === v);
  for (let i = 0; i < size; i++) {
    const row = m[i], col = m.map(r => r[i]);
    for (let j = 0; j + 11 <= size; j++) {
      if (match(row, j, P1) || match(row, j, P2)) score += 40;
      if (match(col, j, P1) || match(col, j, P2)) score += 40;
    }
  }

  // rule 4: deviation from 50% dark
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += m[r][c];
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;

  return score;
}

/**
 * Encode text into a QR matrix.
 * @returns {{ matrix:number[][], size:number, version:number, ecLevel:string, mask:number }}
 */
function encodeQR(text, ecLevel = 'M') {
  if (!text) throw new Error('Nothing to encode');
  if (!RS_BLOCKS[ecLevel]) throw new Error('Error-correction level must be L, M, Q or H');

  const bytes = utf8Bytes(text);
  const version = pickVersion(bytes.length, ecLevel);
  if (!version) throw new Error('Too much data — shorten the text or lower the error correction');

  const { codewords } = buildCodewords(bytes, version, ecLevel);

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const { m, reserved, size } = buildMatrix(version);
    placeData(m, reserved, size, codewords);

    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && MASKS[mask](r, c)) m[r][c] ^= 1;
    }

    // format info
    const fmt = formatBits(ecLevel, mask);
    for (let i = 0; i < 15; i++) {
      const bit = (fmt >> i) & 1;
      if (i < 6) m[8][i] = bit;
      else if (i < 8) m[8][i + 1] = bit;
      else if (i === 8) m[7][8] = bit;
      else m[14 - i][8] = bit;

      if (i < 8) m[size - 1 - i][8] = bit;
      else m[8][size - 15 + i] = bit;
    }
    m[size - 8][8] = 1; // dark module

    if (version >= 7) {
      const vb = versionBits(version);
      for (let i = 0; i < 18; i++) {
        const bit = (vb >> i) & 1;
        m[Math.floor(i / 3)][size - 11 + (i % 3)] = bit;
        m[size - 11 + (i % 3)][Math.floor(i / 3)] = bit;
      }
    }

    const p = penalty(m, size);
    if (!best || p < best.penalty) best = { matrix: m, size, penalty: p, mask };
  }

  return { matrix: best.matrix, size: best.size, version, ecLevel, mask: best.mask };
}

/** Render a matrix to a standalone SVG string (4-module quiet zone per spec). */
function qrToSVG(qr, { scale = 8, dark = '#000000', light = '#ffffff', quiet = 4 } = {}) {
  const dim = qr.size + quiet * 2;
  const px = dim * scale;
  let path = '';
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.matrix[r][c]) path += `M${(c + quiet) * scale} ${(r + quiet) * scale}h${scale}v${scale}h-${scale}z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" shape-rendering="crispEdges">` +
         `<rect width="${px}" height="${px}" fill="${light}"/>` +
         `<path d="${path}" fill="${dark}"/></svg>`;
}


window.encodeQR=encodeQR;window.qrToSVG=qrToSVG;