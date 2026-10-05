/**
 * Generated voice-over on the device: window.AIVidTTS.
 *
 * Kokoro-82M v1.0 (hexgrad, Apache-2.0), the 8-bit ONNX export (92 MB),
 * speaks English text in 28 voices — 20 American, 8 British — through ONNX
 * Runtime's WebAssembly build in a worker (engine/aivid-tts-worker.js), so
 * the page keeps moving while it works. Words become phonemes with misaki's
 * Apache-2.0 dictionaries and letter-to-sound rules (engine/aivid-tts-
 * g2p.js); no eSpeak NG or other GPL code is used. Model, voices and
 * dictionaries are served from this site under engine/models/kokoro-82m/,
 * fetched the first time a voice is asked for, and kept by the browser.
 * The text never leaves the device.
 *
 *   AIVidTTS.voices                  the catalogue (no download needed)
 *   AIVidTTS.load({ onProgress, signal })
 *   AIVidTTS.speak(text, { voice, speed, onProgress, signal })
 *     → { samples: Float32Array, sampleRate: 24000, duration, sentences:
 *         [{ text, start, end }], phonemes }
 *   AIVidTTS.LANGUAGES               language → label, for the picker's groups
 * Languages are a field on each voice, so another language arrives as more
 * rows here plus its dictionary — the picker groups by `lang` and `accent`.
 */
(function () {
  'use strict';
  const T = window.AIVidTTS = window.AIVidTTS || {};
  const WORKER = '/engine/aivid-tts-worker.js';
  const LANGUAGES = { en: 'English' };
  const ACCENTS = { 'en-us': 'American English', 'en-gb': 'British English' };
  /* engine/models/kokoro-82m/kokoro-82m.json, voice for voice (the browser test checks they agree) */
  const V = (id, name, gender, grade) => ({ id, name, gender: gender === 'F' ? 'female' : 'male', grade, lang: 'en', accent: id[0] === 'a' ? 'en-us' : 'en-gb' });
  const VOICES = [
    V('af_heart', 'Heart', 'F', 'A'), V('af_bella', 'Bella', 'F', 'A-'), V('af_nicole', 'Nicole', 'F', 'B-'),
    V('af_aoede', 'Aoede', 'F', 'C+'), V('af_kore', 'Kore', 'F', 'C+'), V('af_sarah', 'Sarah', 'F', 'C+'),
    V('af_alloy', 'Alloy', 'F', 'C'), V('af_nova', 'Nova', 'F', 'C'), V('af_sky', 'Sky', 'F', 'C-'),
    V('af_jessica', 'Jessica', 'F', 'D'), V('af_river', 'River', 'F', 'D'),
    V('am_fenrir', 'Fenrir', 'M', 'C+'), V('am_michael', 'Michael', 'M', 'C+'), V('am_puck', 'Puck', 'M', 'C+'),
    V('am_echo', 'Echo', 'M', 'D'), V('am_eric', 'Eric', 'M', 'D'), V('am_liam', 'Liam', 'M', 'D'),
    V('am_onyx', 'Onyx', 'M', 'D'), V('am_santa', 'Santa', 'M', 'D-'), V('am_adam', 'Adam', 'M', 'F+'),
    V('bf_emma', 'Emma', 'F', 'B-'), V('bf_isabella', 'Isabella', 'F', 'C'), V('bf_alice', 'Alice', 'F', 'D'), V('bf_lily', 'Lily', 'F', 'D'),
    V('bm_fable', 'Fable', 'M', 'C'), V('bm_george', 'George', 'M', 'C'), V('bm_lewis', 'Lewis', 'M', 'D+'), V('bm_daniel', 'Daniel', 'M', 'D')
  ];
  for (const v of VOICES) v.label = v.name + ' — ' + ACCENTS[v.accent] + ', ' + v.gender;
  /* what the first use downloads, for the page's copy (bytes; the dictionary as sent, gzip) */
  const BYTES = { model: 92361116, voice: 522240, dictionary: 1500000, runtime: 14239897 };

  let worker = null, seq = 0;
  const jobs = new Map();
  const abortError = () => { const e = new Error('Cancelled.'); e.name = 'AbortError'; return e; };
  function ensureWorker() {
    if (worker) return worker;
    if (typeof Worker === 'undefined') throw new Error('This browser cannot run the voice in the background (no Web Workers).');
    try { worker = new Worker(WORKER, { type: 'module' }); }
    catch (e) { throw new Error('This browser cannot start the voice worker. Try a current Chrome, Edge, Safari or Firefox.'); }
    worker.onmessage = (ev) => {
      const m = ev.data || {};
      const job = jobs.get(m.id);
      if (!job) return;
      if (m.type === 'progress') { if (job.onProgress) job.onProgress(m); return; }
      jobs.delete(m.id);
      if (m.type === 'error') { const e = new Error(m.message); if (m.name === 'AbortError') e.name = 'AbortError'; job.reject(e); }
      else job.resolve(m);
    };
    worker.onerror = (ev) => {
      const e = new Error('The voice worker stopped' + (ev && ev.message ? ': ' + ev.message : '.'));
      for (const j of jobs.values()) j.reject(e);
      jobs.clear();
      try { worker.terminate(); } catch (x) { /* gone */ }
      worker = null;
    };
    return worker;
  }
  function call(msg, o) {
    o = o || {};
    if (o.signal && o.signal.aborted) return Promise.reject(abortError());
    const w = ensureWorker();
    const id = ++seq;
    return new Promise((resolve, reject) => {
      jobs.set(id, { resolve, reject, onProgress: o.onProgress });
      if (o.signal) o.signal.addEventListener('abort', () => {
        if (!jobs.has(id)) return;
        jobs.delete(id);
        w.postMessage({ id, cmd: 'cancel' });
        reject(abortError());
      }, { once: true });
      w.postMessage(Object.assign({ id }, msg));
    });
  }
  let ready = false;
  function load(o) {
    return call({ cmd: 'load' }, o).then((m) => { ready = true; return m; });
  }
  async function speak(text, o) {
    o = o || {};
    const voice = o.voice || 'af_heart';
    if (!VOICES.some((v) => v.id === voice)) throw new Error('Unknown voice ' + voice + '.');
    const speed = Math.min(1.2, Math.max(0.8, Number(o.speed) || 1));
    const m = await call({ cmd: 'speak', text: String(text || ''), voice, speed }, o);
    ready = true;
    return { samples: m.samples, sampleRate: m.sampleRate, duration: m.samples.length / m.sampleRate, sentences: m.sentences, phonemes: m.phonemes };
  }
  /** Stop the worker and free the model (the downloaded files stay in the browser's cache). */
  function dispose() {
    for (const j of jobs.values()) j.reject(abortError());
    jobs.clear();
    if (worker) { try { worker.terminate(); } catch (e) { /* gone */ } worker = null; }
    ready = false;
  }
  Object.assign(T, { voices: VOICES, LANGUAGES, ACCENTS, BYTES, load, speak, dispose });
  Object.defineProperty(T, 'ready', { get: () => ready, configurable: true });
})();
