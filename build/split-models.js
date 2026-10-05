#!/usr/bin/env node
/**
 * build/split-models.js — keep every published file under the hosts' size
 * caps by shipping big model files in pieces.
 *
 * Cloudflare's static hosting (Workers static assets and Pages) refuses any
 * file over 25 MiB, and GitHub Pages warns at 50 MB and refuses 100 MB. So
 * every file over 24 MiB (a 1 MiB margin) is written as <file>.part0,
 * <file>.part1, … of at most 20 MiB each, and the loaders fetch the parts in
 * order, join them and check the length (and, where the loader has a
 * manifest with a hash, the sha256) before handing the bytes to ONNX Runtime.
 * This is the same convention build/ai-video/prepare-whisper.py has always
 * used for a sharded file.
 *
 *   node build/split-models.js [--root <dir>]      split, verify, then remove the whole files
 *   node build/split-models.js [--root <dir>] --check   change nothing; exit 1 if anything is wrong
 *
 * Idempotent. A whole file is removed only after (1) its parts are on disk
 * and re-read to the same sha256 and length, (2) when a manifest pins a
 * sha256 for it, the file matches that pin, and (3) every loader listed in
 * CONSUMERS below names the parts. If any of these fails the whole file is
 * kept and the run exits 1. When only the parts are left (a later run) they
 * are verified against engine/models/parts.json, the record this script keeps.
 *
 * A new big file needs its loader made to read parts and an entry in
 * CONSUMERS; until then this script writes the parts, keeps the whole file
 * and fails, so a release cannot ship a file the host would refuse.
 *
 * After build/ai-video/prepare-kokoro.js (which writes model_quantized.onnx
 * whole), run this script again: it splits the model and lists the parts in
 * kokoro-82m.json.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIB = 1024 * 1024;
const SPLIT_OVER = 24 * MIB;      /* Cloudflare's cap is 25 MiB; keep a margin */
const PART_MAX = 20 * MIB;
const HARD_CAP = 25 * MIB;
const MAX_PARTS = 8;              /* .part0 to .part7, as many as _headers names */
const SKIP = new Set(['.git', 'node_modules']);
const REGISTRY = 'engine/models/parts.json';

/* Who loads each big file, and what each loader must contain once it reads
   parts. `parts: true` means every part's file name must appear in that
   file. `manifest` is a JSON manifest whose files[key] gets `parts`, and
   whose sha256 for the file, when present, the whole file must match. */
const CONSUMERS = {
  'engine/models/depth-anything-v2-small-uint8.onnx': { loaders: [{ file: 'engine/aiimg-depth.js', parts: true }] },
  'engine/models/migan-512-places2.onnx': { loaders: [{ file: 'engine/aiimg-object-remover.js', parts: true }] },
  'engine/models/modnet-photographic-portrait-matting.onnx': { loaders: [{ file: 'engine/aiimg-matte.js', parts: true }] },
  'engine/models/whisper-tiny/decoder_model_merged_quantized.onnx': {
    manifest: { file: 'engine/models/whisper-tiny/whisper-tiny.json', key: 'decoder_model_merged_quantized.onnx' },
    loaders: [{ file: 'engine/aivid-whisper.js', needs: 'files[name].parts' }]
  },
  'engine/models/kokoro-82m/model_quantized.onnx': {
    manifest: { file: 'engine/models/kokoro-82m/kokoro-82m.json', key: 'model_quantized.onnx' },
    loaders: [{ file: 'engine/aivid-tts-worker.js', needs: 'm.files[m.model].parts' }]
  }
};

const args = process.argv.slice(2);
const flag = (n) => args.indexOf('--' + n);
const ROOT = path.resolve(flag('root') >= 0 ? args[flag('root') + 1] : path.join(__dirname, '..'));
const CHECK = flag('check') >= 0;
const errors = [];
const say = (s) => console.log(s);
const fail = (s) => { errors.push(s); console.log('  FAIL ' + s); };
const abs = (rel) => path.join(ROOT, rel);
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const PART_RE = /\.part\d+$/;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}
const relOf = (p) => path.relative(ROOT, p).split(path.sep).join('/');

/* JSON written back the way it was read: same indent (1), same line ends,
   same trailing newline or none. Refuses a file that would not round-trip. */
function readJson(rel) {
  const text = fs.readFileSync(abs(rel), 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const tail = /\r?\n$/.test(text);
  const fmt = (o) => JSON.stringify(o, null, 1).replace(/\n/g, eol) + (tail ? eol : '');
  const data = JSON.parse(text);
  if (fmt(data) !== text) throw new Error(rel + ' is not in the JSON layout this script writes back (indent 1); not touching it');
  return { data, write: (o) => { const s = fmt(o); if (s !== text) fs.writeFileSync(abs(rel), s); return s !== text; } };
}

function partsOnDisk(rel) {
  const dir = path.dirname(abs(rel)), base = path.basename(rel);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => n.startsWith(base + '.part') && PART_RE.test(n))
    .sort((a, b) => Number(a.slice(a.lastIndexOf('.part') + 5)) - Number(b.slice(b.lastIndexOf('.part') + 5)));
}

/* Read the listed parts back and compare with the record. */
function verifyParts(rel, rec) {
  const dir = path.dirname(abs(rel));
  const h = crypto.createHash('sha256');
  let total = 0;
  for (const p of rec.parts) {
    const f = path.join(dir, p.file);
    if (!fs.existsSync(f)) return 'missing ' + p.file;
    const b = fs.readFileSync(f);
    if (b.length !== p.bytes || sha(b) !== p.sha256) return p.file + ' does not match its record';
    if (b.length > PART_MAX) return p.file + ' is over 20 MiB';
    h.update(b); total += b.length;
  }
  if (total !== rec.bytes) return 'the parts add up to ' + total + ' bytes, not ' + rec.bytes;
  if (h.digest('hex') !== rec.sha256) return 'the joined parts do not hash to ' + rec.sha256;
  const extra = partsOnDisk(rel).filter((n) => !rec.parts.some((p) => p.file === n));
  if (extra.length) return 'stray parts on disk: ' + extra.join(', ');
  return null;
}

function checkConsumers(rel, rec) {
  const c = CONSUMERS[rel];
  if (!c) return ['no loader is registered for it in CONSUMERS (build/split-models.js)'];
  const bad = [];
  /* _headers gives .part0 to .part7 a compressible Content-Type, one rule each */
  if (rec.parts.length > MAX_PARTS) bad.push(rec.parts.length + ' parts; _headers has Content-Type rules for .part0 to .part' + (MAX_PARTS - 1) + ' only');
  if (c.manifest) {
    const m = JSON.parse(fs.readFileSync(abs(c.manifest.file), 'utf8'));
    const e = m.files && m.files[c.manifest.key];
    const want = rec.parts.map((p) => p.file);
    if (!e) bad.push(c.manifest.file + ' has no files["' + c.manifest.key + '"]');
    else {
      if (JSON.stringify(e.parts) !== JSON.stringify(want)) bad.push(c.manifest.file + ' does not list the parts');
      if (e.bytes !== rec.bytes) bad.push(c.manifest.file + ' gives ' + e.bytes + ' bytes, not ' + rec.bytes);
      if (e.sha256 && e.sha256 !== rec.sha256) bad.push(c.manifest.file + ' pins another sha256');
    }
  }
  for (const L of c.loaders) {
    const src = fs.readFileSync(abs(L.file), 'utf8');
    if (L.parts) {
      for (const p of rec.parts) if (!src.includes(p.file)) bad.push(L.file + ' does not name ' + p.file);
      if (!src.includes(String(rec.bytes))) bad.push(L.file + ' does not give the total, ' + rec.bytes + ' bytes');
      const whole = path.basename(rel);
      const re = new RegExp(whole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?!\\.part)', 'g');
      if (re.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))) bad.push(L.file + ' still names the whole file in code');
    }
    if (L.needs && !src.includes(L.needs)) bad.push(L.file + ' does not read parts (no "' + L.needs + '")');
  }
  return bad;
}

function main() {
  say('split-models: ' + ROOT + (CHECK ? ' (check only)' : ''));
  let registry = { note: 'Written by build/split-models.js. Each file over 24 MiB ships as <file>.part0, .part1, … of at most 20 MiB; bytes and sha256 are of the whole file.', files: {} };
  if (fs.existsSync(abs(REGISTRY))) registry = readJson(REGISTRY).data;
  const files = walk(ROOT, []);
  let changed = 0;

  /* 1. whole files over the threshold */
  for (const f of files) {
    const st = fs.statSync(f);
    if (st.size <= SPLIT_OVER || PART_RE.test(f)) continue;
    const rel = relOf(f);
    if (CHECK) { fail(rel + ' is ' + (st.size / MIB).toFixed(2) + ' MiB, over 24 MiB, and not split'); continue; }
    say(rel + ': ' + st.size + ' bytes');
    const buf = fs.readFileSync(f);
    const whole = { bytes: buf.length, sha256: sha(buf) };
    const c = CONSUMERS[rel];
    let man = null;
    if (c && c.manifest) {
      man = readJson(c.manifest.file);
      const e = man.data.files && man.data.files[c.manifest.key];
      if (!e) { fail(c.manifest.file + ' has no files["' + c.manifest.key + '"]'); continue; }
      if (e.sha256 && e.sha256 !== whole.sha256) { fail(rel + ' does not match the sha256 its manifest pins'); continue; }
      if (e.bytes !== whole.bytes) { fail(rel + ' is not the ' + e.bytes + ' bytes its manifest gives'); continue; }
    }
    /* write the parts, then read them back */
    const n = Math.ceil(buf.length / PART_MAX);
    const rec = { bytes: whole.bytes, sha256: whole.sha256, parts: [] };
    for (let i = 0; i < n; i++) {
      const b = buf.subarray(i * PART_MAX, Math.min(buf.length, (i + 1) * PART_MAX));
      const name = path.basename(rel) + '.part' + i;
      const pf = path.join(path.dirname(f), name);
      if (!fs.existsSync(pf) || !fs.readFileSync(pf).equals(b)) { fs.writeFileSync(pf, b); changed++; }
      rec.parts.push({ file: name, bytes: b.length, sha256: sha(b) });
    }
    for (const stray of partsOnDisk(rel).filter((x) => !rec.parts.some((p) => p.file === x))) {
      fs.unlinkSync(path.join(path.dirname(f), stray)); changed++;
    }
    const v = verifyParts(rel, rec);
    if (v) { fail(rel + ': ' + v + ' — whole file kept'); continue; }
    say('  ' + n + ' parts written and verified (sha256 ' + whole.sha256.slice(0, 16) + '…)');
    if (JSON.stringify(registry.files[rel]) !== JSON.stringify(rec)) { registry.files[rel] = rec; changed++; }
    if (man) {
      const e = man.data.files[c.manifest.key];
      e.parts = rec.parts.map((p) => p.file);
      if (man.write(man.data)) { changed++; say('  ' + c.manifest.file + ' lists the parts'); }
    }
    const bad = checkConsumers(rel, rec);
    if (bad.length) { for (const b of bad) fail(rel + ': ' + b); fail(rel + ': whole file kept until its loaders read the parts'); continue; }
    fs.unlinkSync(f); changed++;
    say('  whole file removed; its loaders read the parts');
  }

  /* 2. every recorded split: parts present and correct, loaders agree, no whole copy left */
  for (const [rel, rec] of Object.entries(registry.files)) {
    if (fs.existsSync(abs(rel))) { if (!errors.some((e) => e.startsWith(rel))) fail(rel + ': the whole file is still there beside its parts'); continue; }
    const v = verifyParts(rel, rec);
    if (v) { fail(rel + ': ' + v); continue; }
    const bad = checkConsumers(rel, rec);
    for (const b of bad) fail(rel + ': ' + b);
    if (!v && !bad.length) say('ok   ' + rel + ' — ' + rec.parts.length + ' parts, ' + rec.bytes + ' bytes');
  }

  /* 3. nothing published over the hard cap */
  for (const f of walk(ROOT, [])) {
    const s = fs.statSync(f).size;
    if (s > HARD_CAP) fail(relOf(f) + ' is ' + (s / MIB).toFixed(2) + ' MiB, over the 25 MiB per-file cap');
  }

  if (!CHECK && fs.existsSync(path.dirname(abs(REGISTRY)))) {
    const text = JSON.stringify(registry, null, 1) + '\n';
    if (!fs.existsSync(abs(REGISTRY)) || fs.readFileSync(abs(REGISTRY), 'utf8') !== text) { fs.writeFileSync(abs(REGISTRY), text); changed++; }
  }
  say((errors.length ? errors.length + ' problem(s)' : 'all good') + (CHECK ? '' : '; ' + changed + ' change(s) written'));
  process.exit(errors.length ? 1 : 0);
}

main();
