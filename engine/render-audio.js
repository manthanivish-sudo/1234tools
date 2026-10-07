/**
 * Audio Tools — the shared runtime (window.AudioKit) for /audio/.
 *
 * Built on VideoKit (engine/render-video.js) for the page parts (the drop
 * zone, the job bar with Cancel, result rows, remembered settings, the trim
 * bar) and its encoders (Ogg Opus pages, AAC through WebCodecs into an M4A,
 * the resampler), with engine/audio-dsp.js for the sound itself, run in
 * engine/audio-worker.js when a job is long.
 *
 *   decodeFile(file)          → { buffer (AudioBuffer at the file's own
 *                               rate where its header names one), rate,
 *                               channels, duration, format, name }
 *   planesOf(buffer)          copies of each channel (Float32Array)
 *   encode(planes, rate, fmt, o) → { blob, note }  fmt: 'wav' | 'opus' | 'm4a'
 *   dsp(op, planes, rate, args, onProgress) → the worker's answer
 *   waveform(canvas)          a drawable waveform with a selection
 *
 * Nothing leaves the page: files are read with the browser's own decoder
 * and every file made is assembled here.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit, DSP = window.AudioDSP;
  if (!A || !VK || !DSP) return;
  const { el, clamp, select, field, fmtBytes } = A;
  const AK = window.AudioKit = window.AudioKit || {};

  const MAX_BYTES = 400 * 1048576;
  const MAX_SECONDS = 3 * 3600;
  const FORMATS = [['wav', 'WAV (uncompressed)'], ['m4a', 'M4A (AAC)'], ['opus', 'Opus (.ogg)']];
  const BITRATES = { m4a: [['128', '128 kbit/s'], ['192', '192 kbit/s'], ['160', '160 kbit/s'], ['96', '96 kbit/s']], opus: [['96', '96 kbit/s'], ['128', '128 kbit/s'], ['64', '64 kbit/s (speech)'], ['32', '32 kbit/s (voice notes)']] };

  /* ------------------------------------------------------------------ */
  /* reading                                                            */
  /* ------------------------------------------------------------------ */
  /** The rate (and format) a file's header states: WAV, FLAC, MP3 and Ogg here; MP4, M4A and WebM through the demuxer. */
  async function sniff(file) {
    const head = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
    const s = DSP.sniffRate(head);
    if (s && s.rate) return s;
    try {
      const m = await window.VideoDemux.open(window.VideoDemux.fileReader(file));
      const a = m.tracks.find((t) => t.kind === 'audio');
      if (a) return { format: m.container === 'mp4' ? 'm4a' : m.container, rate: a.sampleRate, channels: a.channels, codec: a.codec, video: m.tracks.some((t) => t.kind === 'video') };
      return { format: m.container, rate: 0, noAudio: true };
    } catch (e) { return s || null; }
  }
  /** Decode a whole file with the browser's own decoder, at the rate its header names (so nothing is resampled). */
  async function decodeFile(file, o) {
    o = o || {};
    if (file.size > MAX_BYTES) throw new Error('this file is ' + fmtBytes(file.size) + '; the audio tools take files up to 400 MB.');
    const sn = await sniff(file);
    if (sn && sn.noAudio) throw new Error('there is no sound in this file.');
    const rate = sn && sn.rate >= 8000 && sn.rate <= 384000 ? sn.rate : 48000;
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Ctx) throw new Error('this browser cannot decode sound on the device.');
    const data = await file.arrayBuffer();
    if (o.signal && o.signal.aborted) throw VK.abortError();
    let buffer;
    try {
      const ctx = new Ctx(2, 1, rate);
      buffer = await new Promise((res, rej) => { const p = ctx.decodeAudioData(data, res, (e) => rej(e || new Error('decode failed'))); if (p && p.then) p.then(res, rej); });
    } catch (e) {
      throw new Error('this browser could not decode it' + (sn && sn.format ? ' (' + String(sn.format).toUpperCase() + ')' : '') + '. MP3, WAV, M4A, FLAC, Ogg and WebM sound files, and videos with sound, are what browsers decode.');
    }
    if (!buffer || !buffer.length) throw new Error('there is no sound in this file.');
    if (buffer.duration > MAX_SECONDS) throw new Error('it lasts ' + VK.fmtT(buffer.duration, 0) + '; the audio tools take up to 3 hours.');
    return { buffer, rate: buffer.sampleRate, channels: buffer.numberOfChannels, duration: buffer.duration, format: sn ? sn.format : '', codec: sn && sn.codec, name: VK.baseName(file.name), fullName: file.name, size: file.size, file };
  }
  function planesOf(buffer, channels) {
    const out = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) out.push(buffer.getChannelData(c).slice());
    return channels ? VK.mixTo(out, channels) : out;
  }
  const describe = (s) => VK.fmtT(s.duration, 2) + ', ' + (s.rate / 1000) + ' kHz, ' + (s.channels === 1 ? 'mono' : s.channels === 2 ? 'stereo' : s.channels + ' channels') + (s.format ? ', ' + String(s.format).toUpperCase() : '') + ', ' + fmtBytes(s.size);

  /* ------------------------------------------------------------------ */
  /* writing                                                            */
  /* ------------------------------------------------------------------ */
  /** Planes as blocks of about a second, resampled to `to` on the way when it differs from `rate`. */
  async function* blocksOf(planes, rate, to, signal) {
    const n = planes[0].length, STEP = rate;
    const rs = to && to !== rate ? VK.Resampler(rate, to, planes.length) : null;
    let made = 0;
    for (let i = 0; i < n; i += STEP) {
      if (signal && signal.aborted) throw VK.abortError();
      let p = planes.map((x) => x.subarray(i, Math.min(n, i + STEP)));
      if (rs) p = rs.push(p);
      if (p[0].length) { yield { planes: p, t: made / (to || rate) }; made += p[0].length; }
    }
    if (rs) { const tail = rs.flush(); if (tail[0].length) yield { planes: tail, t: made / to }; }
  }
  /** 16-bit PCM WAV, with a LIST/INFO chunk when o.tags is given ({ INAM, ICMT, ISFT, … }, four-letter keys). */
  function wav(planes, rate, tags) {
    const ch = planes.length, n = planes[0].length;
    const enc = new TextEncoder();
    let list = null;
    if (tags && Object.keys(tags).length) {
      const items = Object.entries(tags).map(([k, v]) => { const b = enc.encode(String(v) + '\0'); const pad = b.length & 1; const u = new Uint8Array(8 + b.length + pad); u.set(enc.encode(k.slice(0, 4)), 0); new DataView(u.buffer).setUint32(4, b.length, true); u.set(b, 8); return u; });
      const size = 4 + items.reduce((s, u) => s + u.length, 0);
      list = new Uint8Array(8 + size);
      list.set(enc.encode('LIST'), 0); new DataView(list.buffer).setUint32(4, size, true); list.set(enc.encode('INFO'), 8);
      let o = 12; for (const u of items) { list.set(u, o); o += u.length; }
    }
    const dataBytes = n * ch * 2;
    const h = new DataView(new ArrayBuffer(44));
    const str = (o, s) => { for (let i = 0; i < 4; i++) h.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); h.setUint32(4, 36 + dataBytes + (list ? list.length : 0), true); str(8, 'WAVE');
    str(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, ch, true);
    h.setUint32(24, rate, true); h.setUint32(28, rate * ch * 2, true); h.setUint16(32, ch * 2, true); h.setUint16(34, 16, true);
    str(36, 'data'); h.setUint32(40, dataBytes, true);
    const pcm = new Int16Array(n * ch);
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = clamp(planes[c][i], -1, 1); pcm[i * ch + c] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767); }
    /* the LIST chunk goes after the samples, where every reader that ignores it still finds 'data' at once */
    return new Blob([h.buffer, pcm.buffer].concat(list ? [list] : []), { type: 'audio/wav' });
  }
  /**
   * planes at `rate` → a file. fmt 'wav' (16-bit, the same rate), 'opus'
   * (Ogg, 48 kHz, o.bitrate kbit/s), 'm4a' (AAC, 44.1 or 48 kHz). Returns
   * { blob, note, rate, channels }.
   */
  async function encode(planes, rate, fmt, o) {
    o = o || {};
    const ch = Math.min(2, planes.length);
    if (planes.length > 2) planes = VK.mixTo(planes, 2);
    if (fmt === 'wav') {
      if (o.onProgress) o.onProgress(0.5);
      return { blob: wav(planes, rate, o.tags || (o.comment ? { ICMT: o.comment, ISFT: '1234tools.com' } : null)), note: '16-bit PCM WAV at ' + (rate / 1000) + ' kHz.', rate, channels: ch };
    }
    const kbps = Number(o.bitrate) || (fmt === 'opus' ? 96 : 128);
    if (fmt === 'opus') {
      const r = await VK.toOggOpus(blocksOf(planes, rate, 48000, o.signal), ch, kbps * 1000, o.signal, o.comment ? ['COMMENT=' + o.comment, 'ENCODER=1234tools.com'] : null);
      return { blob: r.blob, note: 'Opus at ' + kbps + ' kbit/s in an Ogg file (48 kHz).', rate: 48000, channels: ch };
    }
    if (fmt === 'm4a') {
      const cfg = await VK.audioConfig('m4a', ch, rate, kbps * 1000);
      if (!cfg) throw new Error('this browser has no AAC encoder at ' + kbps + ' kbit/s. Choose WAV or Opus, or another bitrate.');
      const to = cfg.config.sampleRate;
      const mux = await VK.openBox('m4a', { audio: { codec: cfg.config.codec, channels: ch, rate: to } });
      await VK.encodeAudioBlocks(blocksOf(planes, rate, to, o.signal), cfg, (chunk, meta) => mux.addAudio(chunk, meta), o.signal);
      let buf = mux.finish();
      /* a comment goes into moov/udta/meta/ilst (©cmt, ©too) through the same tagger the Reel Maker uses */
      if (o.comment && typeof A.tagMP4 === 'function') { try { buf = A.tagMP4(buf, { comment: o.comment, tool: '1234tools.com' }); } catch (e) { /* left untagged */ } }
      return { blob: new Blob([buf], { type: 'audio/mp4' }), note: 'AAC at ' + kbps + ' kbit/s in an M4A file (' + (to / 1000) + ' kHz).', rate: to, channels: ch };
    }
    throw new Error('unknown format ' + fmt);
  }

  /* ------------------------------------------------------------------ */
  /* the worker                                                         */
  /* ------------------------------------------------------------------ */
  let worker = null, seq = 0;
  const pending = new Map();
  function getWorker() {
    if (worker !== null) return worker;
    try {
      worker = new Worker('/engine/audio-worker.js');
      worker.onmessage = (e) => {
        const m = e.data || {}, job = pending.get(m.id);
        if (!job) return;
        if (m.type === 'progress') { if (job.onProgress) job.onProgress(m.value); return; }
        pending.delete(m.id);
        if (m.error) job.reject(new Error(m.error)); else job.resolve(m.result);
      };
      worker.onerror = () => { for (const j of pending.values()) j.reject(new Error('the sound worker stopped')); pending.clear(); worker = false; };
    } catch (e) { worker = false; }
    return worker;
  }
  /** Run a DSP operation in the worker (planes are copied in, results transferred back); on the page when no worker starts. */
  function dsp(op, planes, rate, args, onProgress, signal) {
    const w = window.__akNoWorker ? false : getWorker();
    if (!w) {
      const D = DSP;
      return Promise.resolve(op === 'loudness' ? D.loudness(planes, rate) : op === 'stretch' ? D.stretch(planes, rate, args.speed, onProgress) : op === 'silences' ? D.silences(planes, rate, args || {}) : D.cutRanges(planes, rate, args.keep, args.fade));
    }
    return new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject, onProgress });
      if (signal) signal.addEventListener('abort', () => {
        if (!pending.has(id)) return;
        pending.delete(id); reject(VK.abortError());
        /* a cancelled job cannot be stopped inside the worker: start a fresh one next time */
        try { worker.terminate(); } catch (e) { /* */ }
        for (const j of pending.values()) j.reject(VK.abortError());
        pending.clear(); worker = null;
      }, { once: true });
      const copies = planes.map((p) => p.slice());
      w.postMessage({ id, op, planes: copies, rate, args: args || {} }, copies.map((p) => p.buffer));
    });
  }

  /* ------------------------------------------------------------------ */
  /* the page                                                           */
  /* ------------------------------------------------------------------ */
  /** A waveform on a canvas: set(planes) once, then draw({ sel: [a, b] (0..1), head: t (0..1), marks: [[a, b]] (0..1, shaded) }). */
  function waveform(label) {
    const c = el('canvas', 'ak-wave');
    c.setAttribute('role', 'img'); c.setAttribute('aria-label', label || 'Waveform of the sound');
    let pk = null, planes = null, last = {};
    const colour = (name, fb) => { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fb; };
    function draw(o) {
      last = o || last;
      const W = Math.max(200, Math.round((c.clientWidth || 600) * (window.devicePixelRatio || 1)));
      const H = Math.round(W * 0.18);
      if (c.width !== W || c.height !== H || !pk || pk.length !== 2 * W) { c.width = W; c.height = H; if (planes) pk = DSP.peaks(planes, W); }
      const x = c.getContext('2d');
      x.fillStyle = colour('--bg-0', '#0b0d14'); x.fillRect(0, 0, W, H);
      if (!pk) return;
      const sel = last.sel || [0, 1];
      const mid = H / 2;
      for (const m of last.marks || []) { x.fillStyle = 'rgba(255, 99, 99, 0.18)'; x.fillRect(m[0] * W, 0, Math.max(1, (m[1] - m[0]) * W), H); }
      const on = colour('--accent', '#f7c948'), off = colour('--text-3', '#6b7280');
      for (let i = 0; i < W; i++) {
        const f = i / W;
        x.fillStyle = f >= sel[0] && f <= sel[1] ? on : off;
        const lo = pk[2 * i], hi = pk[2 * i + 1];
        x.fillRect(i, mid - hi * mid, 1, Math.max(1, (hi - lo) * mid));
      }
      if (last.head !== undefined && last.head !== null) { x.fillStyle = colour('--text-1', '#ffffff'); x.fillRect(Math.round(last.head * W), 0, Math.max(1, Math.round(W / 400)), H); }
    }
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => draw()); ro.observe(c); }
    return { el: c, set(p) { planes = p; pk = null; draw(); }, draw };
  }
  /** The format and bitrate pickers every audio tool shares, remembered by the tool. */
  function formatPicker(id, S, onChange) {
    const fmtSel = select(id + '-format', FORMATS, S.format);
    const brSel = select(id + '-bitrate', BITRATES[S.format === 'opus' ? 'opus' : 'm4a'], S.bitrate);
    const brField = field('Bitrate', brSel);
    const sync = (quiet) => {
      S.format = fmtSel.value;
      const opts = BITRATES[S.format] || [];
      brField.hidden = !opts.length;
      if (opts.length) {
        const cur = brSel.value;
        brSel.innerHTML = '';
        for (const [v, l] of opts) { const op = el('option', null, l); op.value = v; brSel.appendChild(op); }
        brSel.value = opts.some((x) => x[0] === cur) ? cur : opts.some((x) => x[0] === String(S.bitrate)) ? String(S.bitrate) : opts[0][0];
      }
      S.bitrate = brSel.value;
      if (onChange && quiet !== true) onChange();
    };
    fmtSel.addEventListener('change', () => sync());
    brSel.addEventListener('change', () => { S.bitrate = brSel.value; if (onChange) onChange(); });
    /* set up quietly: the tool's own controls may not exist yet */
    sync(true);
    return { fields: [field('Save as', fmtSel), brField], fmtSel, brSel, sync };
  }
  const okFormat = (k, v) => (k === 'format' ? FORMATS.some((f) => f[0] === v) : k === 'bitrate' ? /^\d{2,3}$/.test(String(v)) : true);
  /** Whole planes from one rate to another (windowed sinc, through VideoKit's resampler). */
  function resample(planes, from, to) {
    if (from === to) return planes;
    const rs = VK.Resampler(from, to, planes.length);
    const a = rs.push(planes), b = rs.flush();
    return a.map((p, c) => { const o = new Float32Array(p.length + b[c].length); o.set(p); o.set(b[c], p.length); return o; });
  }
  /** The file name for a result: base name, a suffix, and the extension of what was actually made. */
  const nameFor = (base, suffix, blob) => base + (suffix ? '-' + suffix : '') + '.' + VK.extOf(blob);

  Object.assign(AK, { MAX_BYTES, MAX_SECONDS, FORMATS, BITRATES, sniff, decodeFile, planesOf, describe, blocksOf, wav, encode, dsp, waveform, formatPicker, okFormat, nameFor, resample });
})();
