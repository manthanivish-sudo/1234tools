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
 *   encoder → merged decoder with KV cache, greedy, Whisper's timestamp
 *   rules → segments with absolute times → words, by proportional split.
 *
 * Exposed as window.AIVidWhisper and as AIImg.whisper when the shared
 * runtime is on the page.
 */
(function () {
  'use strict';
  const A = window.AIImg || null;
  const W = window.AIVidWhisper = window.AIVidWhisper || {};
  if (A) A.whisper = W;

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
  /** The text of a run of token ids; special tokens (≥ n_text) are skipped. */
  function decodeTokens(model, ids) {
    const map = byteMap();
    const bytes = [];
    const nText = model.T.n_text;
    for (const id of ids) {
      if (id >= nText) continue;
      const s = model.tokens[id];
      if (!s) continue;
      for (const ch of s) { const b = map.get(ch); bytes.push(b === undefined ? 63 : b); }
    }
    return utf8.decode(new Uint8Array(bytes));
  }

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

  /** Greedy decoding of one encoded window. Returns the sampled token ids (prompt and <|endoftext|> excluded). */
  async function decodeWindow(model, encoderOut, o) {
    const { ort, decoder, T, dims } = model;
    const heads = dims.heads, hd = dims.head_dim;
    const feed = {};
    for (const name of model.pastNames) feed[name] = new ort.Tensor('float32', new Float32Array(0), [1, heads, 0, hd]);
    feed.encoder_hidden_states = encoderOut;
    feed.input_ids = new ort.Tensor('int64', BigInt64Array.from([T.sot, T.en, T.transcribe].map(BigInt)), [1, 3]);
    feed.use_cache_branch = new ort.Tensor('bool', new Uint8Array([0]), [1]);
    const sampled = [];
    const maxTokens = o && o.maxTokens || MAX_TOKENS;
    let step = 0;
    for (;;) {
      if (o && o.signal && o.signal.aborted) throw abortError();
      const out = await decoder.run(feed);
      const L = out.logits;
      const vocab = L.dims[L.dims.length - 1];
      const seq = L.dims[1];
      const logits = Float32Array.from(L.data.subarray((seq - 1) * vocab, seq * vocab));
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
  /**
   * Split a segment into words and share its time out in proportion to
   * character length. Approximate — Whisper tiny does not give word
   * timings directly, and this version does not run the cross-attention
   * alignment — but for karaoke-style captions, where a word is on
   * screen for a few hundred milliseconds, it lands close enough.
   */
  function wordsFor(seg) {
    const text = String(seg.text || '').trim();
    if (!text) return [];
    const parts = text.split(/\s+/).filter(Boolean);
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

  /* ------------------------------------------------------------------ */
  /* the whole thing                                                    */
  /* ------------------------------------------------------------------ */
  /**
   * Transcribe 16 kHz mono samples. o.onProgress({ fraction, seconds,
   * total, eta, window }) as windows finish; o.onSegment(seg) as each
   * segment arrives; o.signal to cancel. Returns { segments, words,
   * windows, seconds, elapsed }.
   */
  async function transcribe(samples, o) {
    o = o || {};
    const model = await load(o.onLoad);
    const { ort } = model;
    const total = samples.length / SR;
    const report = o.onProgress || (() => {});
    const t0 = performance.now();
    const segments = [];
    let seek = 0, windows = 0;
    while (seek < total - 0.05) {
      if (o.signal && o.signal.aborted) throw abortError();
      const offset = Math.round(seek * SR);
      const avail = Math.min(N_SAMPLES, samples.length - offset);
      const segDur = Math.min(30, avail / SR);
      report({ fraction: seek / total, seconds: seek, total, window: windows, stage: 'mel' });
      await sleep(0);
      const mel = logMel(samples, offset);
      if (o.signal && o.signal.aborted) throw abortError();
      report({ fraction: seek / total, seconds: seek, total, window: windows, stage: 'encode' });
      await sleep(0);
      const encOut = await model.encoder.run({ input_features: new ort.Tensor('float32', mel, [1, N_MELS, N_FRAMES]) });
      const hidden = encOut[model.encoder.outputNames[0]];
      report({ fraction: seek / total, seconds: seek, total, window: windows, stage: 'decode' });
      const tokens = await decodeWindow(model, hidden, { signal: o.signal, onToken: (k) => report({ fraction: seek / total, seconds: seek, total, window: windows, stage: 'decode', tokens: k }) });
      try { hidden.dispose && hidden.dispose(); } catch (e) { /* fine */ }
      const { segs, adv } = segmentsFrom(model, tokens, seek, segDur);
      for (const s of segs) {
        s.text = decodeTokens(model, s.tokens).trim();
        s.end = Math.min(s.end, total);
        if (!s.text || s.end <= s.start) continue;
        s.words = wordsFor(s);
        segments.push(s);
        if (o.onSegment) o.onSegment(s);
      }
      seek += adv;
      windows++;
      const elapsed = (performance.now() - t0) / 1000;
      const done = Math.min(seek, total);
      report({ fraction: done / total, seconds: done, total, window: windows, elapsed, eta: done > 0 ? elapsed * (total - done) / done : null, stage: 'window' });
    }
    return { segments, words: segments.flatMap((s) => s.words), windows, seconds: total, elapsed: (performance.now() - t0) / 1000 };
  }

  Object.assign(W, {
    SR, N_FFT, HOP, N_MELS, N_SAMPLES, N_FRAMES, DIR,
    runtime, session, fetchBytes, load, decodeAudio, toMono16k, resampleLinear,
    melFilters, logMel, decodeTokens, decodeWindow, segmentsFrom, wordsFor, transcribe
  });
})();
