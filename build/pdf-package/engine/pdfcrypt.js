/**
 * PDF Standard Security Handler — opening and writing encrypted PDFs, in pure
 * synchronous JavaScript with no dependencies.
 *
 * Covers the whole of the Standard handler as PDF 1.x and 2.0 define it:
 *   V1/V2  RC4, 40 to 128 bit (revisions 2 and 3)
 *   V4     crypt filters: StdCF with CFM V2 (RC4), AESV2 (AES-128) or None,
 *          the Identity filter, and EncryptMetadata false (revision 4)
 *   V5     AESV3 (AES-256), revision 5 (the withdrawn Adobe extension) and
 *          revision 6 (ISO 32000-2, algorithm 2.B)
 * It writes AES-128 (V4 R4) and AES-256 (V5 R6). RC4 is read but never
 * written: it has been broken for years.
 *
 * Everything works on Uint8Array and is synchronous, because it runs both in
 * a Web Worker and in Node. AES is table-driven (four 256-entry T-tables for
 * each direction) and the CBC loops allocate nothing per block, so a 100 MB
 * document's streams decrypt in well under a second or two.
 *
 * This file is concatenated after pdfcore.js into a browser bundle, so all of
 * it lives inside the single PDFCrypt declaration below.
 */
const PDFCrypt = (function () {
  'use strict';

  /* ============================================================
     Byte helpers
     ============================================================ */

  const EMPTY = new Uint8Array(0);
  const ZERO_IV = new Uint8Array(16);

  function toU8(v) {
    if (v instanceof Uint8Array) return v;
    if (v == null) return EMPTY;
    if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    if (v instanceof ArrayBuffer) return new Uint8Array(v);
    if (Array.isArray(v)) return Uint8Array.from(v);
    if (typeof v === 'string') {
      const a = new Uint8Array(v.length);
      for (let i = 0; i < v.length; i++) a[i] = v.charCodeAt(i) & 0xff;
      return a;
    }
    throw new TypeError('Expected bytes (a Uint8Array)');
  }

  function concat() {
    let len = 0;
    for (let i = 0; i < arguments.length; i++) len += arguments[i].length;
    const out = new Uint8Array(len);
    let p = 0;
    for (let i = 0; i < arguments.length; i++) { out.set(arguments[i], p); p += arguments[i].length; }
    return out;
  }

  function sameBytes(a, b, n) {
    if (a.length < n || b.length < n) return false;
    let diff = 0;
    for (let i = 0; i < n; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }

  function hex(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return s;
  }

  /* Pads a hash input's tail and feeds it, plus every whole block before it,
     to a compression function. Whole blocks are read straight from the
     input, so hashing a large buffer does not copy it. */
  function runHash(bytes, blockSize, lenBytes, bigEndian, compress, state) {
    const n = bytes.length;
    const full = n - (n % blockSize);
    for (let off = 0; off < full; off += blockSize) compress(state, bytes, off);
    const rem = n - full;
    const tailLen = rem + 1 + lenBytes <= blockSize ? blockSize : 2 * blockSize;
    const tail = new Uint8Array(tailLen);
    tail.set(bytes.subarray(full));
    tail[rem] = 0x80;
    const lo = ((n % 0x20000000) * 8) >>> 0;     // bit length, low 32 bits
    const hi = Math.floor(n / 0x20000000);       // and the bits above them
    if (bigEndian) {
      writeBE(tail, tailLen - 4, lo);
      writeBE(tail, tailLen - 8, hi);
    } else {
      writeLE(tail, tailLen - 8, lo);
      writeLE(tail, tailLen - 4, hi);
    }
    for (let off = 0; off < tailLen; off += blockSize) compress(state, tail, off);
  }

  function writeBE(b, p, v) { b[p] = v >>> 24; b[p + 1] = (v >>> 16) & 255; b[p + 2] = (v >>> 8) & 255; b[p + 3] = v & 255; }
  function writeLE(b, p, v) { b[p] = v & 255; b[p + 1] = (v >>> 8) & 255; b[p + 2] = (v >>> 16) & 255; b[p + 3] = v >>> 24; }

  /* ============================================================
     MD5 (RFC 1321)
     ============================================================ */

  const MD5_K = Int32Array.from([
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
  ].map(x => x | 0));
  const MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const MD5_M = new Int32Array(16);

  function md5Compress(st, b, off) {
    const M = MD5_M;
    for (let i = 0; i < 16; i++) {
      const p = off + 4 * i;
      M[i] = b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24);
    }
    let a = st[0], bb = st[1], c = st[2], d = st[3];
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (bb & c) | (~bb & d); g = i; }
      else if (i < 32) { f = (d & bb) | (~d & c); g = (5 * i + 1) & 15; }
      else if (i < 48) { f = bb ^ c ^ d; g = (3 * i + 5) & 15; }
      else { f = c ^ (bb | ~d); g = (7 * i) & 15; }
      const x = (a + f + MD5_K[i] + M[g]) | 0;
      const s = MD5_S[((i >> 4) << 2) | (i & 3)];
      a = d; d = c; c = bb;
      bb = (bb + ((x << s) | (x >>> (32 - s)))) | 0;
    }
    st[0] = (st[0] + a) | 0; st[1] = (st[1] + bb) | 0;
    st[2] = (st[2] + c) | 0; st[3] = (st[3] + d) | 0;
  }

  function md5(input) {
    const st = Int32Array.from([0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476]);
    runHash(toU8(input), 64, 8, false, md5Compress, st);
    const out = new Uint8Array(16);
    for (let i = 0; i < 4; i++) writeLE(out, 4 * i, st[i]);
    return out;
  }

  /* ============================================================
     SHA-256, SHA-384, SHA-512 (FIPS 180-4)

     The round constants are the fractional parts of the cube roots of the
     first 80 primes, and the initial values those of the square roots. They
     are derived here with exact integer roots rather than typed out, which
     removes the chance of a transcription slip; SHA-256's constants are the
     top 32 bits of SHA-512's.
     ============================================================ */

  let K512 = null, K256 = null, H512 = null, H384 = null, H256 = null;
  let W512 = null, W256 = null;

  function initSha() {
    if (K512) return;
    const B = (x) => BigInt(x);
    const iroot = (n, k) => {                     // floor(n^(1/k)) by Newton
      let x = B(1) << B(Math.ceil(n.toString(2).length / k) + 1);
      const kk = B(k), k1 = B(k - 1);
      for (;;) {
        const y = (k1 * x + n / (x ** k1)) / kk;
        if (y >= x) return x;
        x = y;
      }
    };
    const primes = [];
    for (let c = 2; primes.length < 80; c++) {
      let isPrime = true;
      for (const p of primes) { if (p * p > c) break; if (c % p === 0) { isPrime = false; break; } }
      if (isPrime) primes.push(c);
    }
    const M32 = B(0xffffffff), M64 = (B(1) << B(64)) - B(1);
    const split = (arr, i, v) => { arr[2 * i] = Number((v >> B(32)) & M32) | 0; arr[2 * i + 1] = Number(v & M32) | 0; };
    K512 = new Int32Array(160);
    K256 = new Int32Array(64);
    for (let i = 0; i < 80; i++) {
      const v = iroot(B(primes[i]) << B(192), 3) & M64;
      split(K512, i, v);
      if (i < 64) K256[i] = K512[2 * i];
    }
    H512 = new Int32Array(16); H384 = new Int32Array(16); H256 = new Int32Array(8);
    for (let i = 0; i < 8; i++) {
      split(H512, i, iroot(B(primes[i]) << B(128), 2) & M64);
      split(H384, i, iroot(B(primes[i + 8]) << B(128), 2) & M64);
      H256[i] = H512[2 * i];
    }
    W512 = new Int32Array(160);
    W256 = new Int32Array(64);
  }

  function sha256Compress(st, b, off) {
    const W = W256, K = K256;
    for (let t = 0; t < 16; t++) {
      const p = off + 4 * t;
      W[t] = (b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3];
    }
    for (let t = 16; t < 64; t++) {
      const x = W[t - 15], y = W[t - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }
    let a = st[0], bb = st[1], c = st[2], d = st[3], e = st[4], f = st[5], g = st[6], h = st[7];
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & bb) ^ (a & c) ^ (bb & c);
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = bb; bb = a; a = (t1 + S0 + maj) | 0;
    }
    st[0] = (st[0] + a) | 0; st[1] = (st[1] + bb) | 0; st[2] = (st[2] + c) | 0; st[3] = (st[3] + d) | 0;
    st[4] = (st[4] + e) | 0; st[5] = (st[5] + f) | 0; st[6] = (st[6] + g) | 0; st[7] = (st[7] + h) | 0;
  }

  function sha256(input) {
    initSha();
    const st = Int32Array.from(H256);
    runHash(toU8(input), 64, 8, true, sha256Compress, st);
    const out = new Uint8Array(32);
    for (let i = 0; i < 8; i++) writeBE(out, 4 * i, st[i]);
    return out;
  }

  /* 64-bit words are held as (high, low) pairs of signed 32-bit integers.
     Sums of low halves are taken as unsigned doubles (exact below 2^53) and
     the carry moved into the high half. */
  const TWO32 = 4294967296;

  function sha512Compress(st, b, off) {
    const W = W512, K = K512;
    for (let t = 0; t < 32; t++) {
      const p = off + 4 * t;
      W[t] = (b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3];
    }
    for (let t = 16; t < 80; t++) {
      let xh = W[2 * (t - 15)], xl = W[2 * (t - 15) + 1];
      const s0h = ((xh >>> 1) | (xl << 31)) ^ ((xh >>> 8) | (xl << 24)) ^ (xh >>> 7);
      const s0l = ((xl >>> 1) | (xh << 31)) ^ ((xl >>> 8) | (xh << 24)) ^ ((xl >>> 7) | (xh << 25));
      xh = W[2 * (t - 2)]; xl = W[2 * (t - 2) + 1];
      const s1h = ((xh >>> 19) | (xl << 13)) ^ ((xl >>> 29) | (xh << 3)) ^ (xh >>> 6);
      const s1l = ((xl >>> 19) | (xh << 13)) ^ ((xh >>> 29) | (xl << 3)) ^ ((xl >>> 6) | (xh << 26));
      const lo = (s1l >>> 0) + (W[2 * (t - 7) + 1] >>> 0) + (s0l >>> 0) + (W[2 * (t - 16) + 1] >>> 0);
      const hi = s1h + W[2 * (t - 7)] + s0h + W[2 * (t - 16)] + Math.floor(lo / TWO32);
      W[2 * t] = hi | 0;
      W[2 * t + 1] = lo | 0;
    }
    let ah = st[0], al = st[1], bh = st[2], bl = st[3], ch = st[4], cl = st[5], dh = st[6], dl = st[7];
    let eh = st[8], el = st[9], fh = st[10], fl = st[11], gh = st[12], gl = st[13], hh = st[14], hl = st[15];
    for (let t = 0; t < 80; t++) {
      const S1h = ((eh >>> 14) | (el << 18)) ^ ((eh >>> 18) | (el << 14)) ^ ((el >>> 9) | (eh << 23));
      const S1l = ((el >>> 14) | (eh << 18)) ^ ((el >>> 18) | (eh << 14)) ^ ((eh >>> 9) | (el << 23));
      const chh = (eh & fh) ^ (~eh & gh), chl = (el & fl) ^ (~el & gl);
      let lo = (hl >>> 0) + (S1l >>> 0) + (chl >>> 0) + (K[2 * t + 1] >>> 0) + (W[2 * t + 1] >>> 0);
      const t1h = (hh + S1h + chh + K[2 * t] + W[2 * t] + Math.floor(lo / TWO32)) | 0;
      const t1l = lo | 0;
      const S0h = ((ah >>> 28) | (al << 4)) ^ ((al >>> 2) | (ah << 30)) ^ ((al >>> 7) | (ah << 25));
      const S0l = ((al >>> 28) | (ah << 4)) ^ ((ah >>> 2) | (al << 30)) ^ ((ah >>> 7) | (al << 25));
      const mjh = (ah & bh) ^ (ah & ch) ^ (bh & ch), mjl = (al & bl) ^ (al & cl) ^ (bl & cl);
      hh = gh; hl = gl; gh = fh; gl = fl; fh = eh; fl = el;
      lo = (dl >>> 0) + (t1l >>> 0);
      eh = (dh + t1h + Math.floor(lo / TWO32)) | 0; el = lo | 0;
      dh = ch; dl = cl; ch = bh; cl = bl; bh = ah; bl = al;
      lo = (t1l >>> 0) + (S0l >>> 0) + (mjl >>> 0);
      ah = (t1h + S0h + mjh + Math.floor(lo / TWO32)) | 0; al = lo | 0;
    }
    const add = (i, h, l) => {
      const lo = (st[i + 1] >>> 0) + (l >>> 0);
      st[i] = (st[i] + h + Math.floor(lo / TWO32)) | 0;
      st[i + 1] = lo | 0;
    };
    add(0, ah, al); add(2, bh, bl); add(4, ch, cl); add(6, dh, dl);
    add(8, eh, el); add(10, fh, fl); add(12, gh, gl); add(14, hh, hl);
  }

  function sha512Family(input, init, outLen) {
    initSha();
    const st = Int32Array.from(init);
    runHash(toU8(input), 128, 16, true, sha512Compress, st);
    const full = new Uint8Array(64);
    for (let i = 0; i < 16; i++) writeBE(full, 4 * i, st[i]);
    return outLen === 64 ? full : full.slice(0, outLen);
  }

  function sha384(input) { initSha(); return sha512Family(input, H384, 48); }
  function sha512(input) { initSha(); return sha512Family(input, H512, 64); }

  /* ============================================================
     RC4
     ============================================================ */

  function rc4(key, data) {
    const k = toU8(key), d = toU8(data);
    if (!k.length) throw new Error('RC4 needs a key of at least one byte');
    const S = new Uint8Array(256);
    for (let i = 0; i < 256; i++) S[i] = i;
    for (let i = 0, j = 0; i < 256; i++) {
      j = (j + S[i] + k[i % k.length]) & 255;
      const t = S[i]; S[i] = S[j]; S[j] = t;
    }
    const out = new Uint8Array(d.length);
    let i = 0, j = 0;
    for (let n = 0; n < d.length; n++) {
      i = (i + 1) & 255;
      const si = S[i];
      j = (j + si) & 255;
      const sj = S[j];
      S[i] = sj; S[j] = si;
      out[n] = d[n] ^ S[(si + sj) & 255];
    }
    return out;
  }

  /* ============================================================
     AES (FIPS 197) with T-tables, plus CBC and single-block ECB

     State words are big-endian columns. Tables are Int32Array rather than
     Uint32Array: the values are identical bit for bit, but signed reads keep
     V8 and SpiderMonkey on their small-integer fast path.
     ============================================================ */

  let SBOX = null, INV_SBOX = null;
  let TE0, TE1, TE2, TE3, TD0, TD1, TD2, TD3;

  function initAes() {
    if (SBOX) return;
    SBOX = new Uint8Array(256);
    INV_SBOX = new Uint8Array(256);
    const exp = new Uint8Array(256), log = new Uint8Array(256);
    const xtime = (x) => ((x << 1) ^ (x & 0x80 ? 0x1b : 0)) & 0xff;
    for (let i = 0, p = 1; i < 255; i++) { exp[i] = p; log[p] = i; p ^= xtime(p); }
    const mul = (a, b) => (a && b) ? exp[(log[a] + log[b]) % 255] : 0;
    for (let x = 0; x < 256; x++) {
      const inv = x ? exp[(255 - log[x]) % 255] : 0;
      let s = inv;
      for (let r = 1; r <= 4; r++) s ^= ((inv << r) | (inv >>> (8 - r))) & 0xff;
      s ^= 0x63;
      SBOX[x] = s;
      INV_SBOX[s] = x;
    }
    TE0 = new Int32Array(256); TE1 = new Int32Array(256); TE2 = new Int32Array(256); TE3 = new Int32Array(256);
    TD0 = new Int32Array(256); TD1 = new Int32Array(256); TD2 = new Int32Array(256); TD3 = new Int32Array(256);
    for (let x = 0; x < 256; x++) {
      const s = SBOX[x];
      const e = (mul(s, 2) << 24) | (s << 16) | (s << 8) | mul(s, 3);
      TE0[x] = e; TE1[x] = (e >>> 8) | (e << 24); TE2[x] = (e >>> 16) | (e << 16); TE3[x] = (e >>> 24) | (e << 8);
      const si = INV_SBOX[x];
      const d = (mul(si, 14) << 24) | (mul(si, 9) << 16) | (mul(si, 13) << 8) | mul(si, 11);
      TD0[x] = d; TD1[x] = (d >>> 8) | (d << 24); TD2[x] = (d >>> 16) | (d << 16); TD3[x] = (d >>> 24) | (d << 8);
    }
  }

  /* Expanded key: { enc, dec, rounds }. dec is the equivalent-inverse-cipher
     schedule (round keys reversed, InvMixColumns applied to the inner ones). */
  function expandKey(keyIn) {
    initAes();
    const key = toU8(keyIn);
    const nk = key.length >> 2;
    if (key.length !== 16 && key.length !== 24 && key.length !== 32) {
      throw new Error('An AES key must be 16, 24 or 32 bytes long, not ' + key.length);
    }
    const rounds = nk + 6, total = 4 * (rounds + 1);
    const w = new Int32Array(total);
    for (let i = 0; i < nk; i++) {
      w[i] = (key[4 * i] << 24) | (key[4 * i + 1] << 16) | (key[4 * i + 2] << 8) | key[4 * i + 3];
    }
    let rcon = 1;
    for (let i = nk; i < total; i++) {
      let t = w[i - 1];
      if (i % nk === 0) {
        t = (SBOX[(t >>> 16) & 255] << 24) | (SBOX[(t >>> 8) & 255] << 16) | (SBOX[t & 255] << 8) | SBOX[t >>> 24];
        t ^= rcon << 24;
        rcon = ((rcon << 1) ^ (rcon & 0x80 ? 0x1b : 0)) & 0xff;
      } else if (nk > 6 && i % nk === 4) {
        t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 255] << 16) | (SBOX[(t >>> 8) & 255] << 8) | SBOX[t & 255];
      }
      w[i] = w[i - nk] ^ t;
    }
    const dk = new Int32Array(total);
    for (let r = 0; r <= rounds; r++) {
      for (let j = 0; j < 4; j++) {
        let v = w[4 * (rounds - r) + j];
        if (r > 0 && r < rounds) {
          v = TD0[SBOX[v >>> 24]] ^ TD1[SBOX[(v >>> 16) & 255]] ^ TD2[SBOX[(v >>> 8) & 255]] ^ TD3[SBOX[v & 255]];
        }
        dk[4 * r + j] = v;
      }
    }
    return { enc: w, dec: dk, rounds };
  }

  /* One block in, one block out, through this shared scratch (no allocation). */
  const BLK = new Int32Array(4);

  function encryptBlock(rk, rounds, s0, s1, s2, s3) {
    const T0 = TE0, T1 = TE1, T2 = TE2, T3 = TE3;
    s0 ^= rk[0]; s1 ^= rk[1]; s2 ^= rk[2]; s3 ^= rk[3];
    let k = 4;
    for (let r = 1; r < rounds; r++) {
      const t0 = T0[s0 >>> 24] ^ T1[(s1 >>> 16) & 255] ^ T2[(s2 >>> 8) & 255] ^ T3[s3 & 255] ^ rk[k];
      const t1 = T0[s1 >>> 24] ^ T1[(s2 >>> 16) & 255] ^ T2[(s3 >>> 8) & 255] ^ T3[s0 & 255] ^ rk[k + 1];
      const t2 = T0[s2 >>> 24] ^ T1[(s3 >>> 16) & 255] ^ T2[(s0 >>> 8) & 255] ^ T3[s1 & 255] ^ rk[k + 2];
      const t3 = T0[s3 >>> 24] ^ T1[(s0 >>> 16) & 255] ^ T2[(s1 >>> 8) & 255] ^ T3[s2 & 255] ^ rk[k + 3];
      s0 = t0; s1 = t1; s2 = t2; s3 = t3; k += 4;
    }
    const S = SBOX;
    BLK[0] = ((S[s0 >>> 24] << 24) | (S[(s1 >>> 16) & 255] << 16) | (S[(s2 >>> 8) & 255] << 8) | S[s3 & 255]) ^ rk[k];
    BLK[1] = ((S[s1 >>> 24] << 24) | (S[(s2 >>> 16) & 255] << 16) | (S[(s3 >>> 8) & 255] << 8) | S[s0 & 255]) ^ rk[k + 1];
    BLK[2] = ((S[s2 >>> 24] << 24) | (S[(s3 >>> 16) & 255] << 16) | (S[(s0 >>> 8) & 255] << 8) | S[s1 & 255]) ^ rk[k + 2];
    BLK[3] = ((S[s3 >>> 24] << 24) | (S[(s0 >>> 16) & 255] << 16) | (S[(s1 >>> 8) & 255] << 8) | S[s2 & 255]) ^ rk[k + 3];
  }

  function decryptBlock(rk, rounds, s0, s1, s2, s3) {
    const T0 = TD0, T1 = TD1, T2 = TD2, T3 = TD3;
    s0 ^= rk[0]; s1 ^= rk[1]; s2 ^= rk[2]; s3 ^= rk[3];
    let k = 4;
    for (let r = 1; r < rounds; r++) {
      const t0 = T0[s0 >>> 24] ^ T1[(s3 >>> 16) & 255] ^ T2[(s2 >>> 8) & 255] ^ T3[s1 & 255] ^ rk[k];
      const t1 = T0[s1 >>> 24] ^ T1[(s0 >>> 16) & 255] ^ T2[(s3 >>> 8) & 255] ^ T3[s2 & 255] ^ rk[k + 1];
      const t2 = T0[s2 >>> 24] ^ T1[(s1 >>> 16) & 255] ^ T2[(s0 >>> 8) & 255] ^ T3[s3 & 255] ^ rk[k + 2];
      const t3 = T0[s3 >>> 24] ^ T1[(s2 >>> 16) & 255] ^ T2[(s1 >>> 8) & 255] ^ T3[s0 & 255] ^ rk[k + 3];
      s0 = t0; s1 = t1; s2 = t2; s3 = t3; k += 4;
    }
    const S = INV_SBOX;
    BLK[0] = ((S[s0 >>> 24] << 24) | (S[(s3 >>> 16) & 255] << 16) | (S[(s2 >>> 8) & 255] << 8) | S[s1 & 255]) ^ rk[k];
    BLK[1] = ((S[s1 >>> 24] << 24) | (S[(s0 >>> 16) & 255] << 16) | (S[(s3 >>> 8) & 255] << 8) | S[s2 & 255]) ^ rk[k + 1];
    BLK[2] = ((S[s2 >>> 24] << 24) | (S[(s1 >>> 16) & 255] << 16) | (S[(s0 >>> 8) & 255] << 8) | S[s3 & 255]) ^ rk[k + 2];
    BLK[3] = ((S[s3 >>> 24] << 24) | (S[(s2 >>> 16) & 255] << 16) | (S[(s1 >>> 8) & 255] << 8) | S[s0 & 255]) ^ rk[k + 3];
  }

  const rd32 = (b, p) => (b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3];

  /* The two CBC loops below repeat the block functions' rounds inline: they
     carry nearly all the bytes, and keeping the state in locals (no call, no
     scratch array) is what makes them quick. */

  /* CBC-encrypt buf[off, off+len) in place; len is a multiple of 16. */
  function cbcEncryptInPlace(ks, iv, buf, off, len) {
    const rk = ks.enc, kl = 4 * ks.rounds;
    const T0 = TE0, T1 = TE1, T2 = TE2, T3 = TE3, S = SBOX;
    const k0 = rk[0], k1 = rk[1], k2 = rk[2], k3 = rk[3];
    let p0 = rd32(iv, 0), p1 = rd32(iv, 4), p2 = rd32(iv, 8), p3 = rd32(iv, 12);
    for (let i = off, end = off + len; i < end; i += 16) {
      let s0 = ((buf[i] << 24) | (buf[i + 1] << 16) | (buf[i + 2] << 8) | buf[i + 3]) ^ p0 ^ k0;
      let s1 = ((buf[i + 4] << 24) | (buf[i + 5] << 16) | (buf[i + 6] << 8) | buf[i + 7]) ^ p1 ^ k1;
      let s2 = ((buf[i + 8] << 24) | (buf[i + 9] << 16) | (buf[i + 10] << 8) | buf[i + 11]) ^ p2 ^ k2;
      let s3 = ((buf[i + 12] << 24) | (buf[i + 13] << 16) | (buf[i + 14] << 8) | buf[i + 15]) ^ p3 ^ k3;
      for (let k = 4; k < kl; k += 4) {
        const t0 = T0[s0 >>> 24] ^ T1[(s1 >>> 16) & 255] ^ T2[(s2 >>> 8) & 255] ^ T3[s3 & 255] ^ rk[k];
        const t1 = T0[s1 >>> 24] ^ T1[(s2 >>> 16) & 255] ^ T2[(s3 >>> 8) & 255] ^ T3[s0 & 255] ^ rk[k + 1];
        const t2 = T0[s2 >>> 24] ^ T1[(s3 >>> 16) & 255] ^ T2[(s0 >>> 8) & 255] ^ T3[s1 & 255] ^ rk[k + 2];
        s3 = T0[s3 >>> 24] ^ T1[(s0 >>> 16) & 255] ^ T2[(s1 >>> 8) & 255] ^ T3[s2 & 255] ^ rk[k + 3];
        s0 = t0; s1 = t1; s2 = t2;
      }
      p0 = ((S[s0 >>> 24] << 24) | (S[(s1 >>> 16) & 255] << 16) | (S[(s2 >>> 8) & 255] << 8) | S[s3 & 255]) ^ rk[kl];
      p1 = ((S[s1 >>> 24] << 24) | (S[(s2 >>> 16) & 255] << 16) | (S[(s3 >>> 8) & 255] << 8) | S[s0 & 255]) ^ rk[kl + 1];
      p2 = ((S[s2 >>> 24] << 24) | (S[(s3 >>> 16) & 255] << 16) | (S[(s0 >>> 8) & 255] << 8) | S[s1 & 255]) ^ rk[kl + 2];
      p3 = ((S[s3 >>> 24] << 24) | (S[(s0 >>> 16) & 255] << 16) | (S[(s1 >>> 8) & 255] << 8) | S[s2 & 255]) ^ rk[kl + 3];
      buf[i] = p0 >>> 24; buf[i + 1] = p0 >>> 16; buf[i + 2] = p0 >>> 8; buf[i + 3] = p0;
      buf[i + 4] = p1 >>> 24; buf[i + 5] = p1 >>> 16; buf[i + 6] = p1 >>> 8; buf[i + 7] = p1;
      buf[i + 8] = p2 >>> 24; buf[i + 9] = p2 >>> 16; buf[i + 10] = p2 >>> 8; buf[i + 11] = p2;
      buf[i + 12] = p3 >>> 24; buf[i + 13] = p3 >>> 16; buf[i + 14] = p3 >>> 8; buf[i + 15] = p3;
    }
  }

  /* CBC-decrypt src[off, off+len) into dst[0, len); len is a multiple of 16.
     The IV is read from iv[ivOff, ivOff+16). */
  function cbcDecryptInto(ks, iv, ivOff, src, off, len, dst) {
    const rk = ks.dec, kl = 4 * ks.rounds;
    const T0 = TD0, T1 = TD1, T2 = TD2, T3 = TD3, S = INV_SBOX;
    const k0 = rk[0], k1 = rk[1], k2 = rk[2], k3 = rk[3];
    let p0 = rd32(iv, ivOff), p1 = rd32(iv, ivOff + 4), p2 = rd32(iv, ivOff + 8), p3 = rd32(iv, ivOff + 12);
    for (let i = 0; i < len; i += 16) {
      const q = off + i;
      const c0 = (src[q] << 24) | (src[q + 1] << 16) | (src[q + 2] << 8) | src[q + 3];
      const c1 = (src[q + 4] << 24) | (src[q + 5] << 16) | (src[q + 6] << 8) | src[q + 7];
      const c2 = (src[q + 8] << 24) | (src[q + 9] << 16) | (src[q + 10] << 8) | src[q + 11];
      const c3 = (src[q + 12] << 24) | (src[q + 13] << 16) | (src[q + 14] << 8) | src[q + 15];
      let s0 = c0 ^ k0, s1 = c1 ^ k1, s2 = c2 ^ k2, s3 = c3 ^ k3;
      for (let k = 4; k < kl; k += 4) {
        const t0 = T0[s0 >>> 24] ^ T1[(s3 >>> 16) & 255] ^ T2[(s2 >>> 8) & 255] ^ T3[s1 & 255] ^ rk[k];
        const t1 = T0[s1 >>> 24] ^ T1[(s0 >>> 16) & 255] ^ T2[(s3 >>> 8) & 255] ^ T3[s2 & 255] ^ rk[k + 1];
        const t2 = T0[s2 >>> 24] ^ T1[(s1 >>> 16) & 255] ^ T2[(s0 >>> 8) & 255] ^ T3[s3 & 255] ^ rk[k + 2];
        s3 = T0[s3 >>> 24] ^ T1[(s2 >>> 16) & 255] ^ T2[(s1 >>> 8) & 255] ^ T3[s0 & 255] ^ rk[k + 3];
        s0 = t0; s1 = t1; s2 = t2;
      }
      const o0 = ((S[s0 >>> 24] << 24) | (S[(s3 >>> 16) & 255] << 16) | (S[(s2 >>> 8) & 255] << 8) | S[s1 & 255]) ^ rk[kl] ^ p0;
      const o1 = ((S[s1 >>> 24] << 24) | (S[(s0 >>> 16) & 255] << 16) | (S[(s3 >>> 8) & 255] << 8) | S[s2 & 255]) ^ rk[kl + 1] ^ p1;
      const o2 = ((S[s2 >>> 24] << 24) | (S[(s1 >>> 16) & 255] << 16) | (S[(s0 >>> 8) & 255] << 8) | S[s3 & 255]) ^ rk[kl + 2] ^ p2;
      const o3 = ((S[s3 >>> 24] << 24) | (S[(s2 >>> 16) & 255] << 16) | (S[(s1 >>> 8) & 255] << 8) | S[s0 & 255]) ^ rk[kl + 3] ^ p3;
      dst[i] = o0 >>> 24; dst[i + 1] = o0 >>> 16; dst[i + 2] = o0 >>> 8; dst[i + 3] = o0;
      dst[i + 4] = o1 >>> 24; dst[i + 5] = o1 >>> 16; dst[i + 6] = o1 >>> 8; dst[i + 7] = o1;
      dst[i + 8] = o2 >>> 24; dst[i + 9] = o2 >>> 16; dst[i + 10] = o2 >>> 8; dst[i + 11] = o2;
      dst[i + 12] = o3 >>> 24; dst[i + 13] = o3 >>> 16; dst[i + 14] = o3 >>> 8; dst[i + 15] = o3;
      p0 = c0; p1 = c1; p2 = c2; p3 = c3;
    }
  }

  /* Strips PKCS#7 padding when it is well formed; otherwise leaves the data
     alone. Damaged files often carry slightly wrong padding, and a reader
     that refused them would be less useful than one that shows a stray byte. */
  function unpadTolerant(out) {
    const n = out.length;
    if (!n) return out;
    const p = out[n - 1];
    if (p < 1 || p > 16 || p > n) return out;
    for (let i = n - p; i < n; i++) if (out[i] !== p) return out;
    return out.subarray(0, n - p);
  }

  function checkIv(iv) {
    const v = toU8(iv);
    if (v.length !== 16) throw new Error('An AES initialisation vector must be 16 bytes long');
    return v;
  }

  function aesEncryptCbc(key, iv, data, pad) {
    const ks = expandKey(key), v = checkIv(iv), d = toU8(data);
    let buf;
    if (pad === false) {
      if (d.length % 16) throw new Error('Unpadded AES-CBC input must be a multiple of 16 bytes');
      buf = d.slice();
    } else {
      const p = 16 - (d.length % 16);
      buf = new Uint8Array(d.length + p);
      buf.set(d);
      buf.fill(p, d.length);
    }
    cbcEncryptInPlace(ks, v, buf, 0, buf.length);
    return buf;
  }

  /* A trailing partial block (which a valid file never has) is ignored. */
  function aesDecryptCbc(key, iv, data, unpad) {
    const ks = expandKey(key), v = checkIv(iv), d = toU8(data);
    const len = d.length - (d.length % 16);
    const out = new Uint8Array(len);
    cbcDecryptInto(ks, v, 0, d, 0, len, out);
    return unpad === false ? out : unpadTolerant(out);
  }

  function aesEncryptEcbBlock(key, block) {
    const ks = expandKey(key), b = toU8(block);
    if (b.length !== 16) throw new Error('An AES block is 16 bytes');
    encryptBlock(ks.enc, ks.rounds, rd32(b, 0), rd32(b, 4), rd32(b, 8), rd32(b, 12));
    const out = new Uint8Array(16);
    for (let i = 0; i < 4; i++) writeBE(out, 4 * i, BLK[i]);
    return out;
  }

  function aesDecryptEcbBlock(key, block) {
    const ks = expandKey(key), b = toU8(block);
    if (b.length !== 16) throw new Error('An AES block is 16 bytes');
    decryptBlock(ks.dec, ks.rounds, rd32(b, 0), rd32(b, 4), rd32(b, 8), rd32(b, 12));
    const out = new Uint8Array(16);
    for (let i = 0; i < 4; i++) writeBE(out, 4 * i, BLK[i]);
    return out;
  }

  /* ============================================================
     Passwords
     ============================================================ */

  /* Code points PDFDocEncoding places in its 0x18–0x1F and 0x80–0xA0 slots.
     Everything else at or below U+00FF maps to itself; anything left over
     cannot be expressed and is dropped. */
  const PDFDOC = {
    0x02d8: 0x18, 0x02c7: 0x19, 0x02c6: 0x1a, 0x02d9: 0x1b, 0x02dd: 0x1c, 0x02db: 0x1d, 0x02da: 0x1e, 0x02dc: 0x1f,
    0x2022: 0x80, 0x2020: 0x81, 0x2021: 0x82, 0x2026: 0x83, 0x2014: 0x84, 0x2013: 0x85, 0x0192: 0x86, 0x2044: 0x87,
    0x2039: 0x88, 0x203a: 0x89, 0x2212: 0x8a, 0x2030: 0x8b, 0x201e: 0x8c, 0x201c: 0x8d, 0x201d: 0x8e, 0x2018: 0x8f,
    0x2019: 0x90, 0x201a: 0x91, 0x2122: 0x92, 0xfb01: 0x93, 0xfb02: 0x94, 0x0141: 0x95, 0x0152: 0x96, 0x0160: 0x97,
    0x0178: 0x98, 0x017d: 0x99, 0x0131: 0x9a, 0x0142: 0x9b, 0x0153: 0x9c, 0x0161: 0x9d, 0x017e: 0x9e, 0x20ac: 0xa0
  };

  /* Revisions 2–4: PDFDocEncoding bytes, at most 32 of which count. */
  function legacyPasswordBytes(pw) {
    const out = [];
    for (const ch of String(pw == null ? '' : pw)) {
      const cp = ch.codePointAt(0);
      if (cp <= 0xff) out.push(cp);
      else if (PDFDOC[cp] !== undefined) out.push(PDFDOC[cp]);
      if (out.length === 32) break;
    }
    return Uint8Array.from(out);
  }

  /* Revisions 5–6: UTF-8 of the NFKC form, at most 127 bytes. (The spec asks
     for SASLprep, whose substance for real passwords is NFKC.) */
  function utf8PasswordBytes(pw) {
    let s = String(pw == null ? '' : pw);
    if (typeof s.normalize === 'function') s = s.normalize('NFKC');
    const out = [];
    for (const ch of s) {
      let cp = ch.codePointAt(0);
      if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;          // lone surrogate
      const bytes = cp < 0x80 ? [cp]
        : cp < 0x800 ? [0xc0 | (cp >> 6), 0x80 | (cp & 63)]
        : cp < 0x10000 ? [0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)]
        : [0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)];
      if (out.length + bytes.length > 127) break;              // never split a character
      for (const b of bytes) out.push(b);
    }
    return Uint8Array.from(out);
  }

  /* ============================================================
     Revisions 2–4 (algorithms 2–7 of ISO 32000-1, 7.6.3)
     ============================================================ */

  const PAD = Uint8Array.from([
    0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
    0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a
  ]);

  function pad32(pw) {
    const out = new Uint8Array(32);
    const n = Math.min(32, pw.length);
    out.set(pw.subarray(0, n));
    out.set(PAD.subarray(0, 32 - n), n);
    return out;
  }

  function le32(v) { const b = new Uint8Array(4); writeLE(b, 0, v); return b; }

  /* Algorithm 2: the file key from a (user) password. */
  function legacyFileKey(pw, O, P, id0, R, n, encryptMetadata) {
    const parts = [pad32(pw), O.subarray(0, 32), le32(P), id0];
    if (R >= 4 && !encryptMetadata) parts.push(Uint8Array.from([0xff, 0xff, 0xff, 0xff]));
    let h = md5(concat.apply(null, parts));
    if (R >= 3) for (let i = 0; i < 50; i++) h = md5(h.subarray(0, n));
    return h.slice(0, n);
  }

  function xorKey(key, i) {
    const k = new Uint8Array(key.length);
    for (let j = 0; j < key.length; j++) k[j] = key[j] ^ i;
    return k;
  }

  /* Algorithms 4 and 5: the U value (first 16 bytes significant from R3). */
  function legacyU(key, R, id0) {
    if (R === 2) return rc4(key, PAD);
    let x = rc4(key, md5(concat(PAD, id0)));
    for (let i = 1; i <= 19; i++) x = rc4(xorKey(key, i), x);
    return x;
  }

  /* The RC4 key that algorithm 3 derives from the owner password. */
  function ownerRc4Key(ownerPw, R, n) {
    let h = md5(pad32(ownerPw));
    if (R >= 3) for (let i = 0; i < 50; i++) h = md5(h);
    return h.slice(0, R === 2 ? 5 : n);
  }

  /* Algorithm 3: the O value. */
  function legacyO(ownerPw, userPw, R, n) {
    const key = ownerRc4Key(ownerPw.length ? ownerPw : userPw, R, n);
    let x = rc4(key, pad32(userPw));
    if (R >= 3) for (let i = 1; i <= 19; i++) x = rc4(xorKey(key, i), x);
    return x;
  }

  /* Algorithm 6: returns the file key if pw is the user password, else null. */
  function legacyCheckUser(pw, s) {
    const key = legacyFileKey(pw, s.O, s.P, s.id0, s.R, s.n, s.encryptMetadata);
    const u = legacyU(key, s.R, s.id0);
    return sameBytes(u, s.U, s.R === 2 ? 32 : 16) ? key : null;
  }

  /* Algorithm 7: recover the padded user password from O, then check it. */
  function legacyCheckOwner(pw, s) {
    const key = ownerRc4Key(pw, s.R, s.n);
    let x = s.O.subarray(0, 32);
    if (s.R === 2) x = rc4(key, x);
    else for (let i = 19; i >= 0; i--) x = rc4(xorKey(key, i), x);
    return legacyCheckUser(x, s);
  }

  /* ============================================================
     Revisions 5–6 (algorithms 2.A, 2.B, 8–13 of ISO 32000-2)
     ============================================================ */

  /* Algorithm 2.B: the revision 6 hash. Revision 5 is its first step only. */
  function hashR6(pw, salt, udata) {
    let K = sha256(concat(pw, salt, udata));
    for (let i = 0; ; ) {
      const unit = pw.length + K.length + udata.length;
      const K1 = new Uint8Array(unit * 64);
      K1.set(pw, 0); K1.set(K, pw.length); K1.set(udata, pw.length + K.length);
      for (let r = 1; r < 64; r++) K1.copyWithin(r * unit, 0, unit);
      cbcEncryptInPlace(expandKey(K.subarray(0, 16)), K.subarray(16, 32), K1, 0, K1.length);
      const E = K1;
      let sum = 0;
      for (let j = 0; j < 16; j++) sum += E[j];        // 256 ≡ 1 (mod 3)
      const m = sum % 3;
      K = m === 0 ? sha256(E) : m === 1 ? sha384(E) : sha512(E);
      i++;
      if (i >= 64 && E[E.length - 1] <= i - 32) break;
    }
    return K.subarray(0, 32);
  }

  function hashV5(R, pw, salt, udata) {
    return R === 5 ? sha256(concat(pw, salt, udata)) : hashR6(pw, salt, udata);
  }

  function aesV3CheckUser(pw, s) {
    if (!sameBytes(hashV5(s.R, pw, s.U.subarray(32, 40), EMPTY), s.U, 32)) return null;
    const k = hashV5(s.R, pw, s.U.subarray(40, 48), EMPTY);
    return aesDecryptCbc(k, ZERO_IV, s.UE.subarray(0, 32), false);
  }

  function aesV3CheckOwner(pw, s) {
    const u48 = s.U.subarray(0, 48);
    if (!sameBytes(hashV5(s.R, pw, s.O.subarray(32, 40), u48), s.O, 32)) return null;
    const k = hashV5(s.R, pw, s.O.subarray(40, 48), u48);
    return aesDecryptCbc(k, ZERO_IV, s.OE.subarray(0, 32), false);
  }

  /* Algorithm 13: is the Perms entry consistent with P? Advisory only. */
  function permsValid(key, perms, P, encryptMetadata) {
    if (!perms || perms.length < 16) return false;
    const b = aesDecryptEcbBlock(key, perms.subarray(0, 16));
    if (b[9] !== 0x61 || b[10] !== 0x64 || b[11] !== 0x62) return false;   // 'adb'
    const p = b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24);
    if (p !== (P | 0)) return false;
    return encryptMetadata ? b[8] === 0x54 : b[8] === 0x46;                // 'T' / 'F'
  }

  /* ============================================================
     Opening
     ============================================================ */

  const fail = (reason, message) => ({ ok: false, reason, message });

  function nameOf(v) {
    if (v == null) return undefined;
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && typeof v.name === 'string') return v.name;   // a pdfcore Name, leniently
    return String(v);
  }

  function numOf(v, dflt) {
    const n = typeof v === 'number' ? v : Number(v);
    return isFinite(n) ? n : dflt;
  }

  /* Crypt filter name -> 'RC4' | 'AESV2' | 'AESV3' | 'Identity', or null. */
  function cryptFilterMethod(enc, name) {
    if (name === undefined || name === 'Identity') return 'Identity';
    const cf = enc.CF && enc.CF[name];
    if (!cf || typeof cf !== 'object') return null;
    const cfm = nameOf(cf.CFM);
    if (cfm === undefined || cfm === 'None') return 'Identity';
    if (cfm === 'V2') return 'RC4';
    if (cfm === 'AESV2') return 'AESV2';
    if (cfm === 'AESV3') return 'AESV3';
    return null;
  }

  function methodLabel(h) {
    const used = [h.stmf, h.strf];
    if (used.includes('AESV3')) return 'AES-256';
    if (used.includes('AESV2')) return 'AES-128';
    if (used.includes('RC4')) return 'RC4 ' + (h.key.length * 8) + '-bit';
    return 'no encryption (Identity crypt filters)';
  }

  /**
   * Open the Standard security handler with a password.
   * opts: { encrypt, id0, password } — see the module notes for the shapes.
   */
  function openHandler(opts) {
    const o = opts || {};
    const enc = o.encrypt || {};
    const id0 = toU8(o.id0);
    const password = o.password == null ? '' : String(o.password);

    const filter = nameOf(enc.Filter);
    if (filter !== 'Standard') {
      return fail('unsupported', `This PDF uses the ${filter || 'unnamed'} security handler, which needs ` +
        'a certificate rather than a password. Only password protection (the Standard handler) can be opened here.');
    }
    const V = numOf(enc.V, 0), R = numOf(enc.R, 0);
    const P = numOf(enc.P, 0) | 0;
    const encryptMetadata = enc.EncryptMetadata !== false;

    let stmf, strf, eff;
    if (V === 1 || V === 2) {
      if (R < 2 || R > 4) return fail('unsupported', `Encryption revision ${R} is not one this reader knows.`);
      stmf = strf = eff = 'RC4';
    } else if (V === 4 || V === 5) {
      if (V === 4 && (R < 2 || R > 4)) return fail('unsupported', `Encryption revision ${R} is not one this reader knows.`);
      if (V === 5 && R !== 5 && R !== 6) return fail('unsupported', `Encryption revision ${R} is not one this reader knows.`);
      stmf = cryptFilterMethod(enc, nameOf(enc.StmF));
      strf = cryptFilterMethod(enc, nameOf(enc.StrF));
      eff = enc.EFF === undefined ? stmf : cryptFilterMethod(enc, nameOf(enc.EFF));
      if (!stmf || !strf || !eff) return fail('unsupported', 'This PDF names a crypt filter this reader does not know.');
    } else {
      return fail('unsupported', `Encryption version ${V} is not one this reader knows.`);
    }

    const O = toU8(enc.O), U = toU8(enc.U);
    let key = null, isOwner = false, permsOk = null;

    if (R <= 4) {
      let bits = numOf(enc.Length, 0);
      if (V === 1) bits = 40;
      else if (!bits) {
        if (V === 2) bits = 40;
        else {
          const cf = enc.CF && enc.CF[nameOf(enc.StmF)] || enc.CF && enc.CF[nameOf(enc.StrF)];
          bits = cf ? numOf(cf.Length, 0) : 0;
          if (bits && bits < 40) bits *= 8;           // some writers give bytes
          if (!bits) bits = 128;
        }
      }
      let n = R === 2 ? 5 : Math.max(5, Math.min(16, Math.floor(bits / 8)));
      if (stmf === 'AESV2' || strf === 'AESV2') n = 16;
      if (O.length < 32 || U.length < (R === 2 ? 32 : 16)) {
        return fail('unsupported', 'The encryption dictionary is damaged (its O or U entry is too short).');
      }
      const s = { O, U, P, id0, R, n, encryptMetadata };
      const pw = legacyPasswordBytes(password);
      key = legacyCheckUser(pw, s);
      if (key) {
        // The same password may also be the owner's (or the owner password may be empty).
        isOwner = !!legacyCheckOwner(pw, s);
      } else {
        key = legacyCheckOwner(pw, s);
        isOwner = !!key;
      }
    } else {
      const OE = toU8(enc.OE), UE = toU8(enc.UE);
      if (O.length < 48 || U.length < 48 || OE.length < 32 || UE.length < 32) {
        return fail('unsupported', 'The encryption dictionary is damaged (an O, U, OE or UE entry is too short).');
      }
      const s = { O, U, OE, UE, R };
      const pw = utf8PasswordBytes(password);
      key = aesV3CheckUser(pw, s);
      if (key) {
        isOwner = !!aesV3CheckOwner(pw, s);
      } else {
        key = aesV3CheckOwner(pw, s);
        isOwner = !!key;
      }
      if (key) permsOk = permsValid(key, toU8(enc.Perms), P, encryptMetadata);
    }

    if (!key) {
      return fail('password', password ? 'That password is not correct for this PDF.' : 'This PDF needs a password to open.');
    }
    const h = {
      ok: true, isOwner, key, revision: R, version: V,
      stmf, strf, eff, encryptMetadata, permissions: P,
      openedWith: isOwner ? 'owner' : password ? 'user' : 'empty',
      permsValid: permsOk
    };
    h.method = methodLabel(h);
    return h;
  }

  /* ============================================================
     Per-object transforms
     ============================================================ */

  /* Algorithm 1: the object key, for RC4 and AESV2. */
  function objectKey(h, objNum, gen, aes) {
    const n = h.key.length;
    const b = new Uint8Array(n + 5 + (aes ? 4 : 0));
    b.set(h.key);
    b[n] = objNum & 255; b[n + 1] = (objNum >>> 8) & 255; b[n + 2] = (objNum >>> 16) & 255;
    b[n + 3] = gen & 255; b[n + 4] = (gen >>> 8) & 255;
    if (aes) { b[n + 5] = 0x73; b[n + 6] = 0x41; b[n + 7] = 0x6c; b[n + 8] = 0x54; }   // 'sAlT'
    return md5(b).subarray(0, Math.min(n + 5, 16));
  }

  /* kind: 'string' | 'stream', plus two refinements a caller may use:
     'metadata' for a /Type /Metadata stream (left alone when EncryptMetadata
     is false) and 'embeddedFile' for an embedded file stream (the EFF filter). */
  function methodFor(h, kind) {
    switch (kind) {
      case 'string': return h.strf;
      case 'stream': return h.stmf;
      case 'metadata': return h.encryptMetadata ? h.stmf : 'Identity';
      case 'embeddedFile': return h.eff;
      default: throw new TypeError(`Unknown kind '${kind}' (expected 'string' or 'stream')`);
    }
  }

  function decryptBytes(h, objNum, gen, bytes, kind) {
    const data = toU8(bytes);
    const m = methodFor(h, kind);
    if (m === 'Identity') return data;
    if (m === 'RC4') return rc4(objectKey(h, objNum, gen || 0, false), data);
    if (data.length < 16) return new Uint8Array(0);
    const key = m === 'AESV3' ? h.key : objectKey(h, objNum, gen || 0, true);
    const len = (data.length - 16) - ((data.length - 16) % 16);
    const out = new Uint8Array(len);
    cbcDecryptInto(expandKey(key), data, 0, data, 16, len, out);
    return unpadTolerant(out);
  }

  function defaultRandom(n) {
    const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
    if (!c || typeof c.getRandomValues !== 'function') {
      throw new Error('No source of random bytes: pass random(n) explicitly.');
    }
    return c.getRandomValues(new Uint8Array(n));
  }

  function randomBytes(random, n) {
    const r = toU8(random(n));
    if (r.length !== n) throw new Error(`random(${n}) returned ${r.length} bytes`);
    return r;
  }

  function encryptBytes(h, objNum, gen, bytes, kind, random) {
    const data = toU8(bytes);
    const m = methodFor(h, kind);
    if (m === 'Identity') return data;
    if (m === 'RC4') return rc4(objectKey(h, objNum, gen || 0, false), data);
    const key = m === 'AESV3' ? h.key : objectKey(h, objNum, gen || 0, true);
    const iv = randomBytes(random || h.random || defaultRandom, 16);
    const p = 16 - (data.length % 16);
    const out = new Uint8Array(16 + data.length + p);
    out.set(iv);
    out.set(data, 16);
    out.fill(p, 16 + data.length);
    cbcEncryptInPlace(expandKey(key), iv, out, 16, out.length - 16);
    return out;
  }

  /* ============================================================
     Permissions
     ============================================================ */

  const PERM_BITS = {
    print: 3, modify: 4, copy: 5, annotate: 6,
    fillForms: 9, accessibility: 10, assemble: 11, printHighRes: 12
  };

  /* Bits 7, 8 and 13–32 must be 1; bits 1–2 must be 0. */
  function pFromPermissions(perms) {
    const p = perms || {};
    let v = 0xfffff0c0 | 0;
    for (const k of Object.keys(PERM_BITS)) {
      if (p[k] !== false) v |= 1 << (PERM_BITS[k] - 1);
    }
    return v | 0;
  }

  /* With revision 2 the four later bits do not exist; pass it to have them
     follow the older bits that governed those actions. */
  function permissionsFromP(P, revision) {
    const v = P | 0, out = {};
    for (const k of Object.keys(PERM_BITS)) out[k] = (v & (1 << (PERM_BITS[k] - 1))) !== 0;
    if (revision === 2) {
      out.printHighRes = out.print;
      out.fillForms = out.annotate;
      out.accessibility = out.copy;
      out.assemble = out.modify;
    }
    return out;
  }

  /* ============================================================
     Creating
     ============================================================ */

  /**
   * Set up encryption for a new file.
   * opts: { userPassword, ownerPassword, permissions, method: 'AES-256' | 'AES-128',
   *         id0, encryptMetadata = true, random(n) -> Uint8Array }
   * Returns { handler, encryptDict }. When id0 is not given one is generated
   * and returned as handler.id0, which the trailer's /ID must then carry.
   */
  function createHandler(opts) {
    const o = opts || {};
    if (typeof o.random !== 'function') throw new Error('createHandler needs random(n), e.g. from crypto.getRandomValues');
    const rnd = (n) => randomBytes(o.random, n);
    const method = o.method || 'AES-256';
    const P = pFromPermissions(o.permissions);
    const encryptMetadata = o.encryptMetadata !== false;
    const userPassword = o.userPassword == null ? '' : String(o.userPassword);
    let ownerPassword = o.ownerPassword == null ? '' : String(o.ownerPassword);
    if (!ownerPassword) ownerPassword = hex(rnd(16));              // nobody knows it, as Acrobat does
    const id0 = o.id0 == null ? rnd(16) : toU8(o.id0);

    let handler, encryptDict;
    if (method === 'AES-256') {
      const upw = utf8PasswordBytes(userPassword), opw = utf8PasswordBytes(ownerPassword);
      const key = rnd(32);
      const us = rnd(16);
      const U = concat(hashR6(upw, us.subarray(0, 8), EMPTY), us);
      const UE = aesEncryptCbc(hashR6(upw, us.subarray(8, 16), EMPTY), ZERO_IV, key, false);
      const os = rnd(16);
      const O = concat(hashR6(opw, os.subarray(0, 8), U), os);
      const OE = aesEncryptCbc(hashR6(opw, os.subarray(8, 16), U), ZERO_IV, key, false);
      const pb = new Uint8Array(16);
      writeLE(pb, 0, P);
      pb[4] = pb[5] = pb[6] = pb[7] = 0xff;
      pb[8] = encryptMetadata ? 0x54 : 0x46;
      pb[9] = 0x61; pb[10] = 0x64; pb[11] = 0x62;
      pb.set(rnd(4), 12);
      const Perms = aesEncryptEcbBlock(key, pb);
      handler = { key, revision: 6, version: 5, stmf: 'AESV3', strf: 'AESV3', eff: 'AESV3' };
      encryptDict = {
        Filter: 'Standard', V: 5, R: 6, Length: 256,
        CF: { StdCF: { CFM: 'AESV3', AuthEvent: 'DocOpen', Length: 32 } },
        StmF: 'StdCF', StrF: 'StdCF',
        O, U, OE, UE, P, Perms
      };
    } else if (method === 'AES-128') {
      const upw = legacyPasswordBytes(userPassword), opw = legacyPasswordBytes(ownerPassword);
      const O = legacyO(opw, upw, 4, 16);
      const key = legacyFileKey(upw, O, P, id0, 4, 16, encryptMetadata);
      const U = concat(legacyU(key, 4, id0), rnd(16));
      handler = { key, revision: 4, version: 4, stmf: 'AESV2', strf: 'AESV2', eff: 'AESV2' };
      encryptDict = {
        Filter: 'Standard', V: 4, R: 4, Length: 128,
        CF: { StdCF: { CFM: 'AESV2', AuthEvent: 'DocOpen', Length: 16 } },
        StmF: 'StdCF', StrF: 'StdCF',
        O, U, P
      };
    } else {
      throw new Error(`Unknown encryption method '${method}' (use 'AES-256' or 'AES-128')`);
    }
    if (!encryptMetadata) encryptDict.EncryptMetadata = false;
    Object.assign(handler, {
      ok: true, isOwner: true, encryptMetadata, permissions: P, id0,
      openedWith: 'created', userPasswordEmpty: !userPassword, random: o.random
    });
    handler.method = methodLabel(handler);
    return { handler, encryptDict };
  }

  function describeHandler(h) {
    if (!h || !h.ok) return 'not opened';
    const label = h.method || methodLabel(h);
    switch (h.openedWith) {
      case 'owner': return `${label}, opened with the owner password`;
      case 'user': return `${label}, opened with the user password`;
      case 'empty': return `${label}, opened without a password (none is needed to read it)`;
      case 'created': return `${label}, new encryption ` +
        (h.userPasswordEmpty ? 'that opens without a password' : 'with a password to open');
      default: return label;
    }
  }

  return {
    md5, sha256, sha384, sha512, rc4,
    aesEncryptCbc, aesDecryptCbc, aesEncryptEcbBlock, aesDecryptEcbBlock,
    openHandler, decryptBytes, createHandler, encryptBytes,
    permissionsFromP, describeHandler,
    // smaller helpers, exposed for callers and tests
    pFromPermissions, legacyPasswordBytes, utf8PasswordBytes
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PDFCrypt };
}
