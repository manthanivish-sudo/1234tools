/**
 * Vendors Kokoro-82M v1.0 (the q8 ONNX), its 28 English voices and misaki's
 * English pronunciation dictionaries under engine/models/kokoro-82m/, so the
 * Reel Maker's "Generate voice" runs from this site alone.
 *
 *   node build/ai-video/prepare-kokoro.js [--root <site dir>] [--cache <dir>]
 *
 * Every download is pinned to a commit and the model is checked against the
 * sha256 Hugging Face publishes for it (its LFS object id). Writes:
 *   engine/models/kokoro-82m/model_quantized.onnx   the network, 92.4 MB
 *   engine/models/kokoro-82m/voices/<id>.bin         510×256 float32 style vectors
 *   engine/models/kokoro-82m/lexicon-us.json         misaki us_gold + us_silver
 *   engine/models/kokoro-82m/lexicon-gb.json         misaki gb_gold + gb_silver
 *   engine/models/kokoro-82m/kokoro-82m.json         the manifest the page reads
 * The lexicons are re-serialised without indentation as {"g": gold, "s":
 * silver entries gold lacks}; nothing else changes. No eSpeak NG (GPL) data
 * is fetched or derived: misaki's dictionaries are Apache-2.0.
 *
 * The model is over the static hosts' 25 MiB per-file cap, so run
 * build/split-models.js afterwards: it writes model_quantized.onnx.part0…4,
 * lists them in kokoro-82m.json (which engine/aivid-tts-worker.js reads)
 * and removes the whole file once the parts verify.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const ROOT = path.resolve(flag('root', path.join(__dirname, '..', '..')));
const CACHE = path.resolve(flag('cache', path.join(os.tmpdir(), 'kokoro-prepare')));
const OUT = path.join(ROOT, 'engine', 'models', 'kokoro-82m');

const HF_REV = '1939ad2a8e416c0acfeecc08a694d14ef25f2231';           /* onnx-community/Kokoro-82M-v1.0-ONNX */
const HF = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/' + HF_REV + '/';
const MISAKI_REV = 'fba1236595f2d2bf21d414ba6e57d25256afada3';      /* hexgrad/misaki */
const MISAKI = 'https://raw.githubusercontent.com/hexgrad/misaki/' + MISAKI_REV + '/misaki/data/';
const MODEL = { file: 'onnx/model_quantized.onnx', bytes: 92361116, sha256: 'fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478' };

/* The 28 English voices of Kokoro v1.0, with the names, genders and the
   overall grades hexgrad publishes in VOICES.md (huggingface.co/hexgrad/
   Kokoro-82M/blob/main/VOICES.md). Grades rank the picker; they are the
   author's, not ours. */
const VOICES = [
  ['af_heart', 'Heart', 'F', 'A'], ['af_bella', 'Bella', 'F', 'A-'], ['af_nicole', 'Nicole', 'F', 'B-'],
  ['af_aoede', 'Aoede', 'F', 'C+'], ['af_kore', 'Kore', 'F', 'C+'], ['af_sarah', 'Sarah', 'F', 'C+'],
  ['af_alloy', 'Alloy', 'F', 'C'], ['af_nova', 'Nova', 'F', 'C'], ['af_sky', 'Sky', 'F', 'C-'],
  ['af_jessica', 'Jessica', 'F', 'D'], ['af_river', 'River', 'F', 'D'],
  ['am_fenrir', 'Fenrir', 'M', 'C+'], ['am_michael', 'Michael', 'M', 'C+'], ['am_puck', 'Puck', 'M', 'C+'],
  ['am_echo', 'Echo', 'M', 'D'], ['am_eric', 'Eric', 'M', 'D'], ['am_liam', 'Liam', 'M', 'D'],
  ['am_onyx', 'Onyx', 'M', 'D'], ['am_santa', 'Santa', 'M', 'D-'], ['am_adam', 'Adam', 'M', 'F+'],
  ['bf_emma', 'Emma', 'F', 'B-'], ['bf_isabella', 'Isabella', 'F', 'C'], ['bf_alice', 'Alice', 'F', 'D'], ['bf_lily', 'Lily', 'F', 'D'],
  ['bm_fable', 'Fable', 'M', 'C'], ['bm_george', 'George', 'M', 'C'], ['bm_lewis', 'Lewis', 'M', 'D+'], ['bm_daniel', 'Daniel', 'M', 'D']
];
const US_VOCAB = new Set('AIOWYbdfhijklmnpstuvwzæðŋɑɔəɛɜɡɪɹɾʃʊʌʒʤʧˈˌθᵊᵻʔ');
const GB_VOCAB = new Set('AIQWYabdfhijklmnpstuvwzðŋɑɒɔəɛɜɡɪɹʃʊʌʒʤʧˈˌːθᵊ');

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
async function get(url, name) {
  const file = path.join(CACHE, name);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  const b = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, b);
  return b;
}
function put(rel, buf) {
  const abs = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (fs.existsSync(abs) && fs.readFileSync(abs).equals(buf)) return false;
  fs.writeFileSync(abs, buf);
  return true;
}

function lexicon(gold, silver, vocab, name) {
  const bad = [];
  const ok = (v) => v === null || [...v].every((c) => vocab.has(c));
  for (const [k, v] of Object.entries(gold)) {
    if (typeof v === 'string') { if (!ok(v)) bad.push(k); }
    else { if (!('DEFAULT' in v)) bad.push(k); for (const x of Object.values(v)) if (!ok(x)) bad.push(k); }
  }
  if (bad.length) throw new Error(name + ': ' + bad.length + ' gold entries outside the phoneme set, e.g. ' + bad.slice(0, 5).join(', '));
  const s = {};
  let dropped = 0;
  for (const [k, v] of Object.entries(silver)) {
    if (k in gold) continue;
    const vals = typeof v === 'string' ? [v] : Object.values(v);
    if (!vals.every(ok)) { dropped++; continue; }
    s[k] = v;
  }
  return { json: JSON.stringify({ g: gold, s }), gold: Object.keys(gold).length, silver: Object.keys(s).length, dropped };
}

(async () => {
  fs.mkdirSync(CACHE, { recursive: true });
  const files = {};
  const model = await get(HF + MODEL.file, 'model_quantized.onnx');
  if (model.length !== MODEL.bytes || sha(model) !== MODEL.sha256) throw new Error('model_quantized.onnx does not match the published sha256');
  put('model_quantized.onnx', model);
  files['model_quantized.onnx'] = { bytes: model.length, sha256: MODEL.sha256, from: 'onnx/model_quantized.onnx' };
  const tok = JSON.parse((await get(HF + 'tokenizer.json', 'tokenizer.json')).toString('utf8'));
  const vocab = tok.model.vocab;
  const voices = [];
  for (const [id, name, gender, grade] of VOICES) {
    const b = await get(HF + 'voices/' + id + '.bin', 'voices/' + id + '.bin');
    if (b.length !== 510 * 256 * 4) throw new Error(id + '.bin is ' + b.length + ' bytes, not 510×256 float32');
    put('voices/' + id + '.bin', b);
    files['voices/' + id + '.bin'] = { bytes: b.length, sha256: sha(b) };
    voices.push({ id, name, gender, grade, lang: 'en', accent: id[0] === 'a' ? 'en-us' : 'en-gb', bytes: b.length });
  }
  const lex = {};
  for (const a of ['us', 'gb']) {
    const g = await get(MISAKI + a + '_gold.json', a + '_gold.json');
    const s = await get(MISAKI + a + '_silver.json', a + '_silver.json');
    const L = lexicon(JSON.parse(g), JSON.parse(s), a === 'us' ? US_VOCAB : GB_VOCAB, a);
    const buf = Buffer.from(L.json, 'utf8');
    put('lexicon-' + a + '.json', buf);
    files['lexicon-' + a + '.json'] = { bytes: buf.length, sha256: sha(buf), from: [a + '_gold.json ' + sha(g), a + '_silver.json ' + sha(s)] };
    lex['en-' + a] = { file: 'lexicon-' + a + '.json', bytes: buf.length, gold: L.gold, silver: L.silver };
    console.log('  lexicon-' + a + '.json  ' + L.gold + ' gold + ' + L.silver + ' silver entries, ' + buf.length + ' bytes' + (L.dropped ? ', ' + L.dropped + ' silver entries dropped (phonemes outside the set)' : ''));
  }
  const manifest = {
    name: 'Kokoro-82M v1.0', licence: 'Apache-2.0', sampleRate: 24000, styleDim: 256, maxTokens: 510,
    model: 'model_quantized.onnx', modelBytes: model.length,
    source: { model: 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/tree/' + HF_REV, weights: 'https://huggingface.co/hexgrad/Kokoro-82M', lexicons: 'https://github.com/hexgrad/misaki/tree/' + MISAKI_REV + '/misaki/data' },
    vocab, voices, lexicons: lex, files
  };
  put('kokoro-82m.json', Buffer.from(JSON.stringify(manifest, null, 1) + '\n', 'utf8'));
  const total = Object.values(files).reduce((s, f) => s + f.bytes, 0);
  console.log('  ' + voices.length + ' voices, ' + Object.keys(files).length + ' files, ' + total + ' bytes in ' + OUT);
})().catch((e) => { console.error('prepare-kokoro failed: ' + (e && e.message || e)); process.exit(1); });
