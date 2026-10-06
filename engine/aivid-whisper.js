/**
 * Whisper tiny in the browser: audio in, timed words out.
 *
 * Everything runs on the device through ONNX Runtime's WebAssembly build.
 * The model (engine/models/whisper-tiny/, 41 MB in three files, MIT) is
 * served from this site and kept by the browser; no third-party server is
 * contacted and the audio never leaves the page.
 *
 * The pipeline mirrors openai/whisper step for step — and is checked
 * against a Python reference, build/ai-video/prepare-whisper.py
 * --transcribe, on the same samples:
 *   decode the file → mono 16 kHz float → 30 s windows → 80-bin log-mel →
 *   encoder → (Auto-detect: the language token the decoder rates likeliest
 *   on the first window) → merged decoder with KV cache, greedy, Whisper's
 *   timestamp rules, prompted in the chosen language → segments with
 *   absolute times → words, timed by dynamic time warping over the
 *   decoder's cross-attention (openai/whisper timing.py), or by a
 *   proportional split when that is not available.
 *
 * The same file is also the Web Worker that computes the log-mel windows
 * and the word alignment, so neither holds the page's main thread: loaded
 * with `new Worker(this file)`, it answers 'mel' and 'align' messages and
 * does nothing else. When a worker cannot be started the same functions
 * run on the page.
 *
 * Exposed as window.AIVidWhisper and as AIImg.whisper when the shared
 * runtime is on the page.
 */
(function () {
  'use strict';
  const IS_WORKER = typeof window === 'undefined' && typeof self !== 'undefined' && typeof importScripts === 'function';
  const A = IS_WORKER ? null : (window.AIImg || null);
  const W = IS_WORKER ? {} : (window.AIVidWhisper = window.AIVidWhisper || {});
  if (A) A.whisper = W;
  /* this script's own URL, for starting it again as a worker */
  const SELF_URL = (!IS_WORKER && typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '/engine/aivid-whisper.js';

  const DIR = '/engine/models/whisper-tiny/';
  const ORT_DIR = '/engine/vendor/ort/';
  const SR = 16000, N_FFT = 400, HOP = 160, N_MELS = 80, N_SAMPLES = 480000, N_FRAMES = 3000, N_BINS = 201;
  const MAX_TOKENS = 224;
  const TIME_PRECISION = 0.02;
  const abortError = () => { const e = new Error('Cancelled.'); e.name = 'AbortError'; return e; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms || 0));

  /* ------------------------------------------------------------------ */
  /* the runtime and the sessions                                       */
  /* ------------------------------------------------------------------ */
  let ortLib = null;
  function runtime() {
    if (A && typeof A.runtime === 'function') return A.runtime();
    if (!ortLib) {
      ortLib = import(ORT_DIR + 'ort.wasm.min.mjs').then((m) => {
        const ort = m.default && m.default.InferenceSession ? m.default : m;
        ort.env.wasm.wasmPaths = ORT_DIR;
        /* Whisper decoding is hundreds of small runs; one thread is right
           for them, and the site is not cross-origin isolated anyway. */
        ort.env.wasm.numThreads = 1;
        return ort;
      }).catch(() => {
        ortLib = null;
        throw new Error('The AI runtime could not be loaded. You may be offline — the first run needs the 14 MB runtime and the 41 MB model, after which both are cached.');
      });
    }
    return ortLib;
  }

  /** Read one URL, or the parts of a sharded file, with progress. */
  async function fetchBytes(urls, bytes, onProgress) {
    const list = Array.isArray(urls) ? urls : [urls];
    const chunks = [];
    let got = 0;
    for (const u of list) {
      const res = await fetch(u);
      if (!res.ok) throw new Error('The model could not be downloaded (HTTP ' + res.status + ' for ' + u.split('/').pop() + ').');
      if (!res.body || !res.body.getReader) { const b = new Uint8Array(await res.arrayBuffer()); chunks.push(b); got += b.length; continue; }
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); got += value.length;
        if (onProgress) onProgress({ stage: 'download', loaded: got, total: Math.max(bytes || 0, got), fraction: Math.min(1, got / Math.max(bytes || got, got)) });
      }
    }
    if (chunks.length === 1) return chunks[0];
    const out = new Uint8Array(got);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }

  /** A model file from the manifest must be its full size and, where the
      browser can hash, its sha256: a file over 24 MiB arrives in parts
      (build/split-models.js) and a short part must not reach the runtime. */
  async function checkBytes(data, bytes, sha256) {
    const bad = () => new Error('The model download was incomplete or damaged. Reload the page to try again.');
    if (bytes && data.length !== bytes) throw bad();
    if (sha256 && typeof crypto !== 'undefined' && crypto.subtle) {
      const d = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
      let hex = '';
      for (const b of d) hex += (b < 16 ? '0' : '') + b.toString(16);
      if (hex !== sha256) throw bad();
    }
  }

  const sessions = new Map();
  /**
   * An ONNX session for a URL or a list of shard URLs, created once and
   * kept. Uses the shared loader when aiimg-core provides one, otherwise
   * does the same thing here.
   */
  function session(urlOrParts, bytes, onProgress, sha256) {
    const key = Array.isArray(urlOrParts) ? urlOrParts.join('|') : urlOrParts;
    if (sessions.has(key)) return sessions.get(key);
    const p = (async () => {
      /* the shared loader resolves { ort, session, bytes, url }; this file
         wants the session itself, as its own path below returns. Both
         check the joined parts' length and the manifest's sha256. */
      if (A && typeof A.loadSession === 'function') return A.loadSession(urlOrParts, { bytes, onProgress, sha256 }).then((s) => (s && s.session) ? s.session : s);
      const ort = await runtime();
      const data = await fetchBytes(urlOrParts, bytes, onProgress);
      await checkBytes(data, bytes, sha256);
      if (onProgress) onProgress({ stage: 'compile', fraction: 1 });
      return ort.InferenceSession.create(data, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    })().catch((e) => { sessions.delete(key); throw e; });
    sessions.set(key, p);
    return p;
  }

  /* ------------------------------------------------------------------ */
  /* the model: manifest, tokens, both sessions                         */
  /* ------------------------------------------------------------------ */
  let modelPromise = null;
  /**
   * Load everything once. onProgress gets { stage, fraction, loaded, total,
   * file } as the downloads advance (stage: 'manifest' | 'download' |
   * 'compile' | 'ready').
   */
  function load(onProgress) {
    if (modelPromise) return modelPromise;
    modelPromise = (async () => {
      const report = onProgress || (() => {});
      report({ stage: 'manifest', fraction: 0 });
      const res = await fetch(DIR + 'whisper-tiny.json');
      if (!res.ok) throw new Error('The model manifest could not be read (HTTP ' + res.status + ').');
      const m = await res.json();
      const files = m.files;
      const total = Object.values(files).reduce((s, f) => s + f.bytes, 0);
      const done = {};
      const prog = (name) => (p) => {
        done[name] = p.loaded !== undefined ? p.loaded : (p.fraction || 0) * files[name].bytes;
        const loaded = Object.values(done).reduce((s, v) => s + v, 0);
        report({ stage: p.stage === 'compile' ? 'compile' : 'download', file: name, loaded, total, fraction: Math.min(1, loaded / total) });
      };
      const urlsOf = (name) => files[name].parts.length === 1 ? DIR + files[name].parts[0] : files[name].parts.map((p) => DIR + p);
      const ortReady = (A && typeof A.runtime === 'function') ? A.runtime() : runtime();
      const [tokens, encoder, decoder] = await Promise.all([
        fetchBytes(urlsOf('tokens.json'), files['tokens.json'].bytes, prog('tokens.json')).then((b) => JSON.parse(new TextDecoder().decode(b))),
        ortReady.then(() => session(urlsOf('encoder_model_quantized.onnx'), files['encoder_model_quantized.onnx'].bytes, prog('encoder_model_quantized.onnx'), files['encoder_model_quantized.onnx'].sha256)),
        ortReady.then(() => session(urlsOf('decoder_model_merged_quantized.onnx'), files['decoder_model_merged_quantized.onnx'].bytes, prog('decoder_model_merged_quantized.onnx'), files['decoder_model_merged_quantized.onnx'].sha256))
      ]);
      const ort = await ortReady;
      const model = {
        ort, manifest: m, tokens, encoder, decoder,
        T: m.tokens, dims: m.dims, bytes: total,
        suppress: m.suppress_tokens, beginSuppress: m.begin_suppress_tokens,
        maxInitialTs: m.max_initial_timestamp_index === undefined ? 50 : m.max_initial_timestamp_index,
        /* the decoder's own names, read from the session, so the feed is built generically */
        decIn: decoder.inputNames.slice(), decOut: decoder.outputNames.slice()
      };
      model.pastNames = model.decIn.filter((n) => /^past_key_values\./.test(n));
      model.presentOf = (n) => 'present.' + n.slice('past_key_values.'.length);
      /* the language tokens, code → id ('en' → 50259) */
      model.langIds = {};
      for (const k in (m.lang_to_id || {})) model.langIds[k.replace(/^<\|/, '').replace(/\|>$/, '')] = m.lang_to_id[k];
      if (!model.langIds.en) model.langIds.en = m.tokens.en;
      /* the cross-attention outputs prepare-whisper.py adds, and the heads
         that follow the audio: without them words fall back to the split */
      const heads = (m.alignment_heads || []).filter((h) => model.decOut.indexOf('cross_attentions.' + h[0]) >= 0);
      model.alignHeads = heads.length && heads.length === (m.alignment_heads || []).length ? heads : null;
      report({ stage: 'ready', fraction: 1, loaded: total, total });
      return model;
    })().catch((e) => { modelPromise = null; throw e; });
    return modelPromise;
  }

  /* ------------------------------------------------------------------ */
  /* audio: file → mono 16 kHz                                          */
  /* ------------------------------------------------------------------ */
  /**
   * Decode a video or audio file with the browser's own decoder and
   * resample to 16 kHz mono. Returns { samples, duration, audioBuffer }
   * where audioBuffer is the full-rate buffer (at o.sampleRate when the
   * browser allows it), kept for muxing back into the exported video.
   */
  async function decodeAudio(file, o) {
    const data = await file.arrayBuffer();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('This browser cannot decode audio.');
    /* o.sampleRate asks for the kept buffer at that rate — 48 kHz is what
       the AAC and Opus encoders take when the clip is muxed back together */
    let ac = null;
    if (o && o.sampleRate) { try { ac = new Ctx({ sampleRate: o.sampleRate }); } catch (e) { ac = null; } }
    if (!ac) { try { ac = new Ctx(); } catch (e) { throw new Error('This browser cannot decode audio.'); } }
    let buffer;
    try {
      buffer = await new Promise((res, rej) => {
        const p = ac.decodeAudioData(data.slice(0), res, (e) => rej(e || new Error('decode failed')));
        if (p && p.then) p.then(res, rej);
      });
    } catch (e) {
      throw new Error('That file could not be decoded. It needs a sound track the browser can play — MP4, MOV, WebM, MP3, WAV, M4A or OGG.');
    } finally { try { ac.close(); } catch (e) { /* done */ } }
    if (!buffer || !buffer.length) throw new Error('That file has no sound track to caption.');
    const samples = await toMono16k(buffer);
    return { samples, duration: buffer.duration, audioBuffer: buffer, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels };
  }

  /** Mix to mono, then resample with an OfflineAudioContext; linear interpolation if that is refused. */
  async function toMono16k(buffer) {
    const n = buffer.length, ch = buffer.numberOfChannels;
    let mono;
    if (ch === 1) mono = buffer.getChannelData(0);
    else {
      mono = new Float32Array(n);
      for (let c = 0; c < ch; c++) { const d = buffer.getChannelData(c); for (let i = 0; i < n; i++) mono[i] += d[i]; }
      const g = 1 / ch; for (let i = 0; i < n; i++) mono[i] *= g;
    }
    if (buffer.sampleRate === SR) return mono.slice();
    const outLen = Math.round(n * SR / buffer.sampleRate);
    try {
      const oc = new OfflineAudioContext(1, outLen, SR);
      const src = oc.createBufferSource();
      const b = oc.createBuffer(1, n, buffer.sampleRate);
      b.copyToChannel(mono, 0);
      src.buffer = b; src.connect(oc.destination); src.start(0);
      const out = await oc.startRendering();
      return out.getChannelData(0).slice();
    } catch (e) {
      return resampleLinear(mono, buffer.sampleRate, SR);
    }
  }
  function resampleLinear(a, from, to) {
    if (from === to) return a.slice();
    const n = Math.round(a.length * to / from);
    const out = new Float32Array(n);
    const step = from / to;
    for (let k = 0; k < n; k++) {
      const pos = k * step;
      let i = Math.floor(pos); if (i > a.length - 1) i = a.length - 1;
      const f = pos - Math.floor(pos);
      const i1 = Math.min(i + 1, a.length - 1);
      out[k] = a[i] * (1 - f) + a[i1] * f;
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* log-mel spectrogram                                                */
  /* ------------------------------------------------------------------ */
  /* Slaney mel scale, as librosa's mel() with htk=False and norm='slaney'
     — the filterbank Whisper ships as mel_filters.npz, computed here
     instead of downloaded (2e-9 apart). */
  const hzToMel = (f) => {
    const fSp = 200 / 3, minLogHz = 1000, minLogMel = minLogHz / fSp, logstep = Math.log(6.4) / 27;
    return f >= minLogHz ? minLogMel + Math.log(f / minLogHz) / logstep : f / fSp;
  };
  const melToHz = (m) => {
    const fSp = 200 / 3, minLogHz = 1000, minLogMel = minLogHz / fSp, logstep = Math.log(6.4) / 27;
    return m >= minLogMel ? minLogHz * Math.exp(logstep * (m - minLogMel)) : fSp * m;
  };
  let filterCache = null;
  /** The 80 × 201 filterbank, row-major, built once. */
  function melFilters() {
    if (filterCache) return filterCache;
    const fftfreqs = new Float64Array(N_BINS);
    for (let i = 0; i < N_BINS; i++) fftfreqs[i] = (SR / 2) * i / (N_BINS - 1);
    const melF = new Float64Array(N_MELS + 2);
    const m0 = hzToMel(0), m1 = hzToMel(SR / 2);
    for (let i = 0; i < N_MELS + 2; i++) melF[i] = melToHz(m0 + (m1 - m0) * i / (N_MELS + 1));
    const w = new Float32Array(N_MELS * N_BINS);
    for (let i = 0; i < N_MELS; i++) {
      const enorm = 2 / (melF[i + 2] - melF[i]);
      const fd0 = melF[i + 1] - melF[i], fd1 = melF[i + 2] - melF[i + 1];
      for (let k = 0; k < N_BINS; k++) {
        const lower = -(melF[i] - fftfreqs[k]) / fd0;
        const upper = (melF[i + 2] - fftfreqs[k]) / fd1;
        const v = Math.max(0, Math.min(lower, upper));
        w[i * N_BINS + k] = v * enorm;
      }
    }
    /* for each mel row, the first and last bin that is non-zero: the
       filters are triangles, so the matrix is 94% zeros */
    const span = new Int32Array(N_MELS * 2);
    for (let i = 0; i < N_MELS; i++) {
      let a = -1, b = -1;
      for (let k = 0; k < N_BINS; k++) if (w[i * N_BINS + k] > 0) { if (a < 0) a = k; b = k; }
      span[i * 2] = a < 0 ? 0 : a; span[i * 2 + 1] = b < 0 ? -1 : b;
    }
    filterCache = { w, span };
    return filterCache;
  }

  /* A 400-point real DFT, computed directly from cosine and sine tables.
     400 is not a power of two, and padding to 512 would move the bins off
     the filterbank, so the honest O(n²) sum it is: 3,000 frames × 201 bins
     × 400 samples is a quarter of a second, well under the encoder. */
  let trig = null;
  function tables() {
    if (trig) return trig;
    const cos = new Float32Array(N_BINS * N_FFT), sin = new Float32Array(N_BINS * N_FFT);
    for (let k = 0; k < N_BINS; k++) for (let n = 0; n < N_FFT; n++) {
      const a = 2 * Math.PI * k * n / N_FFT;
      cos[k * N_FFT + n] = Math.cos(a); sin[k * N_FFT + n] = Math.sin(a);
    }
    const hann = new Float32Array(N_FFT);
    for (let n = 0; n < N_FFT; n++) hann[n] = 0.5 - 0.5 * Math.cos(2 * Math.PI * n / N_FFT);
    trig = { cos, sin, hann };
    return trig;
  }

  /**
   * The log-mel spectrogram of one 30 s window: 80 × 3000 floats, row-major,
   * exactly as WhisperFeatureExtractor computes it. `samples` is the 16 kHz
   * mono signal, `offset` the first sample of the window; a short last
   * window is padded with zeros.
   */
  function logMel(samples, offset) {
    offset = offset || 0;
    const { w, span } = melFilters();
    const { cos, sin, hann } = tables();
    /* the window, zero-padded, with 200 samples of reflection either side */
    const pad = N_FFT >> 1;
    const x = new Float32Array(N_SAMPLES + 2 * pad);
    const avail = Math.max(0, Math.min(N_SAMPLES, samples.length - offset));
    for (let i = 0; i < avail; i++) x[pad + i] = samples[offset + i];
    for (let i = 1; i <= pad; i++) { x[pad - i] = x[pad + i]; x[pad + N_SAMPLES - 1 + i] = x[pad + N_SAMPLES - 1 - i]; }
    const out = new Float32Array(N_MELS * N_FRAMES);
    const frame = new Float32Array(N_FFT);
    const power = new Float32Array(N_BINS);
    let max = -Infinity;
    for (let t = 0; t < N_FRAMES; t++) {
      const base = t * HOP;
      let silent = true;
      for (let n = 0; n < N_FFT; n++) { const v = x[base + n] * hann[n]; frame[n] = v; if (v !== 0) silent = false; }
      if (silent) {
        for (let m = 0; m < N_MELS; m++) { out[m * N_FRAMES + t] = -10; }
        if (-10 > max) max = -10;
        continue;
      }
      for (let k = 0; k < N_BINS; k++) {
        let re = 0, im = 0;
        const o = k * N_FFT;
        for (let n = 0; n < N_FFT; n++) { const v = frame[n]; re += v * cos[o + n]; im -= v * sin[o + n]; }
        power[k] = re * re + im * im;
      }
      for (let m = 0; m < N_MELS; m++) {
        let s = 0;
        const a = span[m * 2], b = span[m * 2 + 1], o = m * N_BINS;
        for (let k = a; k <= b; k++) s += w[o + k] * power[k];
        const v = Math.log10(s < 1e-10 ? 1e-10 : s);
        out[m * N_FRAMES + t] = v;
        if (v > max) max = v;
      }
    }
    const floor = max - 8;
    for (let i = 0; i < out.length; i++) { const v = out[i] < floor ? floor : out[i]; out[i] = (v + 4) / 4; }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* tokens → text (GPT-2 byte-level BPE, decoding only)                */
  /* ------------------------------------------------------------------ */
  let byteOf = null;
  function byteMap() {
    if (byteOf) return byteOf;
    /* bytes_to_unicode(): printable ranges keep their code point, the
       other 68 bytes are mapped to 256 upwards */
    const bs = [];
    for (let b = 33; b <= 126; b++) bs.push(b);
    for (let b = 161; b <= 172; b++) bs.push(b);
    for (let b = 174; b <= 255; b++) bs.push(b);
    const cs = bs.slice();
    let n = 0;
    for (let b = 0; b < 256; b++) if (bs.indexOf(b) < 0) { bs.push(b); cs.push(256 + n); n++; }
    byteOf = new Map();
    for (let i = 0; i < bs.length; i++) byteOf.set(String.fromCodePoint(cs[i]), bs[i]);
    return byteOf;
  }
  const utf8 = new TextDecoder('utf-8');
  const utf8Strict = new TextDecoder('utf-8', { fatal: true });
  /** The UTF-8 bytes of a run of token ids; special tokens (≥ n_text) are skipped. */
  function tokenBytes(model, ids) {
    const map = byteMap();
    const bytes = [];
    const nText = model.T.n_text;
    for (const id of ids) {
      if (id >= nText) continue;
      const s = model.tokens[id];
      if (!s) continue;
      for (const ch of s) { const b = map.get(ch); bytes.push(b === undefined ? 63 : b); }
    }
    return new Uint8Array(bytes);
  }
  /** The text of a run of token ids; special tokens (≥ n_text) are skipped. */
  function decodeTokens(model, ids) { return utf8.decode(tokenBytes(model, ids)); }

  /* ------------------------------------------------------------------ */
  /* decoding one window                                                */
  /* ------------------------------------------------------------------ */
  function pick(model, logits, sampled) {
    const T = model.T, TB = T.timestamp_begin, EOT = T.eot, n = logits.length;
    const NEG = -Infinity;
    if (sampled.length === 0) for (const t of model.beginSuppress) logits[t] = NEG;
    for (const t of model.suppress) logits[t] = NEG;
    logits[T.notimestamps] = NEG;
    const len = sampled.length;
    const lastTs = len >= 1 && sampled[len - 1] >= TB;
    const penTs = len < 2 || sampled[len - 2] >= TB;
    if (lastTs) {
      if (penTs) { for (let i = TB; i < n; i++) logits[i] = NEG; }
      else { for (let i = 0; i < EOT; i++) logits[i] = NEG; }
    }
    let lastTsTok = -1;
    for (let i = len - 1; i >= 0; i--) if (sampled[i] >= TB) { lastTsTok = sampled[i]; break; }
    if (lastTsTok >= 0) {
      const upto = (lastTs && !penTs) ? lastTsTok : lastTsTok + 1;
      for (let i = TB; i < upto; i++) logits[i] = NEG;
    }
    if (len === 0) {
      for (let i = 0; i < TB; i++) logits[i] = NEG;
      for (let i = TB + model.maxInitialTs + 1; i < n; i++) logits[i] = NEG;
    }
    /* if the timestamp tokens together are likelier than any one text token, take a timestamp */
    let mx = NEG;
    for (let i = 0; i < n; i++) if (logits[i] > mx) mx = logits[i];
    let sum = 0;
    for (let i = 0; i < n; i++) if (logits[i] > NEG) sum += Math.exp(logits[i] - mx);
    const lse = mx + Math.log(sum);
    let tsSum = 0, textMax = NEG;
    for (let i = TB; i < n; i++) if (logits[i] > NEG) tsSum += Math.exp(logits[i] - lse);
    for (let i = 0; i < TB; i++) if (logits[i] > textMax) textMax = logits[i];
    const tsLogprob = tsSum > 0 ? Math.log(tsSum) : NEG;
    if (tsLogprob > textMax - lse) for (let i = 0; i < TB; i++) logits[i] = NEG;
    let best = 0, bv = NEG;
    for (let i = 0; i < n; i++) if (logits[i] > bv) { bv = logits[i]; best = i; }
    return best;
  }

  /** The language token id for a code ('en', 'hi', …); English for anything unknown or missing. */
  function langToken(model, code) { return (code && model.langIds[code]) || model.T.en; }

  /** An empty KV cache and the first-step feed for a prompt. */
  function firstFeed(model, encoderOut, prompt) {
    const { ort, dims } = model;
    const feed = {};
    for (const name of model.pastNames) feed[name] = new ort.Tensor('float32', new Float32Array(0), [1, dims.heads, 0, dims.head_dim]);
    feed.encoder_hidden_states = encoderOut;
    feed.input_ids = new ort.Tensor('int64', BigInt64Array.from(prompt.map(BigInt)), [1, prompt.length]);
    feed.use_cache_branch = new ort.Tensor('bool', new Uint8Array([0]), [1]);
    return feed;
  }

  /**
   * Which language is spoken in this window: openai/whisper's
   * detect_language. One decoder step on <|startoftranscript|> alone; the
   * logits of every token but the 99 language tokens are dropped and the
   * rest soft-maxed. Returns { code, probability, ranked: [[code, p], …] }.
   */
  async function detectLanguage(model, encoderOut) {
    const out = await model.decoder.run(firstFeed(model, encoderOut, [model.T.sot]));
    const L = out.logits, vocab = L.dims[L.dims.length - 1], seq = L.dims[1];
    const row = L.data.subarray((seq - 1) * vocab, seq * vocab);
    const codes = Object.keys(model.langIds);
    let mx = -Infinity;
    for (const c of codes) mx = Math.max(mx, row[model.langIds[c]]);
    let sum = 0;
    const ex = codes.map((c) => { const e = Math.exp(row[model.langIds[c]] - mx); sum += e; return e; });
    const ranked = codes.map((c, i) => [c, ex[i] / sum]).sort((a, b) => b[1] - a[1]);
    return { code: ranked[0][0], probability: ranked[0][1], ranked: ranked.slice(0, 5) };
  }

  /**
   * Greedy decoding of one encoded window. Returns the sampled token ids
   * (prompt and <|endoftext|> excluded). o.language picks the language token
   * of the prompt (English when absent, as before). When o.attention is an
   * array and the decoder exposes its cross-attention, one Float32Array of
   * heads × 1500 is pushed for every token sampled and one more for the
   * <|endoftext|> step: the attention of the alignment heads at the query
   * that predicted that token.
   */
  async function decodeWindow(model, encoderOut, o) {
    const { ort, decoder, T } = model;
    const feed = firstFeed(model, encoderOut, [T.sot, langToken(model, o && o.language), T.transcribe]);
    const sampled = [];
    const maxTokens = o && o.maxTokens || MAX_TOKENS;
    const att = o && Array.isArray(o.attention) && model.alignHeads ? o.attention : null;
    let step = 0;
    for (;;) {
      if (o && o.signal && o.signal.aborted) throw abortError();
      const out = await decoder.run(feed);
      const L = out.logits;
      const vocab = L.dims[L.dims.length - 1];
      const seq = L.dims[1];
      const logits = Float32Array.from(L.data.subarray((seq - 1) * vocab, seq * vocab));
      if (att) {
        const H = model.alignHeads.length, row = new Float32Array(H * N_FRAMES / 2);
        model.alignHeads.forEach(([layer, head], k) => {
          const X = out['cross_attentions.' + layer];
          const n = X.dims[X.dims.length - 2], F = X.dims[X.dims.length - 1];
          const at = (head * n + (n - 1)) * F;
          row.set(X.data.subarray(at, at + Math.min(F, N_FRAMES / 2)), k * N_FRAMES / 2);
        });
        att.push(row);
      }
      for (const name of model.pastNames) {
        const pres = out[model.presentOf(name)];
        if (/\.decoder\./.test(name) || step === 0) {
          if (feed[name] && feed[name].dispose && feed[name] !== pres) { try { feed[name].dispose(); } catch (e) { /* fine */ } }
          feed[name] = pres;
        }
      }
      if (step === 0) feed.use_cache_branch = new ort.Tensor('bool', new Uint8Array([1]), [1]);
      step++;
      const next = pick(model, logits, sampled);
      if (next === T.eot || sampled.length >= maxTokens) break;
      sampled.push(next);
      /* four identical tokens in a row: the model is stuck; keep one and stop */
      const n = sampled.length;
      if (n >= 4 && sampled[n - 1] === sampled[n - 2] && sampled[n - 2] === sampled[n - 3] && sampled[n - 3] === sampled[n - 4]) { sampled.length = n - 3; break; }
      feed.input_ids = new ort.Tensor('int64', BigInt64Array.from([BigInt(next)]), [1, 1]);
      if (o && o.onToken) o.onToken(sampled.length);
      if ((step & 3) === 0) await sleep(0);
    }
    return sampled;
  }

  /** transcribe.py's rules: tokens → segments of this window, and how far to seek. */
  function segmentsFrom(model, tokens, offset, segDur) {
    const TB = model.T.timestamp_begin, EOT = model.T.eot;
    const isTs = tokens.map((t) => t >= TB);
    const n = tokens.length;
    const singleEnd = n >= 2 && !isTs[n - 2] && isTs[n - 1];
    const consecutive = [];
    for (let i = 0; i < n - 1; i++) if (isTs[i] && isTs[i + 1]) consecutive.push(i + 1);
    const segs = [];
    let adv;
    if (consecutive.length) {
      const slices = consecutive.slice();
      if (singleEnd) slices.push(n);
      let last = 0;
      for (const cur of slices) {
        const sl = tokens.slice(last, cur);
        segs.push({ start: offset + (sl[0] - TB) * TIME_PRECISION, end: offset + (sl[sl.length - 1] - TB) * TIME_PRECISION, tokens: sl.filter((t) => t < EOT) });
        last = cur;
      }
      adv = singleEnd ? segDur : (tokens[last - 1] - TB) * TIME_PRECISION;
    } else {
      let dur = segDur;
      const ts = tokens.filter((t) => t >= TB);
      if (ts.length && ts[ts.length - 1] !== TB) dur = (ts[ts.length - 1] - TB) * TIME_PRECISION;
      segs.push({ start: offset, end: offset + dur, tokens: tokens.filter((t) => t < EOT) });
      adv = segDur;
    }
    return { segs, adv: Math.max(adv, TIME_PRECISION) };
  }

  /* ------------------------------------------------------------------ */
  /* words                                                              */
  /* ------------------------------------------------------------------ */
  /* Languages written without spaces between words: the ones openai/whisper
     itself splits by character rather than by space (zh, ja, th, lo, my,
     yue), plus Khmer and Tibetan. */
  const NO_SPACE = new Set(['zh', 'ja', 'th', 'lo', 'my', 'yue', 'km', 'bo']);
  const NO_SPACE_SCRIPT = /[\u0E00-\u0EFF\u1000-\u109F\u1780-\u17FF\u0F00-\u0FFF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
  /** Is this text written without spaces between words? By language when it
      is one of those, otherwise by script: CJK, Thai, Lao, Burmese, Khmer or
      Tibetan letters with no space anywhere in the line. */
  function noSpace(lang, text) {
    if (lang && NO_SPACE.has(lang)) return true;
    const t = String(text || '').trim();
    return !!t && NO_SPACE_SCRIPT.test(t) && !/\s/.test(t);
  }

  /**
   * The words of a line, each { text, index } with index its offset in the
   * text. Spaced scripts split on white space, exactly as before. Chinese,
   * Japanese, Thai and the like have no spaces, so they are split by the
   * browser's own word segmenter (Intl.Segmenter, which uses a dictionary
   * for these languages); punctuation joins the word before it. A browser
   * without Intl.Segmenter gets one character per word.
   */
  function splitWords(text, lang) {
    text = String(text || '');
    const out = [];
    if (!noSpace(lang, text)) {
      const re = /\S+/g;
      let m;
      while ((m = re.exec(text))) out.push({ text: m[0], index: m.index });
      return out;
    }
    let pieces;
    const Seg = typeof Intl !== 'undefined' && Intl.Segmenter;
    if (Seg) {
      let sg;
      try { sg = new Seg(lang || undefined, { granularity: 'word' }); } catch (e) { sg = new Seg(undefined, { granularity: 'word' }); }
      pieces = Array.from(sg.segment(text), (s) => ({ text: s.segment, index: s.index, word: !!s.isWordLike }));
    } else {
      pieces = [];
      let i = 0;
      for (const ch of text) { pieces.push({ text: ch, index: i, word: /[\p{L}\p{N}]/u.test(ch) }); i += ch.length; }
    }
    const spans = [];
    let lead = -1;
    for (const p of pieces) {
      if (/^\s+$/.test(p.text)) continue;
      const end = p.index + p.text.length;
      if (p.word || !spans.length) {
        if (!p.word) { if (lead < 0) lead = p.index; continue; }
        spans.push({ index: lead >= 0 ? lead : p.index, end });
        lead = -1;
      } else spans[spans.length - 1].end = end;
    }
    if (lead >= 0) spans.push({ index: lead, end: text.trimEnd().length });
    for (const s of spans) out.push({ text: text.slice(s.index, s.end), index: s.index });
    return out;
  }

  /**
   * Split a segment into words and share its time out in proportion to
   * character length. The fallback when the aligned timings are not
   * available (an older model file) or a line has been edited into a
   * different number of words. o.lang (or seg.lang) picks the word
   * splitting for languages written without spaces.
   */
  function wordsFor(seg, o) {
    const text = String(seg.text || '').trim();
    if (!text) return [];
    const parts = splitWords(text, (o && o.lang) || seg.lang).map((w) => w.text);
    const weights = parts.map((p) => p.replace(/[^\p{L}\p{N}]/gu, '').length + 1);
    const total = weights.reduce((s, w) => s + w, 0) || 1;
    const dur = Math.max(0.05, seg.end - seg.start);
    const words = [];
    let t = seg.start;
    parts.forEach((p, i) => {
      const d = dur * weights[i] / total;
      words.push({ text: p, start: t, end: Math.min(seg.end, t + d) });
      t += d;
    });
    if (words.length) words[words.length - 1].end = seg.end;
    return words;
  }

  /**
   * Word alignment, as openai/whisper timing.py find_alignment does it.
   * rows holds N rows of H × 1500 attention weights (row r, alignment head
   * h, audio frame of 20 ms); nFrames is how many frames hold audio. Each
   * row is renormalised over those frames (the softmax restricted to them),
   * z-normalised across rows for each head and frame, median-filtered along
   * time (width 7, reflected at the edges), averaged over the heads; dynamic
   * time warping then finds the cheapest monotonic path through −matrix.
   * Returns, for every row, the first frame the path reaches it at.
   */
  function alignRows(rows, N, H, nFrames) {
    const S = N_FRAMES / 2;
    const F = Math.max(1, Math.min(S, nFrames | 0));
    const X = new Float32Array(H * N * F);
    for (let r = 0; r < N; r++) for (let h = 0; h < H; h++) {
      const src = (r * H + h) * S;
      let sum = 0;
      for (let f = 0; f < F; f++) sum += rows[src + f];
      const inv = sum > 0 ? 1 / sum : 0, dst = (h * N + r) * F;
      for (let f = 0; f < F; f++) X[dst + f] = rows[src + f] * inv;
    }
    for (let h = 0; h < H; h++) for (let f = 0; f < F; f++) {
      let m = 0;
      for (let r = 0; r < N; r++) m += X[(h * N + r) * F + f];
      m /= N;
      let v = 0;
      for (let r = 0; r < N; r++) { const d = X[(h * N + r) * F + f] - m; v += d * d; }
      const sd = Math.sqrt(v / N);
      for (let r = 0; r < N; r++) { const i = (h * N + r) * F + f; X[i] = sd > 0 ? (X[i] - m) / sd : 0; }
    }
    const M = new Float32Array(N * F);
    const PAD = 3, win = new Float32Array(7);
    for (let h = 0; h < H; h++) for (let r = 0; r < N; r++) {
      const base = (h * N + r) * F;
      for (let f = 0; f < F; f++) {
        let v;
        if (F <= PAD) v = X[base + f];
        else {
          for (let k = -PAD; k <= PAD; k++) { let i = f + k; if (i < 0) i = -i; else if (i >= F) i = 2 * (F - 1) - i; win[k + PAD] = X[base + i]; }
          for (let a = 1; a < 7; a++) { const x = win[a]; let b = a - 1; while (b >= 0 && win[b] > x) { win[b + 1] = win[b]; b--; } win[b + 1] = x; }
          v = win[PAD];
        }
        M[r * F + f] += v / H;
      }
    }
    /* dtw_cpu, with its strict comparisons and its trace edges */
    const W1 = F + 1;
    const C = new Float64Array((N + 1) * W1).fill(Infinity);
    const T = new Int8Array((N + 1) * W1);
    C[0] = 0;
    for (let j = 1; j <= F; j++) for (let i = 1; i <= N; i++) {
      const c0 = C[(i - 1) * W1 + j - 1], c1 = C[(i - 1) * W1 + j], c2 = C[i * W1 + j - 1];
      let c, t;
      if (c0 < c1 && c0 < c2) { c = c0; t = 0; } else if (c1 < c0 && c1 < c2) { c = c1; t = 1; } else { c = c2; t = 2; }
      C[i * W1 + j] = -M[(i - 1) * F + j - 1] + c;
      T[i * W1 + j] = t;
    }
    for (let j = 0; j <= F; j++) T[j] = 2;
    for (let i = 0; i <= N; i++) T[i * W1] = 1;
    const path = [];
    let i = N, j = F;
    while (i > 0 || j > 0) {
      path.push(i - 1, j - 1);
      const t = T[i * W1 + j];
      if (t === 0) { i--; j--; } else if (t === 1) i--; else j--;
    }
    const first = new Int32Array(N).fill(-1);
    for (let k = path.length - 2; k >= 0; k -= 2) { const r = path[k], f = path[k + 1]; if (r >= 0 && first[r] < 0) first[r] = Math.max(0, f); }
    for (let r = 0; r < N; r++) if (first[r] < 0) first[r] = r ? first[r - 1] : 0;
    return first;
  }

  /**
   * The words of one segment from its tokens' aligned start times. Tokens
   * are grouped into whole UTF-8 characters first (a CJK character or a
   * Devanagari conjunct can span two tokens), the text is split into words
   * as splitWords does, and each word starts where its first character's
   * token starts and ends where the token after its last character starts
   * (endTime for the last).
   */
  function timedWords(model, tokens, starts, endTime, lang) {
    const units = [];
    let cur = [], k0 = 0;
    for (let k = 0; k < tokens.length; k++) {
      if (!cur.length) k0 = k;
      cur.push(tokens[k]);
      const b = tokenBytes(model, cur);
      let s;
      try { s = utf8Strict.decode(b); } catch (e) { if (cur.length < 6 && k < tokens.length - 1) continue; s = utf8.decode(b); }
      units.push({ text: s, start: starts[k0], end: k + 1 < tokens.length ? starts[k + 1] : endTime });
      cur = [];
    }
    const full = units.map((u) => u.text).join('');
    if (!full.trim()) return [];
    const unitAt = new Int32Array(full.length);
    let p = 0;
    units.forEach((u, n) => { for (let c = 0; c < u.text.length; c++) unitAt[p++] = n; });
    const lead = full.length - full.replace(/^\s+/, '').length;
    return splitWords(full.trim(), lang).map((w) => {
      const a = lead + w.index, b = lead + w.index + w.text.length - 1;
      return { text: w.text, start: units[unitAt[a]].start, end: units[unitAt[Math.max(a, b)]].end };
    });
  }

  /** openai/whisper's clean-ups of aligned words: a word longer than twice
      the median word (median at most 0.7 s) is cut back when it ends a
      sentence, starts one, or opens or closes the segment — that time is a
      pause, not the word; then no word starts before the one before it ends,
      and none is shorter than 20 ms. */
  function tidyWords(words) {
    const SENT = /[.。!！?？]["”’)」』]?$/;
    const d = words.map((w) => w.end - w.start).filter((x) => x > 0).sort((a, b) => a - b);
    if (d.length) {
      const max = 2 * Math.min(0.7, d[d.length >> 1]);
      words.forEach((w, i) => {
        if (w.end - w.start <= max) return;
        if (SENT.test(w.text) || i === words.length - 1) w.end = w.start + max;
        else if (i === 0 || SENT.test(words[i - 1].text)) w.start = w.end - max;
      });
    }
    let prev = -Infinity;
    for (const w of words) {
      if (w.start < prev) w.start = prev;
      if (w.end < w.start + 0.02) w.end = w.start + 0.02;
      prev = w.end;
    }
    return words;
  }

  /* ------------------------------------------------------------------ */
  /* telling when the model has failed                                  */
  /* ------------------------------------------------------------------ */
  /* The script a language is written in, for the languages whose script is
     not Latin: a window of text mostly outside it was not written in that
     language (Whisper tiny writes Hindi speech in English, for instance). */
  const SCRIPTS = {
    hi: /\p{Script=Devanagari}/u, mr: /\p{Script=Devanagari}/u, ne: /\p{Script=Devanagari}/u, bn: /\p{Script=Bengali}/u, as: /\p{Script=Bengali}/u,
    ar: /\p{Script=Arabic}/u, ur: /\p{Script=Arabic}/u, fa: /\p{Script=Arabic}/u, ps: /\p{Script=Arabic}/u, sd: /\p{Script=Arabic}/u,
    he: /\p{Script=Hebrew}/u, yi: /\p{Script=Hebrew}/u, zh: /\p{Script=Han}/u, yue: /\p{Script=Han}/u, ja: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
    ko: /\p{Script=Hangul}/u, ru: /\p{Script=Cyrillic}/u, uk: /\p{Script=Cyrillic}/u, be: /\p{Script=Cyrillic}/u, bg: /\p{Script=Cyrillic}/u,
    sr: /\p{Script=Cyrillic}/u, mk: /\p{Script=Cyrillic}/u, kk: /\p{Script=Cyrillic}/u, el: /\p{Script=Greek}/u, th: /\p{Script=Thai}/u,
    ta: /\p{Script=Tamil}/u, te: /\p{Script=Telugu}/u, kn: /\p{Script=Kannada}/u, ml: /\p{Script=Malayalam}/u, gu: /\p{Script=Gujarati}/u,
    pa: /\p{Script=Gurmukhi}/u, si: /\p{Script=Sinhala}/u, my: /\p{Script=Myanmar}/u, km: /\p{Script=Khmer}/u, lo: /\p{Script=Lao}/u,
    ka: /\p{Script=Georgian}/u, hy: /\p{Script=Armenian}/u, am: /\p{Script=Ethiopic}/u, bo: /\p{Script=Tibetan}/u
  };
  /** The share of a text's letters written in the language's own script (1 for Latin-script languages and unknown codes). */
  function scriptShare(text, lang) {
    const re = SCRIPTS[lang];
    if (!re) return 1;
    const letters = Array.from(String(text || '')).filter((c) => /\p{L}/u.test(c));
    return letters.length ? letters.filter((c) => re.test(c)).length / letters.length : 1;
  }
  /** openai/whisper's compression-ratio test for a decoder stuck in a loop: UTF-8 length over deflated length (above 2.4 is a loop). 0 when the browser cannot compress. */
  async function compressionRatio(text) {
    if (typeof CompressionStream === 'undefined' || !text) return 0;
    try {
      const bytes = new TextEncoder().encode(text);
      const out = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer();
      return bytes.length / Math.max(1, out.byteLength);
    } catch (e) { return 0; }
  }

  /* ------------------------------------------------------------------ */
  /* the worker: log-mel and alignment off the main thread              */
  /* ------------------------------------------------------------------ */
  let worker = null, workerBroken = false, seq = 0;
  const pending = new Map();
  function getWorker() {
    if (IS_WORKER || workerBroken || typeof Worker === 'undefined') return null;
    if (worker) return worker;
    try { worker = new Worker(SELF_URL); } catch (e) { workerBroken = true; return null; }
    worker.onmessage = (e) => {
      const d = e.data || {}, p = pending.get(d.id);
      if (!p) return;
      pending.delete(d.id);
      if (d.error) p.reject(new Error(d.error)); else p.resolve(d);
    };
    /* a worker that cannot start (or dies) hands its jobs back to the page */
    worker.onerror = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      workerBroken = true;
      try { worker.terminate(); } catch (x) { /* gone */ }
      worker = null;
      const jobs = [...pending.values()]; pending.clear();
      for (const p of jobs) p.fallback();
    };
    return worker;
  }
  /** Run msg in the worker; `local` computes the same thing here when there is no worker. */
  function inWorker(msg, local) {
    const w = getWorker();
    if (!w) return sleep(0).then(local);
    return new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject, fallback: () => { try { resolve(local()); } catch (e) { reject(e); } } });
      w.postMessage(Object.assign({ id }, msg));
    });
  }
  /** The log-mel of the window at `offset`, computed in the worker. */
  function melOf(samples, offset) {
    return inWorker({ op: 'mel', samples: samples.slice(offset, Math.min(samples.length, offset + N_SAMPLES)) }, () => ({ mel: logMel(samples, offset) })).then((r) => r.mel);
  }
  /** alignRows in the worker. */
  function alignOf(rows, N, H, nFrames) {
    return inWorker({ op: 'align', rows, n: N, h: H, frames: nFrames }, () => ({ first: alignRows(rows, N, H, nFrames) })).then((r) => r.first);
  }

  /* ------------------------------------------------------------------ */
  /* the whole thing                                                    */
  /* ------------------------------------------------------------------ */
  /**
   * Transcribe 16 kHz mono samples. o.onProgress({ fraction, seconds,
   * total, eta, window }) as windows finish; o.onSegment(seg) as each
   * segment arrives; o.signal to cancel. o.language is a Whisper language
   * code ('en', 'hi', 'zh', …), 'auto' to detect it on the first 30 s, or
   * absent for English (as before); o.onLanguage(detection) reports what
   * was detected. o.wordTimestamps: false skips the alignment. Returns
   * { segments, words, windows, seconds, elapsed, language, detection,
   * timing } — timing 'aligned' when the words were placed by the
   * cross-attention alignment, 'proportional' when split by length.
   * Each segment carries lang and timing too.
   */
  async function transcribe(samples, o) {
    o = o || {};
    const model = await load(o.onLoad);
    const { ort } = model;
    const total = samples.length / SR;
    const report = o.onProgress || (() => {});
    const t0 = performance.now();
    const segments = [];
    const align = o.wordTimestamps !== false && !!model.alignHeads;
    const EOT = model.T.eot;
    let language = o.language === 'auto' ? null : (o.language && model.langIds[o.language] ? o.language : 'en');
    let detection = null;
    const issues = [];
    let seek = 0, windows = 0;
    while (seek < total - 0.05) {
      if (o.signal && o.signal.aborted) throw abortError();
      const offset = Math.round(seek * SR);
      const avail = Math.min(N_SAMPLES, samples.length - offset);
      const segDur = Math.min(30, avail / SR);
      report({ fraction: seek / total, seconds: seek, total, window: windows, stage: 'mel' });
      const mel = await melOf(samples, offset);
      if (o.signal && o.signal.aborted) throw abortError();
      report({ fraction: seek / total, seconds: seek, total, window: windows, stage: 'encode' });
      await sleep(0);
      const encOut = await model.encoder.run({ input_features: new ort.Tensor('float32', mel, [1, N_MELS, N_FRAMES]) });
      const hidden = encOut[model.encoder.outputNames[0]];
      if (!language) {
        report({ fraction: seek / total, seconds: seek, total, window: windows, stage: 'detect' });
        detection = await detectLanguage(model, hidden);
        language = detection.code;
        if (o.onLanguage) o.onLanguage(detection);
      }
      report({ fraction: seek / total, seconds: seek, total, window: windows, stage: 'decode' });
      const attention = align ? [] : null;
      const tokens = await decodeWindow(model, hidden, { signal: o.signal, language, attention, onToken: (k) => report({ fraction: seek / total, seconds: seek, total, window: windows, stage: 'decode', tokens: k }) });
      try { hidden.dispose && hidden.dispose(); } catch (e) { /* fine */ }
      const { segs, adv } = segmentsFrom(model, tokens, seek, segDur);
      /* one alignment for all the text tokens of the window, plus the row
         that predicted whatever followed the last of them */
      let times = null;
      const textIdx = [];
      tokens.forEach((t, k) => { if (t < EOT) textIdx.push(k); });
      if (attention && textIdx.length && textIdx[textIdx.length - 1] + 1 < attention.length) {
        const H = model.alignHeads.length, S = N_FRAMES / 2, N = textIdx.length + 1;
        const rows = new Float32Array(N * H * S);
        textIdx.concat([textIdx[textIdx.length - 1] + 1]).forEach((k, r) => rows.set(attention[k], r * H * S));
        report({ fraction: seek / total, seconds: seek, total, window: windows, stage: 'align' });
        const first = await alignOf(rows, N, H, Math.ceil(segDur * 50));
        times = Array.from(first, (f) => seek + f * TIME_PRECISION);
      }
      /* say so when the model has visibly failed on this window: bytes that
         are not text, a loop, or the wrong script for the language */
      const winText = decodeTokens(model, textIdx.map((k) => tokens[k]));
      if (winText.trim()) {
        const kind = /\uFFFD/.test(winText) ? 'garbled' : (await compressionRatio(winText)) > 2.4 ? 'repetitive' : scriptShare(winText, language) < 0.5 ? 'script' : null;
        if (kind) issues.push({ start: seek, end: Math.min(total, seek + segDur), kind });
      }
      let c = 0;
      for (const s of segs) {
        const n = s.tokens.length, from = c;
        c += n;
        /* a token that is half a character decodes to U+FFFD: never show it */
        s.text = decodeTokens(model, s.tokens).replace(/\uFFFD+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        s.end = Math.min(s.end, total);
        s.lang = language;
        if (!s.text || s.end <= s.start) continue;
        let words = null;
        if (times) {
          words = tidyWords(timedWords(model, s.tokens, times.slice(from, from + n), times[from + n], language));
          for (const w of words) { w.start = Math.min(w.start, total); w.end = Math.min(w.end, total); }
          for (const w of words) w.text = w.text.replace(/\uFFFD+/g, '');
          words = words.filter((w) => w.text && w.end > w.start);
        }
        if (words && words.length) {
          s.words = words; s.timing = 'aligned';
          s.start = words[0].start; s.end = words[words.length - 1].end;
        } else { s.words = wordsFor(s); s.timing = 'proportional'; }
        segments.push(s);
        if (o.onSegment) o.onSegment(s);
      }
      seek += adv;
      windows++;
      const elapsed = (performance.now() - t0) / 1000;
      const done = Math.min(seek, total);
      report({ fraction: done / total, seconds: done, total, window: windows, elapsed, eta: done > 0 ? elapsed * (total - done) / done : null, stage: 'window' });
    }
    return {
      segments, words: segments.flatMap((s) => s.words), windows, seconds: total, elapsed: (performance.now() - t0) / 1000,
      language: language || 'en', detection, timing: align ? 'aligned' : 'proportional', issues
    };
  }

  if (IS_WORKER) {
    self.onmessage = (e) => {
      const d = e.data || {};
      try {
        if (d.op === 'mel') { const mel = logMel(d.samples, 0); self.postMessage({ id: d.id, mel }, [mel.buffer]); }
        else if (d.op === 'align') { const first = alignRows(d.rows, d.n, d.h, d.frames); self.postMessage({ id: d.id, first }, [first.buffer]); }
        else self.postMessage({ id: d.id, error: 'unknown request' });
      } catch (err) { self.postMessage({ id: d.id, error: String((err && err.message) || err) }); }
    };
    return;
  }

  Object.assign(W, {
    SR, N_FFT, HOP, N_MELS, N_SAMPLES, N_FRAMES, DIR,
    runtime, session, fetchBytes, load, decodeAudio, toMono16k, resampleLinear,
    melFilters, logMel, decodeTokens, decodeWindow, segmentsFrom, wordsFor, transcribe,
    detectLanguage, alignRows, timedWords, tidyWords, splitWords, noSpace, NO_SPACE, scriptShare, compressionRatio
  });
})();
