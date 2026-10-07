/**
 * Video Tools — the shared runtime (window.VideoKit) for /video/ and the
 * audio side of /audio/.
 *
 * Everything happens in this tab: the file is taken apart by
 * engine/video-demux.js (read a few megabytes at a time, never uploaded),
 * pictures are decoded and encoded with the browser's own WebCodecs codecs,
 * and the result is boxed by two vendored MIT muxers — mp4-muxer for MP4
 * (through the same adapter idea as engine/aiimg-core.js) and webm-muxer for
 * WebM. No ffmpeg: its WebAssembly builds are LGPL or GPL, outside this
 * site's licence rule, and the browser already carries the codecs.
 *
 * Three routes, best first, and the page always says which one ran:
 *   copy     — the samples are moved into a new file untouched (lossless,
 *              seconds for a long video): trimming at keyframes, muting,
 *              taking the sound out, repackaging MOV as MP4;
 *   encode   — VideoDecoder → canvas or straight through → VideoEncoder,
 *              audio by AudioDecoder → AudioEncoder (or copied when the
 *              codec already fits the box), faster than real time;
 *   recorder — where WebCodecs is missing, the video is played once in a
 *              hidden element and recorded in real time by MediaRecorder,
 *              usually as WebM. Slower (as long as the clip) and the
 *              browser chooses the codec.
 *
 * Tools: engine/video-<slug>.js registers AIImg.tools['<slug>'] and builds
 * its UI with VideoKit.shell(), trimBar(), job() and result().
 *
 * Test hooks: window.__vkNoWebCodecs = true pretends WebCodecs is missing
 * (the recorder route); window.__vkNoDecoder = true skips VideoDecoder (the
 * seek route); VideoKit.last holds what the last run did.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  const D = window.VideoDemux;
  if (!A || !D) return;
  const { el, clamp, field, select, range, check, button, sleep, fmtBytes } = A;
  const VK = window.VideoKit = window.VideoKit || {};

  const MAX_BYTES = 2 * 1024 * 1048576;   /* 2 GB: past this a browser tab cannot hold the result */
  const VIDEO_RE = /\.(mp4|m4v|mov|webm|mkv|3gp|ogv|avi)$/i;
  const AUDIO_RE = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|weba|webm|mp4)$/i;
  const evenDown = (n) => Math.max(2, Math.floor(n / 2) * 2);
  const abortError = () => { const e = new Error('Cancelled'); e.name = 'AbortError'; return e; };
  const baseName = (n) => (String(n || 'video').replace(/\.[^.]+$/, '') || 'video').replace(/[\\/:*?"<>|]+/g, '-');
  function fmtT(s, digits) {
    if (!isFinite(s)) return '–';
    const d = digits === undefined ? 1 : digits;
    const neg = s < 0; s = Math.abs(s);
    const h = Math.floor(s / 3600), m = Math.floor((s - h * 3600) / 60), r = s - h * 3600 - m * 60;
    const rs = r.toFixed(d);
    const sec = (Number(rs) < 10 ? '0' : '') + rs;
    return (neg ? '−' : '') + (h ? h + ':' + (m < 10 ? '0' : '') + m : m) + ':' + sec;
  }
  const fmtRate = (bps) => !isFinite(bps) || bps <= 0 ? '–' : bps >= 1e6 ? (bps / 1e6).toFixed(2) + ' Mbit/s' : Math.round(bps / 1000) + ' kbit/s';

  /* ------------------------------------------------------------------ */
  /* what this browser can do                                           */
  /* ------------------------------------------------------------------ */
  const AVC = ['avc1.42001f', 'avc1.4d001f', 'avc1.640028', 'avc1.64002a', 'avc1.640032', 'avc1.640033', 'avc1.640034'];
  const hasWC = () => !window.__vkNoWebCodecs && typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
  async function videoConfig(kind, w, h, fps, bitrate) {
    if (!hasWC() || !VideoEncoder.isConfigSupported) return null;
    const codecs = kind === 'webm' ? ['vp09.00.10.08', 'vp8'] : AVC;
    for (const codec of codecs) {
      const config = { codec, width: w, height: h, bitrate: Math.round(bitrate), framerate: fps, latencyMode: 'quality' };
      if (/^avc1/.test(codec)) config.avc = { format: 'avc' };
      try { const r = await VideoEncoder.isConfigSupported(config); if (r && r.supported) return r.config || config; }
      catch (e) { /* next */ }
    }
    return null;
  }
  async function audioConfig(box, channels, rate, bitrate) {
    if (window.__vkNoWebCodecs || typeof AudioEncoder === 'undefined' || !AudioEncoder.isConfigSupported) return null;
    const tries = box === 'webm' || box === 'ogg' ? [{ codec: 'opus', sampleRate: 48000, name: 'opus' }]
      : box === 'm4a' ? [{ codec: 'mp4a.40.2', sampleRate: rate === 44100 ? 44100 : 48000, name: 'aac' }]
      : [{ codec: 'mp4a.40.2', sampleRate: rate === 44100 ? 44100 : 48000, name: 'aac' }, { codec: 'opus', sampleRate: 48000, name: 'opus' }];
    for (const t of tries) {
      const config = { codec: t.codec, sampleRate: t.sampleRate, numberOfChannels: channels, bitrate: Math.round(bitrate || (channels > 1 ? 128000 : 96000)) };
      try { const r = await AudioEncoder.isConfigSupported(config); if (r && r.supported) return { config: r.config || config, name: t.name }; }
      catch (e) { /* next */ }
    }
    return null;
  }
  let capsCache = null;
  /** Codecs this browser offers for encoding, checked once (720p for video). */
  function caps() {
    if (capsCache) return capsCache;
    capsCache = (async () => {
      const r = { webcodecs: hasWC(), videoDecoder: !window.__vkNoWebCodecs && typeof VideoDecoder !== 'undefined', audioDecoder: !window.__vkNoWebCodecs && typeof AudioDecoder !== 'undefined' };
      r.h264 = !!(await videoConfig('mp4', 1280, 720, 30, 2e6));
      const vp = await videoConfig('webm', 1280, 720, 30, 2e6);
      r.vp9 = !!(vp && /^vp09/.test(vp.codec)); r.vp8 = !!vp;
      r.aac = !!(await audioConfig('m4a', 2, 48000, 128000));
      r.opus = !!(await audioConfig('webm', 2, 48000, 128000));
      r.recorder = typeof MediaRecorder === 'undefined' ? [] : ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .filter((t) => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } });
      return r;
    })();
    return capsCache;
  }

  /* ------------------------------------------------------------------ */
  /* reading a file                                                     */
  /* ------------------------------------------------------------------ */
  function median(a) { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; }
  /** The nearest common rate when within 1%, else the measured rate to two places. */
  function niceFps(f) {
    let best = null;
    for (const c of [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 90, 120]) if (Math.abs(f - c) < 0.01 * c && (!best || Math.abs(f - c) < Math.abs(f - best))) best = c;
    return best || Math.round(f * 100) / 100;
  }
  function decoderConfig(t) {
    const c = { codec: t.codec, codedWidth: t.codedWidth || undefined, codedHeight: t.codedHeight || undefined };
    if (t.description) c.description = t.description;
    return c;
  }
  function audioDecoderConfig(t) {
    const c = { codec: t.codec, sampleRate: t.sampleRate, numberOfChannels: t.channels };
    if (t.description) c.description = t.description;
    return c;
  }
  /** A <video> on the file, for the preview and for files the demuxer cannot read. */
  function elementOf(file, url) {
    return new Promise((res, rej) => {
      const v = el('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
      let done = false;
      const fail = () => { if (done) return; done = true; rej(new Error('this browser cannot play this video (an unsupported codec, or a damaged file).')); };
      const ok = () => { if (done) return; done = true; res(v); };
      v.addEventListener('loadeddata', ok, { once: true });
      v.addEventListener('error', fail, { once: true });
      setTimeout(() => { if (!done && v.readyState >= 1 && v.videoWidth) ok(); else if (!done) fail(); }, 20000);
      v.src = url;
    });
  }
  /**
   * Everything a tool needs to know about a file, without decoding it:
   * { file, name, size, reader, movie, video, audio (tracks or null),
   *   duration, width, height, rotation, fps, frames (presentation times,
   *   s), videoBytes, audioBytes, videoBitrate, audioBitrate, canDecode,
   *   canDecodeAudio, demuxError }.
   */
  async function probe(file, opt) {
    opt = opt || {};
    if (file.size > MAX_BYTES) throw new Error('this file is ' + fmtBytes(file.size) + '; this tool takes files up to 2 GB.');
    const reader = D.fileReader(file);
    const info = { file, name: baseName(file.name), fullName: file.name || 'video', size: file.size, reader, movie: null, video: null, audio: null };
    try { info.movie = await D.open(reader); }
    catch (e) { info.demuxError = (e && e.message) || String(e); }
    if (info.movie) {
      info.container = info.movie.container;
      info.video = info.movie.tracks.find((t) => t.kind === 'video' && t.samples.length) || null;
      info.audio = info.movie.tracks.find((t) => t.kind === 'audio' && t.samples.length) || null;
      info.duration = info.movie.duration;
    }
    const v = info.video;
    if (v) {
      info.width = v.width; info.height = v.height; info.rotation = v.rotation || 0;
      info.frames = v.samples.map((s) => s.pts / 1e6).sort((a, b) => a - b);
      /* frames over the time they span: exact for a steady rate, the average for a variable one, and not fooled by WebM's whole-millisecond timecodes */
      const n = info.frames.length, span = n > 1 ? info.frames[n - 1] - info.frames[0] : 0;
      const durs = v.samples.map((s) => s.dur).filter((d) => d > 0);
      info.fps = niceFps(span > 0 ? (n - 1) / span : 1e6 / (median(durs) || 33333));
      info.videoBytes = v.samples.reduce((n, s) => n + s.size, 0);
      info.keyframes = v.samples.filter((s) => s.key).map((s) => s.pts / 1e6).sort((a, b) => a - b);
      info.canDecode = false;
      if (v.codec && !window.__vkNoWebCodecs && !window.__vkNoDecoder && typeof VideoDecoder !== 'undefined') {
        try { const r = await VideoDecoder.isConfigSupported(decoderConfig(v)); info.canDecode = !!(r && r.supported); } catch (e) { info.canDecode = false; }
      }
    }
    const a = info.audio;
    if (a) {
      info.audioBytes = a.samples.reduce((n, s) => n + s.size, 0);
      info.canDecodeAudio = false;
      if (a.codec && !window.__vkNoWebCodecs && typeof AudioDecoder !== 'undefined' && !/^pcm-/.test(a.codec)) {
        try { const r = await AudioDecoder.isConfigSupported(audioDecoderConfig(a)); info.canDecodeAudio = !!(r && r.supported); } catch (e) { info.canDecodeAudio = false; }
      }
      if (/^pcm-/.test(a.codec || '')) info.canDecodeAudio = true;
    }
    if (info.duration > 0) {
      if (info.videoBytes) info.videoBitrate = info.videoBytes * 8 / info.duration;
      if (info.audioBytes) info.audioBitrate = info.audioBytes * 8 / info.duration;
    }
    if (opt.element !== false && (opt.element || !v)) {
      info.url = URL.createObjectURL(file);
      try {
        info.element = await elementOf(file, info.url);
        if (!info.duration || !isFinite(info.duration)) info.duration = info.element.duration;
        if (!info.width) { info.width = info.element.videoWidth; info.height = info.element.videoHeight; }
      } catch (e) {
        URL.revokeObjectURL(info.url); info.url = null;
        if (!v && !a) throw new Error(info.demuxError || e.message);
      }
    }
    if (!v && !a && !info.element) throw new Error(info.demuxError || 'no picture or sound was found in this file.');
    return info;
  }
  function release(info) {
    if (!info) return;
    if (info.element) { try { info.element.removeAttribute('src'); info.element.load(); } catch (e) { /* */ } info.element.remove(); }
    if (info.url) URL.revokeObjectURL(info.url);
    info.element = null; info.url = null;
  }

  /* ------------------------------------------------------------------ */
  /* pictures                                                           */
  /* ------------------------------------------------------------------ */
  /**
   * Decoded frames (VideoFrame, presentation order) whose display time
   * overlaps [from, to) seconds: decoding starts at the keyframe at or
   * before `from` and frames before it are dropped. The caller closes each
   * frame. o: { from, to, signal }.
   */
  async function* decodeFrames(info, o) {
    const t = info.video;
    const s = t.samples;
    const fromUs = Math.round((o.from || 0) * 1e6), toUs = o.to === undefined ? Infinity : Math.round(o.to * 1e6);
    let k0 = 0;
    for (let i = 0; i < s.length; i++) if (s[i].key && s[i].pts <= fromUs + 500) k0 = i;
    const queue = [];
    let failure = null, wake = null;
    const poke = () => { if (wake) { const w = wake; wake = null; w(); } };
    const dec = new VideoDecoder({
      output: (f) => {
        const end = f.timestamp + (f.duration || 0);
        if ((f.duration ? end <= fromUs + 500 : f.timestamp < fromUs - 500) || f.timestamp >= toUs) f.close();
        else queue.push(f);
        poke();
      },
      error: (e) => { failure = failure || e; poke(); }
    });
    dec.configure(Object.assign(decoderConfig(t), { hardwareAcceleration: 'no-preference' }));
    const waitFor = (cond) => new Promise((res) => {
      const tick = () => { if (cond() || failure || (o.signal && o.signal.aborted)) res(); else { wake = tick; setTimeout(() => { if (wake === tick) { wake = null; tick(); } }, 20); } };
      tick();
    });
    try {
      let i = k0;
      while (i < s.length && s[i].dts < toUs) {
        if (o.signal && o.signal.aborted) throw abortError();
        if (failure) throw failure;
        const batch = [];
        while (i < s.length && s[i].dts < toUs && batch.length < 24) batch.push(s[i++]);
        const datas = await D.read(info.reader, batch);
        for (let k = 0; k < batch.length; k++) {
          const b = batch[k];
          dec.decode(new EncodedVideoChunk({ type: b.key ? 'key' : 'delta', timestamp: b.pts, duration: b.dur || undefined, data: datas[k] }));
          while (queue.length) yield queue.shift();
          if (dec.decodeQueueSize > 6) await waitFor(() => dec.decodeQueueSize <= 3 || queue.length);
          while (queue.length) yield queue.shift();
        }
      }
      if (failure) throw failure;
      await dec.flush();
      while (queue.length) yield queue.shift();
      if (failure) throw failure;
    } finally {
      while (queue.length) { try { queue.shift().close(); } catch (e) { /* */ } }
      try { if (dec.state !== 'closed') dec.close(); } catch (e) { /* */ }
    }
  }
  function seekTo(video, t, signal) {
    return new Promise((res, rej) => {
      if (signal && signal.aborted) { rej(abortError()); return; }
      if (Math.abs(video.currentTime - t) < 1e-4 && video.readyState >= 2) { res(); return; }
      let done = false;
      const finish = () => { if (done) return; done = true; video.removeEventListener('seeked', finish); clearTimeout(timer); res(); };
      const timer = setTimeout(finish, 5000);
      video.addEventListener('seeked', finish);
      video.currentTime = t;
    });
  }
  /** Frames from a <video> by seeking, fps a second: for codecs WebCodecs cannot decode but the element can play. */
  async function* seekFrames(info, o) {
    let v = info.element;
    if (!v) { info.url = info.url || URL.createObjectURL(info.file); v = info.element = await elementOf(info.file, info.url); }
    const fps = o.fps || info.fps || 30;
    const from = o.from || 0, to = Math.min(o.to === undefined ? info.duration : o.to, v.duration || info.duration);
    const n = Math.max(1, Math.round((to - from) * fps));
    for (let i = 0; i < n; i++) {
      if (o.signal && o.signal.aborted) throw abortError();
      const t = Math.min(from + (i + 0.5) / fps, to - 0.001);
      await seekTo(v, t, o.signal);
      yield new VideoFrame(v, { timestamp: Math.round((from + i / fps) * 1e6), duration: Math.round(1e6 / fps) });
    }
  }

  /* ------------------------------------------------------------------ */
  /* sound                                                              */
  /* ------------------------------------------------------------------ */
  /**
   * A streaming resampler: windowed-sinc (Blackman, 16 input samples each
   * side), low-passed at the lower of the two Nyquist frequencies.
   * push(planes) → planes at the new rate; flush() → the tail.
   */
  function Resampler(inRate, outRate, channels) {
    const ratio = inRate / outRate;
    const HW = 16;
    const cut = Math.min(1, outRate / inRate) * 0.97;
    let hist = []; for (let c = 0; c < channels; c++) hist.push(new Float32Array(0));
    let pos = 0;   /* next output's position, in input samples from hist[0] */
    const sinc = (x) => x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
    const win = (x) => { const r = (x + HW) / (2 * HW); return r < 0 || r > 1 ? 0 : 0.42 - 0.5 * Math.cos(2 * Math.PI * r) + 0.08 * Math.cos(4 * Math.PI * r); };
    function run(final) {
      const len = hist[0].length;
      const lim = final ? len : len - HW;
      /* outputs fit between pos and lim at `ratio` input samples each (more than the input count when upsampling) */
      const n = Math.max(0, Math.ceil((lim - pos) / ratio) + 1);
      const out = [];
      for (let c = 0; c < channels; c++) out.push(new Float32Array(n));
      let k = 0;
      for (; k < n; k++) {
        const x = pos + k * ratio;
        if (x >= lim) break;
        const i0 = Math.floor(x);
        const frac = x - i0;
        for (let c = 0; c < channels; c++) {
          const h = hist[c];
          let acc = 0, wsum = 0;
          for (let j = -HW + 1; j <= HW; j++) {
            const idx = i0 + j;
            const d = j - frac;
            const wgt = cut * sinc(cut * d) * win(d);
            wsum += wgt;
            if (idx >= 0 && idx < len) acc += h[idx] * wgt;
          }
          out[c][k] = wsum ? acc / wsum : 0;
        }
      }
      const made = out.map((p) => p.subarray(0, k));
      pos += k * ratio;
      const drop = Math.max(0, Math.floor(pos) - HW);
      if (drop > 0) { hist = hist.map((h) => h.slice(drop)); pos -= drop; }
      return made;
    }
    return {
      push(planes) {
        if (inRate === outRate) return planes;
        hist = hist.map((h, c) => { const a = new Float32Array(h.length + planes[c].length); a.set(h); a.set(planes[c], h.length); return a; });
        return run(false);
      },
      flush() { if (inRate === outRate) return hist.map(() => new Float32Array(0)); return run(true); }
    };
  }
  /** Mixed to `want` channels: mono to both, or several averaged into left (even) and right (odd). */
  function mixTo(planes, want) {
    if (planes.length === want) return planes;
    const n = planes[0].length;
    if (want === 1) { const m = new Float32Array(n); for (const p of planes) for (let i = 0; i < n; i++) m[i] += p[i] / planes.length; return [m]; }
    if (planes.length === 1) return [planes[0], planes[0].slice()];
    const L = new Float32Array(n), R = new Float32Array(n);
    let nl = 0, nr = 0;
    planes.forEach((p, c) => { const t = c % 2 ? R : L; if (c % 2) nr++; else nl++; for (let i = 0; i < n; i++) t[i] += p[i]; });
    for (let i = 0; i < n; i++) { L[i] /= nl || 1; R[i] /= nr || 1; }
    return [L, R];
  }
  function planesOf(ad) {
    const out = [];
    for (let c = 0; c < ad.numberOfChannels; c++) {
      const p = new Float32Array(ad.numberOfFrames);
      ad.copyTo(p, { planeIndex: c, format: 'f32-planar' });
      out.push(p);
    }
    return out;
  }
  function pcmPlanes(codec, data, channels, bits) {
    const le = codec !== 'pcm-twos' && codec !== 'pcm-in24' && codec !== 'pcm-raw';
    const bps = codec === 'pcm-float' ? 4 : codec === 'pcm-raw' ? 1 : codec === 'pcm-in24' ? 3 : (bits === 24 ? 3 : bits === 32 ? 4 : 2);
    const n = Math.floor(data.length / (bps * channels));
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const out = []; for (let c = 0; c < channels; c++) out.push(new Float32Array(n));
    for (let i = 0; i < n; i++) for (let c = 0; c < channels; c++) {
      const p = (i * channels + c) * bps;
      let v;
      if (codec === 'pcm-float') v = dv.getFloat32(p, true);
      else if (bps === 1) v = (data[p] - 128) / 128;
      else if (bps === 2) v = dv.getInt16(p, le) / 32768;
      else if (bps === 3) { const b0 = le ? data[p] : data[p + 2], b2 = le ? data[p + 2] : data[p]; v = ((b2 << 24 | data[p + 1] << 16 | b0 << 8) >> 8) / 8388608; }
      else v = dv.getInt32(p, le) / 2147483648;
      out[c][i] = v;
    }
    return out;
  }
  /**
   * The sound between `from` and `to` seconds as blocks of float planes at
   * o.rate (default: the file's) with o.channels (default: the file's, at
   * most 2): async iterable of { planes, t } where t is the block's start
   * in seconds from `from`. AudioDecoder where it can; otherwise the whole
   * file through decodeAudioData (o.maxWholeSeconds guards memory).
   */
  async function* audioBlocks(info, o) {
    const a = info.audio;
    const from = o.from || 0, to = o.to === undefined ? Infinity : o.to;
    const srcRate = a ? a.sampleRate : 48000;
    const ch = o.channels || Math.min(2, Math.max(1, (a && a.channels) || 2));
    const rate = o.rate || srcRate;
    if (a && info.canDecodeAudio) {
      const s = a.samples;
      const isPcm = /^pcm-/.test(a.codec);
      const queue = [];
      let failure = null;
      const dec = isPcm ? null : new AudioDecoder({ output: (ad) => queue.push(ad), error: (e) => { failure = failure || e; } });
      if (dec) dec.configure(audioDecoderConfig(a));
      let rs = null, made = 0, inRate = srcRate;
      const emit = function* (planes, tStart) {
        /* cut to [from, to) by sample position, then mix and resample */
        const r = inRate, n = planes[0].length;
        let i0 = Math.max(0, Math.ceil((from - tStart) * r - 1e-6));
        let i1 = Math.min(n, Math.floor((to - tStart) * r + 1e-6));
        if (i1 <= i0) return;
        let p = planes.map((x) => (i0 === 0 && i1 === n ? x : x.subarray(i0, i1)));
        p = mixTo(p, ch);
        if (!rs) rs = Resampler(inRate, rate, ch);
        const out = rs.push(p);
        if (out[0].length) { yield { planes: out, t: made / rate }; made += out[0].length; }
      };
      try {
        const startUs = Math.round(from * 1e6) - 400000;
        let i = 0;
        while (i < s.length && s[i].pts + s[i].dur < startUs) i++;
        const endUs = to === Infinity ? Infinity : Math.round(to * 1e6) + 200000;
        while (i < s.length && s[i].pts < endUs) {
          if (o.signal && o.signal.aborted) throw abortError();
          if (failure) throw failure;
          const batch = [];
          while (i < s.length && s[i].pts < endUs && batch.length < 64) batch.push(s[i++]);
          const datas = await D.read(info.reader, batch);
          for (let k = 0; k < batch.length; k++) {
            if (isPcm) { inRate = srcRate; yield* emit(pcmPlanes(a.codec, datas[k], a.channels, a.sampleSize || a.bits), batch[k].pts / 1e6); continue; }
            dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: batch[k].pts, duration: batch[k].dur || undefined, data: datas[k] }));
          }
          if (dec && dec.decodeQueueSize > 32) await sleep(1);
          while (queue.length) { const ad = queue.shift(); inRate = ad.sampleRate; const pl = planesOf(ad); const ts = ad.timestamp / 1e6; ad.close(); yield* emit(pl, ts); }
        }
        if (dec) { await dec.flush(); if (failure) throw failure; }
        while (queue.length) { const ad = queue.shift(); inRate = ad.sampleRate; const pl = planesOf(ad); const ts = ad.timestamp / 1e6; ad.close(); yield* emit(pl, ts); }
        if (rs) { const tail = rs.flush(); if (tail[0].length) { yield { planes: tail, t: made / rate }; made += tail[0].length; } }
      } finally {
        while (queue.length) { try { queue.shift().close(); } catch (e) { /* */ } }
        if (dec) { try { if (dec.state !== 'closed') dec.close(); } catch (e) { /* */ } }
      }
      return;
    }
    /* the whole file, decoded by the browser's media stack */
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Ctx) throw new Error('this browser cannot decode the sound on the device.');
    if (info.size > (o.maxWholeBytes || 600 * 1048576)) throw new Error('this browser has no streaming audio decoder (WebCodecs AudioDecoder), and the file is too large to decode in one piece. Try Chrome or Edge.');
    const buf = await info.file.arrayBuffer();
    const ctx = new Ctx(ch, Math.max(1, Math.round(rate)), rate);
    const ab = await new Promise((res, rej) => { const p = ctx.decodeAudioData(buf, res, rej); if (p && p.then) p.then(res, rej); });
    const r = ab.sampleRate;
    const i0 = Math.max(0, Math.round(from * r)), i1 = Math.min(ab.length, to === Infinity ? ab.length : Math.round(to * r));
    let planes = []; for (let c = 0; c < ab.numberOfChannels; c++) planes.push(ab.getChannelData(c));
    planes = mixTo(planes, ch);
    const STEP = 65536;
    let made = 0;
    let rs = r === rate ? null : Resampler(r, rate, ch);
    for (let i = i0; i < i1; i += STEP) {
      if (o.signal && o.signal.aborted) throw abortError();
      let p = planes.map((x) => x.slice(i, Math.min(i1, i + STEP)));
      if (rs) p = rs.push(p);
      if (p[0].length) { yield { planes: p, t: made / rate }; made += p[0].length; }
    }
    if (rs) { const tail = rs.flush(); if (tail[0].length) yield { planes: tail, t: made / rate }; }
  }

  /** Encode blocks (from audioBlocks at the encoder's rate) and hand each chunk to add(chunk, meta). */
  async function encodeAudioBlocks(blocks, cfg, add, signal) {
    const { config } = cfg;
    const rate = config.sampleRate, ch = config.numberOfChannels;
    let failure = null;
    const enc = new AudioEncoder({ output: (c, m) => add(c, m), error: (e) => { failure = failure || e; } });
    enc.configure(config);
    let made = 0;
    try {
      for await (const b of blocks) {
        if (signal && signal.aborted) throw abortError();
        if (failure) throw failure;
        const n = b.planes[0].length;
        const STEP = 4800;
        for (let i = 0; i < n; i += STEP) {
          const k = Math.min(STEP, n - i);
          const data = new Float32Array(k * ch);
          for (let c = 0; c < ch; c++) data.set(b.planes[Math.min(c, b.planes.length - 1)].subarray(i, i + k), c * k);
          const ad = new AudioData({ format: 'f32-planar', sampleRate: rate, numberOfFrames: k, numberOfChannels: ch, timestamp: Math.round(made * 1e6 / rate), data });
          enc.encode(ad); ad.close();
          made += k;
          if (enc.encodeQueueSize > 16) await sleep(1);
        }
      }
      await enc.flush();
      if (failure) throw failure;
    } finally { try { if (enc.state !== 'closed') enc.close(); } catch (e) { /* */ } }
    return made / rate;
  }

  /* ------------------------------------------------------------------ */
  /* boxes                                                              */
  /* ------------------------------------------------------------------ */
  const MP4_VIDEO = { avc1: 'avc', avc3: 'avc', hvc1: 'hevc', hev1: 'hevc', vp09: 'vp9', av01: 'av1' };
  const WEBM_VIDEO = { vp8: 'V_VP8', vp09: 'V_VP9', av01: 'V_AV1' };
  const codecFamily = (c) => String(c || '').split('.')[0];
  /** Can this track be copied into this box untouched? */
  function copyable(track, box) {
    if (!track || !track.codec) return false;
    const f = codecFamily(track.codec);
    /* avc3 and hev1 keep their parameter sets in the stream, which the MP4 boxer cannot describe: those are re-encoded */
    if (track.kind === 'video') return box === 'mp4' ? ['avc1', 'hvc1', 'vp09', 'av01'].indexOf(f) >= 0 : box === 'webm' ? !!WEBM_VIDEO[f] : false;
    if (box === 'mp4' || box === 'm4a') return f === 'mp4a' && /^mp4a\.40\./.test(track.codec) || f === 'opus' && box === 'mp4';
    if (box === 'webm') return f === 'opus' || f === 'vorbis';
    return false;
  }
  /**
   * A muxer for 'mp4' (also 'm4a', sound only) or 'webm': { addVideo(chunk,
   * meta), addVideoRaw(data, key, ptsUs, durUs, meta, ctoUs), addAudio(chunk,
   * meta), addAudioRaw(data, ptsUs, durUs, meta), finish() → ArrayBuffer }.
   * spec: { video: { codec (WebCodecs string), width, height, fps, rotation },
   *         audio: { codec, channels, rate } }
   */
  async function openBox(box, spec) {
    if (box === 'mp4' || box === 'm4a') {
      const M = await import('/engine/vendor/mp4-muxer.mjs');
      const target = new M.ArrayBufferTarget();
      const o = { target, fastStart: 'in-memory', firstTimestampBehavior: 'strict' };
      if (spec.video) o.video = { codec: MP4_VIDEO[codecFamily(spec.video.codec)] || 'avc', width: spec.video.width, height: spec.video.height, rotation: spec.video.rotation || 0 };
      if (spec.video && spec.video.fps) o.video.frameRate = Math.max(1, Math.round(spec.video.fps));
      if (spec.audio) o.audio = { codec: codecFamily(spec.audio.codec) === 'opus' ? 'opus' : 'aac', numberOfChannels: spec.audio.channels, sampleRate: spec.audio.rate };
      const m = new M.Muxer(o);
      return {
        addVideo: (c, meta) => m.addVideoChunk(c, meta),
        addVideoRaw: (data, key, pts, dur, meta, cto) => m.addVideoChunkRaw(data, key ? 'key' : 'delta', pts, dur, meta, cto || 0),
        addAudio: (c, meta) => m.addAudioChunk(c, meta),
        addAudioRaw: (data, pts, dur, meta) => m.addAudioChunkRaw(data, 'key', pts, dur, meta),
        finish: () => { m.finalize(); return target.buffer; }
      };
    }
    const W = await import('/engine/vendor/webm-muxer.mjs');
    const target = new W.ArrayBufferTarget();
    const o = { target, type: 'webm', firstTimestampBehavior: 'permissive' };
    if (spec.video) o.video = { codec: WEBM_VIDEO[codecFamily(spec.video.codec)] || 'V_VP9', width: spec.video.width, height: spec.video.height };
    if (spec.video && spec.video.fps) o.video.frameRate = Math.max(1, Math.round(spec.video.fps));
    if (spec.audio) o.audio = { codec: codecFamily(spec.audio.codec) === 'vorbis' ? 'A_VORBIS' : 'A_OPUS', numberOfChannels: spec.audio.channels, sampleRate: spec.audio.rate };
    const m = new W.Muxer(o);
    return {
      addVideo: (c, meta) => m.addVideoChunk(c, meta),
      addVideoRaw: (data, key, pts, dur, meta) => m.addVideoChunkRaw(data, key ? 'key' : 'delta', pts, meta),
      addAudio: (c, meta) => m.addAudioChunk(c, meta),
      addAudioRaw: (data, pts, dur, meta) => m.addAudioChunkRaw(data, 'key', pts, meta),
      finish: () => { m.finalize(); return target.buffer; }
    };
  }
  const BOX_NAME = { mp4: 'MP4', webm: 'WebM', m4a: 'M4A', ogg: 'Ogg', wav: 'WAV', mkv: 'MKV' };
  const boxName = (b) => BOX_NAME[b] || String(b).toUpperCase();
  const MIME = { mp4: 'video/mp4', webm: 'video/webm', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav', mp3: 'audio/mpeg', weba: 'audio/webm' };
  const EXT_OF = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'audio/webm': 'weba', 'video/x-matroska': 'mkv', 'image/png': 'png', 'image/jpeg': 'jpg', 'application/zip': 'zip' };
  const extOf = (blob) => EXT_OF[String(blob.type).split(';')[0]] || 'bin';

  /* ------------------------------------------------------------------ */
  /* copy: samples moved untouched                                      */
  /* ------------------------------------------------------------------ */
  /**
   * A new file holding the chosen tracks' samples untouched.
   * o: { box: 'mp4'|'webm'|'m4a', video: bool, audio: bool, from, to (s),
   *      onProgress, signal }. Video starts at the keyframe at or before
   * `from` (a cut can only begin where a picture stands alone); sound
   * starts with it. Returns { blob, start, end, videoFrames, audioPackets }.
   */
  async function remux(info, o) {
    const box = o.box;
    const v = o.video !== false && info.video ? info.video : null;
    const a = o.audio !== false && info.audio ? info.audio : null;
    if (v && !copyable(v, box)) throw new Error('the picture (' + (v.codec || v.fourcc) + ') cannot go into ' + boxName(box) + ' without re-encoding.');
    if (a && !copyable(a, box)) throw new Error('the sound (' + (a.codec || a.fourcc) + ') cannot go into ' + boxName(box) + ' without re-encoding.');
    if (!v && !a) throw new Error('there is nothing to copy.');
    const fromUs = Math.round((o.from || 0) * 1e6);
    const toUs = o.to === undefined ? Infinity : Math.round(o.to * 1e6);
    let vs = [], startUs = fromUs, endUs = toUs;
    if (v) {
      const s = v.samples;
      let k0 = 0;
      for (let i = 0; i < s.length; i++) if (s[i].key && s[i].pts <= fromUs + 500) k0 = i;
      /* every sample from that keyframe whose decode time is before the end; then drop trailing ones shown after the end */
      for (let i = k0; i < s.length && s[i].dts < toUs; i++) vs.push(s[i]);
      if (!vs.length) throw new Error('there are no pictures in that part of the video.');
      startUs = s[k0].pts;
      const shown = vs.filter((x) => x.pts < toUs);
      endUs = Math.min(toUs, Math.max.apply(null, shown.map((x) => x.pts + x.dur)));
    }
    const originUs = v ? Math.min.apply(null, vs.slice(0, 8).map((x) => x.dts)) : startUs;
    let as = [];
    if (a) {
      for (const x of a.samples) if (x.pts + x.dur > startUs + 1000 && x.pts < endUs) as.push(x);
    }
    const spec = {};
    if (v) spec.video = { codec: v.codec, width: v.codedWidth || v.width, height: v.codedHeight || v.height, fps: info.fps, rotation: box === 'mp4' ? v.rotation || 0 : 0 };
    if (a) spec.audio = { codec: a.codec, channels: a.channels || 2, rate: a.sampleRate };
    const mux = await openBox(box, spec);
    const total = vs.length + as.length;
    let done = 0;
    const report = o.onProgress || (() => {});
    const step = async () => { done++; if ((done & 63) === 0) { report(done / total); await sleep(0); if (o.signal && o.signal.aborted) throw abortError(); } };
    if (v) {
      const meta = { decoderConfig: { codec: v.codec, codedWidth: v.codedWidth, codedHeight: v.codedHeight, description: v.description || undefined } };
      /* the MP4 boxer writes VP9's vpcC from a colour space; a WebM without a Colour element is BT.709, limited range */
      if (/^(vp09|av01)/.test(v.codec)) meta.decoderConfig.colorSpace = v.colorSpace || { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: false };
      for (let i = 0; i < vs.length; i += 48) {
        const part = vs.slice(i, i + 48);
        const datas = await D.read(info.reader, part);
        for (let k = 0; k < part.length; k++) {
          const x = part[k];
          const pts = x.pts - originUs, dts = x.dts - originUs;
          mux.addVideoRaw(datas[k], x.key, pts, x.dur, i + k === 0 ? meta : undefined, pts - dts);
          await step();
        }
      }
    }
    if (a) {
      const meta = { decoderConfig: { codec: a.codec, sampleRate: a.sampleRate, numberOfChannels: a.channels, description: a.description || undefined } };
      for (let i = 0; i < as.length; i += 128) {
        const part = as.slice(i, i + 128);
        const datas = await D.read(info.reader, part);
        for (let k = 0; k < part.length; k++) {
          const x = part[k];
          /* the first packet of each track opens at zero: the MP4 boxer insists, and the shift is under one packet */
          let ts = Math.max(0, x.pts - originUs);
          if (i + k === 0 && (box !== 'webm' || !v)) ts = 0;
          mux.addAudioRaw(datas[k], ts, x.dur, i + k === 0 ? meta : undefined);
          await step();
        }
      }
    }
    const buf = mux.finish();
    report(1);
    const mime = box === 'm4a' ? (v ? 'video/mp4' : 'audio/mp4') : box === 'webm' ? (v ? 'video/webm' : 'audio/webm') : 'video/mp4';
    return { blob: new Blob([buf], { type: mime }), start: startUs / 1e6, end: endUs / 1e6, videoFrames: vs.length, audioPackets: as.length };
  }

  /* ------------------------------------------------------------------ */
  /* encode                                                             */
  /* ------------------------------------------------------------------ */
  /** The size a frame is shown at once rotated, and the output size for a `short` side (or the original). */
  function outputSize(info, opt) {
    let w = info.width, h = info.height;
    if (opt && opt.maxShort && Math.min(w, h) > opt.maxShort) {
      const s = opt.maxShort / Math.min(w, h);
      w = Math.round(w * s); h = Math.round(h * s);
    }
    if (opt && opt.width && opt.height) { w = opt.width; h = opt.height; }
    return { width: evenDown(w), height: evenDown(h) };
  }
  /** Draw a decoded frame (coded orientation) rotated and scaled into ctx's W × H. */
  function drawFrame(ctx, frame, rotation, W, H, fit) {
    const fw = frame.displayWidth || frame.videoWidth || frame.width, fh = frame.displayHeight || frame.videoHeight || frame.height;
    ctx.save();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    if (rotation) ctx.rotate(rotation * Math.PI / 180);
    const sw = rotation === 90 || rotation === 270 ? H : W, sh = rotation === 90 || rotation === 270 ? W : H;
    if (fit) fit(ctx, frame, fw, fh, sw, sh);
    else ctx.drawImage(frame, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();
  }

  /**
   * Re-encode a part of the file.
   * o: { box: 'mp4'|'webm', from, to (s), width, height (output; else the
   *      original's shown size), fps (output cap; else the original's),
   *      bitrate (video, bit/s), keyEvery (s, default 3),
   *      audio: 'copy'|'encode'|'none' (copy falls back to encode when the
   *      codec does not fit the box), audioBitrate, audioChannels,
   *      draw(ctx, frame, info, W, H) to paint a frame yourself,
   *      onProgress(p), signal }
   * Returns { blob, route: 'encode', videoCodec, audioCodec, audioRoute,
   *   frames, width, height, fps, seconds }.
   */
  async function transcode(info, o) {
    const box = o.box || 'mp4';
    const from = Math.max(0, o.from || 0);
    const to = Math.min(info.duration, o.to === undefined ? info.duration : o.to);
    const seconds = Math.max(0.01, to - from);
    const { width: W, height: H } = o.width && o.height ? { width: evenDown(o.width), height: evenDown(o.height) } : outputSize(info);
    const srcFps = info.fps || 30;
    const fps = Math.min(srcFps, o.fps || srcFps);
    const bitrate = clamp(o.bitrate || W * H * fps * 0.08, 50000, 60e6);
    const vcfg = await videoConfig(box, W, H, Math.round(fps) || 30, bitrate);
    if (!vcfg) return null;
    const report = o.onProgress || (() => {});
    /* sound: copy when it fits, else encode, else leave out with a note */
    let audioRoute = 'none', acfg = null;
    const a = info.audio;
    if (a && o.audio !== 'none') {
      if (o.audio === 'copy' && copyable(a, box)) audioRoute = 'copy';
      else {
        const ch = Math.min(2, o.audioChannels || a.channels || 2);
        acfg = await audioConfig(box, ch, a.sampleRate, o.audioBitrate || (ch > 1 ? 128000 : 96000));
        audioRoute = acfg ? 'encode' : 'dropped';
      }
    }
    const spec = { video: { codec: vcfg.codec, width: W, height: H, fps } };
    if (audioRoute === 'copy') spec.audio = { codec: a.codec, channels: a.channels, rate: a.sampleRate };
    if (audioRoute === 'encode') spec.audio = { codec: acfg.config.codec, channels: acfg.config.numberOfChannels, rate: acfg.config.sampleRate };
    const mux = await openBox(box, spec);
    let failure = null;
    let pending = Promise.resolve();
    const queue = (fn) => { pending = pending.then(fn).catch((e) => { failure = failure || e; }); };
    const enc = new VideoEncoder({ output: (c, m) => queue(() => mux.addVideo(c, m)), error: (e) => { failure = failure || e; } });
    enc.configure(vcfg);
    VK.lastVideoConfig = Object.assign({}, vcfg);
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(el('canvas'), { width: W, height: H });
    const ctx = canvas.getContext('2d', { alpha: false });
    const rot = info.rotation || 0;
    const useDecoder = info.video && info.canDecode;
    const frames = useDecoder ? decodeFrames(info, { from, to, signal: o.signal }) : seekFrames(info, { from, to, fps, signal: o.signal });
    const expect = Math.max(1, Math.round(seconds * fps));
    const keyEvery = (o.keyEvery || 3) * 1e6;
    let count = 0, lastKey = -Infinity, nextSlot = 0, lastTs = -1;
    const slot = 1e6 / fps;
    try {
      for await (const f of frames) {
        if (o.signal && o.signal.aborted) { f.close(); throw abortError(); }
        if (failure) { f.close(); throw failure; }
        let ts = Math.max(0, Math.round(f.timestamp - from * 1e6));
        /* fewer frames a second: keep a frame when it reaches the next slot */
        if (fps < srcFps - 0.01) {
          if (ts + slot * 0.5 < nextSlot) { f.close(); continue; }
          ts = Math.round(nextSlot); nextSlot += slot;
        }
        if (ts <= lastTs) ts = lastTs + 1;
        lastTs = ts;
        let frame;
        const same = !o.draw && !rot && (f.displayWidth === W && f.displayHeight === H);
        if (same) frame = new VideoFrame(f, { timestamp: ts, duration: Math.round(slot) });
        else {
          if (o.draw) o.draw(ctx, f, info, W, H);
          else drawFrame(ctx, f, rot, W, H);
          frame = new VideoFrame(canvas, { timestamp: ts, duration: Math.round(slot) });
        }
        f.close();
        const key = ts - lastKey >= keyEvery;
        if (key) lastKey = ts;
        enc.encode(frame, { keyFrame: key });
        frame.close();
        count++;
        while (enc.encodeQueueSize > 4) await sleep(2);
        if ((count & 3) === 0) { report(Math.min(0.97, count / expect) * (audioRoute === 'encode' ? 0.9 : 1)); await sleep(0); }
      }
      if (!count) throw new Error('no pictures could be decoded from this part of the video.');
      await enc.flush();
      if (failure) throw failure;
      if (audioRoute === 'copy') {
        const meta = { decoderConfig: { codec: a.codec, sampleRate: a.sampleRate, numberOfChannels: a.channels, description: a.description || undefined } };
        const list = a.samples.filter((x) => x.pts + x.dur > from * 1e6 + 1000 && x.pts < to * 1e6);
        for (let i = 0; i < list.length; i += 128) {
          const part = list.slice(i, i + 128);
          const datas = await D.read(info.reader, part);
          for (let k = 0; k < part.length; k++) {
            const x = part[k];
            let ts = Math.max(0, x.pts - Math.round(from * 1e6));
            if (i + k === 0 && box !== 'webm') ts = 0;
            queue(() => mux.addAudioRaw(datas[k], ts, x.dur, i + k === 0 ? meta : undefined));
          }
        }
      } else if (audioRoute === 'encode') {
        const blocks = audioBlocks(info, { from, to, rate: acfg.config.sampleRate, channels: acfg.config.numberOfChannels, signal: o.signal });
        await encodeAudioBlocks(blocks, acfg, (c, m) => queue(() => mux.addAudio(c, m)), o.signal);
      }
      await pending;
      if (failure) throw failure;
    } finally {
      try { if (enc.state !== 'closed') enc.close(); } catch (e) { /* */ }
      if (frames.return) { try { await frames.return(); } catch (e) { /* */ } }
    }
    const buf = mux.finish();
    report(1);
    const out = { blob: new Blob([buf], { type: MIME[box] }), route: 'encode', decodeRoute: useDecoder ? 'decoder' : 'seek', videoCodec: vcfg.codec, audioCodec: spec.audio ? spec.audio.codec : null, audioRoute, frames: count, width: W, height: H, fps, seconds, bitrate };
    VK.last = out;
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* recorder: real time, where WebCodecs is missing                    */
  /* ------------------------------------------------------------------ */
  /**
   * Play [from, to) once in a hidden element and record it with
   * MediaRecorder: the frame through a canvas (scaled to W × H, or drawn by
   * o.draw), the sound through Web Audio, not to the speakers. As slow as
   * the clip is long. o: { from, to, width, height, bitrate, audio: bool,
   * draw, onProgress, signal }. Returns { blob, route: 'recorder', mime }.
   */
  async function record(info, o) {
    const c = await caps();
    if (!c.recorder.length || typeof HTMLCanvasElement.prototype.captureStream !== 'function') throw new Error('this browser has neither WebCodecs nor a media recorder, so it cannot make video on the device. Chrome, Edge, Safari 16.4+ or Firefox 130+ can.');
    const mime = c.recorder[0];
    info.url = info.url || URL.createObjectURL(info.file);
    const v = el('video');
    v.playsInline = true; v.preload = 'auto'; v.src = info.url;
    v.className = 'sv-hidden-video';
    document.body.appendChild(v);
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('this browser cannot play this video.')); });
    const from = o.from || 0, to = Math.min(o.to === undefined ? v.duration : o.to, v.duration || Infinity);
    const W = evenDown(o.width || v.videoWidth), H = evenDown(o.height || v.videoHeight);
    const canvas = el('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(Math.round(info.fps || 30));
    let actx = null;
    if (o.audio !== false) {
      try {
        actx = new (window.AudioContext || window.webkitAudioContext)();
        const srcN = actx.createMediaElementSource(v);
        const dest = actx.createMediaStreamDestination();
        srcN.connect(dest);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch (e) { actx = null; }
    }
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(o.bitrate || W * H * 30 * 0.08) });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((res) => { rec.onstop = res; });
    await seekTo(v, from);
    const paint = () => { if (o.draw) o.draw(ctx, v, info, W, H); else ctx.drawImage(v, 0, 0, W, H); };
    paint();
    rec.start(500);
    if (actx && actx.state === 'suspended') { try { await actx.resume(); } catch (e) { /* */ } }
    try { await v.play(); } catch (e) { rec.stop(); throw new Error('the video would not play for recording: ' + e.message); }
    const report = o.onProgress || (() => {});
    try {
      await new Promise((res, rej) => {
        /* frames are painted as they are shown; the end is the end time, the 'ended' event, or (the last
           frame callback never comes once a video stops) a timer that watches the clock */
        let done = false;
        const finish = (err) => { if (done) return; done = true; clearInterval(timer); v.removeEventListener('ended', onEnd); if (err) rej(err); else { paint(); res(); } };
        const onEnd = () => finish();
        v.addEventListener('ended', onEnd);
        const timer = setInterval(() => {
          if (o.signal && o.signal.aborted) finish(abortError());
          else if (v.currentTime >= to - 0.001 || v.ended || (v.paused && v.currentTime > from)) finish();
        }, 200);
        const tick = () => {
          if (done) return;
          if (o.signal && o.signal.aborted) { finish(abortError()); return; }
          paint();
          report(clamp((v.currentTime - from) / (to - from), 0, 0.99));
          if (v.currentTime >= to) { finish(); return; }
          if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(tick); else requestAnimationFrame(tick);
        };
        tick();
      });
    } finally {
      v.pause();
      if (rec.state !== 'inactive') rec.stop();
      await stopped;
      if (actx) { try { await actx.close(); } catch (e) { /* */ } }
      v.remove();
    }
    report(1);
    const type = /mp4/.test(mime) ? 'video/mp4' : 'video/webm';
    const out = { blob: new Blob(chunks, { type }), route: 'recorder', mime, width: W, height: H, seconds: to - from };
    VK.last = out;
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* sound files: WAV and Ogg Opus                                      */
  /* ------------------------------------------------------------------ */
  /** 16-bit PCM WAV from audioBlocks: { blob, seconds, rate, channels }. */
  async function toWav(blocks, rate, channels, signal, onBlock) {
    const parts = [];
    let frames = 0;
    for await (const b of blocks) {
      if (signal && signal.aborted) throw abortError();
      const n = b.planes[0].length;
      const pcm = new Int16Array(n * channels);
      for (let i = 0; i < n; i++) for (let c = 0; c < channels; c++) {
        const s = clamp(b.planes[Math.min(c, b.planes.length - 1)][i], -1, 1);
        pcm[i * channels + c] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
      }
      parts.push(pcm);
      frames += n;
      if (onBlock) onBlock(frames / rate);
    }
    const dataBytes = frames * channels * 2;
    const h = new DataView(new ArrayBuffer(44));
    const str = (o, s) => { for (let i = 0; i < 4; i++) h.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); h.setUint32(4, 36 + dataBytes, true); str(8, 'WAVE');
    str(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, channels, true);
    h.setUint32(24, rate, true); h.setUint32(28, rate * channels * 2, true); h.setUint16(32, channels * 2, true); h.setUint16(34, 16, true);
    str(36, 'data'); h.setUint32(40, dataBytes, true);
    return { blob: new Blob([h.buffer].concat(parts), { type: 'audio/wav' }), seconds: frames / rate, rate, channels };
  }

  /* Ogg (RFC 3533) with Opus (RFC 7845): CRC-32 with polynomial 0x04C11DB7, no reflection. */
  const OGG_CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let r = i << 24; for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1; t[i] = r >>> 0; } return t; })();
  function oggCrc(u) { let c = 0; for (let i = 0; i < u.length; i++) c = ((c << 8) ^ OGG_CRC[((c >>> 24) ^ u[i]) & 255]) >>> 0; return c >>> 0; }
  /** Samples (at 48 kHz) in one Opus packet, from its TOC byte (RFC 6716 §3.1). */
  function opusSamples(p) {
    if (!p || !p.length) return 0;
    const toc = p[0], cfg = toc >> 3, code = toc & 3;
    const size = cfg < 12 ? [480, 960, 1920, 2880][cfg & 3] : cfg < 16 ? [480, 960][cfg & 1] : [120, 240, 480, 960][cfg & 3];
    const count = code === 0 ? 1 : code === 3 ? (p[1] & 63) : 2;
    return size * count;
  }
  function OggWriter(serial) {
    const pages = [];
    let seq = 0;
    function page(packets, granule, flags) {
      const segs = [];
      for (const p of packets) { let n = p.length; while (n >= 255) { segs.push(255); n -= 255; } segs.push(n); }
      const body = packets.reduce((s, p) => s + p.length, 0);
      const u = new Uint8Array(27 + segs.length + body);
      const dv = new DataView(u.buffer);
      u.set([0x4f, 0x67, 0x67, 0x53], 0); u[4] = 0; u[5] = flags;
      dv.setUint32(6, granule % 4294967296, true); dv.setUint32(10, Math.floor(granule / 4294967296), true);
      dv.setUint32(14, serial, true); dv.setUint32(18, seq++, true); dv.setUint32(22, 0, true);
      u[26] = segs.length; u.set(segs, 27);
      let o = 27 + segs.length;
      for (const p of packets) { u.set(p, o); o += p.length; }
      dv.setUint32(22, oggCrc(u), true);
      pages.push(u);
    }
    return { page, pages };
  }
  /** OpusHead (RFC 7845 §5.1) for an encoder that gave none. */
  function opusHead(channels, preskip, rate) {
    const u = new Uint8Array(19);
    const dv = new DataView(u.buffer);
    u.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0);
    u[8] = 1; u[9] = channels; dv.setUint16(10, preskip, true); dv.setUint32(12, rate, true); dv.setInt16(16, 0, true); u[18] = 0;
    return u;
  }
  /** OpusTags (RFC 7845 §5.2): the vendor string and user comments ("KEY=value"). */
  function opusTags(vendor, comments) {
    const e = new TextEncoder();
    const v = e.encode(vendor);
    const cs = (comments || []).map((c) => e.encode(c));
    const u = new Uint8Array(8 + 4 + v.length + 4 + cs.reduce((n, c) => n + 4 + c.length, 0));
    const dv = new DataView(u.buffer);
    u.set(e.encode('OpusTags'), 0);
    dv.setUint32(8, v.length, true);
    u.set(v, 12);
    let o = 12 + v.length;
    dv.setUint32(o, cs.length, true); o += 4;
    for (const c of cs) { dv.setUint32(o, c.length, true); u.set(c, o + 4); o += 4 + c.length; }
    return u;
  }
  /**
   * Ogg Opus from Opus packets: { head (OpusHead bytes), packets: [Uint8Array],
   * samples (48 kHz samples of real sound, for the last granule) }.
   */
  function oggOpus(head, packets, samples, comments) {
    const serial = (Math.random() * 0xffffffff) >>> 0;
    const w = OggWriter(serial);
    w.page([head], 0, 2);
    w.page([opusTags('1234tools.com', comments)], 0, 0);
    const preskip = head[10] | (head[11] << 8);
    let gran = 0, cur = [], curBytes = 0;
    const endGranule = samples ? preskip + samples : Infinity;
    for (let i = 0; i < packets.length; i++) {
      const p = packets[i];
      gran += opusSamples(p);
      cur.push(p); curBytes += p.length;
      const last = i === packets.length - 1;
      if (last || curBytes > 8000 || cur.length >= 48) {
        w.page(cur, last ? Math.min(gran, endGranule) : gran, last ? 4 : 0);
        cur = []; curBytes = 0;
      }
    }
    return new Blob(w.pages, { type: 'audio/ogg' });
  }
  /** Ogg Opus by encoding audioBlocks (at 48 kHz). */
  async function toOggOpus(blocks, channels, bitrate, signal, comments) {
    const cfg = await audioConfig('ogg', channels, 48000, bitrate);
    if (!cfg) throw new Error('this browser has no Opus encoder (WebCodecs AudioEncoder). Choose WAV, or use Chrome or Edge.');
    const packets = [];
    let head = null;
    const seconds = await encodeAudioBlocks(blocks, cfg, (c, m) => {
      const d = new Uint8Array(c.byteLength); c.copyTo(d); packets.push(d);
      if (!head && m && m.decoderConfig && m.decoderConfig.description) {
        const desc = m.decoderConfig.description;
        const u = desc instanceof ArrayBuffer ? new Uint8Array(desc) : new Uint8Array(desc.buffer, desc.byteOffset, desc.byteLength);
        if (u.length >= 19 && String.fromCharCode.apply(null, Array.from(u.subarray(0, 8))) === 'OpusHead') head = u.slice();
      }
    }, signal);
    if (!head) head = opusHead(channels, 312, 48000);
    return { blob: oggOpus(head, packets, Math.round(seconds * 48000), comments), seconds, packets: packets.length };
  }
  /** Copy an Opus or MP3 track as it is: Opus into Ogg, MP3 frames end to end. */
  async function copyAudioTrack(info, signal, onProgress) {
    const a = info.audio;
    const list = a.samples;
    const datas = [];
    for (let i = 0; i < list.length; i += 256) {
      if (signal && signal.aborted) throw abortError();
      const part = await D.read(info.reader, list.slice(i, i + 256));
      for (const d of part) datas.push(d.slice());
      if (onProgress) onProgress(i / list.length);
    }
    if (a.codec === 'mp3') return new Blob(datas, { type: 'audio/mpeg' });
    if (a.codec === 'opus') {
      const head = a.description && a.description.length >= 19 ? a.description : opusHead(a.channels || 2, 312, 48000);
      return oggOpus(head, datas, 0);
    }
    throw new Error('this sound (' + a.codec + ') cannot be copied out as it is.');
  }

  /* ------------------------------------------------------------------ */
  /* the page                                                           */
  /* ------------------------------------------------------------------ */
  /** Settings kept in localStorage under one versioned key; `ok(name, value)` accepts or rejects each stored value. */
  function store(key, defaults, ok) {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { p = null; }
    const o = Object.assign({}, defaults);
    if (p && p.v === 1) for (const k of Object.keys(defaults)) if (k in p && (!ok || ok(k, p[k]))) o[k] = p[k];
    return {
      values: o,
      save(vals) {
        const out = { v: 1 };
        for (const k of Object.keys(defaults)) out[k] = vals[k];
        try { localStorage.setItem(key, JSON.stringify(out)); } catch (e) { /* private window or storage blocked: the settings still apply to this visit */ }
      }
    };
  }

  /**
   * The tool's frame: a drop zone and hidden file input, a message line, a
   * studio (stage column and settings side) hidden until a file is in, and
   * a results list. opt: { id, accept, label, hint, kind: 'video'|'audio',
   * multiple, onFiles(files) }.
   */
  function shell(root, opt) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const wrap = el('div', 'aiimg vk ' + (opt.cls || ''));
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong></strong><span></span>';
    drop.firstChild.textContent = opt.label || 'Choose a video';
    drop.lastChild.textContent = opt.hint || 'MP4, MOV or WebM, or drop it here. Nothing is uploaded.';
    const file = el('input', 'visually-hidden'); file.type = 'file'; file.id = opt.id + '-file';
    file.accept = opt.accept || 'video/*,.mp4,.mov,.m4v,.webm,.mkv';
    if (opt.multiple) file.multiple = true;
    file.setAttribute('aria-label', opt.label || 'Choose a video');
    const msg = el('div', 'io-msg'); msg.setAttribute('role', 'status');
    const studio = el('div', 'aiimg-studio sv-studio vk-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const side = el('div', 'aiimg-side');
    studio.append(stageCol, side);
    const results = el('div', 'aiimg-results');
    wrap.append(drop, file, msg, studio, results);
    io.appendChild(wrap);
    const say = (t, kind) => { msg.textContent = t || ''; msg.className = 'io-msg' + (kind ? ' is-' + kind : ''); };
    const kindRe = opt.kind === 'audio' ? AUDIO_RE : VIDEO_RE;
    const isKind = (f) => opt.kind === 'audio' ? (/^audio\//.test(f.type) || /^video\//.test(f.type) || kindRe.test(f.name || '')) : (/^video\//.test(f.type) || kindRe.test(f.name || ''));
    const take = (list) => {
      const files = Array.from(list || []);
      if (!files.length) return;
      const good = files.filter(isKind);
      const notes = files.filter((f) => !isKind(f)).map((f) => f.name + ': not ' + (opt.kind === 'audio' ? 'a sound or video file' : 'a video') + ' (choose ' + (opt.kind === 'audio' ? 'MP3, WAV, M4A, OGG, Opus, FLAC or WebM' : 'an MP4, MOV or WebM') + ').');
      if (!good.length) { say(notes.join(' '), 'error'); return; }
      if (!opt.multiple && good.length > 1) notes.push('One ' + (opt.kind === 'audio' ? 'file' : 'video') + ' at a time: using ' + good[0].name + '; ' + good.slice(1).map((f) => f.name).join(', ') + ' not used.');
      opt.onFiles(opt.multiple ? good : [good[0]], notes);
    };
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    ['dragenter', 'dragover'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    wrap.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) take(e.dataTransfer.files); });
    file.addEventListener('change', () => { take(file.files); file.value = ''; });
    return { io, wrap, drop, file, msg, studio, stageCol, side, results, say, pick: () => file.click() };
  }

  /** A progress bar, a status line and a Cancel button around one job at a time. */
  function job(label, onRun) {
    const box = el('div', 'sv-job vk-job');
    const go = button(label, 'btn-primary', () => run());
    const cancel = button('Cancel', 'btn-ghost', () => { if (ctl) ctl.abort(); }); cancel.hidden = true;
    const row = el('div', 'aiimg-row'); row.append(go, cancel);
    const prog = el('div', 'aiimg-progress'); prog.hidden = true;
    prog.setAttribute('role', 'progressbar'); prog.setAttribute('aria-valuemin', '0'); prog.setAttribute('aria-valuemax', '100'); prog.setAttribute('aria-label', 'Progress');
    const bar = el('i'); prog.appendChild(bar);
    const status = el('p', 'aiimg-status sv-status'); status.setAttribute('aria-live', 'polite');
    box.append(row, prog, status);
    let ctl = null, started = 0;
    const api = { el: box, go, status, busy: false };
    api.progress = (p, text) => {
      const v = Math.round(clamp(p, 0, 1) * 100);
      bar.style.width = v + '%'; prog.setAttribute('aria-valuenow', String(v));
      const spent = (performance.now() - started) / 1000;
      const eta = p > 0.05 && p < 1 && spent > 1.5 ? ', about ' + Math.max(1, Math.round(spent / p - spent)) + ' s left' : '';
      status.textContent = (text || 'Working') + ': ' + v + '%' + eta + '…';
    };
    async function run() {
      if (api.busy) return;
      api.busy = true; ctl = new AbortController(); started = performance.now();
      go.disabled = true; cancel.hidden = false; prog.hidden = false; bar.style.width = '0%';
      status.textContent = 'Starting…';
      try {
        await onRun(ctl.signal, api);
      } catch (e) {
        if (e && e.name === 'AbortError') status.textContent = 'Cancelled. Nothing was saved.';
        else { status.textContent = 'It did not work: ' + ((e && e.message) || e); status.classList.add('is-error'); setTimeout(() => status.classList.remove('is-error'), 8000); }
      } finally {
        api.busy = false; ctl = null; go.disabled = false; cancel.hidden = true;
        setTimeout(() => { if (!api.busy) prog.hidden = true; }, 600);
      }
    }
    api.run = run;
    api.elapsed = () => (performance.now() - started) / 1000;
    return api;
  }

  /** A result row: name, size, details, a Download button, and the file to play. */
  function result(results, blob, name, details, opt) {
    opt = opt || {};
    const row = el('div', 'aiimg-result vk-result');
    const head = el('div', 'aiimg-result-head');
    head.append(el('strong', null, name), el('span', null, fmtBytes(blob.size) + (details ? ' · ' + details : '')),
      button('Download', 'btn-download', () => A.download(blob, name)));
    row.appendChild(head);
    if (opt.note) row.appendChild(el('p', 'field-hint vk-note', opt.note));
    if (opt.table) row.appendChild(opt.table);
    const url = URL.createObjectURL(blob);
    const t = String(blob.type);
    if (/^video\//.test(t) && opt.media !== false) {
      const v = el('video', 'sv-result-video'); v.controls = true; v.playsInline = true; v.preload = 'metadata'; v.src = url;
      v.setAttribute('aria-label', 'The new video, ' + name);
      row.appendChild(v);
    } else if (/^audio\//.test(t) && opt.media !== false) {
      const au = el('audio', 'vk-result-audio'); au.controls = true; au.preload = 'metadata'; au.src = url;
      au.setAttribute('aria-label', 'The new sound file, ' + name);
      row.appendChild(au);
    } else if (/^image\//.test(t)) {
      const im = el('img'); im.alt = name; im.src = url; row.appendChild(im);
    }
    row.dataset.url = url;
    results.insertBefore(row, results.firstChild);
    while (results.children.length > 4) { const last = results.lastChild; if (last.dataset.url) URL.revokeObjectURL(last.dataset.url); last.remove(); }
    if (opt.download !== false) A.download(blob, name);
    return row;
  }

  /** A two-column table: [[label, value], …]. */
  function table(rows, cls) {
    const t = el('table', 'vk-table ' + (cls || ''));
    const tb = el('tbody');
    for (const r of rows) {
      const tr = el('tr');
      r.forEach((c, i) => { const td = el(i === 0 ? 'th' : 'td', null, String(c)); if (i === 0) td.scope = 'row'; tr.appendChild(td); });
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    return t;
  }

  /** The file in a few words: "1920 × 1080, 0:35.3, 29.97 fps, H.264 + AAC, 16.2 MB". */
  const CODEC_NAMES = { avc1: 'H.264', avc3: 'H.264', hvc1: 'HEVC (H.265)', hev1: 'HEVC (H.265)', vp09: 'VP9', vp8: 'VP8', av01: 'AV1', mp4a: 'AAC', opus: 'Opus', vorbis: 'Vorbis', mp3: 'MP3', flac: 'FLAC' };
  function codecName(c) {
    if (!c) return 'unknown';
    if (/^pcm-/.test(c)) return 'PCM';
    const f = codecFamily(c);
    if (f === 'mp4a' && c === 'mp4a.40.5') return 'HE-AAC';
    return CODEC_NAMES[f] || c;
  }
  function describe(info) {
    const bits = [];
    if (info.width) bits.push(info.width + ' × ' + info.height);
    if (info.duration) bits.push(fmtT(info.duration));
    if (info.fps && info.video) bits.push(info.fps + ' fps');
    const codecs = [info.video && codecName(info.video.codec), info.audio && codecName(info.audio.codec)].filter(Boolean);
    if (codecs.length) bits.push(codecs.join(' + '));
    else if (info.video && !info.audio) bits.push('no sound');
    if (info.video && !info.audio) bits.push('no sound');
    bits.push(fmtBytes(info.size));
    return bits.filter((x, i, a) => a.indexOf(x) === i).join(', ');
  }

  /**
   * A trim bar over a timeline: two handles (drag, arrow keys: a frame at
   * a time when the frame times are known, else a tenth of a second;
   * Shift for a second; Home/End), typed seconds, and buttons that step
   * each handle by one frame. opt: { id, duration, frames (sorted
   * presentation times, s) | null, start, end, minGap, onChange(start,
   * end, which), labels: [startLabel, endLabel], step (the buttons' step
   * without frames, default 0.04 s), keyStep (the arrow keys', 0.1 s),
   * stepLabel ('frame') }.
   */
  function trimBar(opt) {
    const D_ = opt.duration;
    const frames = opt.frames && opt.frames.length ? opt.frames : null;
    const minGap = opt.minGap || (frames ? 0 : 0.1);
    const S = { start: opt.start || 0, end: opt.end === undefined ? D_ : opt.end };
    const box = el('div', 'vk-trim');
    const trim = el('div', 'sv-trim');
    const track = el('div', 'sv-trim-track');
    const sel = el('div', 'sv-trim-sel');
    const playhead = el('div', 'sv-trim-play'); playhead.hidden = true;
    const hS = el('button', 'sv-trim-h'), hE = el('button', 'sv-trim-h');
    hS.type = 'button'; hE.type = 'button';
    const labels = opt.labels || ['Start', 'End'];
    for (const [h, l] of [[hS, labels[0]], [hE, labels[1]]]) { h.setAttribute('role', 'slider'); h.setAttribute('aria-label', l); h.setAttribute('aria-valuemin', '0'); }
    trim.append(track, sel, playhead, hS, hE);
    const sIn = el('input', 'control'), eIn = el('input', 'control');
    for (const [i, id] of [[sIn, 'start'], [eIn, 'end']]) { i.type = 'number'; i.id = opt.id + '-' + id; i.step = '0.001'; i.min = '0'; i.inputMode = 'decimal'; }
    const stepBtn = (txt, aria, which, dir) => { const b = button(txt, 'btn-ghost sv-mini', () => stepFrame(which, dir)); b.setAttribute('aria-label', aria); return b; };
    const unit = frames ? 'one frame' : (opt.stepLabel || ((opt.step || 0.04) * 1000) + ' ms');
    const sRow = el('div', 'vk-step'); sRow.append(stepBtn('◀', labels[0] + ': ' + unit + ' earlier', 'start', -1), stepBtn('▶', labels[0] + ': ' + unit + ' later', 'start', 1));
    const eRow = el('div', 'vk-step'); eRow.append(stepBtn('◀', labels[1] + ': ' + unit + ' earlier', 'end', -1), stepBtn('▶', labels[1] + ': ' + unit + ' later', 'end', 1));
    const fS = field(labels[0] + ' (seconds)', sIn); fS.appendChild(sRow);
    const fE = field(labels[1] + ' (seconds)', eIn); fE.appendChild(eRow);
    const times = el('div', 'sv-times'); times.append(fS, fE);
    const len = el('p', 'field-hint sv-len'); len.setAttribute('aria-live', 'polite');
    box.append(trim, times, len);
    /* Frame times are whole microseconds (3.199968 s for frame 96 at 30 fps), so a time typed or
       dragged counts as on a frame when it is within half a millisecond of it. */
    const TOL = 0.0005;
    /** the index of the frame shown at t: the last frame time <= t */
    const frameIndex = (t) => { if (!frames) return -1; let lo = 0, hi = frames.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (frames[m] <= t + TOL) lo = m; else hi = m - 1; } return lo; };
    const frameAt = (t) => (frames ? frames[frameIndex(t)] : t);
    /** the index of the first frame at or after t (frames.length when none) */
    const firstFrom = (t) => { if (!frames) return -1; let lo = 0, hi = frames.length; while (lo < hi) { const m = (lo + hi) >> 1; if (frames[m] >= t - TOL) hi = m; else lo = m + 1; } return lo; };
    /* an end handle sits at the end of a frame: the next frame's start, or the duration */
    const endSnap = (t) => { if (!frames) return t; const j = Math.max(1, firstFrom(t)); return j < frames.length ? frames[j] : D_; };
    /** the last frame kept when the selection ends at t */
    const lastKept = (t) => Math.max(0, firstFrom(t) - 1);
    function sync() {
      const a = S.start / D_ * 100, b = S.end / D_ * 100;
      hS.style.left = a + '%'; hE.style.left = b + '%';
      sel.style.left = a + '%'; sel.style.width = Math.max(0, b - a) + '%';
      for (const [h, v] of [[hS, S.start], [hE, S.end]]) {
        h.setAttribute('aria-valuemax', D_.toFixed(3)); h.setAttribute('aria-valuenow', v.toFixed(3));
        h.setAttribute('aria-valuetext', fmtT(v, 3));
      }
      if (document.activeElement !== sIn) sIn.value = S.start.toFixed(3);
      if (document.activeElement !== eIn) eIn.value = S.end.toFixed(3);
      sIn.max = D_.toFixed(3); eIn.max = D_.toFixed(3);
      const nf = frames ? lastKept(S.end) - frameIndex(S.start) + 1 : 0;
      len.textContent = 'Keeping ' + fmtT(S.start, 3) + ' to ' + fmtT(S.end, 3) + ': ' + (S.end - S.start).toFixed(3) + ' s of ' + D_.toFixed(3) + ' s' + (frames ? ' (' + nf + ' frame' + (nf === 1 ? '' : 's') + ')' : '') + '.';
    }
    function set(start, end, which, quiet) {
      let s = clamp(Number(start) || 0, 0, D_), e = clamp(Number(end) || 0, 0, D_);
      if (frames) { s = frameAt(s); e = endSnap(e); }
      if (frames ? e <= s + TOL : e - s < minGap) {
        if (which === 'start') s = frames ? frames[lastKept(e)] : Math.max(0, e - minGap);
        else e = frames ? endSnap(s + 2 * TOL) : Math.min(D_, s + minGap);
      }
      S.start = Math.round(s * 1e6) / 1e6; S.end = Math.round(e * 1e6) / 1e6;
      sync();
      if (!quiet && opt.onChange) opt.onChange(S.start, S.end, which);
    }
    function stepFrame(which, dir) {
      if (frames) {
        if (which === 'start') { const i = clamp(frameIndex(S.start) + dir, 0, frames.length - 1); set(frames[i], S.end, 'start'); }
        else { const i = clamp(lastKept(S.end) + dir, 0, frames.length - 1); set(S.start, i + 1 < frames.length ? frames[i + 1] : D_, 'end'); }
      } else { const st = opt.step || 0.04; set(which === 'start' ? S.start + dir * st : S.start, which === 'end' ? S.end + dir * st : S.end, which); }
    }
    for (const [h, which] of [[hS, 'start'], [hE, 'end']]) {
      h.addEventListener('pointerdown', (e) => {
        if (box.dataset.busy) return;
        e.preventDefault(); h.setPointerCapture(e.pointerId); h.focus();
        const move = (ev) => { const r = track.getBoundingClientRect(); const t = clamp((ev.clientX - r.left) / r.width, 0, 1) * D_; if (which === 'start') set(t, S.end, 'start'); else set(S.start, t, 'end'); };
        const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); };
        h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
      });
      h.addEventListener('keydown', (e) => {
        if (box.dataset.busy) return;
        const big = e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown';
        const dir = e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp' ? 1 : 0;
        if (dir) {
          e.preventDefault();
          if (big || !frames) { const st = big ? 1 : (opt.keyStep || 0.1); if (which === 'start') set(S.start + dir * st, S.end, 'start'); else set(S.start, S.end + dir * st, 'end'); }
          else stepFrame(which, dir);
        } else if (e.key === 'Home' || e.key === 'End') {
          e.preventDefault();
          const t = e.key === 'Home' ? 0 : D_;
          if (which === 'start') set(e.key === 'Home' ? 0 : (frames ? frames[lastKept(S.end)] : S.end - minGap), S.end, 'start'); else set(S.start, e.key === 'End' ? t : S.start, 'end');
        }
      });
    }
    track.addEventListener('pointerdown', (e) => {
      if (box.dataset.busy) return;
      const r = track.getBoundingClientRect();
      const t = clamp((e.clientX - r.left) / r.width, 0, 1) * D_;
      if (Math.abs(t - S.start) <= Math.abs(t - S.end)) set(t, S.end, 'start'); else set(S.start, t, 'end');
    });
    sIn.addEventListener('change', () => set(sIn.value, S.end, 'start'));
    eIn.addEventListener('change', () => set(S.start, eIn.value, 'end'));
    set(S.start, S.end, null, true);
    return {
      el: box, state: S, set, frameAt, frameIndex, lastKept,
      get start() { return S.start; }, get end() { return S.end; },
      playhead(t) { if (t === null) { playhead.hidden = true; return; } playhead.hidden = false; playhead.style.left = clamp(t / D_ * 100, 0, 100) + '%'; },
      busy(b) { if (b) box.dataset.busy = '1'; else delete box.dataset.busy; for (const x of box.querySelectorAll('button, input')) x.disabled = !!b; }
    };
  }

  /** "This browser can …" — the codecs it offers, said plainly. */
  async function capsLine() {
    const c = await caps();
    const p = el('p', 'field-hint vk-caps');
    if (!c.webcodecs) {
      p.textContent = 'This browser has no WebCodecs, so video is re-made by playing it once and recording it (as long as the clip, usually as WebM). Chrome, Edge, Safari 16.4+ and Firefox 130+ on a computer are quicker.';
      return p;
    }
    const enc = [c.h264 && 'H.264', c.vp9 ? 'VP9' : c.vp8 && 'VP8', c.aac && 'AAC', c.opus && 'Opus'].filter(Boolean);
    p.textContent = 'This browser encodes ' + (enc.length ? enc.join(', ') : 'no video codec') + ' on the device.' + (!c.aac && c.opus ? ' It has no AAC encoder, so new MP4 sound is Opus, which plays in current browsers but not in every phone app.' : '');
    return p;
  }

  Object.assign(VK, {
    MAX_BYTES, VIDEO_RE, AUDIO_RE, fmtT, fmtRate, baseName, evenDown, abortError, extOf, MIME, boxName,
    caps, probe, release, describe, codecName, decodeFrames, seekFrames, seekTo, elementOf,
    Resampler, mixTo, audioBlocks, encodeAudioBlocks, audioConfig, videoConfig,
    copyable, openBox, remux, transcode, record, outputSize, drawFrame,
    toWav, toOggOpus, oggOpus, opusSamples, oggCrc, copyAudioTrack,
    store, shell, job, result, table, trimBar, capsLine
  });
})();
