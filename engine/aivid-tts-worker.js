/**
 * The voice worker: Kokoro-82M speaking English on the device, off the
 * page's main thread. Started by engine/aivid-tts.js as a module worker.
 *
 * Everything it reads comes from this site: ONNX Runtime's WebAssembly
 * build (engine/vendor/ort/), the q8 model, the voice style vectors and
 * misaki's dictionaries (engine/models/kokoro-82m/). Nothing is fetched
 * until the page asks for a voice, and nothing is sent anywhere: the text
 * arrives in a message and leaves as samples in another.
 *
 * Messages in:  { id, cmd: 'load' }
 *               { id, cmd: 'speak', text, voice, speed }
 *               { id, cmd: 'cancel' }
 * Messages out: { id, type: 'progress', stage, loaded, total, done, of }
 *               { id, type: 'ready', inputs }
 *               { id, type: 'audio', samples, sampleRate, sentences, phonemes }
 *               { id, type: 'error', message, name }
 * A speak is cut into sentences (then into pieces of at most 400 phoneme
 * symbols, under the model's 510), each run on its own; a cancel is seen
 * between pieces.
 */
const DIR = '/engine/models/kokoro-82m/';
const ORT_DIR = '/engine/vendor/ort/';
const MAX_PIECE = 400;
let manifestP = null, modelP = null, g2pLib = null;
const lexicons = new Map(), voices = new Map(), cancelled = new Set();
const post = (m, transfer) => self.postMessage(m, transfer || []);
const abortError = () => { const e = new Error('Cancelled.'); e.name = 'AbortError'; return e; };

function manifest() {
  if (!manifestP) manifestP = fetch(DIR + 'kokoro-82m.json').then((r) => { if (!r.ok) throw new Error('The voice manifest could not be read (HTTP ' + r.status + ').'); return r.json(); })
    .catch((e) => { manifestP = null; throw e; });
  return manifestP;
}
async function fetchBytes(url, expected, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('A voice file could not be downloaded (HTTP ' + res.status + ' for ' + url.split('/').pop() + ').');
  if (!res.body || !res.body.getReader) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks = []; let got = 0, last = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    if (onProgress && got - last > 262144) { last = got; onProgress(got, Math.max(expected || 0, got)); }
  }
  const out = new Uint8Array(got); let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  if (onProgress) onProgress(got, got);
  return out;
}
/* The joined model must be its full size and, where the worker can hash,
   the manifest's sha256; a short part must not reach the runtime. */
async function checkBytes(data, bytes, sha256) {
  const bad = () => new Error('The voice model download was incomplete or damaged. Reload the page to try again.');
  if (bytes && data.length !== bytes) throw bad();
  if (sha256 && self.crypto && self.crypto.subtle) {
    const d = new Uint8Array(await self.crypto.subtle.digest('SHA-256', data));
    let hex = '';
    for (const b of d) hex += (b < 16 ? '0' : '') + b.toString(16);
    if (hex !== sha256) throw bad();
  }
}
function model(id) {
  if (modelP) return modelP;
  modelP = (async () => {
    const m = await manifest();
    const mod = await import(ORT_DIR + 'ort.wasm.min.mjs').catch(() => { throw new Error('The AI runtime could not be loaded. You may be offline — the first run needs the 14 MB runtime and the voice model, after which both are kept.'); });
    const ort = mod.default && mod.default.InferenceSession ? mod.default : mod;
    ort.env.wasm.wasmPaths = ORT_DIR;
    ort.env.wasm.numThreads = 1;
    /* the model is over the hosts' 25 MiB cap, so it ships as parts of at
       most 20 MiB (build/split-models.js), listed in the manifest */
    const entry = (m.files && m.files[m.model]) || {};
    const list = ((m.files && m.files[m.model] && m.files[m.model].parts) || [m.model]).map((p) => DIR + p);
    const chunks = [];
    let done = 0;
    for (const u of list) {
      const b = await fetchBytes(u, 0, (loaded) => post({ id, type: 'progress', stage: 'download', loaded: done + loaded, total: Math.max(m.modelBytes || 0, done + loaded) }));
      chunks.push(b); done += b.length;
    }
    const bytes = chunks.length === 1 ? chunks[0] : new Uint8Array(done);
    if (chunks.length > 1) { let o = 0; for (const c of chunks) { bytes.set(c, o); o += c.length; } }
    await checkBytes(bytes, m.modelBytes, entry.sha256);
    post({ id, type: 'progress', stage: 'compile', loaded: bytes.length, total: bytes.length });
    const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    const names = session.inputNames.slice();
    const find = (re, d) => names.find((n) => re.test(n)) || d;
    return { ort, session, m, names: { ids: find(/input_ids|tokens/, names[0]), style: find(/style/, 'style'), speed: find(/speed/, 'speed') }, out: session.outputNames[0] };
  })().catch((e) => { modelP = null; throw e; });
  return modelP;
}
async function g2p(accent) {
  if (!g2pLib) { await import('/engine/aivid-tts-g2p.js'); g2pLib = self.KokoroG2P; }
  if (!lexicons.has(accent)) {
    const p = (async () => {
      const m = await manifest();
      const L = m.lexicons[accent];
      if (!L) throw new Error('No dictionary for ' + accent + '.');
      const res = await fetch(DIR + L.file);
      if (!res.ok) throw new Error('The pronunciation dictionary could not be downloaded (HTTP ' + res.status + ').');
      return g2pLib.create(await res.json(), accent);
    })().catch((e) => { lexicons.delete(accent); throw e; });
    lexicons.set(accent, p);
  }
  return lexicons.get(accent);
}
function voice(idv) {
  if (!voices.has(idv)) {
    const p = (async () => {
      const m = await manifest();
      if (!m.voices.some((v) => v.id === idv)) throw new Error('Unknown voice ' + idv + '.');
      const b = await fetchBytes(DIR + 'voices/' + idv + '.bin');
      return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
    })().catch((e) => { voices.delete(idv); throw e; });
    voices.set(idv, p);
  }
  return voices.get(idv);
}

/** Sentences of the text, with where each starts, so captions can follow the words. */
function sentences(text) {
  /* a full stop ends a sentence only before a space, so ₹2.5 and 1234tools.com stay whole */
  const out = text.split(/(?<=[.!?…]["”')\]]*)\s+/).map((s) => s.trim()).filter(Boolean);
  return out.length ? out : [text.trim()];
}
/** Trim the near-silence the model leaves at both ends, keeping 40 ms either side. */
function trim(x, sr) {
  const th = 0.004, keep = Math.round(0.04 * sr);
  let a = 0, b = x.length - 1;
  while (a < b && Math.abs(x[a]) < th) a++;
  while (b > a && Math.abs(x[b]) < th) b--;
  return x.subarray(Math.max(0, a - keep), Math.min(x.length, b + keep + 1));
}

async function speak(id, text, voiceId, speed) {
  const [M, vec] = await Promise.all([model(id), voice(voiceId)]);
  const accent = M.m.voices.find((v) => v.id === voiceId).accent;
  const G = await g2p(accent);
  const sr = M.m.sampleRate, vocab = M.m.vocab;
  const parts = [];
  const info = [];
  let t = 0, phon = [];
  const list = sentences(String(text || ''));
  let done = 0;
  const pieces = list.map((s) => { const p = G.phonemize(s).phonemes; return { s, pieces: p ? G.split(p, MAX_PIECE) : [] }; });
  const of = pieces.reduce((n, x) => n + x.pieces.length, 0);
  for (const { s, pieces: ps } of pieces) {
    const start = t;
    for (const p of ps) {
      if (cancelled.has(id)) throw abortError();
      const ids = [0];
      for (const ch of p) { const k = vocab[ch]; if (k !== undefined) ids.push(k); }
      ids.push(0);
      const n = Math.min(Math.max(ids.length - 2, 0), 509);
      const feeds = {};
      feeds[M.names.ids] = new M.ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]);
      feeds[M.names.style] = new M.ort.Tensor('float32', vec.slice(n * 256, n * 256 + 256), [1, 256]);
      feeds[M.names.speed] = new M.ort.Tensor('float32', new Float32Array([speed || 1]), [1]);
      const out = await M.session.run(feeds);
      const wav = trim(out[M.out].data, sr);
      parts.push(wav.slice());
      t += wav.length / sr;
      phon.push(p);
      done++;
      post({ id, type: 'progress', stage: 'speak', done, of });
    }
    if (ps.length) {
      const gap = 0.12;   /* a breath between sentences */
      parts.push(new Float32Array(Math.round(gap * sr)));
      info.push({ text: s, start, end: t });
      t += gap;
    }
  }
  if (parts.length && info.length) { parts.pop(); t -= 0.12; }
  const len = parts.reduce((n, p) => n + p.length, 0);
  const samples = new Float32Array(len);
  let o = 0;
  for (const p of parts) { samples.set(p, o); o += p.length; }
  return { samples, sampleRate: sr, sentences: info, phonemes: phon.join(' ') };
}

self.onmessage = async (ev) => {
  const { id, cmd } = ev.data || {};
  if (cmd === 'cancel') { cancelled.add(id); return; }
  try {
    if (cmd === 'load') {
      const M = await model(id);
      post({ id, type: 'ready', inputs: M.session.inputNames.slice() });
    } else if (cmd === 'speak') {
      const r = await speak(id, ev.data.text, ev.data.voice, ev.data.speed);
      post({ id, type: 'audio', samples: r.samples, sampleRate: r.sampleRate, sentences: r.sentences, phonemes: r.phonemes }, [r.samples.buffer]);
    }
  } catch (e) {
    post({ id, type: 'error', message: (e && e.message) || String(e), name: e && e.name });
  } finally { cancelled.delete(id); }
};
