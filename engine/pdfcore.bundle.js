(function(){
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


/**
 * PDF engine — parse, manipulate and write PDF files with no dependencies.
 *
 * Handles both cross-reference forms: the classic `xref` table and the
 * compressed xref *stream* introduced in PDF 1.5, along with object streams.
 * Inflation uses the platform's own DecompressionStream, which is why this is
 * async throughout and why no compressor has to be shipped.
 *
 * Deliberately not attempted: encrypted documents, and editing existing body
 * text. PDF text is positioned glyphs in subset fonts with no concept of
 * reflow — "editing" it is a rendering-and-overlay trick, not editing.
 */

/* ============================================================
   Byte helpers
   ============================================================ */

/* The standard security handler (pdfcrypt.js). In the browser bundle it is
   declared just before this file; in Node it sits beside it. */
const CRYPT = (function () {
  try { if (typeof PDFCrypt !== 'undefined') return PDFCrypt; } catch (e) { /* not in this scope */ }
  try { if (typeof require === 'function') return require('./pdfcrypt.js').PDFCrypt; } catch (e) { /* absent */ }
  return null;
})();

const WS = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIM = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);
const isWS = (c) => WS.has(c);
const isDelim = (c) => DELIM.has(c);
const isRegular = (c) => !isWS(c) && !isDelim(c);

function latin1(bytes, from, to) {
  let s = '';
  const end = to === undefined ? bytes.length : to;
  for (let i = from || 0; i < end; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function bytesOf(str) {
  const a = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) a[i] = str.charCodeAt(i) & 0xff;
  return a;
}

async function inflate(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot decompress PDF streams.');
  }
  // Most PDFs use zlib-wrapped deflate; a few emit raw. Try both.
  for (const fmt of ['deflate', 'deflate-raw']) {
    try {
      const ds = new DecompressionStream(fmt);
      const stream = new Blob([bytes]).stream().pipeThrough(ds);
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) { /* try the next format */ }
  }
  throw new Error('A compressed stream in this PDF could not be decoded.');
}

/** zlib-wrapped deflate, the platform's own (FlateDecode's format). */
async function deflate(bytes) {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('This browser cannot compress PDF streams.');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* ============================================================
   Progress and preview hooks

   The worker sets these around a run. Progress is reported per page as
   assemble writes it; a preview run (the page render before the real run)
   makes assemble write only the one page being looked at, so a 400-page
   watermark preview costs one page, not four hundred.
   ============================================================ */

let PROGRESS = null;
let PREVIEW = null;
function setProgress(fn) { PROGRESS = typeof fn === 'function' ? fn : null; }
function setPreview(p) { PREVIEW = p && typeof p.pageIndex === 'number' ? p : null; }
function progress(done, total, label) {
  if (PROGRESS) { try { PROGRESS(done, total, label); } catch (e) { /* a reporter must never break a run */ } }
}

/* PNG/TIFF predictors, used by xref streams and some image data */
function applyPredictor(data, predictor, colors, bpc, columns) {
  if (!predictor || predictor < 2) return data;
  if (predictor === 2) return data;                       // TIFF, rare
  const bpp = Math.ceil((colors * bpc) / 8);
  const rowLen = Math.ceil((colors * bpc * columns) / 8);
  const rows = Math.floor(data.length / (rowLen + 1));
  const out = new Uint8Array(rows * rowLen);
  let prev = new Uint8Array(rowLen);

  for (let r = 0; r < rows; r++) {
    const ft = data[r * (rowLen + 1)];
    const src = data.subarray(r * (rowLen + 1) + 1, (r + 1) * (rowLen + 1));
    const cur = new Uint8Array(rowLen);
    for (let i = 0; i < rowLen; i++) {
      const raw = src[i];
      const left = i >= bpp ? cur[i - bpp] : 0;
      const up = prev[i];
      const upLeft = i >= bpp ? prev[i - bpp] : 0;
      let v;
      switch (ft) {
        case 0: v = raw; break;
        case 1: v = raw + left; break;
        case 2: v = raw + up; break;
        case 3: v = raw + ((left + up) >> 1); break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
          v = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
          break;
        }
        default: v = raw;
      }
      cur[i] = v & 0xff;
    }
    out.set(cur, r * rowLen);
    prev = cur;
  }
  return out;
}

/* ============================================================
   Object model
   ============================================================ */

class Name { constructor(n) { this.name = n; } toString() { return '/' + this.name; } }
class Ref  { constructor(n, g) { this.num = n; this.gen = g || 0; } toString() { return `${this.num} ${this.gen} R`; } }
class PDFStream {
  constructor(dict, raw) { this.dict = dict; this.raw = raw; this._decoded = null; }
}

const isName = (v, n) => v instanceof Name && (n === undefined || v.name === n);
const isRef = (v) => v instanceof Ref;
const isDict = (v) => v && typeof v === 'object' && !Array.isArray(v) &&
  !(v instanceof Name) && !(v instanceof Ref) && !(v instanceof PDFStream) && !(v instanceof Uint8Array);

/* ============================================================
   Lexer / parser
   ============================================================ */

class Lexer {
  constructor(bytes, pos) { this.b = bytes; this.p = pos || 0; }

  skipWS() {
    while (this.p < this.b.length) {
      const c = this.b[this.p];
      if (isWS(c)) { this.p++; continue; }
      if (c === 0x25) {                              // % comment
        while (this.p < this.b.length && this.b[this.p] !== 0x0a && this.b[this.p] !== 0x0d) this.p++;
        continue;
      }
      break;
    }
  }

  readToken() {
    this.skipWS();
    if (this.p >= this.b.length) return null;
    const start = this.p;
    while (this.p < this.b.length && isRegular(this.b[this.p])) this.p++;
    if (this.p === start) this.p++;                  // a delimiter is its own token
    return latin1(this.b, start, this.p);
  }

  peekByte() { this.skipWS(); return this.b[this.p]; }

  parse(depth) {
    if ((depth || 0) > 60) throw new Error('PDF object nesting is implausibly deep');
    this.skipWS();
    if (this.p >= this.b.length) return undefined;
    const c = this.b[this.p];

    if (c === 0x2f) {                                // /Name
      this.p++;
      const start = this.p;
      while (this.p < this.b.length && isRegular(this.b[this.p])) this.p++;
      let raw = latin1(this.b, start, this.p);
      raw = raw.replace(/#([0-9a-fA-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
      return new Name(raw);
    }

    if (c === 0x28) return this.parseLiteralString();
    if (c === 0x3c) {
      if (this.b[this.p + 1] === 0x3c) return this.parseDict(depth || 0);
      return this.parseHexString();
    }
    if (c === 0x5b) {                                // [ array ]
      this.p++;
      const arr = [];
      for (;;) {
        this.skipWS();
        if (this.p >= this.b.length) throw new Error('Unterminated array');
        if (this.b[this.p] === 0x5d) { this.p++; return arr; }
        const v = this.parse((depth || 0) + 1);
        if (v === undefined) throw new Error('Bad value in array');
        arr.push(v);
      }
    }
    if (c === 0x5d || c === 0x3e || c === 0x29) { this.p++; return undefined; }

    // number, reference, keyword
    const save = this.p;
    const tok = this.readToken();
    if (tok === null) return undefined;
    if (tok === 'true') return true;
    if (tok === 'false') return false;
    if (tok === 'null') return null;

    if (/^[+-]?[\d.]+$/.test(tok)) {
      // possible "n g R"
      const save2 = this.p;
      const t2 = this.readToken();
      if (t2 !== null && /^\d+$/.test(t2)) {
        const save3 = this.p;
        const t3 = this.readToken();
        if (t3 === 'R' && /^\d+$/.test(tok)) return new Ref(parseInt(tok, 10), parseInt(t2, 10));
        this.p = save3;
      }
      this.p = save2;
      return parseFloat(tok);
    }

    this.p = save + tok.length;
    return { __keyword: tok };
  }

  parseDict(depth) {
    this.p += 2;                                     // <<
    const d = Object.create(null);
    for (;;) {
      this.skipWS();
      if (this.p >= this.b.length) throw new Error('Unterminated dictionary');
      if (this.b[this.p] === 0x3e && this.b[this.p + 1] === 0x3e) { this.p += 2; break; }
      const key = this.parse(depth + 1);
      if (!(key instanceof Name)) {
        if (key === undefined) throw new Error('Malformed dictionary key');
        continue;
      }
      const val = this.parse(depth + 1);
      d[key.name] = val;
    }

    // a dictionary followed by `stream` owns the bytes that follow
    const save = this.p;
    this.skipWS();
    if (latin1(this.b, this.p, this.p + 6) === 'stream') {
      this.p += 6;
      if (this.b[this.p] === 0x0d) this.p++;
      if (this.b[this.p] === 0x0a) this.p++;
      const start = this.p;
      let len = d.Length;
      let end;
      if (typeof len === 'number' && start + len <= this.b.length) {
        end = start + len;
        // trust /Length only if endstream really follows
        const after = latin1(this.b, end, end + 20);
        if (!/^\s*endstream/.test(after)) end = null;
      }
      if (end == null) {
        const idx = latin1(this.b, start).indexOf('endstream');
        if (idx < 0) throw new Error('Stream has no endstream marker');
        end = start + idx;
        while (end > start && (this.b[end - 1] === 0x0a || this.b[end - 1] === 0x0d)) end--;
      }
      const raw = this.b.slice(start, end);
      this.p = end;
      const ei = latin1(this.b, this.p, this.p + 40).indexOf('endstream');
      if (ei >= 0) this.p += ei + 9;
      return new PDFStream(d, raw);
    }
    this.p = save;
    return d;
  }

  parseLiteralString() {
    this.p++;
    const out = [];
    let depth = 1;
    while (this.p < this.b.length) {
      let c = this.b[this.p++];
      if (c === 0x5c) {                              // backslash
        const n = this.b[this.p++];
        const MAP = { 0x6e: 10, 0x72: 13, 0x74: 9, 0x62: 8, 0x66: 12 };
        if (MAP[n] !== undefined) out.push(MAP[n]);
        else if (n >= 0x30 && n <= 0x37) {           // octal
          let oct = String.fromCharCode(n);
          for (let k = 0; k < 2 && this.b[this.p] >= 0x30 && this.b[this.p] <= 0x37; k++) {
            oct += String.fromCharCode(this.b[this.p++]);
          }
          out.push(parseInt(oct, 8) & 0xff);
        } else if (n === 0x0a) { /* line continuation */ }
        else if (n === 0x0d) { if (this.b[this.p] === 0x0a) this.p++; }
        else out.push(n);
        continue;
      }
      if (c === 0x28) depth++;
      if (c === 0x29) { depth--; if (!depth) break; }
      out.push(c);
    }
    return { __string: new Uint8Array(out) };
  }

  parseHexString() {
    this.p++;
    let hex = '';
    while (this.p < this.b.length && this.b[this.p] !== 0x3e) {
      const c = String.fromCharCode(this.b[this.p++]);
      if (/[0-9a-fA-F]/.test(c)) hex += c;
    }
    this.p++;
    if (hex.length % 2) hex += '0';
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return { __string: out };
  }
}

/* ============================================================
   Document
   ============================================================ */

class PDFDocument {
  constructor(bytes) {
    this.bytes = bytes;
    this.objects = new Map();      // num -> value
    this.trailer = null;
    this.version = '1.4';
    this.warnings = [];
  }

  static async load(bytes, options) {
    const doc = new PDFDocument(bytes);
    doc._password = (options && options.password) || '';
    /* decrypt: false reads an encrypted file's objects as they are stored,
       still encrypted (the security handler's own tests use this) */
    doc._noDecrypt = !!(options && options.decrypt === false);
    await doc._parse();
    return doc;
  }

  async _parse() {
    const b = this.bytes;
    if (latin1(b, 0, 5) !== '%PDF-') throw new Error('This file does not begin with a PDF header.');
    this.version = latin1(b, 5, 8);

    const tail = latin1(b, Math.max(0, b.length - 2048));
    const sx = tail.lastIndexOf('startxref');
    let ok = false;
    if (sx >= 0) {
      const off = parseInt(tail.slice(sx + 9).trim(), 10);
      if (isFinite(off) && off > 0 && off < b.length) {
        try { await this._readXrefChain(off, new Set()); ok = true; }
        catch (e) { this.warnings.push('Cross-reference table unreadable: ' + e.message); }
      }
    }
    // A damaged or unusual xref is common in the wild; scanning always works.
    if (!ok || !this.trailer || !this.trailer.Root) await this._scanAllObjects();
    if (!this.trailer || !this.trailer.Root) {
      const found = this._findCatalogByScan();
      if (!found) throw new Error('No document catalogue found — the file may be damaged or encrypted.');
      this.trailer = this.trailer || Object.create(null);
      this.trailer.Root = found;
    }
    if (this.trailer && this.trailer.Encrypt) { if (this._noDecrypt) this.encrypted = true; else await this._decrypt(); }
    else if (this._deferred) await this._expandDeferred();
  }

  async _readXrefChain(offset, seen) {
    if (seen.has(offset) || seen.size > 64) return;
    seen.add(offset);

    const lex = new Lexer(this.bytes, offset);
    lex.skipWS();

    if (latin1(this.bytes, lex.p, lex.p + 4) === 'xref') {
      lex.p += 4;
      for (;;) {
        lex.skipWS();
        if (latin1(this.bytes, lex.p, lex.p + 7) === 'trailer') { lex.p += 7; break; }
        const start = lex.readToken(), count = lex.readToken();
        if (start === null || count === null || !/^\d+$/.test(start) || !/^\d+$/.test(count)) break;
        const s = parseInt(start, 10), n = parseInt(count, 10);
        for (let i = 0; i < n; i++) {
          lex.skipWS();
          const off = lex.readToken(), gen = lex.readToken(), type = lex.readToken();
          if (type === 'n' && !this.objects.has(s + i)) {
            this._offsets = this._offsets || new Map();
            if (!this._offsets.has(s + i)) this._offsets.set(s + i, parseInt(off, 10));
          }
        }
      }
      const tr = lex.parse(0);
      if (isDict(tr)) {
        this.trailer = this.trailer || Object.create(null);
        for (const k of Object.keys(tr)) if (!(k in this.trailer)) this.trailer[k] = tr[k];
        if (typeof tr.XRefStm === 'number') await this._readXrefChain(tr.XRefStm, seen);
        if (typeof tr.Prev === 'number') await this._readXrefChain(tr.Prev, seen);
      }
      await this._materialiseOffsets();
      return;
    }

    // xref stream: "N G obj << ... >> stream"
    lex.readToken(); lex.readToken(); lex.readToken();
    const st = lex.parse(0);
    if (!(st instanceof PDFStream)) throw new Error('Expected a cross-reference stream');
    const d = st.dict;
    const data = await this.decodeStream(st);
    const W = (d.W || []).map(Number);
    if (W.length < 3) throw new Error('Cross-reference stream has a malformed /W array');
    const size = Number(d.Size) || 0;
    const index = d.Index && d.Index.length ? d.Index.map(Number) : [0, size];

    const rowLen = W.reduce((a, c) => a + c, 0);
    let p = 0;
    this._offsets = this._offsets || new Map();
    this._inObjStm = this._inObjStm || new Map();

    for (let s = 0; s < index.length; s += 2) {
      const first = index[s], n = index[s + 1];
      for (let i = 0; i < n && p + rowLen <= data.length; i++) {
        const f = [];
        for (const w of W) {
          let v = 0;
          for (let k = 0; k < w; k++) v = v * 256 + data[p + k];
          f.push(w === 0 ? 1 : v);
          p += w;
        }
        const num = first + i;
        if (f[0] === 1 && !this._offsets.has(num) && !this._inObjStm.has(num)) this._offsets.set(num, f[1]);
        else if (f[0] === 2 && !this._offsets.has(num) && !this._inObjStm.has(num)) this._inObjStm.set(num, { stm: f[1], idx: f[2] });
      }
    }

    this.trailer = this.trailer || Object.create(null);
    for (const k of Object.keys(d)) if (!(k in this.trailer)) this.trailer[k] = d[k];
    if (typeof d.Prev === 'number') await this._readXrefChain(d.Prev, seen);
    await this._materialiseOffsets();
  }

  async _materialiseOffsets() {
    if (this._offsets) {
      for (const [num, off] of this._offsets) {
        if (this.objects.has(num)) continue;
        try {
          const lex = new Lexer(this.bytes, off);
          const a = lex.readToken(), b2 = lex.readToken(), c = lex.readToken();
          if (c !== 'obj') continue;
          if (parseInt(a, 10) !== num) continue;
          const v = lex.parse(0);
          if (v !== undefined) { this.objects.set(num, v); this._gen(num, b2); }
        } catch (e) { /* one bad object should not sink the document */ }
      }
      this._offsets = null;
    }
    if (this._inObjStm && this._inObjStm.size && this.trailer && this.trailer.Encrypt) {
      this._deferred = this._deferred || new Map();
      for (const [num, loc] of this._inObjStm) if (!this._deferred.has(num)) this._deferred.set(num, loc);
      this._inObjStm = null;
      return;
    }
    if (this._inObjStm && this._inObjStm.size) {
      const byStm = new Map();
      for (const [num, loc] of this._inObjStm) {
        if (!byStm.has(loc.stm)) byStm.set(loc.stm, []);
        byStm.get(loc.stm).push(num);
      }
      for (const [stmNum, nums] of byStm) {
        try { await this._expandObjStm(stmNum, nums); }
        catch (e) { this.warnings.push(`Object stream ${stmNum} could not be expanded.`); }
      }
      this._inObjStm = null;
    }
  }

  async _expandObjStm(stmNum, wanted) {
    const stm = this.objects.get(stmNum);
    if (!(stm instanceof PDFStream)) return;
    const data = await this.decodeStream(stm);
    const n = Number(await this.resolve(stm.dict.N)) || 0;
    const first = Number(await this.resolve(stm.dict.First)) || 0;

    const head = new Lexer(data, 0);
    const pairs = [];
    for (let i = 0; i < n; i++) {
      const num = head.readToken(), off = head.readToken();
      if (num === null || off === null) break;
      pairs.push([parseInt(num, 10), parseInt(off, 10)]);
    }
    for (const [num, off] of pairs) {
      if (this.objects.has(num)) continue;
      if (wanted && wanted.length && !wanted.includes(num)) { /* still parse — cheap and avoids a second pass */ }
      try {
        const lex = new Lexer(data, first + off);
        const v = lex.parse(0);
        if (v !== undefined) this.objects.set(num, v);
      } catch (e) { /* skip */ }
    }
  }

  /** Brute-force scan for "N G obj". Slower, but survives a broken xref. */
  async _scanAllObjects() {
    const s = latin1(this.bytes);
    const re = /(\d+)\s+(\d+)\s+obj\b/g;
    let m;
    while ((m = re.exec(s)) !== null) {
      const num = parseInt(m[1], 10);
      try {
        const lex = new Lexer(this.bytes, m.index + m[0].length);
        const v = lex.parse(0);
        if (v !== undefined) { this.objects.set(num, v); this._gen(num, m[2]); }   // later wins
      } catch (e) { /* skip */ }
    }
    if (this._findEncryptByScan()) { this._scanDeferred = true; }
    // expand any object streams we found
    for (const [num, v] of (this._scanDeferred ? [] : [...this.objects])) {
      if (v instanceof PDFStream && isName(v.dict.Type, 'ObjStm')) {
        try { await this._expandObjStm(num, null); } catch (e) { /* skip */ }
      }
    }
    if (!this.trailer || !this.trailer.Root) {
      const ti = s.lastIndexOf('trailer');
      if (ti >= 0) {
        try {
          const lex = new Lexer(this.bytes, ti + 7);
          const tr = lex.parse(0);
          if (isDict(tr)) { this.trailer = this.trailer || Object.create(null); Object.assign(this.trailer, tr); }
        } catch (e) { /* fall through to catalogue scan */ }
      }
    }
  }

  _gen(num, g) {
    const n = parseInt(g, 10);
    if (n > 0) { this._gens = this._gens || new Map(); this._gens.set(num, n); }
  }

  /** A damaged file's trailer may be lost; its Encrypt dictionary is not. */
  _findEncryptByScan() {
    if (this.trailer && this.trailer.Encrypt) return true;
    for (const [num, v] of this.objects) {
      if (isDict(v) && isName(v.Filter) && v.O !== undefined && v.U !== undefined && v.P !== undefined && v.R !== undefined) {
        this.trailer = this.trailer || Object.create(null);
        this.trailer.Encrypt = new Ref(num, 0);
        return true;
      }
    }
    return false;
  }

  /**
   * Open an encrypted file with the password given to load(), or with none:
   * a file protected only against printing or copying has an empty user
   * password and opens like any other. Every string and stream is decrypted
   * in place, so the rest of the engine never sees ciphertext and what it
   * writes is a plain file. doc.security says how it was opened.
   */
  async _decrypt() {
    if (!CRYPT) throw Object.assign(new Error('This PDF is encrypted, and this copy of the engine cannot open encrypted files.'), { code: 'unsupported' });
    const encRef = this.trailer.Encrypt;
    const enc = await this.resolve(encRef);
    if (!isDict(enc)) throw Object.assign(new Error('This PDF says it is encrypted but its encryption dictionary is missing.'), { code: 'damaged' });
    const plain = (v, depth) => {
      if (depth > 6) return null;
      if (v instanceof Ref) return plain(this.objects.get(v.num), depth + 1);
      if (v instanceof Name) return v.name;
      if (v && v.__string !== undefined) return v.__string;
      if (Array.isArray(v)) return v.map((x) => plain(x, depth + 1));
      if (isDict(v)) { const o = {}; for (const k of Object.keys(v)) o[k] = plain(v[k], depth + 1); return o; }
      return v;
    };
    const ids = await this.resolve(this.trailer.ID);
    const id0 = Array.isArray(ids) && ids[0] && ids[0].__string ? ids[0].__string : new Uint8Array(0);
    const h = CRYPT.openHandler({ encrypt: plain(enc, 0), id0, password: this._password || '' });
    if (!h.ok) {
      if (h.reason === 'password') {
        throw Object.assign(new Error(this._password ? 'That password did not open it.' : 'This PDF needs a password to open.'), { code: 'password' });
      }
      throw Object.assign(new Error(h.message || 'This PDF uses an encryption method these tools cannot open (a certificate rather than a password, for example).'), { code: 'unsupported' });
    }
    const skip = encRef instanceof Ref ? encRef.num : -1;
    const gens = this._gens || new Map();
    const walk = (v, num, gen) => {
      if (!v || typeof v !== 'object') return;
      if (v.__string !== undefined) { v.__string = CRYPT.decryptBytes(h, num, gen, v.__string, 'string'); return; }
      if (Array.isArray(v)) { for (const x of v) walk(x, num, gen); return; }
      if (v instanceof PDFStream) { walk(v.dict, num, gen); return; }
      if (isDict(v)) for (const k of Object.keys(v)) walk(v[k], num, gen);
    };
    for (const [num, v] of this.objects) {
      if (num === skip) continue;
      const gen = gens.get(num) || 0;
      if (v instanceof PDFStream) {
        const type = v.dict.Type;
        if (isName(type, 'XRef')) continue;
        const kind = isName(type, 'Metadata') ? 'metadata' : isName(type, 'EmbeddedFile') ? 'embeddedFile' : 'stream';
        walk(v.dict, num, gen);
        v.raw = CRYPT.decryptBytes(h, num, gen, v.raw, kind);
        v._decoded = null;
      } else walk(v, num, gen);
    }
    this.security = {
      method: h.method || (h.stmf === 'AESV3' ? 'AES-256' : h.stmf === 'AESV2' ? 'AES-128' : 'RC4'),
      openedWith: h.openedWith || (this._password ? (h.isOwner ? 'owner' : 'user') : 'empty'),
      isOwner: !!h.isOwner,
      permissions: CRYPT.permissionsFromP(h.permissions, h.revision),
      describe: CRYPT.describeHandler(h)
    };
    delete this.trailer.Encrypt;
    if (this._deferred) await this._expandDeferred();
    if (this._scanDeferred) {
      this._scanDeferred = false;
      for (const [num, v] of [...this.objects]) {
        if (v instanceof PDFStream && isName(v.dict.Type, 'ObjStm')) {
          try { await this._expandObjStm(num, null); } catch (e) { /* skip */ }
        }
      }
    }
  }

  async _expandDeferred() {
    const byStm = new Map();
    for (const [num, loc] of this._deferred) {
      if (!byStm.has(loc.stm)) byStm.set(loc.stm, []);
      byStm.get(loc.stm).push(num);
    }
    this._deferred = null;
    for (const [stmNum, nums] of byStm) {
      try { await this._expandObjStm(stmNum, nums); }
      catch (e) { this.warnings.push(`Object stream ${stmNum} could not be expanded.`); }
    }
  }

  _findCatalogByScan() {
    for (const [num, v] of this.objects) {
      const d = v instanceof PDFStream ? v.dict : v;
      if (isDict(d) && isName(d.Type, 'Catalog')) return new Ref(num, 0);
    }
    return null;
  }

  async resolve(v) {
    let guard = 0;
    while (v instanceof Ref) {
      if (++guard > 64) throw new Error('Circular reference in the PDF');
      v = this.objects.get(v.num);
    }
    return v;
  }

  async decodeStream(stm) {
    if (stm._decoded) return stm._decoded;
    let data = stm.raw;
    let filters = await this.resolve(stm.dict.Filter);
    if (!filters) { stm._decoded = data; return data; }
    if (!Array.isArray(filters)) filters = [filters];
    let parms = await this.resolve(stm.dict.DecodeParms || stm.dict.DP);
    if (!Array.isArray(parms)) parms = [parms];

    for (let i = 0; i < filters.length; i++) {
      const f = await this.resolve(filters[i]);
      if (!(f instanceof Name)) continue;
      if (f.name === 'FlateDecode' || f.name === 'Fl') {
        data = await inflate(data);
        const pm = await this.resolve(parms[i]);
        if (isDict(pm) && pm.Predictor) {
          data = applyPredictor(data, Number(await this.resolve(pm.Predictor)),
            Number(await this.resolve(pm.Colors)) || 1,
            Number(await this.resolve(pm.BitsPerComponent)) || 8,
            Number(await this.resolve(pm.Columns)) || 1);
        }
      } else if (f.name === 'ASCIIHexDecode' || f.name === 'AHx') {
        let hex = latin1(data).replace(/[^0-9a-fA-F>]/g, '');
        hex = hex.slice(0, hex.indexOf('>') >= 0 ? hex.indexOf('>') : hex.length);
        if (hex.length % 2) hex += '0';
        const out = new Uint8Array(hex.length / 2);
        for (let k = 0; k < out.length; k++) out[k] = parseInt(hex.substr(k * 2, 2), 16);
        data = out;
      } else if (f.name === 'ASCII85Decode' || f.name === 'A85') {
        data = ascii85Decode(data);
      } else {
        // DCTDecode, JPXDecode and friends stay compressed; that is correct,
        // since we copy image data through untouched.
        break;
      }
    }
    stm._decoded = data;
    return data;
  }

  /** Flatten the page tree into an ordered array of page dictionaries. */
  async getPages() {
    if (this._pages) return this._pages;
    const root = await this.resolve(this.trailer.Root);
    if (!isDict(root)) throw new Error('The document catalogue is missing or malformed.');
    const pagesRef = root.Pages;
    const out = [];
    const seen = new Set();

    const walk = async (ref, inherited, depth) => {
      if (depth > 64 || out.length > 20000) return;
      const key = ref instanceof Ref ? ref.num : null;
      if (key !== null) { if (seen.has(key)) return; seen.add(key); }
      const node = await this.resolve(ref);
      if (!isDict(node)) return;

      const inh = Object.assign({}, inherited);
      for (const k of ['Resources', 'MediaBox', 'CropBox', 'Rotate']) {
        if (node[k] !== undefined) inh[k] = node[k];
      }
      if (isName(node.Type, 'Page') || (!node.Kids && node.Contents !== undefined)) {
        out.push({ ref: ref instanceof Ref ? ref : null, dict: node, inherited: inh });
        return;
      }
      const kids = await this.resolve(node.Kids);
      if (Array.isArray(kids)) for (const k of kids) await walk(k, inh, depth + 1);
    };

    await walk(pagesRef, Object.create(null), 0);
    if (!out.length) {
      // last resort: any object that looks like a page
      for (const [num, v] of this.objects) {
        if (isDict(v) && isName(v.Type, 'Page')) out.push({ ref: new Ref(num, 0), dict: v, inherited: Object.create(null) });
      }
    }
    this._pages = out;
    return out;
  }

  async pageCount() { return (await this.getPages()).length; }

  async getInfo() {
    const info = await this.resolve(this.trailer && this.trailer.Info);
    const out = {};
    if (isDict(info)) {
      for (const k of ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate']) {
        const v = await this.resolve(info[k]);
        if (v && v.__string) out[k] = decodePdfString(v.__string);
        else if (typeof v === 'string') out[k] = v;
      }
    }
    return out;
  }
}

function decodePdfString(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let s = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    return s;
  }
  return latin1(bytes);
}

function ascii85Decode(data) {
  const s = latin1(data).replace(/\s/g, '').replace(/^<~/, '');
  const end = s.indexOf('~>');
  const body = end >= 0 ? s.slice(0, end) : s;
  const out = [];
  let tuple = [], i = 0;
  while (i < body.length) {
    const c = body[i++];
    if (c === 'z' && tuple.length === 0) { out.push(0, 0, 0, 0); continue; }
    tuple.push(c.charCodeAt(0) - 33);
    if (tuple.length === 5) {
      let v = 0;
      for (const t of tuple) v = v * 85 + t;
      out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
      tuple = [];
    }
  }
  if (tuple.length) {
    const n = tuple.length;
    for (let k = n; k < 5; k++) tuple.push(84);
    let v = 0;
    for (const t of tuple) v = v * 85 + t;
    const b = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
    for (let k = 0; k < n - 1; k++) out.push(b[k]);
  }
  return new Uint8Array(out);
}

/* ============================================================
   Writer
   ============================================================ */

class PDFWriter {
  constructor() {
    this.objects = [null];        // 1-indexed
  }
  alloc() { this.objects.push(undefined); return this.objects.length - 1; }
  set(num, val) { this.objects[num] = val; }
  add(val) { const n = this.alloc(); this.objects[n] = val; return n; }

  serialiseValue(v) {
    if (v === null) return 'null';
    if (v === true) return 'true';
    if (v === false) return 'false';
    if (typeof v === 'number') {
      if (!isFinite(v)) return '0';
      return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(6)));
    }
    if (v instanceof Name) return '/' + v.name.replace(/[^\x21-\x7e]|[#()<>\[\]{}\/%]/g,
      c => '#' + c.charCodeAt(0).toString(16).padStart(2, '0'));
    if (v instanceof Ref) return `${v.num} ${v.gen} R`;
    if (Array.isArray(v)) return '[' + v.map(x => this.serialiseValue(x)).join(' ') + ']';
    if (v && v.__string !== undefined) return '(' + escapeString(v.__string) + ')';
    if (v && v.__raw !== undefined) return v.__raw;
    if (v instanceof PDFStream) return this.serialiseValue(v.dict);
    if (isDict(v)) {
      const parts = [];
      for (const k of Object.keys(v)) {
        if (v[k] === undefined) continue;
        parts.push('/' + k + ' ' + this.serialiseValue(v[k]));
      }
      return '<<' + parts.join(' ') + '>>';
    }
    return 'null';
  }

  build(rootRef, infoRef, version, extraTrailer) {
    const chunks = [];
    let len = 0;
    const push = (x) => { const a = typeof x === 'string' ? bytesOf(x) : x; chunks.push(a); len += a.length; };

    push(`%PDF-${version || '1.7'}\n%\xE2\xE3\xCF\xD3\n`);
    const offsets = new Array(this.objects.length).fill(0);

    for (let i = 1; i < this.objects.length; i++) {
      const v = this.objects[i];
      if (v === undefined) continue;
      offsets[i] = len;
      push(`${i} 0 obj\n`);
      if (v instanceof PDFStream) {
        const d = Object.assign(Object.create(null), v.dict);
        d.Length = v.raw.length;
        push(this.serialiseValue(d));
        push('\nstream\n');
        push(v.raw);
        push('\nendstream');
      } else {
        push(this.serialiseValue(v));
      }
      push('\nendobj\n');
    }

    const xrefAt = len;
    push(`xref\n0 ${this.objects.length}\n`);
    push('0000000000 65535 f \n');
    for (let i = 1; i < this.objects.length; i++) {
      /* a number left empty (a duplicate folded into another) is free */
      push(this.objects[i] === undefined ? '0000000000 65535 f \n' : String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
    }
    const trailer = { Size: this.objects.length, Root: rootRef };
    if (infoRef) trailer.Info = infoRef;
    if (extraTrailer) Object.assign(trailer, extraTrailer);
    push('trailer\n' + this.serialiseValue(trailer) + `\nstartxref\n${xrefAt}\n%%EOF\n`);

    const out = new Uint8Array(len);
    let p = 0;
    for (const c of chunks) { out.set(c, p); p += c.length; }
    return out;
  }
}

function escapeString(bytes) {
  let s = '';
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) s += '\\' + String.fromCharCode(b);
    else if (b < 32 || b > 126) s += '\\' + b.toString(8).padStart(3, '0');
    else s += String.fromCharCode(b);
  }
  return s;
}

const pdfString = (str) => {
  // UTF-16BE with a BOM whenever the text leaves Latin-1
  const needsUnicode = /[^\x00-\xff]/.test(str);
  if (!needsUnicode) return { __string: bytesOf(str) };
  const out = [0xfe, 0xff];
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp > 0xffff) {
      const v = cp - 0x10000;
      const hi = 0xd800 + (v >> 10), lo = 0xdc00 + (v & 0x3ff);
      out.push(hi >> 8, hi & 255, lo >> 8, lo & 255);
    } else out.push(cp >> 8, cp & 255);
  }
  return { __string: new Uint8Array(out) };
};

/* ============================================================
   Pictures: image XObjects for logos, stamps and scans
   ============================================================ */

/**
 * Make a picture ready to embed. A JPEG goes in as its own bytes
 * (DCTDecode); raw pixels are deflated, with their transparency as a soft
 * mask. Input, from the page's image control or a canvas:
 *   { kind: 'jpeg', bytes, width, height, components }
 *   { kind: 'raw', width, height, rgb, alpha | null }      (8 bits per sample)
 *   { kind: 'grey', width, height, grey }
 * Async because deflating uses the platform's CompressionStream.
 */
async function prepareImage(img) {
  if (!img || !(img.width > 0) || !(img.height > 0)) throw new Error('That picture has no size.');
  if (img.prepared) return img;
  if (img.kind === 'jpeg') {
    return { prepared: true, width: img.width, height: img.height, filter: 'DCTDecode', data: img.bytes,
      colorSpace: img.components === 1 ? 'DeviceGray' : img.components === 4 ? 'DeviceCMYK' : 'DeviceRGB', smask: null };
  }
  if (img.kind === 'grey') {
    return { prepared: true, width: img.width, height: img.height, filter: 'FlateDecode', data: await deflate(img.grey), colorSpace: 'DeviceGray', smask: null };
  }
  if (img.kind === 'raw') {
    const out = { prepared: true, width: img.width, height: img.height, filter: 'FlateDecode', data: await deflate(img.rgb), colorSpace: 'DeviceRGB', smask: null };
    if (img.alpha) out.smask = await deflate(img.alpha);
    return out;
  }
  throw new Error('Unknown picture format.');
}

/** Add a prepared picture to a writer once, however many pages draw it. */
function imageRef(writer, prep) {
  writer._images = writer._images || new Map();
  if (writer._images.has(prep)) return writer._images.get(prep);
  const d = Object.create(null);
  d.Type = new Name('XObject'); d.Subtype = new Name('Image');
  d.Width = prep.width; d.Height = prep.height;
  d.ColorSpace = new Name(prep.colorSpace); d.BitsPerComponent = 8;
  d.Filter = new Name(prep.filter);
  if (prep.colorSpace === 'DeviceCMYK' && prep.filter === 'DCTDecode') d.Decode = [1, 0, 1, 0, 1, 0, 1, 0];
  if (prep.smask) {
    const m = Object.create(null);
    m.Type = new Name('XObject'); m.Subtype = new Name('Image');
    m.Width = prep.width; m.Height = prep.height;
    m.ColorSpace = new Name('DeviceGray'); m.BitsPerComponent = 8; m.Filter = new Name('FlateDecode');
    d.SMask = new Ref(writer.add(new PDFStream(m, prep.smask)), 0);
  }
  const ref = new Ref(writer.add(new PDFStream(d, prep.data)), 0);
  writer._images.set(prep, ref);
  return ref;
}

/* ============================================================
   Page operations
   ============================================================ */

/* What copyObject returns for a reference it must not follow. A dictionary
   leaves that key out; a list of things (Kids, Annots, Fields, CO) leaves the
   entry out; any other array gets null in its place. */
const BARRED = Object.freeze({ __barred: true });
const LIST_KEYS = new Set(['Kids', 'Annots', 'Fields', 'CO']);

/**
 * Deep-copy an object graph from a source document into a writer, renumbering.
 *
 * With `ctx` (assemble passes one per source document) two kinds of reference
 * are never followed. A page the output keeps is pointed at its new page
 * object. Every other page, the page tree, the catalogue, and anything that
 * belongs only to a page the output leaves out (its annotations, the form
 * fields only it shows) is cut. Without that, a link or a form field on a kept
 * page drags a deleted page into the file behind it, content and all — present
 * in the bytes, invisible in every viewer.
 */
async function copyObject(doc, writer, value, map, depth, ctx) {
  depth = depth || 0;
  if (depth > 80) return null;
  if (value instanceof Ref) {
    const key = value.num;
    if (ctx) {
      if (ctx.kept.has(key)) return new Ref(ctx.kept.get(key), 0);
      if (ctx.barred.has(key)) return BARRED;
    }
    if (map.has(key)) return new Ref(map.get(key), 0);
    const slot = writer.alloc();
    map.set(key, slot);
    let target = await doc.resolve(value);
    if (ctx && ctx.rewrite) target = await ctx.rewrite(key, target);
    const copied = await copyObject(doc, writer, target, map, depth + 1, ctx);
    writer.set(slot, copied === undefined || copied === BARRED ? null : copied);
    return new Ref(slot, 0);
  }
  if (Array.isArray(value)) return copyArray(doc, writer, value, map, depth, ctx, false);
  if (value instanceof PDFStream) {
    const d = Object.create(null);
    for (const k of Object.keys(value.dict)) {
      if (k === 'Length') continue;
      const c = await copyEntry(doc, writer, k, value.dict[k], map, depth, ctx);
      if (c !== BARRED) d[k] = c;
    }
    return new PDFStream(d, value.raw);
  }
  if (isDict(value)) {
    const d = Object.create(null);
    for (const k of Object.keys(value)) {
      const c = await copyEntry(doc, writer, k, value[k], map, depth, ctx);
      if (c !== BARRED) d[k] = c;
    }
    return d;
  }
  return value;
}

async function copyEntry(doc, writer, key, v, map, depth, ctx) {
  if (Array.isArray(v)) return copyArray(doc, writer, v, map, depth, ctx, LIST_KEYS.has(key));
  return copyObject(doc, writer, v, map, depth + 1, ctx);
}

async function copyArray(doc, writer, value, map, depth, ctx, isList) {
  const out = [];
  for (const v of value) {
    const c = await copyObject(doc, writer, v, map, depth + 1, ctx);
    if (c === BARRED) { if (!isList) out.push(null); }
    else out.push(c);
  }
  return out;
}

/* ============================================================
   The visible page, the right way up
   ============================================================ */

async function readBox(doc, v) {
  const a = await doc.resolve(v);
  if (!Array.isArray(a) || a.length < 4) return null;
  const n = [];
  for (const x of a.slice(0, 4)) {
    const r = Number(await doc.resolve(x));
    if (!isFinite(r)) return null;
    n.push(r);
  }
  return [Math.min(n[0], n[2]), Math.min(n[1], n[3]), Math.max(n[0], n[2]), Math.max(n[1], n[3])];
}

/**
 * The part of a page a viewer shows (the CropBox, clipped to the MediaBox),
 * turned the way the viewer turns it (/Rotate, plus any `extraRotate`).
 *
 * Returns { width, height, rotate, box, matrix }: width and height are what
 * the reader sees, and matrix maps that upright frame — origin at the bottom
 * left of the visible page, x to the right, y up — onto the page's own
 * coordinates. A stamp drawn in the frame through that matrix lands upright
 * and inside the visible area whatever the page's rotation and crop. It is
 * the same frame pdf.js draws at scale 1, so a click on a preview and the
 * point written to the file agree.
 */
async function pageFrame(doc, pageIndex, extraRotate) {
  const pages = await doc.getPages();
  const page = pages[pageIndex];
  if (!page) throw new Error('There is no page ' + (pageIndex + 1) + ' in this document.');
  const get = (k) => (page.dict[k] !== undefined ? page.dict[k] : page.inherited[k]);
  const media = (await readBox(doc, get('MediaBox'))) || [0, 0, 595.28, 841.89];
  let box = media;
  const crop = await readBox(doc, get('CropBox'));
  if (crop) {
    const x0 = Math.max(crop[0], media[0]), y0 = Math.max(crop[1], media[1]);
    const x1 = Math.min(crop[2], media[2]), y1 = Math.min(crop[3], media[3]);
    if (x1 > x0 && y1 > y0) box = [x0, y0, x1, y1];
  }
  let rot = (Number(await doc.resolve(get('Rotate'))) || 0) + (Number(extraRotate) || 0);
  rot = ((rot % 360) + 360) % 360;
  if (rot % 90) rot = 0;                          // what viewers do with a bad angle
  const [x0, y0, x1, y1] = box;
  const w = x1 - x0, h = y1 - y0;
  const matrix = rot === 90 ? [0, 1, -1, 0, x1, y0]
    : rot === 180 ? [-1, 0, 0, -1, x1, y1]
    : rot === 270 ? [0, -1, 1, 0, x0, y1]
    : [1, 0, 0, 1, x0, y0];
  return { width: rot % 180 ? h : w, height: rot % 180 ? w : h, rotate: rot, box, matrix };
}

/* ============================================================
   What a rebuilt file may carry from each source
   ============================================================ */

function newSource(doc) {
  return {
    doc, map: new Map(),
    kept: new Map(),          // source page object number -> output page object number
    keptIdx: new Set(),       // source page indices in the output
    first: null,              // output object number of the first page taken from it
    pageNums: new Set(), barred: new Set(),
    annotNums: new Set(), aliveAnnots: new Set(),
    aliveFields: new Set(), liveWidgets: [],
    root: null, acroForm: null, named: null, ctx: null
  };
}

/** Everything about one source that assemble needs before it copies a page. */
async function prepareSource(doc, st) {
  const pages = await doc.getPages();
  pages.forEach((p) => { if (p.ref) st.pageNums.add(p.ref.num); });
  /* every page is barred; the kept ones are caught first and remapped */
  for (const n of st.pageNums) st.barred.add(n);

  const rootRef = doc.trailer && doc.trailer.Root;
  if (rootRef instanceof Ref) st.barred.add(rootRef.num);
  const root = await doc.resolve(rootRef);
  st.root = isDict(root) ? root : Object.create(null);

  /* the page tree */
  const tree = async (ref, depth) => {
    if (!(ref instanceof Ref) || depth > 64 || st.pageNums.has(ref.num)) return;
    const node = await doc.resolve(ref);
    if (!isDict(node) || isName(node.Type, 'Page') || st.barred.has(ref.num)) return;
    st.barred.add(ref.num);
    const kids = await doc.resolve(node.Kids);
    if (Array.isArray(kids)) for (const k of kids) await tree(k, depth + 1);
  };
  await tree(st.root.Pages, 0);

  /* document-level dictionaries no page owns */
  for (const k of ['Outlines', 'AcroForm', 'Names', 'Dests', 'StructTreeRoot', 'Threads', 'PageLabels']) {
    if (st.root[k] instanceof Ref) st.barred.add(st.root[k].num);
  }
  const ol = await doc.resolve(st.root.Outlines);
  if (isDict(ol)) {
    const seen = new Set();
    const walk = async (ref, depth) => {
      while (ref instanceof Ref && !seen.has(ref.num) && depth < 32 && seen.size < 100000) {
        seen.add(ref.num);
        st.barred.add(ref.num);
        const it = await doc.resolve(ref);
        if (!isDict(it)) return;
        await walk(it.First, depth + 1);
        ref = it.Next;
      }
    };
    await walk(ol.First, 0);
  }

  /* annotations: alive when they sit on a page the output keeps */
  for (let i = 0; i < pages.length; i++) {
    const arr = await doc.resolve(pages[i].dict.Annots);
    if (!Array.isArray(arr)) continue;
    for (const r of arr) {
      if (!(r instanceof Ref)) continue;
      st.annotNums.add(r.num);
      if (st.keptIdx.has(i)) st.aliveAnnots.add(r.num);
    }
  }
  for (const n of st.annotNums) if (!st.aliveAnnots.has(n)) st.barred.add(n);

  /* form fields: alive when one of their widgets is */
  const af = await doc.resolve(st.root.AcroForm);
  st.acroForm = isDict(af) ? af : null;
  const nodes = new Set();
  const down = async (ref, depth) => {
    if (!(ref instanceof Ref) || nodes.has(ref.num) || depth > 32) return;
    nodes.add(ref.num);
    const d = await doc.resolve(ref);
    if (!isDict(d)) return;
    const kids = await doc.resolve(d.Kids);
    if (Array.isArray(kids)) for (const k of kids) await down(k, depth + 1);
  };
  if (st.acroForm) {
    const f = await doc.resolve(st.acroForm.Fields);
    if (Array.isArray(f)) for (const r of f) await down(r, 0);
  }
  for (const n of st.annotNums) {
    const a = await doc.resolve(new Ref(n, 0));
    if (!isDict(a) || !isName(await doc.resolve(a.Subtype), 'Widget')) continue;
    const live = st.aliveAnnots.has(n);
    nodes.add(n);
    if (live) { st.aliveFields.add(n); st.liveWidgets.push(a); }
    let d = a, guard = 0;
    while (isDict(d) && d.Parent instanceof Ref && guard++ < 32) {
      nodes.add(d.Parent.num);
      if (live) st.aliveFields.add(d.Parent.num);
      d = await doc.resolve(d.Parent);
    }
  }
  for (const n of nodes) if (!st.aliveFields.has(n)) st.barred.add(n);

  st.ctx = {
    kept: st.kept, barred: st.barred,
    rewrite: async (num, v) => (st.annotNums.has(num) && isDict(v)) ? rewriteAnnot(doc, st, v) : v
  };
}

/** Name -> destination, from the catalogue's /Dests and its /Names tree. */
async function namedDests(doc, st) {
  if (st.named) return st.named;
  const m = new Map();
  const old = await doc.resolve(st.root.Dests);
  if (isDict(old)) for (const k of Object.keys(old)) m.set(k, old[k]);
  const names = await doc.resolve(st.root.Names);
  const seen = new Set();
  const walk = async (ref, depth) => {
    if (depth > 32) return;
    if (ref instanceof Ref) { if (seen.has(ref.num)) return; seen.add(ref.num); }
    const node = await doc.resolve(ref);
    if (!isDict(node)) return;
    const arr = await doc.resolve(node.Names);
    if (Array.isArray(arr)) {
      for (let i = 0; i + 1 < arr.length; i += 2) {
        const k = await doc.resolve(arr[i]);
        if (k && k.__string && !m.has(latin1(k.__string))) m.set(latin1(k.__string), arr[i + 1]);
      }
    }
    const kids = await doc.resolve(node.Kids);
    if (Array.isArray(kids)) for (const k of kids) await walk(k, depth + 1);
  };
  if (isDict(names)) await walk(names.Dests, 0);
  st.named = m;
  return m;
}

/**
 * A destination as an explicit array whose first element is the source page's
 * reference: { ok, page, array }. ok is false when it names nothing, or
 * nothing that is a page of this document.
 */
async function resolveDest(doc, st, dest) {
  let d = await doc.resolve(dest);
  if (d instanceof Name || (d && d.__string)) {
    const key = d instanceof Name ? d.name : latin1(d.__string);
    d = await doc.resolve((await namedDests(doc, st)).get(key));
  }
  if (isDict(d) && d.D !== undefined) d = await doc.resolve(d.D);
  if (!Array.isArray(d) || !d.length) return { ok: false, page: null, array: null };
  let first = d[0];
  if (typeof first === 'number') {               // a page index: meant for remote files, but some writers use it
    const p = (await doc.getPages())[first];
    first = p && p.ref ? p.ref : null;
  }
  if (!(first instanceof Ref) || !st.pageNums.has(first.num)) return { ok: false, page: null, array: null };
  return { ok: true, page: first.num, array: [first].concat(d.slice(1)) };
}

/** Where an annotation jumps to inside its own file, or null when it does not. */
async function annotTarget(doc, st, a) {
  if (a.Dest !== undefined) return Object.assign({ via: 'Dest' }, await resolveDest(doc, st, a.Dest));
  const act = await doc.resolve(a.A);
  if (isDict(act) && isName(await doc.resolve(act.S), 'GoTo')) {
    return Object.assign({ via: 'A', act }, await resolveDest(doc, st, act.D));
  }
  return null;
}

/** The annotation with its jump pointed at the kept page, or removed if that page is gone. */
async function rewriteAnnot(doc, st, a) {
  const t = await annotTarget(doc, st, a);
  if (!t) return a;
  const out = Object.assign(Object.create(null), a);
  const live = t.ok && st.kept.has(t.page);
  if (t.via === 'Dest') {
    if (live) out.Dest = t.array; else delete out.Dest;
  } else if (live) {
    const act = Object.assign(Object.create(null), t.act);
    act.D = t.array;
    out.A = act;
  } else delete out.A;
  return out;
}

/** A kept page's annotations, without the links that lead to a page the output leaves out. */
async function keptAnnots(doc, st, value) {
  const arr = await doc.resolve(value);
  if (!Array.isArray(arr)) return undefined;
  const out = [];
  for (const r of arr) {
    if (r instanceof Ref && st.barred.has(r.num)) continue;
    const a = await doc.resolve(r);
    if (!isDict(a)) continue;
    if (isName(await doc.resolve(a.Subtype), 'Link')) {
      const t = await annotTarget(doc, st, a);
      if (t && !(t.ok && st.kept.has(t.page))) continue;
    }
    out.push(r instanceof Ref ? r : await rewriteAnnot(doc, st, a));
  }
  return out;
}

/* Every /Name a page's content streams mention, or null when one of them
   cannot be read — and then nothing is pruned. */
async function contentNames(doc, contents) {
  let list = await doc.resolve(contents);
  if (list === undefined || list === null) return new Set();
  if (!Array.isArray(list)) list = [contents];
  const names = new Set();
  for (const c of list) {
    const s = await doc.resolve(c);
    if (!(s instanceof PDFStream)) return null;
    let filters = await doc.resolve(s.dict.Filter);
    filters = filters === undefined || filters === null ? [] : Array.isArray(filters) ? filters : [filters];
    for (const f of filters) {
      const fn = await doc.resolve(f);
      if (!(fn instanceof Name) || !/^(FlateDecode|Fl|ASCIIHexDecode|AHx|ASCII85Decode|A85)$/.test(fn.name)) return null;
    }
    let data;
    try { data = await doc.decodeStream(s); } catch (e) { return null; }
    const text = latin1(data);
    const re = /\/([^\s\/\[\]()<>{}%]+)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      names.add(m[1].replace(/#([0-9a-fA-F]{2})/g, (x, h) => String.fromCharCode(parseInt(h, 16))));
    }
  }
  return names;
}

const PRUNABLE = ['XObject', 'Font', 'ExtGState', 'Pattern', 'Shading', 'ColorSpace', 'Properties'];

/**
 * A page's resources without the entries its content never names.
 *
 * Many writers give every page one shared resource dictionary listing every
 * image and font in the file. Copied whole, it would carry a deleted page's
 * scanned image into a file that no longer has the page. Returns the source
 * value untouched when nothing is dropped, so sharing survives where it is
 * harmless, and when anything is in doubt: a content stream it cannot read,
 * or a form or Type 3 font with no resources of its own, which draws with the
 * page's.
 */
async function pruneResources(doc, res, contents) {
  const d = await doc.resolve(res);
  if (!isDict(d)) return res;
  const used = await contentNames(doc, contents);
  if (!used) return res;
  const out = Object.create(null);
  let dropped = 0;
  for (const k of Object.keys(d)) {
    const sub = await doc.resolve(d[k]);
    if (PRUNABLE.indexOf(k) < 0 || !isDict(sub)) { out[k] = d[k]; continue; }
    const keep = Object.create(null);
    for (const n of Object.keys(sub)) {
      if (!used.has(n)) { dropped++; continue; }
      const o = await doc.resolve(sub[n]);
      const od = o instanceof PDFStream ? o.dict : o;
      if (isDict(od) && od.Resources === undefined) {
        const st = await doc.resolve(od.Subtype);
        if (isName(st, 'Form') || isName(st, 'Type3')) return res;
      }
      keep[n] = sub[n];
    }
    out[k] = keep;
  }
  return dropped ? out : res;
}

/* ============================================================
   Bookmarks and form fields
   ============================================================ */

/** A source outline, keeping entries whose destination survives; children of a dropped entry move up. */
async function outlineEntries(doc, st, first, depth, seen) {
  const out = [];
  let ref = first;
  while (ref !== undefined && ref !== null && depth < 32 && seen.size < 100000) {
    if (ref instanceof Ref) { if (seen.has(ref.num)) break; seen.add(ref.num); }
    const it = await doc.resolve(ref);
    if (!isDict(it)) break;
    const children = await outlineEntries(doc, st, it.First, depth + 1, seen);
    const count = Number(await doc.resolve(it.Count)) || 0;
    const e = { st, title: await doc.resolve(it.Title), C: it.C, F: it.F, open: count > 0, children };
    let target = null, other = null;
    if (it.Dest !== undefined) target = await resolveDest(doc, st, it.Dest);
    else {
      const act = await doc.resolve(it.A);
      if (isDict(act)) {
        if (isName(await doc.resolve(act.S), 'GoTo')) target = await resolveDest(doc, st, act.D);
        else other = it.A;
      }
    }
    if (target) {
      if (target.ok && st.kept.has(target.page)) { e.dest = target.array; out.push(e); }
      else out.push.apply(out, children);
    } else if (other) { e.action = other; out.push(e); }
    else if (children.length) out.push(e);
    ref = it.Next;
  }
  return out;
}

const visibleCount = (list) => list.reduce((s, e) => s + 1 + (e.open ? visibleCount(e.children) : 0), 0);

async function writeOutline(writer, top) {
  const rootNum = writer.alloc();
  const write = async (list, parentNum) => {
    const nums = list.map(() => writer.alloc());
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const d = Object.create(null);
      d.Title = e.title && e.title.__string !== undefined ? e.title : pdfString(String(e.title || ''));
      d.Parent = new Ref(parentNum, 0);
      if (i > 0) d.Prev = new Ref(nums[i - 1], 0);
      if (i < list.length - 1) d.Next = new Ref(nums[i + 1], 0);
      if (e.children.length) {
        const kids = await write(e.children, nums[i]);
        d.First = kids[0];
        d.Last = kids[kids.length - 1];
        const n = visibleCount(e.children);
        d.Count = e.open ? n : -n;
      }
      if (e.destOut) d.Dest = e.destOut;
      else if (e.dest) d.Dest = await copyObject(e.st.doc, writer, e.dest, e.st.map, 0, e.st.ctx);
      else if (e.action) {
        const a = await copyObject(e.st.doc, writer, e.action, e.st.map, 0, e.st.ctx);
        if (a !== BARRED) d.A = a;
      }
      for (const k of ['C', 'F']) {
        if (e[k] === undefined) continue;
        const c = await copyObject(e.st.doc, writer, e[k], e.st.map, 0, e.st.ctx);
        if (c !== BARRED) d[k] = c;
      }
      writer.set(nums[i], d);
    }
    return nums.map((n) => new Ref(n, 0));
  };
  const kids = await write(top, rootNum);
  writer.set(rootNum, {
    Type: new Name('Outlines'), First: kids[0], Last: kids[kids.length - 1], Count: visibleCount(top)
  });
  return rootNum;
}

/**
 * A form holding the fields that still have a widget on a kept page. Fields
 * from different files that share a name are renamed (name_2, name_3…), or a
 * viewer would treat them as one field and type into both at once.
 */
async function buildForm(writer, states) {
  const fields = [], co = [];
  const taken = new Set();
  let da, q, dr = null, need = false;
  for (const [doc, st] of states) {
    const af = st.acroForm;
    if (!af || !st.aliveFields.size) continue;
    const list = await doc.resolve(af.Fields);
    if (!Array.isArray(list)) continue;
    const mine = new Set();
    for (const r of list) {
      if (!(r instanceof Ref) || !st.aliveFields.has(r.num)) continue;
      const c = await copyObject(doc, writer, r, st.map, 0, st.ctx);
      if (!(c instanceof Ref)) continue;
      const d = writer.objects[c.num];
      if (isDict(d) && d.T && d.T.__string !== undefined) {
        const t = decodePdfString(d.T.__string);
        let name = t, k = 2;
        while (taken.has(name)) name = t + '_' + k++;
        if (name !== t) d.T = pdfString(name);
        mine.add(name);
      }
      fields.push(c);
    }
    mine.forEach((n) => taken.add(n));
    if (da === undefined && af.DA !== undefined) da = await copyObject(doc, writer, af.DA, st.map, 0, st.ctx);
    if (q === undefined && af.Q !== undefined) q = await copyObject(doc, writer, af.Q, st.map, 0, st.ctx);
    if (af.DR !== undefined) {
      const c = await copyObject(doc, writer, af.DR, st.map, 0, st.ctx);
      const cd = c instanceof Ref ? writer.objects[c.num] : c;
      if (!dr) dr = isDict(cd) ? cd : null;
      else if (isDict(cd)) {
        /* fonts the later file's fields name, added where the first file has no font of that name */
        const into = dr.Font instanceof Ref ? writer.objects[dr.Font.num] : dr.Font;
        const from = cd.Font instanceof Ref ? writer.objects[cd.Font.num] : cd.Font;
        if (isDict(from)) {
          if (!isDict(into)) dr.Font = Object.assign(Object.create(null), from);
          else for (const k of Object.keys(from)) if (into[k] === undefined) into[k] = from[k];
        }
      }
    }
    if ((await doc.resolve(af.NeedAppearances)) === true) need = true;
    if (st.liveWidgets.some((w) => w.AP === undefined)) need = true;
    const order = await doc.resolve(af.CO);
    if (Array.isArray(order)) {
      for (const r of order) {
        if (!(r instanceof Ref) || !st.aliveFields.has(r.num)) continue;
        const c = await copyObject(doc, writer, r, st.map, 0, st.ctx);
        if (c instanceof Ref) co.push(c);
      }
    }
  }
  if (!fields.length) return null;
  const form = { Fields: fields };
  if (da !== undefined && da !== BARRED) form.DA = da;
  if (dr) form.DR = dr;
  if (q !== undefined && q !== BARRED) form.Q = q;
  if (co.length) form.CO = co;
  if (need) form.NeedAppearances = true;
  return form;
}

/**
 * Assemble a new PDF from a list of {doc, pageIndex, rotate, overlay}
 * instructions. This is the shared core of merge, split, extract, delete,
 * reorder, rotate and every tool that stamps a page.
 *
 * What the output carries, besides the pages:
 *   - a page's annotations, minus links to pages the output leaves out; a
 *     link or bookmark to a kept page points at its new page;
 *   - bookmarks whose destination survives (options.outline 'per-file', for
 *     a merge, puts each source's under an entry named after it — from
 *     options.names, a Map of doc -> name);
 *   - the form, with the fields that still have a widget on a kept page;
 *   - options.info, when given; with no options.info and one source file,
 *     that file's own Info dictionary;
 *   - the XMP metadata of options.xmp (a source doc), or by default of the
 *     only source file; false writes none.
 * Nothing that belongs only to a page left out is copied: see copyObject.
 *
 * overlay: { content, fontKey, fontName, needsGS, opacity, upright }. The
 * page's own content is wrapped in q … Q so whatever state it leaves cannot
 * shift the overlay; with upright, the overlay is drawn in the visible,
 * upright frame pageFrame() describes.
 */
async function assemble(items, options) {
  const opts = Object.assign({}, options || {});
  if (PREVIEW) {
    /* one page, as it will be written, and nothing a preview cannot show */
    const want = PREVIEW.pageIndex;
    const first = items.length ? items[0].doc : null;
    const hit = items.filter((it) => it.doc === (PREVIEW.doc || first) && it.pageIndex === want).slice(0, 1);
    items = hit.length ? hit : items.slice(0, 1);
    opts.outline = 'none'; opts.noForm = true; opts.xmp = null; opts.info = {};
  }
  const writer = new PDFWriter();
  const catalogNum = writer.alloc();
  const pagesNum = writer.alloc();
  const kids = [];

  /* Number every output page before anything is copied, so a link or a
     bookmark to a page the output keeps can point at its new object. */
  const plan = [];
  const states = new Map();       // doc -> what is kept of it, and how it maps
  for (const item of items) {
    const pages = await item.doc.getPages();
    const page = pages[item.pageIndex];
    if (!page) continue;
    let st = states.get(item.doc);
    if (!st) { st = newSource(item.doc); states.set(item.doc, st); }
    const num = writer.alloc();
    plan.push({ item, page, num, st });
    st.keptIdx.add(item.pageIndex);
    if (page.ref && !st.kept.has(page.ref.num)) st.kept.set(page.ref.num, num);
    if (st.first === null) st.first = num;
  }
  if (!plan.length) throw new Error('No pages were selected.');
  for (const [doc, st] of states) await prepareSource(doc, st);
  if (opts.replace) {
    /* compression swaps some objects (pictures) for smaller ones as they are copied */
    for (const [doc, st] of states) {
      const swap = opts.replace.get(doc);
      if (!swap || !st.ctx) continue;
      const inner = st.ctx.rewrite;
      st.ctx.rewrite = async (num, v) => swap.has(num) ? swap.get(num) : (inner ? inner(num, v) : v);
    }
  }

  let isolate = 0;                // one shared "q" stream for every stamped page
  const fmt = (v) => String(Number(Number(v).toFixed(4)));

  let written = 0;
  for (const { item, page, num, st } of plan) {
    const doc = item.doc;
    const map = st.map;
    const src = page.dict;
    const out = Object.create(null);
    out.Type = new Name('Page');

    for (const k of ['Resources', 'MediaBox', 'CropBox', 'BleedBox', 'TrimBox',
                     'ArtBox', 'Contents', 'Annots', 'Group', 'UserUnit']) {
      let v = src[k] !== undefined ? src[k] : page.inherited[k];
      if (v === undefined) continue;
      if (k === 'Annots') {
        v = await keptAnnots(doc, st, v);
        if (!v || !v.length) continue;
      }
      if (k === 'Resources') v = await pruneResources(doc, v, src.Contents);
      const c = await copyObject(doc, writer, v, map, 0, st.ctx);
      if (c !== BARRED && c !== undefined) out[k] = c;
    }
    if (out.MediaBox === undefined) out.MediaBox = [0, 0, 595.28, 841.89];
    if (out.Resources === undefined) out.Resources = Object.create(null);

    const baseRotate = Number(src.Rotate !== undefined ? src.Rotate : page.inherited.Rotate) || 0;
    const extra = Number(item.rotate) || 0;
    const rot = (((baseRotate + extra) % 360) + 360) % 360;
    if (rot) out.Rotate = rot;

    if (item.overlay) {
      let body = item.overlay.content;
      if (item.overlay.upright) {
        const fr = await pageFrame(doc, item.pageIndex, item.rotate);
        if (fr.matrix.join(' ') !== '1 0 0 1 0 0') {
          body = 'q\n' + fr.matrix.map(fmt).join(' ') + ' cm\n' + body + '\nQ\n';
        }
      }
      if (!isolate) isolate = writer.add(new PDFStream(Object.create(null), bytesOf('q\n')));
      const streamNum = writer.add(new PDFStream(
        Object.create(null), bytesOf('\nQ\n' + body)));
      let existing = out.Contents;
      if (existing instanceof Ref && Array.isArray(writer.objects[existing.num])) existing = writer.objects[existing.num];
      const arr = existing === undefined ? []
        : Array.isArray(existing) ? existing.slice() : [existing];
      out.Contents = [new Ref(isolate, 0)].concat(arr, [new Ref(streamNum, 0)]);

      /* /Resources and its sub-dictionaries are usually indirect objects in
         real documents, and copyObject preserves that. Writing a key onto a
         Ref would be lost at serialisation — the overlay would then name a
         font that the page does not declare, and the watermark or page number
         would silently not render. Resolve through the writer to the real
         dictionary before adding anything. */
      const deref = (v) => (v instanceof Ref && isDict(writer.objects[v.num]))
        ? writer.objects[v.num] : v;

      let res = deref(out.Resources);
      if (!isDict(res)) { res = Object.create(null); out.Resources = res; }

      let font = deref(res.Font);
      if (!isDict(font)) { font = Object.create(null); res.Font = font; }
      if (item.overlay.fontKey && !font[item.overlay.fontKey]) {
        /* one font object per face for the whole file, not one per page */
        const face = item.overlay.fontName || 'Helvetica';
        writer._base14 = writer._base14 || Object.create(null);
        if (!writer._base14[face]) {
          writer._base14[face] = new Ref(writer.add({
            Type: new Name('Font'), Subtype: new Name('Type1'),
            BaseFont: new Name(face), Encoding: new Name('WinAnsiEncoding')
          }), 0);
        }
        font[item.overlay.fontKey] = writer._base14[face];
      }
      if (item.overlay.images) {
        let xo = deref(res.XObject);
        if (!isDict(xo)) { xo = Object.create(null); res.XObject = xo; }
        for (const [key, prep] of Object.entries(item.overlay.images)) xo[key] = imageRef(writer, prep);
      }
      if (item.overlay.fonts) {
        for (const [key, ref] of Object.entries(item.overlay.fonts)) font[key] = typeof ref === 'function' ? ref(writer) : ref;
      }
      if (item.overlay.needsGS) {
        let eg = deref(res.ExtGState);
        if (!isDict(eg)) { eg = Object.create(null); res.ExtGState = eg; }
        if (!eg.MVRgs) {
          eg.MVRgs = new Ref(writer.add({
            Type: new Name('ExtGState'), ca: item.overlay.opacity, CA: item.overlay.opacity
          }), 0);
        }
      }
    }

    out.Parent = new Ref(pagesNum, 0);
    writer.set(num, out);
    kids.push(new Ref(num, 0));
    progress(++written, plan.length, 'page');
  }

  writer.set(pagesNum, { Type: new Name('Pages'), Kids: kids, Count: kids.length });
  const catalog = { Type: new Name('Catalog'), Pages: new Ref(pagesNum, 0) };

  /* bookmarks */
  const top = [];
  let anyOutline = false;
  for (const [doc, st] of (opts.outline === 'none' ? [] : states)) {
    const ol = await doc.resolve(st.root.Outlines);
    const entries = isDict(ol) ? await outlineEntries(doc, st, ol.First, 0, new Set()) : [];
    if (entries.length) anyOutline = true;
    if (opts.outline === 'per-file') {
      const name = String((opts.names && opts.names.get(doc)) || 'Document').replace(/\.pdf$/i, '');
      top.push({ st, title: name, destOut: [new Ref(st.first, 0), new Name('Fit')], open: true, children: entries });
    } else top.push.apply(top, entries);
  }
  if (anyOutline && top.length) catalog.Outlines = new Ref(await writeOutline(writer, top), 0);

  /* the form */
  const form = opts.noForm ? null : await buildForm(writer, states);
  if (form) catalog.AcroForm = new Ref(writer.add(form), 0);

  const only = states.size === 1 ? states.keys().next().value : null;

  /* XMP metadata */
  const xmpDoc = opts.xmp === undefined ? only : (opts.xmp || null);
  const xst = xmpDoc && states.get(xmpDoc);
  if (xst && xst.root.Metadata !== undefined) {
    const c = await copyObject(xmpDoc, writer, xst.root.Metadata, xst.map, 0, xst.ctx);
    if (c instanceof Ref) catalog.Metadata = c;
    else if (c instanceof PDFStream) catalog.Metadata = new Ref(writer.add(c), 0);
  }

  writer.set(catalogNum, catalog);

  let infoRef = null;
  if (opts.info === undefined) {
    const ist = only && states.get(only);
    if (ist && only.trailer && only.trailer.Info !== undefined) {
      const c = await copyObject(only, writer, only.trailer.Info, ist.map, 0, ist.ctx);
      if (c instanceof Ref) infoRef = c;
      else if (isDict(c) && Object.keys(c).length) infoRef = new Ref(writer.add(c), 0);
    }
  } else if (opts.info && Object.keys(opts.info).length) {
    const info = Object.create(null);
    for (const [k, v] of Object.entries(opts.info)) {
      if (v !== undefined && v !== null && String(v) !== '') info[k] = pdfString(String(v));
    }
    if (Object.keys(info).length) infoRef = new Ref(writer.add(info), 0);
  }

  if (opts.finish) await opts.finish(writer);
  if (opts.protect) return encryptAndBuild(writer, new Ref(catalogNum, 0), infoRef, opts.protect);
  if (opts.compact) return compactBuild(writer, new Ref(catalogNum, 0), infoRef);
  return writer.build(new Ref(catalogNum, 0), infoRef, opts.version || '1.7');
}

/* ============================================================
   Writing an encrypted file
   ============================================================ */

function randomBytes(n) {
  const out = new Uint8Array(n);
  const c = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
  if (!c) throw new Error('This browser has no secure random numbers, so it cannot encrypt.');
  c.getRandomValues(out);
  return out;
}
const hexOf = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/**
 * Encrypt every string and stream the writer holds with the standard
 * security handler, then write the file with /Encrypt and /ID in its
 * trailer. options: { userPassword, ownerPassword, permissions, method:
 * 'AES-256' | 'AES-128', encryptMetadata }.
 */
function encryptAndBuild(writer, rootRef, infoRef, options) {
  if (!CRYPT) throw new Error('This copy of the engine cannot encrypt.');
  const id0 = randomBytes(16);
  const { handler, encryptDict } = CRYPT.createHandler({
    userPassword: options.userPassword || '', ownerPassword: options.ownerPassword || '',
    permissions: options.permissions || {}, method: options.method === 'AES-128' ? 'AES-128' : 'AES-256',
    id0, encryptMetadata: options.encryptMetadata !== false, random: randomBytes
  });
  const walk = (v, num) => {
    if (!v || typeof v !== 'object') return;
    if (v.__string !== undefined) { v.__string = CRYPT.encryptBytes(handler, num, 0, v.__string, 'string', randomBytes); return; }
    if (Array.isArray(v)) { for (const x of v) walk(x, num); return; }
    if (v instanceof PDFStream) { walk(v.dict, num); return; }
    if (isDict(v)) for (const k of Object.keys(v)) walk(v[k], num);
  };
  for (let num = 1; num < writer.objects.length; num++) {
    const v = writer.objects[num];
    if (v === undefined || v === null) continue;
    if (v instanceof PDFStream) {
      const kind = isName(v.dict.Type, 'Metadata') ? 'metadata' : isName(v.dict.Type, 'EmbeddedFile') ? 'embeddedFile' : 'stream';
      walk(v.dict, num);
      writer.objects[num] = new PDFStream(v.dict, CRYPT.encryptBytes(handler, num, 0, v.raw, kind, randomBytes));
    } else walk(v, num);
  }
  const toCore = (v) => {
    if (v instanceof Uint8Array) return { __raw: '<' + hexOf(v) + '>' };
    if (Array.isArray(v)) return v.map(toCore);
    if (typeof v === 'string') return new Name(v);
    if (v && typeof v === 'object') { const o = Object.create(null); for (const k of Object.keys(v)) o[k] = toCore(v[k]); return o; }
    return v;
  };
  const encNum = writer.add(toCore(encryptDict));
  const idHex = { __raw: '<' + hexOf(handler.id0 || id0) + '>' };
  return writer.build(rootRef, infoRef, '1.7', { Encrypt: new Ref(encNum, 0), ID: [idHex, { __raw: '<' + hexOf(randomBytes(16)) + '>' }] });
}

/**
 * The whole document again, every page, its bookmarks, form and metadata,
 * encrypted with a password (protect), or written plain (unlock: the
 * document was opened with its password, so it is already decrypted).
 */
async function protectDocument(doc, options) {
  const n = await doc.pageCount();
  const items = Array.from({ length: n }, (_, i) => ({ doc, pageIndex: i }));
  return assemble(items, options && options.protect === false ? {} : { protect: options || {} });
}

/* ============================================================
   Compression
   ============================================================ */

/**
 * The writer's objects as a PDF 1.5 file: every object that is not a stream
 * packed into compressed object streams, and a compressed cross-reference
 * stream in place of the table. For a text-heavy file this is where most of
 * the structure's bytes go: a classic table costs 20 bytes an object and
 * every dictionary is stored as plain text.
 */
async function compactBuild(writer, rootRef, infoRef) {
  const objs = writer.objects;
  const size0 = objs.length;
  const packable = [];
  for (let i = 1; i < size0; i++) {
    const v = objs[i];
    if (v === undefined || v instanceof PDFStream) continue;
    packable.push(i);
  }
  const where = new Map();          /* object number -> [stream number, index] */
  const streams = [];
  for (let k = 0; k < packable.length; k += 200) {
    const group = packable.slice(k, k + 200);
    const bodies = group.map((i) => writer.serialiseValue(objs[i]));
    let head = '', off = 0;
    group.forEach((num, j) => { head += num + ' ' + off + ' '; off += bodies[j].length + 1; });
    const first = head.length;
    const data = bytesOf(head + bodies.join('\n') + '\n');
    const z = await deflate(data);
    const num = writer.add(null);
    streams.push({ num, dict: { Type: new Name('ObjStm'), N: group.length, First: first, Filter: new Name('FlateDecode') }, raw: z });
    group.forEach((i, j) => where.set(i, [num, j]));
  }
  for (const st of streams) objs[st.num] = new PDFStream(st.dict, st.raw);

  const chunks = [];
  let len = 0;
  const push = (x) => { const a = typeof x === 'string' ? bytesOf(x) : x; chunks.push(a); len += a.length; };
  push('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n');
  const offsets = new Map();
  for (let i = 1; i < objs.length; i++) {
    const v = objs[i];
    if (!(v instanceof PDFStream)) continue;
    offsets.set(i, len);
    const d = Object.assign(Object.create(null), v.dict);
    d.Length = v.raw.length;
    push(i + ' 0 obj\n' + writer.serialiseValue(d) + '\nstream\n');
    push(v.raw);
    push('\nendstream\nendobj\n');
  }
  const xrefNum = objs.length;
  const size = xrefNum + 1;
  const rows = new Uint8Array(size * 7);
  for (let i = 0; i < size; i++) {
    const r = i * 7;
    if (i === 0) { rows[r] = 0; rows[r + 5] = 0xff; rows[r + 6] = 0xff; continue; }
    if (offsets.has(i) || i === xrefNum) {
      const off = i === xrefNum ? len : offsets.get(i);
      rows[r] = 1; rows[r + 1] = (off >>> 24) & 255; rows[r + 2] = (off >>> 16) & 255; rows[r + 3] = (off >>> 8) & 255; rows[r + 4] = off & 255;
    } else if (where.has(i)) {
      const [sn, idx] = where.get(i);
      rows[r] = 2; rows[r + 1] = (sn >>> 24) & 255; rows[r + 2] = (sn >>> 16) & 255; rows[r + 3] = (sn >>> 8) & 255; rows[r + 4] = sn & 255;
      rows[r + 5] = (idx >>> 8) & 255; rows[r + 6] = idx & 255;
    }
  }
  const z = await deflate(rows);
  const xd = { Type: new Name('XRef'), Size: size, W: [1, 4, 2], Root: rootRef, Filter: new Name('FlateDecode'), Length: z.length };
  if (infoRef) xd.Info = infoRef;
  const xrefAt = len;
  push(xrefNum + ' 0 obj\n' + writer.serialiseValue(xd) + '\nstream\n');
  push(z);
  push('\nendstream\nendobj\nstartxref\n' + xrefAt + '\n%%EOF\n');
  const out = new Uint8Array(len);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

const mul = (a, b) => [
  a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]
];

async function streamBytes(doc, contents) {
  const list = await doc.resolve(contents);
  const parts = [];
  for (const c of Array.isArray(list) ? list : [list]) {
    const st = await doc.resolve(c);
    if (st instanceof PDFStream) { try { parts.push(await doc.decodeStream(st)); } catch (e) { /* unreadable: skip */ } }
  }
  const len = parts.reduce((n, x) => n + x.length + 1, 0);
  const out = new Uint8Array(len);
  let at = 0;
  for (const x of parts) { out.set(x, at); at += x.length; out[at++] = 10; }
  return out;
}

/**
 * How large each picture is drawn, in points, the largest use winning:
 * the page content is walked for q, Q, cm and Do (into forms too), which is
 * all the geometry a picture's size depends on.
 */
async function drawnSizes(doc, res, bytes, ctm, out, depth) {
  if (depth > 8 || !bytes || !bytes.length) return;
  const resources = await doc.resolve(res);
  const xobjects = isDict(resources) ? await doc.resolve(resources.XObject) : null;
  const lex = new Lexer(bytes, 0);
  const stack = [];
  let m = ctm, ops = [];
  for (let guard = 0; guard < 5e6; guard++) {
    let v;
    try { v = lex.parse(0); } catch (e) { lex.p++; ops = []; continue; }
    if (v === undefined) { if (lex.p >= bytes.length) break; ops = []; continue; }
    if (!v || v.__keyword === undefined) { ops.push(v); continue; }
    const op = v.__keyword;
    if (op === 'q') stack.push(m);
    else if (op === 'Q') m = stack.length ? stack.pop() : ctm;
    else if (op === 'cm' && ops.length >= 6) m = mul(ops.slice(-6).map(Number), m);
    else if (op === 'BI') {
      /* an inline image: its data is binary, skip to EI */
      const at = latin1(bytes, lex.p).search(/\sEI[\s]/);
      lex.p = at < 0 ? bytes.length : lex.p + at + 4;
    } else if (op === 'Do' && ops.length && xobjects && isDict(xobjects)) {
      const nm = ops[ops.length - 1];
      const ref = nm instanceof Name ? xobjects[nm.name] : null;
      const x = await doc.resolve(ref);
      if (x instanceof PDFStream) {
        if (isName(x.dict.Subtype, 'Image') && ref instanceof Ref) {
          const w = Math.hypot(m[0], m[1]), h = Math.hypot(m[2], m[3]);
          const was = out.get(ref.num);
          if (!was || w * h > was.w * was.h) out.set(ref.num, { w, h });
        } else if (isName(x.dict.Subtype, 'Form')) {
          const fm = await doc.resolve(x.dict.Matrix);
          const fmat = Array.isArray(fm) && fm.length === 6 ? fm.map(Number) : [1, 0, 0, 1, 0, 0];
          let fb = null;
          try { fb = await doc.decodeStream(x); } catch (e) { fb = null; }
          await drawnSizes(doc, x.dict.Resources !== undefined ? x.dict.Resources : res, fb, mul(fmat, m), out, depth + 1);
        }
      }
    }
    ops = [];
  }
}

/** A picture, decoded to RGBA for a canvas, or null when it cannot be. */
async function imageToBitmap(doc, stm) {
  if (typeof createImageBitmap !== 'function') return null;
  const d = stm.dict;
  let filters = await doc.resolve(d.Filter);
  if (filters && !Array.isArray(filters)) filters = [filters];
  const names = (filters || []).map((f) => f && f.name);
  if (names.length === 1 && (names[0] === 'DCTDecode' || names[0] === 'DCT')) {
    return createImageBitmap(new Blob([stm.raw], { type: 'image/jpeg' }));
  }
  if (names.some((n) => !/^(FlateDecode|Fl|ASCII85Decode|A85|ASCIIHexDecode|AHx)$/.test(n))) return null;
  const W = Number(await doc.resolve(d.Width)), H = Number(await doc.resolve(d.Height));
  const comps = (await colourComponents(doc, d.ColorSpace));
  if (!comps || comps === 4) return null;
  const data = await doc.decodeStream(stm);
  if (data.length < W * H * comps) return null;
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let i = 0, j = 0; i < W * H; i++, j += comps) {
    const k = i * 4;
    if (comps === 1) { rgba[k] = rgba[k + 1] = rgba[k + 2] = data[j]; }
    else { rgba[k] = data[j]; rgba[k + 1] = data[j + 1]; rgba[k + 2] = data[j + 2]; }
    rgba[k + 3] = 255;
  }
  return createImageBitmap(new ImageData(rgba, W, H));
}
async function colourComponents(doc, cs) {
  const v = await doc.resolve(cs);
  if (isName(v, 'DeviceRGB') || isName(v, 'CalRGB')) return 3;
  if (isName(v, 'DeviceGray') || isName(v, 'CalGray')) return 1;
  if (isName(v, 'DeviceCMYK')) return 4;
  if (Array.isArray(v) && isName(v[0], 'ICCBased')) {
    const st = await doc.resolve(v[1]);
    const n = st instanceof PDFStream ? Number(await doc.resolve(st.dict.N)) : 0;
    return n === 1 || n === 3 || n === 4 ? n : null;
  }
  if (Array.isArray(v) && (isName(v[0], 'CalRGB'))) return 3;
  if (Array.isArray(v) && (isName(v[0], 'CalGray'))) return 1;
  return null;
}

/**
 * Make a PDF smaller: pictures drawn at more than the chosen resolution are
 * scaled down and pictures re-encoded as JPEG at the chosen quality (only
 * where that is actually smaller), uncompressed streams are deflated,
 * identical streams and fonts are stored once, objects nothing uses are left
 * out (assemble copies only what the pages reach), and the metadata is
 * removed on request. Options: { dpi, quality (0.1–1), images: true,
 * metadata: 'keep' | 'strip', greyscale: false }.
 * Returns { bytes, report }.
 */
async function compressDocument(doc, options) {
  const o = Object.assign({ dpi: 150, quality: 0.75, images: true, metadata: 'strip' }, options || {});
  const pages = await doc.getPages();
  const report = { images: 0, recoded: 0, downsampled: 0, kept: {}, imageBytesBefore: 0, imageBytesAfter: 0, deflated: 0, merged: 0 };
  const keep = (why) => { report.kept[why] = (report.kept[why] || 0) + 1; };

  /* 1. how big each picture is drawn */
  const sizes = new Map();
  for (let i = 0; i < pages.length; i++) {
    progress(i, pages.length, 'Measuring the pictures on page ' + (i + 1));
    const pg = pages[i];
    const res = pg.dict.Resources !== undefined ? pg.dict.Resources : pg.inherited.Resources;
    let bytes = null;
    try { bytes = await streamBytes(doc, pg.dict.Contents); } catch (e) { bytes = null; }
    try { await drawnSizes(doc, res, bytes, [1, 0, 0, 1, 0, 0], sizes, 0); } catch (e) { /* a page we cannot read keeps its pictures */ }
  }

  /* 2. pictures, re-encoded where it pays */
  const replace = new Map();
  const masks = new Set();
  for (const v of doc.objects.values()) {
    const d = v instanceof PDFStream ? v.dict : null;
    if (d && d.SMask instanceof Ref) masks.add(d.SMask.num);
    if (d && d.Mask instanceof Ref) masks.add(d.Mask.num);
  }
  const canEncode = typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function';
  const imgs = [...doc.objects].filter(([n, v]) => v instanceof PDFStream && isName(v.dict.Subtype, 'Image') && !masks.has(n));
  let done = 0;
  for (const [num, stm] of imgs) {
    progress(done++, imgs.length, 'Pictures');
    report.images++;
    report.imageBytesBefore += stm.raw.length;
    const d = stm.dict;
    const fallback = () => { report.imageBytesAfter += stm.raw.length; };
    if (!o.images) { keep('pictures left as they are'); fallback(); continue; }
    if (!canEncode) { keep('this browser cannot re-encode pictures here'); fallback(); continue; }
    if ((await doc.resolve(d.ImageMask)) === true) { keep('a stencil mask'); fallback(); continue; }
    if (Number(await doc.resolve(d.BitsPerComponent)) !== 8) { keep('not 8 bits per sample'); fallback(); continue; }
    if (d.Decode !== undefined || Array.isArray(await doc.resolve(d.Mask))) { keep('a colour key or decode array'); fallback(); continue; }
    const comps = await colourComponents(doc, d.ColorSpace);
    if (comps !== 1 && comps !== 3) { keep(comps === 4 ? 'CMYK' : 'an unusual colour space'); fallback(); continue; }
    const W = Number(await doc.resolve(d.Width)), H = Number(await doc.resolve(d.Height));
    if (!(W > 0 && H > 0)) { fallback(); continue; }
    const drawn = sizes.get(num);
    let scale = 1;
    if (drawn && drawn.w > 0 && drawn.h > 0) {
      const tw = drawn.w / 72 * o.dpi, th = drawn.h / 72 * o.dpi;
      scale = Math.min(1, Math.max(tw / W, th / H));
      if (scale > 0.87) scale = 1;            /* not worth a generation of loss */
    }
    if (scale === 1 && stm.raw.length < 24 * 1024) { keep('already small'); fallback(); continue; }
    let bmp = null;
    try { bmp = await imageToBitmap(doc, stm); } catch (e) { bmp = null; }
    if (!bmp) { keep('a format the browser cannot decode (JPEG 2000, JBIG2, CCITT …)'); fallback(); continue; }
    const w = Math.max(1, Math.round(W * scale)), h = Math.max(1, Math.round(H * scale));
    const cv = new OffscreenCanvas(w, h);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close && bmp.close();
    let blob;
    try { blob = await cv.convertToBlob({ type: 'image/jpeg', quality: Math.max(0.1, Math.min(1, o.quality)) }); }
    catch (e) { keep('could not be encoded'); fallback(); continue; }
    const jpeg = new Uint8Array(await blob.arrayBuffer());
    if (blob.type !== 'image/jpeg' || jpeg.length >= stm.raw.length * 0.95) { keep('re-encoding would not make it smaller'); fallback(); continue; }
    const nd = Object.create(null);
    for (const k of Object.keys(d)) if (!/^(Filter|DecodeParms|DP|Length|Width|Height|BitsPerComponent|ColorSpace|Intent)$/.test(k)) nd[k] = d[k];
    nd.Width = w; nd.Height = h; nd.BitsPerComponent = 8;
    nd.ColorSpace = new Name('DeviceRGB');
    nd.Filter = new Name('DCTDecode');
    replace.set(num, new PDFStream(nd, jpeg));
    report.recoded++;
    if (scale < 1) report.downsampled++;
    report.imageBytesAfter += jpeg.length;
  }

  /* 3. write it again, deflating and folding duplicates on the way out */
  const finish = async (writer) => {
    const fnv = (b) => { let h = 2166136261; for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
    const all = writer.objects;
    let k = 0;
    for (let i = 1; i < all.length; i++) {
      const v = all[i];
      if (!(v instanceof PDFStream) || v.dict.Filter !== undefined || v.raw.length < 64) continue;
      if (isName(v.dict.Type, 'Metadata') || isName(v.dict.Type, 'XRef')) continue;
      if (++k % 50 === 0) progress(i, all.length, 'Compressing streams');
      const z = await deflate(v.raw);
      if (z.length < v.raw.length) {
        const dd = Object.assign(Object.create(null), v.dict);
        dd.Filter = new Name('FlateDecode');
        all[i] = new PDFStream(dd, z);
        report.deflated++;
      }
    }
    /* identical streams, and identical fonts, descriptors and graphics states */
    const FOLD = new Set(['Font', 'FontDescriptor', 'ExtGState']);
    for (let pass = 0; pass < 3; pass++) {
      const seen = new Map(), alias = new Map();
      for (let i = 1; i < all.length; i++) {
        const v = all[i];
        let key = null;
        if (v instanceof PDFStream) key = 's' + writer.serialiseValue(v.dict) + '|' + v.raw.length + '|' + fnv(v.raw);
        else if (isDict(v) && v.Type instanceof Name && FOLD.has(v.Type.name)) key = 'd' + writer.serialiseValue(v);
        if (!key) continue;
        const first = seen.get(key);
        if (first === undefined) { seen.set(key, i); continue; }
        if (v instanceof PDFStream) {
          const a = all[first].raw, b = v.raw;
          let same = a.length === b.length;
          for (let j = 0; same && j < a.length; j++) if (a[j] !== b[j]) same = false;
          if (!same) continue;
        }
        alias.set(i, first);
      }
      if (!alias.size) break;
      const swap = (x) => {
        if (x instanceof Ref) return alias.has(x.num) ? new Ref(alias.get(x.num), 0) : x;
        if (Array.isArray(x)) { for (let j = 0; j < x.length; j++) x[j] = swap(x[j]); return x; }
        if (x instanceof PDFStream) { swap(x.dict); return x; }
        if (isDict(x)) { for (const key of Object.keys(x)) x[key] = swap(x[key]); return x; }
        return x;
      };
      for (let i = 1; i < all.length; i++) if (all[i] !== undefined && !alias.has(i)) swap(all[i]);
      for (const i of alias.keys()) { all[i] = undefined; report.merged++; }
    }
  };

  const items = pages.map((pg, i) => ({ doc, pageIndex: i }));
  const strip = o.metadata === 'strip';
  const bytes = await assemble(items, Object.assign({ replace: new Map([[doc, replace]]), finish, compact: o.compact !== false },
    strip ? { info: {}, xmp: false } : {}));
  report.before = doc.bytes.length;
  report.after = bytes.length;
  return { bytes, report };
}

/** Parse "1-3, 5, 8-" style page selections into zero-based indices. */
function parsePageRange(spec, total) {
  // Strip all whitespace before splitting: people type "3 - 4" and "1, 5",
  // and splitting on whitespace would turn the dash into its own token.
  const s = String(spec || '').replace(/\s+/g, '');
  if (!s || s.toLowerCase() === 'all') return Array.from({ length: total }, (_, i) => i);
  const out = [];
  for (const part of s.split(/[,;]+/).filter(Boolean)) {
    let m = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (m) {
      let a = parseInt(m[1], 10), b = parseInt(m[2], 10);
      if (a > b) [a, b] = [b, a];
      for (let i = a; i <= b; i++) if (i >= 1 && i <= total) out.push(i - 1);
      continue;
    }
    m = /^(\d+)\s*-$/.exec(part);
    if (m) {
      for (let i = parseInt(m[1], 10); i <= total; i++) if (i >= 1) out.push(i - 1);
      continue;
    }
    m = /^-\s*(\d+)$/.exec(part);
    if (m) {
      for (let i = 1; i <= Math.min(total, parseInt(m[1], 10)); i++) out.push(i - 1);
      continue;
    }
    if (/^\d+$/.test(part)) {
      const i = parseInt(part, 10);
      if (i >= 1 && i <= total) out.push(i - 1);
      continue;
    }
    throw new Error(`"${part}" is not a valid page selection. Use forms like 1-3, 5, 8-`);
  }
  if (!out.length) throw new Error('That selection matches no pages in this document.');
  return out;
}

/* ============================================================
   Base-14 text: widths, wrapping, page building
   ============================================================ */

/* AFM widths for the WinAnsi range, indexed 32..126 then a flat value for the
   rest. Enough for accurate wrapping and centring of Latin text. */
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HELVB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const TIMES = [250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541];

const FONTS = {
  Helvetica:        { widths: HELV,  name: 'Helvetica' },
  'Helvetica-Bold': { widths: HELVB, name: 'Helvetica-Bold' },
  'Times-Roman':    { widths: TIMES, name: 'Times-Roman' },
  Courier:          { widths: null,  name: 'Courier' }      // monospace, 600
};

function textWidth(text, fontKey, size) {
  const f = FONTS[fontKey] || FONTS.Helvetica;
  let units = 0;
  for (const ch of String(text)) {
    const c = ch.codePointAt(0);
    if (!f.widths) { units += 600; continue; }
    if (c >= 32 && c <= 126) { units += f.widths[c - 32]; continue; }
    // en/em dashes and curly quotes are common enough to be worth measuring
    if (c === 0x2014) { units += 1000; continue; }
    if (c === 0x2013) { units += 556; continue; }
    if (c === 0x2018 || c === 0x2019) { units += 222; continue; }
    if (c === 0x201c || c === 0x201d) { units += 333; continue; }
    if (c === 0x2026) { units += 1000; continue; }
    units += 556;
  }
  return (units / 1000) * size;
}

function wrapText(text, fontKey, size, maxWidth) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    if (!para.trim()) { lines.push(''); continue; }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? line + ' ' + word : word;
      if (textWidth(test, fontKey, size) > maxWidth && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
  }
  return lines;
}

/* WinAnsiEncoding is not Latin-1: positions 0x80–0x9F carry typographic
   characters that Latin-1 leaves undefined. Without this map, every smart
   quote, en-dash and ellipsis in pasted text renders as "?" — which is most
   text copied out of a word processor. */
const WINANSI = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f
};

/* Characters with no WinAnsi slot but an obvious ASCII stand-in. Better a
   readable approximation than a row of question marks. */
const FALLBACK = {
  0x2212: '-', 0x2010: '-', 0x2011: '-', 0x2015: '-',
  0x00a0: ' ', 0x2009: ' ', 0x200a: ' ', 0x2002: ' ', 0x2003: ' ',
  0x2032: "'", 0x2033: '"', 0x00ad: ''
};

/** Escape a string for a PDF content stream, mapping to WinAnsi. */
function contentEscape(s) {
  let out = '';
  for (const ch of String(s)) {
    let c = ch.codePointAt(0);
    if (WINANSI[c] !== undefined) c = WINANSI[c];
    else if (FALLBACK[c] !== undefined) {
      const sub = FALLBACK[c];
      if (sub) out += sub;
      continue;
    }
    if (c === 0x28 || c === 0x29 || c === 0x5c) out += '\\' + String.fromCharCode(c);
    else if (c < 32) out += ' ';
    else if (c < 127) out += String.fromCharCode(c);
    else if (c < 256) out += '\\' + c.toString(8).padStart(3, '0');
    else out += '?';                                   // genuinely unrepresentable
  }
  return out;
}

const PAGE_SIZES = {
  a3:     [841.89, 1190.55],
  a4:     [595.28, 841.89],
  a5:     [419.53, 595.28],
  letter: [612, 792],
  legal:  [612, 1008],
  tabloid:[792, 1224]
};

/**
 * Build a PDF from page descriptors, each a list of drawing ops.
 * ops: {text,x,y,size,font,colour} | {rect,...} | {line,...}
 */
function createPDF(pages, opts) {
  const o = opts || {};
  const writer = new PDFWriter();
  const catalogNum = writer.alloc();
  const pagesNum = writer.alloc();

  const fontRefs = Object.create(null);
  const fontKeyFor = (key) => {
    const k = FONTS[key] ? key : 'Helvetica';
    if (!fontRefs[k]) {
      fontRefs[k] = new Ref(writer.add({
        Type: new Name('Font'), Subtype: new Name('Type1'),
        BaseFont: new Name(FONTS[k].name), Encoding: new Name('WinAnsiEncoding')
      }), 0);
    }
    return k;
  };

  const kids = [];
  for (const page of pages) {
    const [W, H] = page.size || PAGE_SIZES[o.pageSize || 'a4'];
    const used = new Set();
    const usedImages = Object.create(null);
    let cs = '';

    for (const op of page.ops || []) {
      if (op.rect) {
        const [x, y, w, h] = op.rect;
        if (op.fill) cs += `${rgb(op.fill)} rg\n${n(x)} ${n(y)} ${n(w)} ${n(h)} re f\n`;
        if (op.stroke) cs += `${rgb(op.stroke)} RG\n${n(op.lineWidth || 1)} w\n${n(x)} ${n(y)} ${n(w)} ${n(h)} re S\n`;
      } else if (op.line) {
        const [x1, y1, x2, y2] = op.line;
        cs += `${rgb(op.stroke || '#000000')} RG\n${n(op.lineWidth || 1)} w\n${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S\n`;
      } else if (op.image) {
        const key = 'Im' + imageRef(writer, op.image).num;
        usedImages[key] = imageRef(writer, op.image);
        const w = op.w, h = op.h !== undefined ? op.h : op.w * op.image.height / op.image.width;
        cs += `q\n${n(w)} 0 0 ${n(h)} ${n(op.x)} ${n(op.y)} cm\n/${key} Do\nQ\n`;
      } else if (op.raw !== undefined) {
        cs += op.raw + '\n';
      } else if (op.text !== undefined) {
        const fk = fontKeyFor(op.font || 'Helvetica');
        used.add(fk);
        const size = op.size || 11;
        let x = op.x || 0;
        if (op.align === 'center') x = op.x - textWidth(op.text, fk, size) / 2;
        else if (op.align === 'right') x = op.x - textWidth(op.text, fk, size);
        cs += `BT\n/${fk.replace(/[^A-Za-z0-9]/g, '')} ${n(size)} Tf\n` +
              `${rgb(op.colour || '#000000')} rg\n` +
              `${n(x)} ${n(op.y)} Td\n(${contentEscape(op.text)}) Tj\nET\n`;
      }
    }

    const res = Object.create(null);
    const fdict = Object.create(null);
    used.forEach(k => { fdict[k.replace(/[^A-Za-z0-9]/g, '')] = fontRefs[k]; });
    if (Object.keys(fdict).length) res.Font = fdict;
    if (Object.keys(usedImages).length) res.XObject = usedImages;
    if (page.gs) {
      const gs = Object.create(null);
      for (const [k, v] of Object.entries(page.gs)) gs[k] = { Type: new Name('ExtGState'), ca: v, CA: v };
      res.ExtGState = gs;
    }

    const contentNum = writer.add(new PDFStream(Object.create(null), bytesOf(cs)));
    const pageNum = writer.alloc();
    writer.set(pageNum, {
      Type: new Name('Page'), Parent: new Ref(pagesNum, 0),
      MediaBox: [0, 0, W, H], Resources: res, Contents: new Ref(contentNum, 0)
    });
    kids.push(new Ref(pageNum, 0));
  }

  writer.set(pagesNum, { Type: new Name('Pages'), Kids: kids, Count: kids.length });
  writer.set(catalogNum, { Type: new Name('Catalog'), Pages: new Ref(pagesNum, 0) });

  let infoRef = null;
  if (o.info) {
    const info = Object.create(null);
    for (const [k, v] of Object.entries(o.info)) {
      if (v) info[k] = pdfString(String(v));
    }
    if (Object.keys(info).length) infoRef = new Ref(writer.add(info), 0);
  }
  return writer.build(new Ref(catalogNum, 0), infoRef, '1.4');
}

const n = (v) => Number.isInteger(v) ? String(v) : String(Number(Number(v).toFixed(4)));
function rgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex));
  if (!m) return '0 0 0';
  return [1, 2, 3].map(i => n(parseInt(m[i], 16) / 255)).join(' ');
}



window.MVRPdfCore={PDFDocument:PDFDocument,assemble:assemble,pageFrame:pageFrame,parsePageRange:parsePageRange,createPDF:createPDF,textWidth:textWidth,wrapText:wrapText,contentEscape:contentEscape,PAGE_SIZES:PAGE_SIZES,FONTS:FONTS,latin1:latin1,isDict:isDict,isName:isName,setProgress:setProgress,setPreview:setPreview,PDFWriter:PDFWriter,PDFStream:PDFStream,Name:Name,Ref:Ref,pdfString:pdfString,decodePdfString:decodePdfString,bytesOf:bytesOf,isRef:isRef,inflate:inflate,deflate:deflate,copyObject:copyObject,prepareImage:prepareImage,compressDocument:compressDocument,protectDocument:protectDocument};
})();