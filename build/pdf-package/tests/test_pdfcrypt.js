#!/usr/bin/env node
/**
 * Engine suite — pdfcrypt.js (the PDF Standard Security Handler).
 *
 * Every assertion compares against something independent of the module:
 *   1. the primitives against node:crypto, and RC4 against published vectors
 *      (OpenSSL 3 no longer ships RC4);
 *   2. opening against files PyMuPDF (MuPDF) encrypted, plus a revision 5
 *      dictionary built here with node:crypto;
 *   3. writing against two independent readers, pdf.js and MuPDF, which must
 *      open what pdfcrypt.js encrypted, reject wrong passwords and report the
 *      permissions that were set;
 *   4. a 20 MB stream, checked against node:crypto and timed.
 *
 * Fixtures:  python build/pdf-package/tests/make-crypt-fixtures.py
 * Run:       node build/pdf-package/tests/test_pdfcrypt.js
 * Set MVR_PDF_FIXTURES to read the fixtures from elsewhere.
 *
 * Getting /Encrypt and /ID into a written file: PDFWriter.build writes its own
 * trailer, but the trailer comes after the xref table and startxref points at
 * the xref, so replacing the trailer moves no offset. spliceTrailer() cuts the
 * built file at its last "trailer" keyword and writes a new trailer carrying
 * /Encrypt (an indirect reference to the plain dictionary, added to the writer
 * after the encryption pass so its own strings stay in the clear) and /ID
 * (two hex strings, the first being the id0 the key was derived from).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

/* ---------- locating things ---------- */

function findFile(rels, what) {
  for (const rel of rels) {
    const p = path.join(__dirname, rel);
    if (fs.existsSync(p)) return p;
  }
  console.error(`Cannot find ${what}. Looked for:\n  ` +
    rels.map(r => path.join(__dirname, r)).join('\n  '));
  process.exit(2);
}

const core = require(findFile(['../engine/pdfcore.js', './pdfcore.js', '../pdfcore.js'], 'pdfcore.js'));
const { PDFCrypt } = require(findFile(['../engine/pdfcrypt.js', './pdfcrypt.js', '../pdfcrypt.js'], 'pdfcrypt.js'));
const { PDFDocument, PDFWriter, Name, Ref, PDFStream, pdfString, decodePdfString, latin1, bytesOf, isDict } = core;

const REPO = path.resolve(__dirname, '../../..');
const PDFJS_DIR = path.join(REPO, 'engine/vendor/pdfjs');
const FIXTURES = process.env.MVR_PDF_FIXTURES
  ? path.resolve(process.env.MVR_PDF_FIXTURES) : path.join(__dirname, 'fixtures');
const OUTPUT = path.join(__dirname, 'output');
const PYTHON = process.env.PYTHON || 'python';

/* ---------- assertions ---------- */

let pass = 0, failCount = 0, group = '';
const failures = [];

function G(name) { group = name; console.log(`\n${name}`); }

function check(cond, what, detail) {
  if (cond) { pass++; console.log(`  ok    ${what}`); }
  else {
    failCount++; failures.push(`${group} → ${what}${detail ? '  (' + detail + ')' : ''}`);
    console.log(`  FAIL  ${what}${detail ? '  → ' + detail : ''}`);
  }
}
const hex = (b) => Buffer.from(b.buffer ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) : b).toString('hex');
const same = (a, b) => a.length === b.length && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
const eqHex = (a, b, what) => check(hex(a) === hex(b), what, hex(a) === hex(b) ? '' : `got ${hex(a).slice(0, 64)}…, expected ${hex(b).slice(0, 64)}…`);
const u8 = (b) => new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
const fromHex = (h) => u8(Buffer.from(h.replace(/\s+/g, ''), 'hex'));
const mbps = (bytes, ms) => (bytes / 1048576 / (ms / 1000)).toFixed(0);

/* Deterministic random(n) for the tests; the real caller passes crypto.getRandomValues. */
function seededRandom(seed) {
  let ctr = 0;
  return (n) => {
    const out = new Uint8Array(n);
    for (let p = 0; p < n; p += 32) {
      const h = crypto.createHash('sha256').update(`${seed}:${ctr++}`).digest();
      out.set(h.subarray(0, Math.min(32, n - p)), p);
    }
    return out;
  };
}

/* ---------- node:crypto references ---------- */

function nodeAes(dir, key, iv, data, padding) {
  const alg = `aes-${key.length * 8}-${iv ? 'cbc' : 'ecb'}`;
  const c = dir === 'enc' ? crypto.createCipheriv(alg, key, iv) : crypto.createDecipheriv(alg, key, iv);
  c.setAutoPadding(padding);
  return u8(Buffer.concat([c.update(data), c.final()]));
}
const nodeHash = (alg, ...parts) => {
  const h = crypto.createHash(alg);
  for (const p of parts) h.update(p);
  return u8(h.digest());
};

/* A second, separate RC4 for building dictionaries in the test (the module's
   own is checked against published vectors before this is relied on). */
function testRc4(key, data) {
  const S = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) { j = (j + S[i] + key[i % key.length]) % 256; [S[i], S[j]] = [S[j], S[i]]; }
  const out = new Uint8Array(data.length);
  let i = 0; j = 0;
  for (let n = 0; n < data.length; n++) {
    i = (i + 1) % 256; j = (j + S[i]) % 256; [S[i], S[j]] = [S[j], S[i]];
    out[n] = data[n] ^ S[(S[i] + S[j]) % 256];
  }
  return out;
}

/* ---------- pdfcore <-> plain-object conversion ---------- */

/* pdfcore value -> the plain shape openHandler takes, resolving references. */
function toPlain(v, doc, depth) {
  if ((depth || 0) > 20) return undefined;
  if (v instanceof Ref) return toPlain(doc.objects.get(v.num), doc, (depth || 0) + 1);
  if (v instanceof Name) return v.name;
  if (v && v.__string) return v.__string;
  if (Array.isArray(v)) return v.map(x => toPlain(x, doc, (depth || 0) + 1));
  if (isDict(v)) {
    const o = {};
    for (const k of Object.keys(v)) o[k] = toPlain(v[k], doc, (depth || 0) + 1);
    return o;
  }
  return v;
}

/* plain Encrypt dictionary -> pdfcore values for the writer. Every string
   value in an Encrypt dictionary is a name. */
function toCore(v) {
  if (v instanceof Uint8Array) return { __raw: '<' + hex(v) + '>' };
  if (typeof v === 'string') return new Name(v);
  if (Array.isArray(v)) return v.map(toCore);
  if (v && typeof v === 'object') {
    const d = Object.create(null);
    for (const k of Object.keys(v)) d[k] = toCore(v[k]);
    return d;
  }
  return v;
}

/* Walk a value, transforming every string and (top-level) stream. */
function transformValue(v, fn, num, gen) {
  if (v instanceof PDFStream) {
    return new PDFStream(transformValue(v.dict, fn, num, gen), fn(num, gen, v.raw, 'stream'));
  }
  if (v && v.__string !== undefined) return { __string: fn(num, gen, v.__string, 'string') };
  if (Array.isArray(v)) return v.map(x => transformValue(x, fn, num, gen));
  if (isDict(v)) {
    const d = Object.create(null);
    for (const k of Object.keys(v)) d[k] = transformValue(v[k], fn, num, gen);
    return d;
  }
  return v;
}

/* Replace the trailer PDFWriter.build wrote (see the header comment). */
function spliceTrailer(bytes, writer, trailer) {
  const s = latin1(bytes);
  const t = s.lastIndexOf('trailer');
  const m = /startxref\s+(\d+)/.exec(s.slice(t));
  if (t < 0 || !m) throw new Error('built file has no trailer');
  const tail = 'trailer\n' + writer.serialiseValue(trailer) + `\nstartxref\n${m[1]}\n%%EOF\n`;
  const out = new Uint8Array(t + tail.length);
  out.set(bytes.subarray(0, t));
  out.set(bytesOf(tail), t);
  return out;
}

/**
 * A one-page PDF with `text` in Helvetica and an Info Title, every string and
 * stream encrypted through `encryptFn(num, gen, bytes, kind)`, the Encrypt
 * dictionary added in the clear, and /ID set.
 */
function buildEncryptedPdf({ text, title, encryptDict, encryptFn, id0, id1, compress }) {
  const w = new PDFWriter();
  const catalog = w.alloc(), pages = w.alloc();
  const font = w.add({ Type: new Name('Font'), Subtype: new Name('Type1'),
    BaseFont: new Name('Helvetica'), Encoding: new Name('WinAnsiEncoding') });
  let raw = bytesOf(`BT\n/F1 12 Tf\n72 720 Td\n(${text}) Tj\nET\n`);
  const sd = Object.create(null);
  if (compress) { raw = u8(zlib.deflateSync(raw)); sd.Filter = new Name('FlateDecode'); }
  const content = w.add(new PDFStream(sd, raw));
  const page = w.add({ Type: new Name('Page'), Parent: new Ref(pages, 0), MediaBox: [0, 0, 595, 842],
    Resources: { Font: { F1: new Ref(font, 0) } }, Contents: new Ref(content, 0) });
  w.set(pages, { Type: new Name('Pages'), Kids: [new Ref(page, 0)], Count: 1 });
  w.set(catalog, { Type: new Name('Catalog'), Pages: new Ref(pages, 0) });
  const info = w.add({ Title: pdfString(title), Producer: pdfString('test_pdfcrypt.js') });

  for (let i = 1; i < w.objects.length; i++) w.objects[i] = transformValue(w.objects[i], encryptFn, i, 0);
  const encNum = w.add(toCore(encryptDict));           // after the pass: stays in the clear

  const built = w.build(new Ref(catalog, 0), new Ref(info, 0), '1.7');
  return spliceTrailer(built, w, {
    Size: w.objects.length, Root: new Ref(catalog, 0), Info: new Ref(info, 0),
    Encrypt: new Ref(encNum, 0),
    ID: [{ __raw: '<' + hex(id0) + '>' }, { __raw: '<' + hex(id1 || id0) + '>' }]
  });
}

/* Parse an encrypted file with pdfcore as it is stored: { decrypt: false }
   keeps every object encrypted and flags the document. */
async function loadEncrypted(bytes) {
  let doc = null, err = null;
  try { doc = await PDFDocument.load(bytes, { decrypt: false }); } catch (e) { err = e; doc = new PDFDocument(bytes); }
  const encrypt = toPlain(doc.trailer && doc.trailer.Encrypt, doc);
  const ids = doc.trailer && toPlain(doc.trailer.ID, doc);
  const id0 = Array.isArray(ids) && ids[0] instanceof Uint8Array ? ids[0] : new Uint8Array(0);
  return { doc, err, encrypt, id0 };
}

async function firstPageContent(doc) {
  const pages = await doc.getPages();
  const c = pages[0].dict.Contents;
  const refs = Array.isArray(c) ? c : [c];
  return refs.map(r => ({ num: r.num, gen: r.gen, stream: doc.objects.get(r.num) }));
}

/* Decrypt and decode one content stream. Flate goes through zlib, which is
   independent of both pdfcore and pdfcrypt. */
function decodeContent(stream, plain) {
  const f = stream.dict.Filter;
  const names = (Array.isArray(f) ? f : f ? [f] : []).map(x => x.name);
  let data = plain;
  for (const n of names) {
    if (n === 'FlateDecode') data = u8(zlib.inflateSync(data));
    else throw new Error('unexpected filter ' + n);
  }
  return data;
}

function containsText(content, text) {
  const s = latin1(content);
  if (s.includes(text)) return true;
  const h = Buffer.from(text, 'latin1').toString('hex');
  const compact = s.replace(/\s+/g, '').toLowerCase();
  if (compact.includes(h)) return true;
  const wide = [...Buffer.from(text, 'latin1')].map(b => '00' + b.toString(16).padStart(2, '0')).join('');
  return compact.includes(wide);
}

/* ---------- the two independent readers ---------- */

let pdfjs = null;
async function loadPdfjs() {
  if (pdfjs) return pdfjs;
  pdfjs = await import(pathToFileURL(path.join(PDFJS_DIR, 'pdf.min.mjs')).href);
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(PDFJS_DIR, 'pdf.worker.min.mjs')).href;
  return pdfjs;
}

/* -> { ok, text, title, permissions } or { ok:false, name, code, message } */
async function readWithPdfjs(bytes, password) {
  const pj = await loadPdfjs();
  const opts = { data: bytes.slice(), isEvalSupported: false, useSystemFonts: false, verbosity: 0 };
  if (password !== undefined) opts.password = password;
  let doc;
  try {
    doc = await pj.getDocument(opts).promise;
    const page = await doc.getPage(1);
    const tc = await page.getTextContent();
    const md = await doc.getMetadata();
    const permissions = await doc.getPermissions();
    return { ok: true, text: tc.items.map(i => i.str).join(''), title: md.info && md.info.Title, permissions };
  } catch (e) {
    return { ok: false, name: e && e.name, code: e && e.code, message: e && e.message };
  } finally {
    if (doc) await doc.destroy();
  }
}

const PYMUPDF_CHECK = `
import json, sys
import pymupdf
path, upw, opw = sys.argv[1], sys.argv[2], sys.argv[3]
r = {}
d = pymupdf.open(path)
r['needsPass'] = bool(d.needs_pass)
r['isEncrypted'] = bool(d.is_encrypted)
r['authWrong'] = d.authenticate('definitely-not-it') if d.needs_pass else None
d.close()
d = pymupdf.open(path)
r['authUser'] = d.authenticate(upw) if d.needs_pass else None
r['permissions'] = d.permissions
r['text'] = d[0].get_text().strip()
r['title'] = d.metadata.get('title')
r['encryption'] = d.metadata.get('encryption')
d.close()
d = pymupdf.open(path)
r['authOwner'] = d.authenticate(opw) if opw else None
r['ownerPermissions'] = d.permissions
d.close()
print(json.dumps(r))
`;

function readWithMupdf(file, upw, opw) {
  const r = spawnSync(PYTHON, ['-', file, upw || '', opw || ''], { input: PYMUPDF_CHECK, encoding: 'utf8' });
  if (r.status !== 0) return { error: (r.stderr || r.error && r.error.message || 'python failed').trim() };
  try { return JSON.parse(r.stdout.trim().split('\n').pop()); }
  catch (e) { return { error: 'unreadable output: ' + r.stdout }; }
}

/* PDF permission bits, as both pdf.js and MuPDF number them. */
const BITS = { print: 4, modify: 8, copy: 16, annotate: 32, fillForms: 256, accessibility: 512, assemble: 1024, printHighRes: 2048 };

/* =====================================================================
   The suite
   ===================================================================== */

(async () => {
  const C = PDFCrypt;

  /* ---------------------------------------------------------------
     1. Primitives
     --------------------------------------------------------------- */
  G('Primitives: hashes against node:crypto');

  const big = u8(crypto.randomBytes(5 * 1048576));
  const LENS = [0, 1, 3, 15, 16, 17, 55, 56, 63, 64, 65, 111, 112, 127, 128, 129, 1000];
  for (const alg of ['md5', 'sha256', 'sha384', 'sha512']) {
    let bad = [];
    for (const n of LENS) {
      const b = u8(crypto.randomBytes(n));
      if (hex(C[alg](b)) !== hex(nodeHash(alg, b))) bad.push(n);
    }
    check(!bad.length, `${alg} matches node:crypto at lengths ${LENS.join(', ')}`, bad.length ? 'differs at ' + bad.join(', ') : '');
    eqHex(C[alg](big), nodeHash(alg, big), `${alg} matches node:crypto on a 5 MB buffer`);
  }
  check(C.md5(new Uint8Array(0)) instanceof Uint8Array && C.md5(new Uint8Array(0)).length === 16, 'md5 returns a 16-byte Uint8Array');
  eqHex(C.md5(bytesOf('abc')), fromHex('900150983cd24fb0d6963f7d28e17f72'), 'md5("abc") is the RFC 1321 value');
  eqHex(C.sha256(bytesOf('abc')), fromHex('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'), 'sha256("abc") is the FIPS 180 value');

  G('Primitives: RC4 against published vectors');
  eqHex(C.rc4(bytesOf('Key'), bytesOf('Plaintext')), fromHex('bbf316e8d940af0ad3'), 'RC4 Key / Plaintext');
  eqHex(C.rc4(bytesOf('Wiki'), bytesOf('pedia')), fromHex('1021bf0420'), 'RC4 Wiki / pedia');
  eqHex(C.rc4(bytesOf('Secret'), bytesOf('Attack at dawn')), fromHex('45a01f645fc35b383552544b9bf5'), 'RC4 Secret / Attack at dawn');
  const ks40 = C.rc4(fromHex('0102030405'), new Uint8Array(32));
  eqHex(ks40, fromHex('b2396305f03dc027ccc3524a0a1118a8 6982944f18fc82d589c403a47a0d0919'), 'RC4 40-bit key 0102030405 keystream (RFC 6229, offsets 0 and 16)');
  const r4 = u8(crypto.randomBytes(100000)), rk = u8(crypto.randomBytes(16));
  check(same(C.rc4(rk, C.rc4(rk, r4)), r4), 'RC4 twice is the identity on 100 kB');
  check(same(C.rc4(rk, r4), testRc4(rk, r4)), 'RC4 agrees with the suite\'s separate implementation on 100 kB');

  G('Primitives: AES-CBC and ECB against node:crypto');
  for (const klen of [16, 32]) {
    const key = u8(crypto.randomBytes(klen)), iv = u8(crypto.randomBytes(16));
    const bits = klen * 8;
    let badE = [], badD = [];
    for (const n of [0, 1, 15, 16, 17, 31, 32, 33, 1000]) {
      const d = u8(crypto.randomBytes(n));
      const ref = nodeAes('enc', key, iv, d, true);
      if (hex(C.aesEncryptCbc(key, iv, d)) !== hex(ref)) badE.push(n);
      if (hex(C.aesDecryptCbc(key, iv, ref)) !== hex(d)) badD.push(n);
    }
    check(!badE.length, `aes-${bits}-cbc encrypt with padding matches (lengths 0, 1, 15, 16, 17, 31, 32, 33, 1000)`, badE.join(', '));
    check(!badD.length, `aes-${bits}-cbc decrypt with padding matches`, badD.join(', '));
    badE = []; badD = [];
    for (const n of [0, 16, 32, 48, 1008]) {
      const d = u8(crypto.randomBytes(n));
      const ref = nodeAes('enc', key, iv, d, false);
      if (hex(C.aesEncryptCbc(key, iv, d, false)) !== hex(ref)) badE.push(n);
      if (hex(C.aesDecryptCbc(key, iv, ref, false)) !== hex(d)) badD.push(n);
    }
    check(!badE.length, `aes-${bits}-cbc encrypt without padding matches (lengths 0, 16, 32, 48, 1008)`, badE.join(', '));
    check(!badD.length, `aes-${bits}-cbc decrypt without padding matches`, badD.join(', '));

    const refBig = nodeAes('enc', key, iv, big, true);
    check(same(C.aesEncryptCbc(key, iv, big), refBig), `aes-${bits}-cbc encrypt of 5 MB matches`);
    const t0 = performance.now();
    const decBig = C.aesDecryptCbc(key, iv, refBig);
    const ms = performance.now() - t0;
    check(same(decBig, big), `aes-${bits}-cbc decrypt of 5 MB matches`);
    console.log(`        AES-${bits} CBC decrypt: ${mbps(big.length, ms)} MB/s (${ms.toFixed(0)} ms for 5 MB)`);

    const blk = u8(crypto.randomBytes(16));
    eqHex(C.aesEncryptEcbBlock(key, blk), nodeAes('enc', key, null, blk, false), `aes-${bits}-ecb block encrypt matches`);
    eqHex(C.aesDecryptEcbBlock(key, blk), nodeAes('dec', key, null, blk, false), `aes-${bits}-ecb block decrypt matches`);

    // Tolerant unpadding: invalid padding leaves the plaintext as it is.
    const plain = u8(Buffer.concat([crypto.randomBytes(31), Buffer.from([0x00])]));     // last byte 0: never valid
    const ct = nodeAes('enc', key, iv, plain, false);
    eqHex(C.aesDecryptCbc(key, iv, ct), plain, `aes-${bits}: invalid padding is returned untouched, not thrown`);
  }
  eqHex(C.aesEncryptEcbBlock(fromHex('000102030405060708090a0b0c0d0e0f'), fromHex('00112233445566778899aabbccddeeff')),
    fromHex('69c4e0d86a7b0430d8cdb78070b4c55a'), 'AES-128 FIPS 197 appendix C.1 vector');
  eqHex(C.aesEncryptEcbBlock(fromHex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'), fromHex('00112233445566778899aabbccddeeff')),
    fromHex('8ea2b7ca516745bfeafc49904b496089'), 'AES-256 FIPS 197 appendix C.3 vector');

  /* ---------------------------------------------------------------
     2. Opening files MuPDF encrypted
     --------------------------------------------------------------- */
  G('Opening: fixtures written by PyMuPDF');

  const manifestPath = path.join(FIXTURES, 'crypt-manifest.json');
  const EXPECT = {
    'RC4-40': { V: 1, R: 2, method: 'RC4', len: 5 },
    'RC4-128': { V: 2, R: 3, method: 'RC4', len: 16 },
    'AES-128': { V: 4, R: 4, method: 'AESV2', len: 16 },
    'AES-256': { V: 5, R: 6, method: 'AESV3', len: 32 }
  };
  if (!fs.existsSync(manifestPath)) {
    check(false, 'encrypted fixtures are present',
      `missing ${manifestPath}; make them with: python build/pdf-package/tests/make-crypt-fixtures.py`);
  } else {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const s of manifest.skipped || []) console.log(`  note  skipped by the fixture script: ${s}`);
    for (const fx of manifest.fixtures) {
      console.log(`  -- ${fx.file}`);
      const bytes = new Uint8Array(fs.readFileSync(path.join(FIXTURES, fx.file)));
      const { doc, err, encrypt, id0 } = await loadEncrypted(bytes);
      const exp = EXPECT[fx.label];
      check(!err && doc.encrypted === true, `${fx.file}: pdfcore reads it raw with { decrypt: false } and flags it encrypted`, err && err.message);
      check(encrypt && encrypt.V === exp.V && encrypt.R === exp.R, `${fx.file}: MuPDF wrote V${exp.V} R${exp.R}`,
        encrypt ? `V${encrypt.V} R${encrypt.R}` : 'no Encrypt dictionary');
      check(id0.length === 16, `${fx.file}: trailer /ID has a 16-byte first element`);

      const withUser = fx.user !== '';
      const hU = C.openHandler({ encrypt, id0, password: fx.user });
      const hO = C.openHandler({ encrypt, id0, password: fx.owner });
      const hE = C.openHandler({ encrypt, id0, password: '' });
      const hW = C.openHandler({ encrypt, id0, password: 'not-the-password' });

      if (withUser) {
        check(hU.ok && hU.isOwner === false, `${fx.file}: the user password opens it, not as owner`, JSON.stringify(hU.ok ? { isOwner: hU.isOwner } : hU));
        check(!hE.ok && hE.reason === 'password', `${fx.file}: an empty password is refused with reason 'password'`, JSON.stringify(hE.ok ? 'opened' : hE.reason));
      } else {
        check(hE.ok && hE.isOwner === false, `${fx.file}: opens with no password, not as owner`, JSON.stringify(hE.ok ? { isOwner: hE.isOwner } : hE));
      }
      check(hO.ok && hO.isOwner === true, `${fx.file}: the owner password opens it as owner`, JSON.stringify(hO.ok ? { isOwner: hO.isOwner } : hO));
      check(!hW.ok && hW.reason === 'password', `${fx.file}: a wrong password is refused with reason 'password'`);

      const h = withUser ? hU : hE;
      if (!h.ok || !hO.ok) continue;
      check(same(h.key, hO.key), `${fx.file}: user and owner passwords yield the same file key`);
      check(h.key.length === exp.len && h.stmf === exp.method && h.strf === exp.method,
        `${fx.file}: ${exp.method}, ${exp.len * 8}-bit key`, `${h.stmf}/${h.strf}, ${h.key.length * 8}-bit`);
      check(h.revision === exp.R, `${fx.file}: revision ${exp.R} reported`);

      // Page content: decrypt, then inflate with zlib.
      const parts = await firstPageContent(doc);
      let content = '';
      for (const p of parts) content += latin1(decodeContent(p.stream, C.decryptBytes(h, p.num, p.gen, p.stream.raw, 'stream')));
      check(containsText(bytesOf(content), fx.text), `${fx.file}: the decrypted page content holds "${fx.text}"`);
      check(fx.mupdfText === fx.text, `${fx.file}: MuPDF reads the same text from its own file`);

      // The Info title.
      const infoRef = doc.trailer.Info;
      const info = doc.objects.get(infoRef.num);
      const title = decodePdfString(C.decryptBytes(h, infoRef.num, infoRef.gen, info.Title.__string, 'string'));
      check(title === fx.title, `${fx.file}: the decrypted Info title is "${fx.title}"`, `got ${JSON.stringify(title)}`);

      // Permissions: P as MuPDF reports it, and the flags the script asked for.
      check(h.permissions === fx.mupdfPermissions, `${fx.file}: P is ${fx.mupdfPermissions}, as MuPDF reports`, `got ${h.permissions}`);
      const perms = C.permissionsFromP(h.permissions);
      const wrong = Object.keys(BITS).filter(k => perms[k] !== ((fx.permissions & BITS[k]) !== 0));
      check(!wrong.length, `${fx.file}: permissionsFromP gives the flags the fixture was saved with`, wrong.join(', '));
      check(/opened with the (user|owner) password|without a password/.test(C.describeHandler(h)),
        `${fx.file}: describeHandler → "${C.describeHandler(h)}"`);
    }
  }

  G('Opening: a revision 5 dictionary built with node:crypto');
  {
    const P = -3904 | 0;
    const upw = bytesOf('r5-user'), opw = bytesOf('r5-owner');
    const fileKey = u8(crypto.randomBytes(32));
    const uvs = u8(crypto.randomBytes(8)), uks = u8(crypto.randomBytes(8));
    const U = u8(Buffer.concat([nodeHash('sha256', upw, uvs), uvs, uks]));
    const UE = nodeAes('enc', nodeHash('sha256', upw, uks), new Uint8Array(16), fileKey, false);
    const ovs = u8(crypto.randomBytes(8)), oks = u8(crypto.randomBytes(8));
    const O = u8(Buffer.concat([nodeHash('sha256', opw, ovs, U), ovs, oks]));
    const OE = nodeAes('enc', nodeHash('sha256', opw, oks, U), new Uint8Array(16), fileKey, false);
    const pb = Buffer.alloc(16); pb.writeInt32LE(P, 0); pb.fill(0xff, 4, 8); pb.write('Tadb', 8, 'latin1');
    const Perms = nodeAes('enc', fileKey, null, pb, false);
    const encrypt = { Filter: 'Standard', V: 5, R: 5, Length: 256, P, O, U, OE, UE, Perms,
      CF: { StdCF: { CFM: 'AESV3', AuthEvent: 'DocOpen', Length: 32 } }, StmF: 'StdCF', StrF: 'StdCF' };
    const hU = C.openHandler({ encrypt, id0: new Uint8Array(0), password: 'r5-user' });
    const hO = C.openHandler({ encrypt, id0: new Uint8Array(0), password: 'r5-owner' });
    const hW = C.openHandler({ encrypt, id0: new Uint8Array(0), password: 'r5-nope' });
    check(hU.ok && !hU.isOwner && same(hU.key, fileKey), 'R5: the user password recovers the file key from UE');
    check(hO.ok && hO.isOwner && same(hO.key, fileKey), 'R5: the owner password recovers the file key from OE');
    check(!hW.ok && hW.reason === 'password', 'R5: a wrong password is refused');
    check(hU.ok && hU.permsValid === true, 'R5: Perms validates');
    const iv = u8(crypto.randomBytes(16)), msg = u8(crypto.randomBytes(777));
    const ct = u8(Buffer.concat([iv, nodeAes('enc', fileKey, iv, msg, true)]));
    check(hU.ok && same(C.decryptBytes(hU, 12, 0, ct, 'stream'), msg), 'R5: a stream node:crypto encrypted with the file key decrypts');
    const badPerms = Object.assign({}, encrypt, { Perms: u8(crypto.randomBytes(16)) });
    const hB = C.openHandler({ encrypt: badPerms, id0: new Uint8Array(0), password: 'r5-user' });
    check(hB.ok && hB.permsValid === false, 'R5: a damaged Perms entry is reported but does not reject the right password');
    // Fullwidth "ｒ" (U+FF52) is "r" under NFKC, so this must open the same dictionary.
    const hN = C.openHandler({ encrypt, id0: new Uint8Array(0), password: 'ｒ5-user' });
    check(hN.ok && same(hN.key, fileKey), 'R5: the password is NFKC-normalised (fullwidth ｒ opens "r5-user")');
  }

  G('Opening: things it must refuse');
  {
    const r1 = C.openHandler({ encrypt: { Filter: 'Adobe.PubSec', V: 4, R: 4 }, id0: new Uint8Array(0), password: '' });
    check(!r1.ok && r1.reason === 'unsupported', 'Adobe.PubSec (certificate security) is reported as unsupported');
    const r2 = C.openHandler({ encrypt: { Filter: 'Standard', V: 5, R: 7, O: new Uint8Array(48), U: new Uint8Array(48) }, id0: new Uint8Array(0), password: '' });
    check(!r2.ok && r2.reason === 'unsupported', 'an unknown revision (R7) is reported as unsupported');
    const r3 = C.openHandler({ encrypt: { Filter: 'Standard', V: 3, R: 3 }, id0: new Uint8Array(0), password: '' });
    check(!r3.ok && r3.reason === 'unsupported', 'the unpublished V3 algorithm is reported as unsupported');
    const r4 = C.openHandler({ encrypt: { Filter: 'Standard', V: 4, R: 4, CF: { StdCF: { CFM: 'Mystery' } }, StmF: 'StdCF', StrF: 'StdCF',
      O: new Uint8Array(32), U: new Uint8Array(32), P: -4 }, id0: new Uint8Array(0), password: '' });
    check(!r4.ok && r4.reason === 'unsupported', 'an unknown crypt filter method is reported as unsupported');
  }

  /* ---------------------------------------------------------------
     3. Writing, checked with pdf.js and MuPDF
     --------------------------------------------------------------- */
  G('Encrypting: files written here, read by pdf.js and MuPDF');
  fs.mkdirSync(OUTPUT, { recursive: true });

  const pyProbe = spawnSync(PYTHON, ['-c', 'import pymupdf; print(pymupdf.__version__)'], { encoding: 'utf8' });
  const haveMupdf = pyProbe.status === 0;
  check(haveMupdf, `PyMuPDF is available to check the output (${haveMupdf ? 'PyMuPDF ' + pyProbe.stdout.trim() : 'pip install pymupdf'})`);
  const pj = await loadPdfjs();
  console.log(`        pdf.js ${pj.version}`);

  /* V4 with an RC4 (CFM V2) crypt filter, built here by algorithms 2, 3 and 5
     with node:crypto's MD5 and the suite's own RC4 — pdfcrypt.js only creates
     AES, so this checks it encrypts correctly from an opened RC4 handler. */
  function rc4V4Dict(userPw, ownerPw, P, id0) {
    const PADB = fromHex('28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a');
    const pad = (s) => { const b = bytesOf(s).subarray(0, 32); return u8(Buffer.concat([b, PADB.subarray(0, 32 - b.length)])); };
    const xor = (k, i) => k.map(x => x ^ i);
    let h = nodeHash('md5', pad(ownerPw));
    for (let i = 0; i < 50; i++) h = nodeHash('md5', h);
    let O = testRc4(h, pad(userPw));
    for (let i = 1; i <= 19; i++) O = testRc4(xor(h, i), O);
    const pLE = Buffer.alloc(4); pLE.writeInt32LE(P, 0);
    let k = nodeHash('md5', pad(userPw), O, pLE, id0);
    for (let i = 0; i < 50; i++) k = nodeHash('md5', k);
    let U = testRc4(k, nodeHash('md5', PADB, id0));
    for (let i = 1; i <= 19; i++) U = testRc4(xor(k, i), U);
    U = u8(Buffer.concat([U, Buffer.alloc(16)]));
    return { key: k, dict: { Filter: 'Standard', V: 4, R: 4, Length: 128, P, O, U,
      CF: { StdCF: { CFM: 'V2', AuthEvent: 'DocOpen', Length: 16 } }, StmF: 'StdCF', StrF: 'StdCF' } };
  }

  const CASES = [
    { name: 'aes256', method: 'AES-256', user: 'user-pw', owner: 'owner-pw', perms: { copy: false, modify: false } },
    { name: 'aes128', method: 'AES-128', user: 'user-pw', owner: 'owner-pw', perms: { copy: false, modify: false } },
    { name: 'aes256-nouser', method: 'AES-256', user: '', owner: 'owner-pw', perms: { copy: false } },
    { name: 'aes128-nouser', method: 'AES-128', user: '', owner: 'owner-pw', perms: { copy: false, print: true } },
    { name: 'aes128-nometa', method: 'AES-128', user: 'user-pw', owner: 'owner-pw', perms: { copy: false }, encryptMetadata: false },
    { name: 'aes256-nometa', method: 'AES-256', user: 'user-pw', owner: 'owner-pw', perms: { copy: false }, encryptMetadata: false },
    { name: 'aes256-unicode', method: 'AES-256', user: 'pässwörd-ü', owner: 'owner-pw', perms: { copy: false } },
    { name: 'aes256-noowner', method: 'AES-256', user: 'user-pw', owner: '', perms: { copy: false } },
    { name: 'aes128-identity-strings', method: 'AES-128', user: 'user-pw', owner: 'owner-pw', perms: { copy: false }, strIdentity: true },
    { name: 'rc4-v4', method: 'RC4-V4', user: 'user-pw', owner: 'owner-pw', perms: { copy: false } }
  ];

  for (const cs of CASES) {
    console.log(`  -- ${cs.name}`);
    const random = seededRandom(cs.name);
    const id0 = random(16), id1 = random(16);
    const text = `ROUNDTRIP-TEXT-${cs.name.toUpperCase()}`;
    const title = `Roundtrip ${cs.name}`;
    const expectP = C.pFromPermissions(cs.perms);
    let handler, encryptDict;

    if (cs.method === 'RC4-V4') {
      const built = rc4V4Dict(cs.user, cs.owner, expectP, id0);
      encryptDict = built.dict;
      handler = C.openHandler({ encrypt: encryptDict, id0, password: cs.owner });
      check(handler.ok && handler.isOwner && same(handler.key, built.key) && handler.stmf === 'RC4',
        `${cs.name}: openHandler opens the suite-built V4/CFM V2 dictionary with the right key`);
      if (!handler.ok) continue;
    } else {
      const made = C.createHandler({ userPassword: cs.user, ownerPassword: cs.owner, permissions: cs.perms,
        method: cs.method, id0, encryptMetadata: cs.encryptMetadata !== false, random });
      handler = made.handler; encryptDict = made.encryptDict;
      if (cs.strIdentity) {
        encryptDict = Object.assign({}, encryptDict, { StrF: 'Identity' });
        handler = C.openHandler({ encrypt: encryptDict, id0, password: cs.owner });
        check(handler.ok && handler.strf === 'Identity' && handler.stmf === 'AESV2', `${cs.name}: StrF Identity, StmF AESV2`);
      }
    }

    // The P value's reserved bits (an independent statement of the spec).
    const P = encryptDict.P;
    check((P & 3) === 0 && (P & 0xc0) === 0xc0 && ((P >>> 12) === 0xfffff), `${cs.name}: P ${P} has bits 1–2 clear and 7, 8, 13–32 set`);
    check(cs.method !== 'AES-256' || (encryptDict.V === 5 && encryptDict.R === 6 && encryptDict.O.length === 48 &&
      encryptDict.U.length === 48 && encryptDict.OE.length === 32 && encryptDict.UE.length === 32 && encryptDict.Perms.length === 16),
      `${cs.name}: dictionary shape`, `V${encryptDict.V} R${encryptDict.R}`);
    if (cs.encryptMetadata === false) check(encryptDict.EncryptMetadata === false, `${cs.name}: EncryptMetadata false is in the dictionary`);

    const bytes = buildEncryptedPdf({
      text, title, encryptDict, id0, id1, compress: true,
      encryptFn: (num, gen, b, kind) => C.encryptBytes(handler, num, gen, b, kind, random)
    });
    const file = path.join(OUTPUT, `crypt-${cs.name}.pdf`);
    fs.writeFileSync(file, bytes);

    // (a) pdf.js
    const withUser = cs.user !== '';
    const a = await readWithPdfjs(bytes, withUser ? cs.user : undefined);
    check(a.ok && a.text.includes(text), `${cs.name}: pdf.js opens it with ${withUser ? 'the user password' : 'no password'} and reads the page text`,
      a.ok ? `text ${JSON.stringify(a.text)}` : `${a.name}: ${a.message}`);
    check(a.ok && a.title === title, `${cs.name}: pdf.js reads the Info title`, a.ok ? JSON.stringify(a.title) : '');
    if (a.ok) {
      const pjPerms = a.permissions || [];
      const want = Object.keys(BITS).filter(k => (expectP & BITS[k]) !== 0).map(k => BITS[k]).sort((x, y) => x - y);
      const got = pjPerms.filter(x => Object.values(BITS).includes(x)).sort((x, y) => x - y);
      check(JSON.stringify(got) === JSON.stringify(want), `${cs.name}: pdf.js reports the permissions set (print ${pjPerms.includes(4) ? 'allowed' : 'denied'}, copy ${pjPerms.includes(16) ? 'allowed' : 'denied'})`,
        `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    }
    if (cs.owner) {
      const ao = await readWithPdfjs(bytes, cs.owner);
      check(ao.ok && ao.text.includes(text), `${cs.name}: pdf.js opens it with the owner password`, ao.ok ? '' : `${ao.name}: ${ao.message}`);
    }
    if (withUser) {
      const an = await readWithPdfjs(bytes, undefined);
      check(!an.ok && an.name === 'PasswordException' && an.code === 1, `${cs.name}: pdf.js without a password → PasswordException (need password)`, `${an.name} ${an.code}`);
      const aw = await readWithPdfjs(bytes, 'wrong-password');
      check(!aw.ok && aw.name === 'PasswordException' && aw.code === 2, `${cs.name}: pdf.js with a wrong password → PasswordException (incorrect)`, `${aw.name} ${aw.code}`);
    }

    // (b) MuPDF
    if (haveMupdf) {
      const m = readWithMupdf(file, cs.user, cs.owner);
      if (m.error) { check(false, `${cs.name}: MuPDF check ran`, m.error.split('\n').pop()); }
      else {
        check(/Standard/.test(m.encryption || '') && (cs.method === 'RC4-V4' ? /RC4/.test(m.encryption) : m.encryption.includes(cs.method.slice(4))), `${cs.name}: MuPDF reports the encryption as "${m.encryption}"`);
        check(m.needsPass === withUser, `${cs.name}: MuPDF needs_pass is ${withUser}`);
        if (withUser) {
          check(m.authWrong === 0, `${cs.name}: MuPDF rejects a wrong password`, `authenticate → ${m.authWrong}`);
          check(m.authUser === 2, `${cs.name}: MuPDF authenticates the user password at user level (2)`, `authenticate → ${m.authUser}`);
        }
        if (cs.owner) check(m.authOwner === 4, `${cs.name}: MuPDF authenticates the owner password at owner level (4)`, `authenticate → ${m.authOwner}`);
        check(m.text === text, `${cs.name}: MuPDF reads the page text`, JSON.stringify(m.text));
        check(m.title === title, `${cs.name}: MuPDF reads the Info title`, JSON.stringify(m.title));
        const wrong = Object.keys(BITS).filter(k => ((m.permissions & BITS[k]) !== 0) !== ((expectP & BITS[k]) !== 0));
        check(!wrong.length, `${cs.name}: MuPDF reports the permissions set (print ${m.permissions & 4 ? 'allowed' : 'denied'}, copy ${m.permissions & 16 ? 'allowed' : 'denied'})`, wrong.join(', '));
      }
    }

    // And back through pdfcore + pdfcrypt.
    const { doc, encrypt, id0: rid } = await loadEncrypted(bytes);
    const back = C.openHandler({ encrypt, id0: rid, password: withUser ? cs.user : '' });
    check(back.ok && same(back.key, handler.key) && back.isOwner === false && back.permissions === expectP,
      `${cs.name}: pdfcrypt reopens it from pdfcore's parse with the same key${withUser ? '' : ' (no password needed)'}`);
    if (back.ok) {
      const parts = await firstPageContent(doc);
      const p = parts[0];
      const content = decodeContent(p.stream, C.decryptBytes(back, p.num, p.gen, p.stream.raw, 'stream'));
      check(containsText(content, text), `${cs.name}: and its content stream decrypts`);
    }
    if (cs.method !== 'RC4-V4' && !cs.strIdentity) {
      check(/new encryption/.test(C.describeHandler(handler)), `${cs.name}: describeHandler → "${C.describeHandler(handler)}"`);
    }
  }

  /* ---------------------------------------------------------------
     4. A large stream
     --------------------------------------------------------------- */
  G('Large stream: 20 MB');
  {
    const N = 20 * 1048576;
    const data = u8(crypto.randomBytes(N));
    for (const method of ['AES-256', 'AES-128']) {
      const { handler: h } = C.createHandler({ userPassword: 'x', ownerPassword: 'y', method, id0: new Uint8Array(16), random: (n) => u8(crypto.randomBytes(n)) });
      let t0 = performance.now();
      const ct = C.encryptBytes(h, 42, 0, data, 'stream');
      const tEnc = performance.now() - t0;
      t0 = performance.now();
      const pt = C.decryptBytes(h, 42, 0, ct, 'stream');
      const tDec = performance.now() - t0;
      check(same(pt, data), `${method}: 20 MB stream round trip is exact`);
      // node:crypto decrypts it independently; for AESV2 the per-object key is
      // recomputed here by algorithm 1 with node's MD5.
      const key = method === 'AES-256' ? h.key
        : nodeHash('md5', h.key, Buffer.from([42, 0, 0, 0, 0]), Buffer.from('sAlT', 'latin1')).subarray(0, 16);
      const ref = nodeAes('dec', key, ct.subarray(0, 16), ct.subarray(16), true);
      check(same(ref, data), `${method}: node:crypto decrypts pdfcrypt's 20 MB stream${method === 'AES-128' ? ' (object key by algorithm 1)' : ''}`);
      console.log(`        ${method}: encrypt ${mbps(N, tEnc)} MB/s (${tEnc.toFixed(0)} ms), decrypt ${mbps(N, tDec)} MB/s (${tDec.toFixed(0)} ms)`);
      check(tDec < 10000, `${method}: 20 MB decrypts in under 10 s`, `${tDec.toFixed(0)} ms`);
    }
    // RC4 round trip through an opened V2 handler (no reference cipher in OpenSSL 3).
    const hR = { ok: true, key: u8(crypto.randomBytes(16)), stmf: 'RC4', strf: 'RC4', eff: 'RC4', encryptMetadata: true };
    let t0 = performance.now();
    const rc = C.encryptBytes(hR, 7, 0, data, 'stream');
    const tR = performance.now() - t0;
    check(same(C.decryptBytes(hR, 7, 0, rc, 'stream'), data), 'RC4: 20 MB stream round trip is exact');
    console.log(`        RC4: ${mbps(N, tR)} MB/s (${tR.toFixed(0)} ms)`);
  }

  G('Small cases');
  {
    const { handler: h } = C.createHandler({ userPassword: '', ownerPassword: '', method: 'AES-256', random: seededRandom('small') });
    check(h.id0 instanceof Uint8Array && h.id0.length === 16, 'createHandler generates an id0 when none is given');
    check(C.decryptBytes(h, 1, 0, new Uint8Array(15), 'string').length === 0, 'AES input shorter than 16 bytes decrypts to nothing');
    check(C.decryptBytes(h, 1, 0, new Uint8Array(16), 'string').length === 0, 'AES input of just an IV decrypts to nothing');
    const e = C.encryptBytes(h, 1, 0, new Uint8Array(0), 'string');
    check(e.length === 32 && C.decryptBytes(h, 1, 0, e, 'string').length === 0, 'an empty string encrypts to IV + one pad block and back');
    const id = { ok: true, key: new Uint8Array(16), stmf: 'Identity', strf: 'Identity', eff: 'Identity' };
    const raw = bytesOf('unchanged');
    check(same(C.decryptBytes(id, 1, 0, raw, 'stream'), raw), 'Identity returns its input');
    const p = C.permissionsFromP(C.pFromPermissions({}));
    check(Object.values(p).every(Boolean), 'missing permissions default to allowed');
    check(C.pFromPermissions({}) === -4, 'all permissions allowed is P = -4');
    let threw = false;
    try { C.createHandler({ method: 'RC4-128', random: seededRandom('x') }); } catch (err) { threw = true; }
    check(threw, 'creating RC4 encryption is refused');
  }

  /* ---------------------------------------------------------------- */
  console.log(`\n${'-'.repeat(60)}`);
  console.log(`${pass + failCount} assertions   ${pass} passed   ${failCount} failed`);
  if (failCount) {
    console.log('\nFailures:');
    failures.forEach(f => console.log('  · ' + f));
  }
  console.log();
  process.exit(failCount ? 1 : 0);
})().catch(e => {
  console.error('\nSuite crashed:', e && e.stack || e);
  process.exit(1);
});
