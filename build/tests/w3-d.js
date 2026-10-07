#!/usr/bin/env node
/**
 * Wave 3, Drop 2, sub-agent D: the hash generator, JWT decoder, UUID
 * generator, password generator and cron parser. Every expected value comes
 * from an independent reference (Node's crypto and zlib, Node's webcrypto
 * signing, RFC and specification test vectors, Intl, hand-worked figures),
 * never from the engine's own output.
 *
 *   node build/tests/w3-d.js [--root DIR] [--port 8933] [--out DIR] [--node-only]
 *
 * --root is the site to test (default: the one this file sits in); it is
 * served on --port (8933-8935 are this test's) for the browser part.
 * Exit code 2 when a case fails, 1 when the run itself breaks.
 *
 *  1  Hash: all 13 algorithms against Node's crypto (and zlib.crc32, and the
 *     Keccak team's vectors) for 0-300 random bytes fed in random slices,
 *     HMAC for each with keys shorter and longer than the block, 5 MB in one
 *     go; hex and Base64 input; errors with line and column; the expected
 *     value compared in hex, Base64, sha256sum and BSD forms; the key never
 *     in the share list; the default output of the story example unchanged
 *  2  JWT: decoding, claims explained, nbf and the live status; verifying
 *     HS*, RS*, PS*, ES*, EdDSA tokens signed by Node, with PEM, PKCS#1, an
 *     X.509 certificate, a JWK and a JWKS picked by kid; tampered tokens,
 *     wrong keys, alg none, algorithm confusion and private keys refused;
 *     the encoder's HS* tokens checked with Node's HMAC
 *  3-5 UUID, passwords and cron: written in build/tests/dev-fixes.js, sections
 *     30 (UUID, ULID, nanoid), 31 (passwords) and 32 (cron); not repeated here.
 *     (This header once listed them as planned here.)
 *  6  Browser: each page mounts with no error; a 20 MB file hashed in the
 *     page matches Node, Cancel stops it; JWT verify and sign in the page;
 *     the generators and the cron builder; no secret or password in
 *     localStorage or the share state; screenshots at 390 and 1400 px
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const zlib = require('zlib');
const crypto = require('crypto');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const PORT = Number(arg('--port', 8933));
const OUT = path.resolve(arg('--out', path.join(os.tmpdir(), '1234tools-w3-d')));
const NODE_ONLY = argv.includes('--node-only');
const BASE_URL = 'http://127.0.0.1:' + PORT;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0, skipped = 0;
function check(ok, what, detail) {
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + what + (!ok && detail !== undefined ? '   (' + String(detail).slice(0, 500) + ')' : ''));
}
function skip(what) { skipped++; console.log('SKIP  ' + what); }
const section = (t) => console.log('\n--- ' + t);

function context(extra) {
  const sb = Object.assign({
    console, Intl, TextEncoder, TextDecoder, URL, URLSearchParams, atob, btoa,
    crypto: crypto.webcrypto, navigator: { language: 'en-GB' }, setTimeout, clearTimeout
  }, extra || {});
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  return vm.createContext(sb);
}
function load(rel, extra) {
  const ctx = context(extra);
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
  return ctx;
}
function defaults(list) { const o = {}; (list || []).forEach((x) => { o[x.key] = x.default; }); return o; }
function transform(spec, input, opts) { return spec.transform(String(input), Object.assign(defaults(spec.options), opts || {})) || {}; }
function generate(spec, fields) { return spec.generate(Object.assign(defaults(spec.fields), fields || {})) || {}; }
const stat = (res, label) => { const r = (res.stats || []).find((x) => x[0] === label); return r ? r[1] : undefined; };
/** xorshift32, for replayable "random" sources */
function xorshift(seed) {
  let x = seed >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };
}
function stubCrypto(next) {
  return { getRandomValues(arr) { for (let i = 0; i < arr.length; i++) arr[i] = arr.BYTES_PER_ELEMENT === 1 ? next() & 255 : next(); return arr; } };
}

/* ======================================================================
   1  Hash generator
   ====================================================================== */

const NODE_ALG = {
  md5: 'md5', sha1: 'sha1', sha224: 'sha224', sha256: 'sha256', sha384: 'sha384', sha512: 'sha512', sha512_256: 'sha512-256',
  sha3_224: 'sha3-224', sha3_256: 'sha3-256', sha3_384: 'sha3-384', sha3_512: 'sha3-512'
};

function testHash() {
  section('1  Hash generator: 13 algorithms, HMAC, hex and Base64 input, compare');
  const spec = load('engine/dev2-hash-generator.js').DEV_TOOLS['hash-generator'];
  const HX = spec._hx;
  const hex = (u8) => Buffer.from(u8).toString('hex');
  check(HX.ALGOS.length === 13, 'thirteen algorithms are offered', HX.ALGOS.map((a) => a.name).join(', '));
  // random lengths across block boundaries, random slices
  let n = 0;
  const bad = [];
  const rnd = xorshift(7);
  for (let len = 0; len <= 300; len++) {
    const buf = crypto.randomBytes(len);
    for (const [id, nid] of Object.entries(NODE_ALG)) {
      const h = HX.create(id);
      for (let i = 0; i < len;) { const k = 1 + rnd() % 150; h.update(new Uint8Array(buf.subarray(i, i + k))); i += k; }
      n++;
      if (hex(h.digest()) !== crypto.createHash(nid).update(buf).digest('hex')) bad.push(id + ' ' + len);
      const key = crypto.randomBytes([0, 1, 20, 64, 65, 128, 129, 200][len % 8]);
      if (key.length) {
        n++;
        const got = hex(HX.create(id, new Uint8Array(key)).update(new Uint8Array(buf)).digest());
        if (got !== crypto.createHmac(nid, key).update(buf).digest('hex')) bad.push('HMAC-' + id + ' ' + len + '/' + key.length);
      }
    }
    n++;
    if (hex(HX.create('crc32').update(new Uint8Array(buf)).digest()) !== zlib.crc32(buf).toString(16).padStart(8, '0')) bad.push('crc32 ' + len);
  }
  check(!bad.length, n + ' digests of 0–300 random bytes in random slices match Node crypto and zlib.crc32 (12 algorithms and 11 HMACs)', bad.slice(0, 5).join(', '));
  const big = crypto.randomBytes(5 * 1024 * 1024 + 77);
  const bigBad = Object.entries(NODE_ALG).filter(([id, nid]) => hex(HX.create(id).update(new Uint8Array(big)).digest()) !== crypto.createHash(nid).update(big).digest('hex'));
  check(!bigBad.length, '5 MB in one update matches Node for all 11 hash algorithms', bigBad.map((x) => x[0]).join(', '));
  // Keccak-256: the Keccak team's vectors (Node has no Keccak-256)
  const kk = (s) => hex(HX.create('keccak256').update(Buffer.from(s)).digest());
  check(kk('') === 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470' && kk('abc') === '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45',
    'Keccak-256 of "" and "abc" are the published vectors (c5d24601…, 4e03657a…)');
  // the story example: default output unchanged
  const fox = transform(spec, 'The quick brown fox jumps over the lazy dog');
  check(fox.output === 'SHA-256  d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592\nSHA-1    2fd4e1c67a2d28fced849ee1bb76e7391b93eb12\nMD5      9e107d9d372bb6826bd81d3542a419d6\nCRC32    414fa339',
    'the default output of the published example is unchanged (four lines)', fox.output);
  // every algorithm in the output
  const every = transform(spec, 'abc', { algo: 'every' });
  const lines = every.output.split('\n');
  const want = { 'SHA-256': crypto.createHash('sha256').update('abc').digest('hex'), 'SHA3-512': crypto.createHash('sha3-512').update('abc').digest('hex'), 'SHA-512/256': crypto.createHash('sha512-256').update('abc').digest('hex') };
  check(lines.length === 13 && Object.entries(want).every(([k, v]) => lines.some((l) => l.startsWith(k + ' ') && l.endsWith(v))), 'Show: all 13 lines, SHA-256, SHA-512/256 and SHA3-512 as Node gives them', lines.length);
  // output formats
  const up = transform(spec, 'abc', { algo: 'sha256', case: 'upper' }).output, b64 = transform(spec, 'abc', { algo: 'sha512', case: 'base64' }).output;
  check(up.endsWith(want['SHA-256'].toUpperCase()) && b64.endsWith(crypto.createHash('sha512').update('abc').digest('base64')), 'UPPERCASE hex and Base64 output', up + ' | ' + b64);
  // hex and Base64 input
  const bytes = crypto.randomBytes(41);
  const fromHex = transform(spec, '0x' + bytes.toString('hex').replace(/(..)/g, '$1 ').toUpperCase(), { input: 'hex', algo: 'sha256' });
  const fromB64 = transform(spec, bytes.toString('base64').replace(/(.{20})/g, '$1\n'), { input: 'base64', algo: 'sha256' });
  const fromUrl = transform(spec, bytes.toString('base64url'), { input: 'base64', algo: 'sha256' });
  const wantB = crypto.createHash('sha256').update(bytes).digest('hex');
  check([fromHex, fromB64, fromUrl].every((r) => r.output && r.output.endsWith(wantB)), 'hex (spaced, 0x, upper case), wrapped Base64 and base64url input hash the same 41 bytes as Node', [fromHex, fromB64, fromUrl].map((r) => r.error || r.output.slice(-8)).join(' '));
  check(stat(fromHex, 'Input length') === 'hex read as 41 bytes', 'Input length says how the text was read', stat(fromHex, 'Input length'));
  const badHex = transform(spec, 'abcd\n12 zz', { input: 'hex' });
  check(/"z" is not a hex digit/.test(badHex.error || '') && badHex.errorAt && badHex.errorAt.line === 2 && badHex.errorAt.col === 4, 'a bad hex digit is named with its line and column (line 2, column 4)', JSON.stringify(badHex));
  check(/odd number of hex digits/.test(transform(spec, 'abc', { input: 'hex' }).error || ''), 'an odd number of hex digits is refused');
  check(/not a Base64 character/.test(transform(spec, 'ab*d', { input: 'base64' }).error || ''), 'a stray character in Base64 is refused');
  // HMAC through the options, key as text, hex and Base64
  const hm = (o) => transform(spec, 'payload', Object.assign({ algo: 'sha256' }, o)).output;
  const wantH = crypto.createHmac('sha256', 'whsec_test').update('payload').digest('hex');
  check(hm({ key: 'whsec_test' }) === 'HMAC-SHA-256  ' + wantH && hm({ key: Buffer.from('whsec_test').toString('hex'), keyenc: 'hex' }).endsWith(wantH) && hm({ key: Buffer.from('whsec_test').toString('base64'), keyenc: 'base64' }).endsWith(wantH),
    'HMAC-SHA-256 with the key as text, hex or Base64 matches Node createHmac');
  const hmAll = transform(spec, 'payload', { key: 'k' });
  check(!/CRC32/.test(hmAll.output) && /no HMAC form/.test(hmAll.warn), 'with a key, CRC32 is left out and the page says why');
  // compare
  const cmp = (e, o) => transform(spec, 'The quick brown fox jumps over the lazy dog', Object.assign({ expect: e }, o)).compare;
  const sha = 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592';
  const sha3 = crypto.createHash('sha3-256').update('The quick brown fox jumps over the lazy dog').digest();
  const tests = [
    [sha.toUpperCase(), true, 'SHA-256'],
    [sha + '  ubuntu.iso', true, 'SHA-256'],
    ['SHA256 (ubuntu.iso) = ' + sha, true, 'SHA-256'],
    ['sha256:' + sha, true, 'SHA-256'],
    [Buffer.from(sha, 'hex').toString('base64'), true, 'SHA-256'],
    [sha3.toString('hex'), true, 'SHA3-256'],
    ['9e107d9d372bb6826bd81d3542a419d6', true, 'MD5'],
    [sha.replace(/^d/, 'e'), false, 'SHA3-256']
  ];
  const cbad = tests.filter(([e, ok, name]) => { const c = cmp(e); return !c || c.ok !== ok || c.text.indexOf(name) < 0; });
  check(!cbad.length, 'Expected hash: upper-case hex, a sha256sum line, a BSD line, a sha256: prefix and Base64 match; SHA3-256 is named though not shown; one wrong digit is a mismatch that names the 256-bit algorithms', cbad.map((t) => t[0].slice(0, 20) + ' → ' + JSON.stringify(cmp(t[0]))).join(' | '));
  check(stat(transform(spec, 'x', { expect: crypto.createHash('md5').update('x').digest('hex') }), 'Compare') === 'Match: MD5', 'the Compare row names the match');
  // the key is a secret
  check(Array.isArray(spec.share) && spec.share.indexOf('key') < 0 && spec.share.indexOf('algo') >= 0, 'the HMAC key is not in the share list', JSON.stringify(spec.share));
  // UTF-8 and characters
  check(stat(transform(spec, 'é😀'), 'Input length') === '2 characters, 6 bytes', 'Input length: é😀 is 2 characters, 6 UTF-8 bytes', stat(transform(spec, 'é😀'), 'Input length'));
  check(!transform(spec, 'abc', { algo: 'sha256' }).warn && /broken/.test(transform(spec, 'abc').warn), 'the MD5/SHA-1 warning shows only when they are shown');
}

/* ======================================================================
   2  JWT decoder
   ====================================================================== */

const CERT_PEM = [
  '-----BEGIN CERTIFICATE-----',
  'MIIBiDCCAS2gAwIBAgIUMRjFBuYqqMsKARftHttcCUS7gtEwCgYIKoZIzj0EAwIw',
  'GTEXMBUGA1UEAwwOMTIzNHRvb2xzIHRlc3QwHhcNMjYxMDA2MTgyNTI5WhcNMzYx',
  'MDAzMTgyNTI5WjAZMRcwFQYDVQQDDA4xMjM0dG9vbHMgdGVzdDBZMBMGByqGSM49',
  'AgEGCCqGSM49AwEHA0IABHLqAFld0ZliLZeOIEiIlyb5zf1wPRYo3U/ezOJqx/4q',
  'URLBWJumrRNMCwwdDXIhaqR8HhlnzGL2swy8+UFlE2ujUzBRMB0GA1UdDgQWBBSQ',
  '8t73TtE4aPFtstIGdyr9Ye3rSDAfBgNVHSMEGDAWgBSQ8t73TtE4aPFtstIGdyr9',
  'Ye3rSDAPBgNVHRMBAf8EBTADAQH/MAoGCCqGSM49BAMCA0kAMEYCIQCCiZFIGhgw',
  'NZeD7N9v5Oke6DlsyAzpJ+rkCcuBkeDELAIhAKAcpeCxt1MRXFIGOgl1mR2LGOS8',
  '0KydQSnp0RffXH4K',
  '-----END CERTIFICATE-----'].join('\n');
/* the certificate's private key: a throwaway made for this test with openssl req -x509 */
const CERT_KEY = [
  '-----BEGIN PRIVATE KEY-----',
  'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgVI8GhbmJ1M6tYxi7',
  'FiE1ELuorZEfMfjCVtpfNkYA9bqhRANCAARy6gBZXdGZYi2XjiBIiJcm+c39cD0W',
  'KN1P3sziasf+KlESwVibpq0TTAsMHQ1yIWqkfB4ZZ8xi9rMMvPlBZRNr',
  '-----END PRIVATE KEY-----'].join('\n');

const b64u = (b) => Buffer.from(b).toString('base64url');
/** a JWS made by Node's crypto, the independent signer */
function nodeSign(alg, payload, key, header) {
  const h = Object.assign({ alg, typ: 'JWT' }, header || {});
  const input = b64u(JSON.stringify(h)) + '.' + b64u(JSON.stringify(payload));
  const hash = { 256: 'sha256', 384: 'sha384', 512: 'sha512' }[alg.slice(2)];
  let sig;
  if (/^HS/.test(alg)) sig = crypto.createHmac(hash, key).update(input).digest();
  else if (/^RS/.test(alg)) sig = crypto.sign(hash, Buffer.from(input), key);
  else if (/^PS/.test(alg)) sig = crypto.sign(hash, Buffer.from(input), { key, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: Number(alg.slice(2)) / 8 });
  else if (/^ES/.test(alg)) sig = crypto.sign(hash, Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
  else if (alg === 'EdDSA') sig = crypto.sign(null, Buffer.from(input), key);
  return input + '.' + b64u(sig);
}

async function testJwt() {
  section('2  JWT: decode, explain, verify (HS, RS, PS, ES, EdDSA; PEM, PKCS#1, certificate, JWK, JWKS), sign');
  const spec = load('engine/dev-jwt-decoder.js').DEV_TOOLS['jwt-decoder'];
  // the published example decodes as before
  const ex = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEwNDIiLCJuYW1lIjoiVGVzdCBVc2VyIiwicm9sZSI6ImVkaXRvciIsImlhdCI6MTc5MDAwMDAwMCwiZXhwIjoxNzkwMDAzNjAwfQ.bm90LWEtcmVhbC1zaWduYXR1cmUtanVzdC1hLWRlbW8';
  const r = transform(spec, ex);
  check(r.output === '// Header\n{\n  "alg": "HS256",\n  "typ": "JWT"\n}\n\n// Payload\n{\n  "sub": "user_1042",\n  "name": "Test User",\n  "role": "editor",\n  "iat": 1790000000,\n  "exp": 1790003600\n}', 'the published example decodes to the same text', r.output);
  check(stat(r, 'Issued') === new Date(1790000000 * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC', 'Issued is iat in UTC', stat(r, 'Issued'));
  const names = r.claims.map((c) => c.part[0] + ':' + c.key).join(',');
  check(names === 'h:alg,h:typ,p:sub,p:name,p:role,p:iat,p:exp', 'every header and payload member gets a row in the claims table', names);
  check(/^Expiry:/.test(r.claims.find((c) => c.key === 'exp').meaning) && /private claim/.test(r.claims.find((c) => c.key === 'role').meaning), 'registered claims are explained; unknown ones are called private claims');
  const ms = transform(spec, b64u('{"alg":"HS256"}') + '.' + b64u('{"exp":1767229200000}') + '.x');
  check(/milliseconds/.test(ms.claims.find((c) => c.key === 'exp').meaning), 'an exp in milliseconds is flagged in its explanation');
  // Bearer prefix, JWE, bad parts
  const bearer = transform(spec, 'Bearer ' + ex);
  check(bearer.output === r.output && /Bearer/.test(bearer.warn), 'a "Bearer " prefix is dropped, and the page says so');
  check(/encrypted token \(JWE/.test(transform(spec, 'a.b.c.d.e').error || '') && /three dot-separated parts/.test(transform(spec, 'a.b').error || ''), 'five parts are named as JWE; two parts are refused');
  // nbf and the live status (pure function of the times)
  const now = Math.floor(Date.now() / 1000);
  const early = transform(spec, b64u('{"alg":"HS256"}') + '.' + b64u(JSON.stringify({ nbf: now + 1800, exp: now + 3600 })) + '.x');
  check(/^NOT YET VALID: starts in 30 min$/.test(stat(early, 'Status') || '') && !!stat(early, 'Not before'), 'a future nbf makes the Status "NOT YET VALID: starts in 30 min"', stat(early, 'Status'));
  const S = spec._status;
  check(S(now + 3725, null, now).text === 'Expires in 1 h 2 min 5 s.' && S(now - 90061, null, now).text === 'Expired 1 d 1 h 1 min ago.' && S(now + 10, now + 5, now).text === 'Not valid yet: it starts in 5 s.' && S(null, null, now).state === 'none',
    'the countdown reads 1 h 2 min 5 s, 1 d 1 h 1 min ago, starts in 5 s, no expiry', [S(now + 3725, null, now).text, S(now - 90061, null, now).text].join(' | '));

  // verification against tokens signed by Node
  const payload = { sub: 'svc-reports', iat: now, exp: now + 3600 };
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const ec = { 256: crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }), 384: crypto.generateKeyPairSync('ec', { namedCurve: 'P-384' }), 512: crypto.generateKeyPairSync('ec', { namedCurve: 'P-521' }) };
  const ed = crypto.generateKeyPairSync('ed25519');
  const pem = (k) => k.export({ type: 'spki', format: 'pem' });
  const rows = [];
  for (const alg of ['HS256', 'HS384', 'HS512']) rows.push([alg, nodeSign(alg, payload, 'a-very-long-test-secret-of-sixty-four-bytes-for-hs512-signing!!'), 'a-very-long-test-secret-of-sixty-four-bytes-for-hs512-signing!!', 'wrong-secret']);
  for (const alg of ['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512']) rows.push([alg, nodeSign(alg, payload, rsa.privateKey), pem(rsa.publicKey), pem(crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey)]);
  for (const n of [256, 384, 512]) rows.push(['ES' + n, nodeSign('ES' + n, payload, ec[n].privateKey), pem(ec[n].publicKey), pem(crypto.generateKeyPairSync('ec', { namedCurve: { 256: 'P-256', 384: 'P-384', 512: 'P-521' }[n] }).publicKey)]);
  let edOk = true;
  try { await crypto.webcrypto.subtle.importKey('spki', ed.publicKey.export({ type: 'spki', format: 'der' }), { name: 'Ed25519' }, false, ['verify']); } catch (e) { edOk = false; }
  if (edOk) rows.push(['EdDSA', nodeSign('EdDSA', payload, ed.privateKey), pem(ed.publicKey), pem(crypto.generateKeyPairSync('ed25519').publicKey)]);
  else skip('Node webcrypto has no Ed25519: EdDSA is not checked in Node');
  for (const [alg, tok, good, wrong] of rows) {
    const ok = await spec.verify(tok, good, {});
    const bad = await spec.verify(tok, wrong, {});
    const parts = tok.split('.');
    const tampered = parts[0] + '.' + b64u(JSON.stringify(Object.assign({}, payload, { sub: 'admin' }))) + '.' + parts[2];
    const tam = await spec.verify(tampered, good, {});
    check(ok.ok && !bad.ok && !tam.ok && /Invalid signature/.test(bad.text), alg + ': a token signed by Node verifies; the wrong ' + (/^HS/.test(alg) ? 'secret' : 'key') + ' and a changed payload do not', [ok.text, bad.text, tam.text].join(' | '));
  }
  // secret encodings
  const raw = crypto.randomBytes(32);
  const hsTok = nodeSign('HS256', payload, raw);
  check((await spec.verify(hsTok, raw.toString('base64'), { secretEnc: 'base64' })).ok && (await spec.verify(hsTok, raw.toString('base64url'), { secretEnc: 'base64' })).ok && (await spec.verify(hsTok, raw.toString('hex'), { secretEnc: 'hex' })).ok,
    'an HS256 secret given as Base64, base64url or hex verifies');
  const shortS = await spec.verify(nodeSign('HS256', payload, 'short'), 'short', {});
  check(shortS.ok && /RFC 7518 forbids/.test(shortS.text), 'a secret shorter than the hash verifies, with a warning that RFC 7518 forbids it', shortS.text);
  // key formats: PKCS#1, certificate, JWK, JWKS by kid
  const rsTok = nodeSign('RS256', payload, rsa.privateKey, { kid: 'k-2026-01' });
  const pkcs1 = rsa.publicKey.export({ type: 'pkcs1', format: 'pem' });
  check((await spec.verify(rsTok, pkcs1, {})).ok, 'an RSA PUBLIC KEY (PKCS#1) PEM verifies');
  const certTok = nodeSign('ES256', payload, CERT_KEY);
  const cv = await spec.verify(certTok, CERT_PEM, {});
  check(cv.ok && /certificate/.test(cv.text), 'an X.509 certificate verifies through its public key', cv.text);
  const jwk = Object.assign(rsa.publicKey.export({ format: 'jwk' }), { kid: 'k-2026-01', alg: 'RS256', use: 'sig' });
  const other = Object.assign(crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ format: 'jwk' }), { kid: 'k-2025-12', alg: 'RS256' });
  const ecJwk = Object.assign(ec[256].publicKey.export({ format: 'jwk' }), { kid: 'ec-1' });
  const jwks = JSON.stringify({ keys: [other, ecJwk, jwk] });
  const jv = await spec.verify(rsTok, jwks, {});
  check(jv.ok && jv.kid === 'k-2026-01', 'a JWKS of three keys: the key whose kid matches the header is used', jv.text);
  check((await spec.verify(rsTok, JSON.stringify(jwk), {})).ok, 'a single JWK verifies');
  const noKid = await spec.verify(nodeSign('RS256', payload, rsa.privateKey, { kid: 'gone' }), jwks, {});
  check(!noKid.ok && /No key in this JWKS has the kid "gone"/.test(noKid.text), 'a kid missing from the JWKS is named', noKid.text);
  // refusals
  const none = await spec.verify(b64u('{"alg":"none"}') + '.' + b64u('{"sub":"admin"}') + '.', 'anything', {});
  check(!none.ok && /unsigned/.test(none.text), 'alg none is never verified', none.text);
  const confusion = nodeSign('HS256', payload, pem(rsa.publicKey));
  const cf = await spec.verify(confusion, pem(rsa.publicKey), {});
  check(!cf.ok && /algorithm confusion/.test(cf.text), 'HS256 signed with the public key as the secret (algorithm confusion) is refused, though the HMAC would match', cf.text);
  const priv = await spec.verify(rsTok, rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }), {});
  check(!priv.ok && /private key/.test(priv.text), 'a pasted private key is refused with a warning', priv.text);
  const derSig = (() => { const p = nodeSign('ES256', payload, ec[256].privateKey).split('.'); const s = crypto.sign('sha256', Buffer.from(p[0] + '.' + p[1]), ec[256].privateKey); return p[0] + '.' + p[1] + '.' + b64u(s); })();
  const dv = await spec.verify(derSig, pem(ec[256].publicKey), {});
  check(!dv.ok && /DER-encoded/.test(dv.text), 'an ES256 signature in DER form (not r||s) is refused with the reason', dv.text);
  // the encoder, checked with Node's HMAC
  for (const alg of ['HS256', 'HS384', 'HS512']) {
    const t = await spec.sign(alg, { sub: 'x', n: 'Zoë' }, 'enc-secret', 'text');
    const p = t.split('.');
    const want = crypto.createHmac('sha' + alg.slice(2), 'enc-secret').update(p[0] + '.' + p[1]).digest('base64url');
    const hdr = JSON.parse(Buffer.from(p[0], 'base64url').toString());
    check(p[2] === want && hdr.alg === alg && hdr.typ === 'JWT' && JSON.parse(Buffer.from(p[1], 'base64url').toString()).n === 'Zoë', 'the encoder\'s ' + alg + ' token carries the signature Node computes', t.slice(0, 40));
  }
  check(Array.isArray(spec.share) && spec.share.length === 0 && spec.autosave === false && !(spec.options || []).length, 'the JWT decoder has no options to share or store, and keeps no draft');
}

/* ======================================================================
   the browser part (filled in below)
   ====================================================================== */

function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  return null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NODE_TESTS = [testHash, testJwt];
const BROWSER_TESTS = [];

async function browserPart() {
  const puppeteer = loadPuppeteer();
  if (!puppeteer) { skip('puppeteer-core not found: the browser cases are skipped'); return; }
  if (!fs.existsSync(CHROME)) { skip('Chrome not found at ' + CHROME + ': the browser cases are skipped'); return; }
  const { serve } = require('./serve.js');
  const server = await serve(ROOT, PORT);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const offsite = [];
  try {
    for (const t of BROWSER_TESTS) await t(browser, offsite);
    check(offsite.length === 0, 'browser: not one request to anything but 127.0.0.1', offsite.slice(0, 5).join(' '));
  } finally {
    await browser.close();
    if (server) server.close();
  }
}

async function newPage(browser, offsite, width) {
  const page = await browser.newPage();
  await page.setViewport({ width: width || 1400, height: 1000 });
  await page.setBypassServiceWorker(true);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = r.url();
    if (!/^(http:\/\/127\.0\.0\.1:|data:|blob:)/.test(u)) { offsite.push(u); r.abort(); return; }
    r.continue();
  });
  return { page, errors };
}

(async function main() {
  try {
    for (const t of NODE_TESTS) await t();
    if (!NODE_ONLY) await browserPart();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed' + (skipped ? ', ' + skipped + ' skipped' : ''));
  process.exit(fail ? 2 : 0);
})();
