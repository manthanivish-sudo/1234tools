/**
 * Auto Captions (offline).
 *
 * A video or audio file goes in; Whisper tiny (engine/aivid-whisper.js)
 * turns the sound into timed words on the device; the words are drawn over
 * the frames in one of four styles and the clip is re-encoded with its own
 * sound. SRT and VTT come from the same words and timings. Nothing leaves
 * the browser.
 *
 * The frame is drawn by one function whether it is the preview or a frame
 * of the export, so what is exported is what was seen. Muxing is isolated
 * behind muxVideo(): the shared runtime's encodeVideoFrames() when it has
 * one, else WebCodecs + mp4-muxer here, else MediaRecorder.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A) return;
  const { el, clamp, field, select, range, colour, check, button, sleep, fmtBytes } = A;

  const MAX_SECONDS = 600;
  const PHONE_WARN_SECONDS = 180;
  const PREVIEW_MAX = 720;
  const MAX_LINE = 42;
  const MAX_LINES = 2;
  const AUDIO_RATE = 48000;
  const FONTS = [['Sora', 'Sora — bold, modern'], ['Inter', 'Inter'], ['Impact', 'Impact'], ['Arial Black', 'Arial Black'], ['Verdana', 'Verdana'], ['Georgia', 'Georgia'], ['system-ui', 'System font']];
  const STYLES = [
    ['karaoke', 'Karaoke', 'Words light up as they are spoken'],
    ['pop', 'Pop', 'The current word jumps in size'],
    ['outline', 'Bold outline', 'White, heavy, black edge'],
    ['minimal', 'Minimal', 'A dark box under one line']
  ];
  const MODES = [['1', '1 word at a time'], ['2', '2 words at a time'], ['3', '3 words at a time'], ['line', 'Whole line, up to 2 lines']];
  const POSITIONS = [['bottom', 'Bottom, inside the safe area'], ['middle', 'Middle'], ['top', 'Top']];
  const PHONE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || !!(navigator.userAgentData && navigator.userAgentData.mobile);
  const abortError = () => { const e = new Error('Cancelled.'); e.name = 'AbortError'; return e; };
  const evenDown = (n) => Math.max(2, Math.floor(n / 2) * 2);
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtSec = (s) => s < 60 ? Math.round(s) + ' s' : Math.floor(s / 60) + ' min ' + pad2(Math.round(s % 60)) + ' s';
  const clock = (s) => { s = Math.max(0, s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = Math.floor(s % 60), ms = Math.round((s - Math.floor(s)) * 1000); return { h, m, sec, ms: ms === 1000 ? 999 : ms }; };
  const srtTime = (s) => { const c = clock(s); return pad2(c.h) + ':' + pad2(c.m) + ':' + pad2(c.sec) + ',' + String(c.ms).padStart(3, '0'); };
  const vttTime = (s) => srtTime(s).replace(',', '.');
  const on = (ctrl, fn) => { const t = ctrl.input || ctrl; t.addEventListener('input', fn); t.addEventListener('change', fn); return ctrl; };

  /* ------------------------------------------------------------------ */
  /* cues: words → what is on screen, and what goes in the files        */
  /* ------------------------------------------------------------------ */
  /** Greedy line fill: arrays of words, each line at most maxChars. */
  function wrapWords(words, maxChars) {
    const lines = [];
    let cur = [], len = 0;
    for (const w of words) {
      const add = (cur.length ? 1 : 0) + w.text.length;
      if (cur.length && len + add > maxChars) { lines.push(cur); cur = [w]; len = w.text.length; }
      else { cur.push(w); len += add; }
    }
    if (cur.length) lines.push(cur);
    return lines;
  }
  /** Cues for SRT/VTT and for line mode: ≤ 2 lines of ≤ 42 characters, strictly increasing, never overlapping. */
  function fileCues(segments) {
    const cues = [];
    for (const s of segments) {
      if (!s.words || !s.words.length) continue;
      const lines = wrapWords(s.words, MAX_LINE);
      for (let i = 0; i < lines.length; i += MAX_LINES) {
        const part = lines.slice(i, i + MAX_LINES);
        const ws = part.flat();
        cues.push({ start: ws[0].start, end: ws[ws.length - 1].end, lines: part.map((l) => l.map((w) => w.text).join(' ')), words: ws });
      }
    }
    let prev = 0;
    for (const c of cues) {
      if (c.start < prev) c.start = prev;
      if (c.end <= c.start + 0.04) c.end = c.start + 0.05;
      prev = c.end;
    }
    return cues;
  }
  /** Cues for word mode: n consecutive words of a segment at a time. */
  function wordCues(segments, n) {
    const cues = [];
    for (const s of segments) {
      const ws = s.words || [];
      for (let i = 0; i < ws.length; i += n) {
        const part = ws.slice(i, i + n);
        cues.push({ start: part[0].start, end: part[part.length - 1].end, lines: [part.map((w) => w.text).join(' ')], words: part });
      }
    }
    return cues;
  }
  /** Hold a cue on screen through a short gap so single words do not flicker. */
  function withHold(cues) {
    for (let i = 0; i < cues.length; i++) {
      const next = cues[i + 1];
      cues[i].until = next ? Math.min(cues[i].end + 0.35, next.start) : cues[i].end + 0.35;
      if (cues[i].until < cues[i].end) cues[i].until = cues[i].end;
    }
    return cues;
  }
  function toSRT(cues) {
    return cues.map((c, i) => (i + 1) + '\n' + srtTime(c.start) + ' --> ' + srtTime(c.end) + '\n' + c.lines.join('\n') + '\n').join('\n');
  }
  function toVTT(cues) {
    return 'WEBVTT\n\n' + cues.map((c) => vttTime(c.start) + ' --> ' + vttTime(c.end) + '\n' + c.lines.join('\n') + '\n').join('\n');
  }

  /* ------------------------------------------------------------------ */
  /* drawing the captions                                               */
  /* ------------------------------------------------------------------ */
  const fontFor = (st, px) => (st.preset === 'minimal' ? 600 : 800) + ' ' + px + 'px "' + (st.font || 'Sora') + '", "Inter", Arial, sans-serif';
  const hexA = (hex, a) => { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || ''); return m ? 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')' : 'rgba(0,0,0,' + a + ')'; };

  /** Draw the active cue at time t on a W×H frame. */
  function drawCaptions(ctx, W, H, t, cues, st) {
    let cue = null;
    for (const c of cues) { if (t >= c.start && t < c.until) { cue = c; break; } }
    if (!cue) return;
    const portrait = H > W;
    const safeW = W * 0.86;
    let px = Math.max(8, (Number(st.size) || 7) / 100 * W);
    const words = cue.words;
    const text = (w) => (st.uppercase ? w.text.toUpperCase() : w.text);
    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    /* lines of words: the cue's own lines in line mode, one line in word mode */
    let lines = cue.lines.length > 1 ? wrapWords(words, MAX_LINE) : [words];
    /* shrink to fit the safe width */
    const widest = () => { ctx.font = fontFor(st, px); return Math.max(...lines.map((l) => l.reduce((s, w) => s + ctx.measureText(text(w)).width, 0) + (l.length - 1) * px * 0.28)); };
    for (let k = 0; k < 8 && widest() > safeW; k++) px *= 0.9;
    ctx.font = fontFor(st, px);
    const lineH = px * 1.22;
    const blockH = lineH * lines.length;
    let cy = st.position === 'top' ? H * (portrait ? 0.16 : 0.13) : st.position === 'middle' ? H * 0.5 : H * (portrait ? 0.78 : 0.86);
    /* a caller may reserve the strip below the captions (the Reel Maker's credit line): the block's bottom, outline included, stays above maxBottom */
    if (st.maxBottom && st.position !== 'top' && st.position !== 'middle') cy = Math.min(cy, st.maxBottom - blockH / 2 - px * 0.3);
    const y0 = cy - blockH / 2 + lineH / 2;
    const strokeW = px * (st.preset === 'outline' ? 0.17 : st.preset === 'minimal' ? 0 : 0.11);
    lines.forEach((line, li) => {
      const widths = line.map((w) => ctx.measureText(text(w)).width);
      const gap = px * 0.28;
      const lineW = widths.reduce((s, w) => s + w, 0) + gap * (line.length - 1);
      let x = (W - lineW) / 2;
      const y = y0 + li * lineH;
      if (st.preset === 'minimal') {
        const padX = px * 0.4, padY = px * 0.22, r = px * 0.28;
        ctx.fillStyle = hexA(st.box || '#0b1020', 0.78);
        ctx.beginPath();
        ctx.roundRect(x - padX, y - lineH / 2 + px * 0.02 - padY / 2, lineW + padX * 2, lineH + padY - px * 0.04, r);
        ctx.fill();
      }
      line.forEach((w, i) => {
        const spoken = t >= w.start, current = t >= w.start && t < w.end;
        const s = text(w);
        const wx = x + widths[i] / 2, wy = y;
        let scale = 1, fill = st.fill || '#ffffff';
        if (st.preset === 'karaoke' && spoken) fill = st.accent || '#f7c948';
        if (st.preset === 'pop' && current) { fill = st.accent || '#f7c948'; scale = 1.18; }
        ctx.save();
        ctx.translate(wx, wy); ctx.scale(scale, scale);
        ctx.textAlign = 'center';
        if (st.preset !== 'minimal') {
          ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = px * 0.22; ctx.shadowOffsetY = px * 0.05;
          ctx.fillStyle = fill; ctx.fillText(s, 0, 0);
          ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
          if (strokeW > 0) { ctx.lineWidth = strokeW * 2; ctx.strokeStyle = st.stroke || '#000000'; ctx.strokeText(s, 0, 0); }
        }
        ctx.fillStyle = fill; ctx.fillText(s, 0, 0);
        ctx.restore();
        x += widths[i] + gap;
      });
    });
    ctx.restore();
  }

  /** The backdrop for an audio-only file: a quiet gradient and a title. */
  function drawBackdrop(ctx, W, H, name) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1020'); g.addColorStop(1, '#06080f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.fillStyle = 'rgba(247,201,72,.08)';
    ctx.beginPath(); ctx.arc(W * 0.5, H * 0.42, Math.min(W, H) * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(244,246,251,.55)';
    ctx.font = '600 ' + Math.round(W * 0.034) + 'px "Inter", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(name || '').slice(0, 48), W / 2, H * 0.09);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* muxing: one door, whichever encoder is behind it                   */
  /* ------------------------------------------------------------------ */
  const AVC = ['avc1.42001f', 'avc1.4d001f', 'avc1.640028', 'avc1.64002a', 'avc1.640032', 'avc1.640033'];
  async function pickAvc(width, height, fps, bitrate) {
    if (typeof VideoEncoder === 'undefined' || !VideoEncoder.isConfigSupported) return null;
    for (const codec of AVC) {
      const config = { codec, width, height, bitrate, framerate: fps, avc: { format: 'avc' }, latencyMode: 'quality' };
      try { const r = await VideoEncoder.isConfigSupported(config); if (r && r.supported) return r.config || config; }
      catch (e) { /* next */ }
    }
    return null;
  }
  async function pickAudio(buffer) {
    if (!buffer || typeof AudioEncoder === 'undefined' || !AudioEncoder.isConfigSupported) return null;
    const ch = Math.min(2, buffer.numberOfChannels), sr = buffer.sampleRate;
    for (const [codec, name] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
      const cfg = { codec, sampleRate: sr, numberOfChannels: ch, bitrate: ch > 1 ? 160000 : 96000 };
      try { const r = await AudioEncoder.isConfigSupported(cfg); if (r && r.supported) return { config: r.config || cfg, name }; }
      catch (e) { /* next */ }
    }
    return null;
  }
  /** Can this browser put sound in the export at all? Answered once, for the hint under the export button. */
  async function audioSupport() {
    if (typeof AudioEncoder === 'undefined') return typeof MediaRecorder !== 'undefined' ? 'recorder' : 'none';
    try { const r = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: AUDIO_RATE, numberOfChannels: 2, bitrate: 160000 }); if (r && r.supported) return 'aac'; } catch (e) { /* */ }
    try { const r = await AudioEncoder.isConfigSupported({ codec: 'opus', sampleRate: AUDIO_RATE, numberOfChannels: 2, bitrate: 160000 }); if (r && r.supported) return 'opus'; } catch (e) { /* */ }
    return typeof MediaRecorder !== 'undefined' ? 'recorder' : 'none';
  }

  /**
   * Frames in, a file out. `frames` is an async iterator of
   * { frame: VideoFrame } | { bitmap: ImageBitmap } | { canvas }, each with
   * timestampUs and durationUs. Returns { blob, ext, note, silent }.
   */
  async function muxVideo(o) {
    const forced = A.__forceRecorder === true;
    if (!forced && typeof A.encodeVideoFrames === 'function') {
      const r = await A.encodeVideoFrames(o.frames, { width: o.width, height: o.height, fps: o.fps, audio: o.audioBuffer ? { buffer: o.audioBuffer } : null, onProgress: o.onProgress, signal: o.signal, duration: o.duration });
      return Object.assign({ silent: !o.audioBuffer }, r);
    }
    if (!forced && typeof VideoEncoder !== 'undefined') {
      const r = await encodeWithWebCodecs(o);
      if (r) return r;
    }
    return recordFrames(o);
  }

  async function encodeWithWebCodecs(o) {
    const w = evenDown(o.width), h = evenDown(o.height), fps = o.fps;
    const bitrate = Math.round(clamp(w * h * fps * 0.1, 1.5e6, 12e6));
    const vconfig = await pickAvc(w, h, fps, bitrate);
    if (!vconfig) return null;
    const audio = await pickAudio(o.audioBuffer);
    const M = await import('/engine/vendor/mp4-muxer.mjs');
    const target = new M.ArrayBufferTarget();
    const muxer = new M.Muxer({
      target,
      video: { codec: 'avc', width: w, height: h, frameRate: fps },
      audio: audio ? { codec: audio.name, numberOfChannels: audio.config.numberOfChannels, sampleRate: audio.config.sampleRate } : undefined,
      fastStart: 'in-memory', firstTimestampBehavior: 'offset'
    });
    let failure = null;
    const venc = new VideoEncoder({ output: (c, m) => { try { muxer.addVideoChunk(c, m); } catch (e) { failure = e; } }, error: (e) => { failure = e; } });
    venc.configure(vconfig);
    const report = o.onProgress || (() => {});
    const dur = o.duration || 0;
    let lastKey = -Infinity, n = 0, lastTs = -1;
    try {
      for await (const item of o.frames) {
        if (o.signal && o.signal.aborted) throw abortError();
        if (failure) throw failure;
        let ts = item.timestampUs;
        if (ts <= lastTs) ts = lastTs + 1;
        lastTs = ts;
        const vf = item.frame ? item.frame : new VideoFrame(item.bitmap || item.canvas, { timestamp: ts, duration: item.durationUs });
        const key = ts - lastKey >= 2e6;
        if (key) lastKey = ts;
        venc.encode(vf, { keyFrame: key });
        vf.close();
        if (item.bitmap) item.bitmap.close();
        n++;
        while (venc.encodeQueueSize > 6) await sleep(4);
        if (dur && (n & 3) === 0) report({ fraction: Math.min(0.9, ts / 1e6 / dur * 0.9), stage: 'video', seconds: ts / 1e6 });
      }
      await venc.flush();
      if (failure) throw failure;
    } finally {
      try { if (venc.state !== 'closed') venc.close(); } catch (e) { /* done */ }
    }
    if (audio) {
      report({ fraction: 0.92, stage: 'audio' });
      const buf = o.audioBuffer, ch = audio.config.numberOfChannels, sr = buf.sampleRate;
      const aenc = new AudioEncoder({ output: (c, m) => { try { muxer.addAudioChunk(c, m); } catch (e) { failure = e; } }, error: (e) => { failure = e; } });
      aenc.configure(audio.config);
      const planes = []; for (let c = 0; c < ch; c++) planes.push(buf.getChannelData(c));
      const total = dur ? Math.min(buf.length, Math.ceil(dur * sr) + sr / 10) : buf.length;
      try {
        for (let pos = 0; pos < total; pos += 1024) {
          if (o.signal && o.signal.aborted) throw abortError();
          if (failure) throw failure;
          const len = Math.min(1024, total - pos);
          const data = new Float32Array(len * ch);
          for (let c = 0; c < ch; c++) data.set(planes[c].subarray(pos, pos + len), c * len);
          const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: len, numberOfChannels: ch, timestamp: Math.round(pos * 1e6 / sr), data });
          aenc.encode(ad); ad.close();
          if (aenc.encodeQueueSize > 24) await sleep(2);
        }
        await aenc.flush();
        if (failure) throw failure;
      } finally {
        try { if (aenc.state !== 'closed') aenc.close(); } catch (e) { /* done */ }
      }
    }
    muxer.finalize();
    report({ fraction: 1, stage: 'done' });
    const note = audio ? 'H.264 MP4 with ' + (audio.name === 'aac' ? 'AAC' : 'Opus') + ' sound' : (o.audioBuffer ? 'H.264 MP4 — this browser could not encode the sound, so the clip is silent' : 'H.264 MP4');
    return { blob: new Blob([target.buffer], { type: 'video/mp4' }), ext: 'mp4', note, silent: !audio };
  }

  /* No WebCodecs (Firefox): MediaRecorder captures the canvas in real time,
     with the decoded sound played into the same stream. */
  async function recordFrames(o) {
    if (typeof MediaRecorder === 'undefined') throw new Error('This browser cannot encode video on the device. Chrome, Edge or Safari 16.4+ can.');
    const w = evenDown(o.width), h = evenDown(o.height), fps = o.fps;
    const canvas = el('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const stream = canvas.captureStream(0);
    const track = stream.getVideoTracks()[0];
    let ac = null, start = null, withAudio = false;
    if (o.audioBuffer && (window.AudioContext || window.webkitAudioContext)) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: o.audioBuffer.sampleRate });
        const dest = ac.createMediaStreamDestination();
        const src = ac.createBufferSource(); src.buffer = o.audioBuffer; src.connect(dest);
        for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
        start = () => src.start(0);
        withAudio = true;
      } catch (e) { ac = null; }
    }
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    const mime = types.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } });
    if (!mime) throw new Error('This browser cannot record video.');
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(clamp(w * h * fps * 0.1, 1.5e6, 12e6)) });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((res) => { rec.onstop = res; });
    const report = o.onProgress || (() => {});
    rec.start(250);
    const t0 = performance.now();
    if (start) start();
    try {
      for await (const item of o.frames) {
        if (o.signal && o.signal.aborted) throw abortError();
        const due = t0 + item.timestampUs / 1000;
        const wait = due - performance.now();
        if (wait > 0) await sleep(wait);
        ctx.drawImage(item.frame || item.bitmap || item.canvas, 0, 0, w, h);
        if (item.frame) item.frame.close();
        if (item.bitmap) item.bitmap.close();
        if (track.requestFrame) track.requestFrame();
        if (o.duration) report({ fraction: Math.min(0.98, item.timestampUs / 1e6 / o.duration), stage: 'video', seconds: item.timestampUs / 1e6 });
      }
      await sleep(150);
    } finally {
      try { rec.stop(); } catch (e) { /* */ }
      await stopped;
      if (ac) { try { ac.close(); } catch (e) { /* */ } }
    }
    report({ fraction: 1, stage: 'done' });
    const mp4 = /mp4/.test(mime);
    return { blob: new Blob(chunks, { type: mp4 ? 'video/mp4' : 'video/webm' }), ext: mp4 ? 'mp4' : 'webm', silent: !withAudio,
      note: (mp4 ? 'MP4' : 'WebM') + ' recorded in real time' + (withAudio ? ' with sound' : ' — this browser could not add the sound, so the clip is silent') + (mp4 ? '' : '. This browser has no on-device MP4 encoder; WebM plays everywhere a browser does.') };
  }

  /* ------------------------------------------------------------------ */
  /* frame sources                                                      */
  /* ------------------------------------------------------------------ */
  /** Play the hidden video once and hand over every presented frame, drawn with captions, at its real media time. */
  async function* framesFromPlayback(video, width, height, fps, draw, signal) {
    const canvas = el('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const queue = [];
    let waiting = null, ended = false, lastT = -1, handle = 0, dropped = 0;
    const wake = () => { if (waiting) { const w = waiting; waiting = null; w(); } };
    const onEnded = () => { ended = true; wake(); };
    const onError = () => { ended = true; wake(); };
    const snap = (t) => {
      ctx.drawImage(video, 0, 0, width, height);
      draw(ctx, width, height, t);
      const ts = Math.round(t * 1e6), du = Math.round(1e6 / fps);
      if (typeof VideoFrame !== 'undefined') return { frame: new VideoFrame(canvas, { timestamp: ts, duration: du }), timestampUs: ts, durationUs: du };
      const copy = el('canvas'); copy.width = width; copy.height = height; copy.getContext('2d').drawImage(canvas, 0, 0);
      return { canvas: copy, timestampUs: ts, durationUs: du };
    };
    const cb = (now, meta) => {
      let t = meta.mediaTime;
      if (lastT < 0 && t < 1 / fps) t = 0;
      if (t > lastT + 1e-4) {
        if (queue.length < 8) { queue.push(snap(t)); lastT = t; wake(); }
        else { dropped++; if (dropped === 12 && video.playbackRate > 0.5) video.playbackRate = 0.5; }
      }
      if (!ended) handle = video.requestVideoFrameCallback(cb);
    };
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    video.muted = true; video.playbackRate = 1; video.currentTime = 0;
    handle = video.requestVideoFrameCallback(cb);
    await video.play();
    try {
      for (;;) {
        if (signal && signal.aborted) throw abortError();
        if (queue.length) { yield queue.shift(); continue; }
        if (ended) break;
        await new Promise((r) => { waiting = r; setTimeout(r, 400); });
      }
      while (queue.length) yield queue.shift();
    } finally {
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      try { video.cancelVideoFrameCallback(handle); } catch (e) { /* */ }
      video.pause(); video.playbackRate = 1;
      for (const q of queue) { if (q.frame) q.frame.close(); }
    }
  }
  /** Step through time at the chosen rate: for audio-only files, and for browsers without requestVideoFrameCallback. */
  async function* framesStepped(video, width, height, fps, duration, draw, signal) {
    const canvas = el('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const total = Math.max(1, Math.round(duration * fps));
    for (let i = 0; i < total; i++) {
      if (signal && signal.aborted) throw abortError();
      const t = i / fps;
      if (video) {
        await new Promise((res) => {
          const done = () => { video.removeEventListener('seeked', done); res(); };
          video.addEventListener('seeked', done);
          video.currentTime = Math.min(t, Math.max(0, duration - 0.001));
          setTimeout(done, 1500);
        });
        ctx.drawImage(video, 0, 0, width, height);
      }
      draw(ctx, width, height, t);
      yield { canvas, timestampUs: Math.round(i * 1e6 / fps), durationUs: Math.round(1e6 / fps) };
      if ((i & 3) === 3) await sleep(0);
    }
  }

  /* ------------------------------------------------------------------ */
  /* the tool                                                           */
  /* ------------------------------------------------------------------ */
  function mount(root) {
    const Wh = window.AIVidWhisper;
    if (!Wh) throw new Error('aivid-whisper.js did not load');
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const S = {
      file: null, name: 'clip', url: null, media: null, hasVideo: false, vw: 0, vh: 0, duration: 0,
      audio: null, segments: [], original: [], cues: [],
      style: { preset: 'karaoke', mode: '2', position: 'bottom', size: 7, font: 'Sora', fill: '#ffffff', accent: '#f7c948', stroke: '#000000', box: '#0b1020', uppercase: false },
      t: 0, playing: false, job: null, busy: false, transcribed: false, exporting: false, live: -1
    };

    /* ---------------- skeleton ---------------- */
    const wrap = el('div', 'aiimg aivid');
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose a video or audio file</strong><span>or drag it here — nothing is uploaded. MP4, MOV, WebM, MP3, WAV or M4A, up to 10 minutes. English speech.</span>';
    const file = el('input', 'visually-hidden');
    file.type = 'file'; file.accept = 'video/*,audio/*'; file.setAttribute('aria-label', 'Choose a video or audio file');
    const studio = el('div', 'aiimg-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage');
    const canvas = el('canvas', 'aiimg-canvas aivid-canvas');
    canvas.setAttribute('aria-label', 'Preview of the captioned video');
    const stageMsg = el('div', 'aiimg-stagemsg'); stageMsg.hidden = true;
    stage.append(canvas, stageMsg);
    const transport = el('div', 'aiimg-transport');
    const play = button('▶ Play', 'btn-ghost');
    const scrub = el('input', 'range'); scrub.type = 'range'; scrub.min = 0; scrub.max = 1000; scrub.step = 1; scrub.value = 0; scrub.setAttribute('aria-label', 'Position in the clip');
    const clockEl = el('span', 'range-val', '0.0 s');
    const change = button('Change file', 'btn-ghost', () => file.click());
    transport.append(play, scrub, clockEl, change);
    stageCol.append(stage, transport);
    const side = el('div', 'aiimg-side');
    const tabs = el('div', 'aiimg-tabs'); tabs.setAttribute('role', 'tablist');
    const panes = {};
    for (const [k, label] of [['words', 'Transcript'], ['style', 'Style'], ['export', 'Export']]) {
      const b = button(label, 'chip', () => showPane(k));
      b.dataset.pane = k; b.setAttribute('role', 'tab');
      tabs.appendChild(b);
      const p = el('div', 'aiimg-pane'); p.dataset.pane = k; p.hidden = true; p.setAttribute('role', 'tabpanel');
      panes[k] = p;
    }
    side.appendChild(tabs);
    for (const k in panes) side.appendChild(panes[k]);
    studio.append(stageCol, side);
    const msg = el('div', 'io-msg');
    wrap.append(drop, file, studio, msg);
    io.appendChild(wrap);
    function showPane(k) {
      for (const b of tabs.children) { const onIt = b.dataset.pane === k; b.classList.toggle('is-on', onIt); b.setAttribute('aria-selected', onIt ? 'true' : 'false'); }
      for (const p in panes) panes[p].hidden = p !== k;
    }
    function say(text, kind) { msg.textContent = text || ''; msg.className = 'io-msg' + (kind ? ' is-' + kind : ''); }
    function note(text) { stageMsg.textContent = text || ''; stageMsg.hidden = !text; }
    const grid = (...fields) => { const g = el('div', 'aiimg-grid2'); g.append(...fields); return g; };
    const h = (t) => el('p', 'aiimg-h', t);

    /* ---------------- drawing ---------------- */
    const pctx = canvas.getContext('2d');
    let dirty = true;
    const invalidate = () => { dirty = true; };
    function frameSize(longEdge) {
      let w, hh;
      if (S.hasVideo) { w = S.vw; hh = S.vh; } else { w = 1080; hh = 1920; }
      const portrait = hh >= w;
      const maxW = portrait ? 1080 : 1920, maxH = portrait ? 1920 : 1080;
      let s = Math.min(1, maxW / w, maxH / hh);
      if (longEdge === '720') s = Math.min(s, 720 / Math.min(w, hh));
      return { width: evenDown(w * s), height: evenDown(hh * s) };
    }
    function sizePreview() {
      const { width, height } = frameSize('1080');
      const s = Math.min(1, PREVIEW_MAX / Math.max(width, height));
      canvas.width = Math.max(2, Math.round(width * s)); canvas.height = Math.max(2, Math.round(height * s));
    }
    /** The frame at time t: the video (or the backdrop), then the captions. */
    function drawOverlay(ctx, Wd, Ht, t) { drawCaptions(ctx, Wd, Ht, t, S.cues, S.style); }
    function renderFrame(ctx, Wd, Ht, t) {
      ctx.save();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      if (S.hasVideo && S.media && S.media.readyState >= 2) ctx.drawImage(S.media, 0, 0, Wd, Ht);
      else if (S.hasVideo) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, Wd, Ht); }
      else drawBackdrop(ctx, Wd, Ht, S.name);
      drawOverlay(ctx, Wd, Ht, t);
      ctx.restore();
    }
    function draw() {
      if (!S.file) return;
      renderFrame(pctx, canvas.width, canvas.height, S.t);
      dirty = false;
    }
    let mounted = true;
    function loop() {
      if (!mounted) return;
      if (S.playing && S.media && !S.exporting) {
        S.t = S.media.currentTime;
        if (S.duration) scrub.value = Math.round(S.t / S.duration * 1000);
        clockEl.textContent = S.t.toFixed(1) + ' s';
        markLive();
        dirty = true;
        if (S.media.ended) setPlaying(false);
      }
      if (dirty) draw();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    function setPlaying(v) {
      if (!S.media) v = false;
      S.playing = v;
      if (S.media) {
        if (v) { S.media.muted = false; S.media.play().catch(() => { S.playing = false; play.textContent = '▶ Play'; }); }
        else S.media.pause();
      }
      play.textContent = v ? '❚❚ Pause' : '▶ Play';
      play.setAttribute('aria-pressed', v ? 'true' : 'false');
    }
    play.addEventListener('click', () => { if (S.exporting) return; setPlaying(!S.playing); });
    scrub.addEventListener('input', () => {
      if (S.exporting) return;
      setPlaying(false);
      S.t = Number(scrub.value) / 1000 * S.duration;
      clockEl.textContent = S.t.toFixed(1) + ' s';
      if (S.media) S.media.currentTime = S.t;
      markLive();
      invalidate();
    });

    /* ---------------- transcript pane ---------------- */
    const status = el('p', 'aiimg-status', 'Choose a video or audio file to begin.');
    const progress = el('div', 'aiimg-progress'); const bar = el('i'); progress.appendChild(bar); progress.hidden = true;
    const splitN = select('aivid-split-n', [['3', '3 words'], ['4', '4 words'], ['6', '6 words'], ['8', '8 words'], ['12', '12 words']], '6');
    const splitBtn = button('Re-split', 'btn-ghost', () => resplit(Number(splitN.value)));
    const restoreBtn = button('Restore', 'btn-ghost', () => { if (!S.original.length) return; S.segments = cloneSegs(S.original); refreshAll(); });
    const splitRow = el('div', 'aiimg-row aivid-splitrow');
    const splitField = field('Segments of', splitN);
    splitRow.append(splitField, splitBtn, restoreBtn);
    const srtLink = el('a', 'btn-download', 'Download SRT'); srtLink.download = 'captions.srt'; srtLink.href = '#';
    const vttLink = el('a', 'btn-download', 'Download VTT'); vttLink.download = 'captions.vtt'; vttLink.href = '#';
    const links = el('div', 'aivid-links'); links.append(srtLink, vttLink); links.hidden = true;
    const segList = el('div', 'aivid-segs');
    const hint = el('p', 'field-hint', 'English only in this version. Edit any line — names and numbers are where the smallest Whisper slips. ±0.1 s moves a segment; Split halves it; Re-split reflows the whole transcript into shorter segments with the same word timings.');
    panes.words.append(status, progress, segList, splitRow, links, hint);

    const cloneSegs = (segs) => segs.map((s) => ({ start: s.start, end: s.end, text: s.text, words: s.words.map((w) => ({ text: w.text, start: w.start, end: w.end })) }));
    let urls = [];
    function refreshFiles() {
      for (const u of urls) URL.revokeObjectURL(u);
      urls = [];
      const cues = fileCues(S.segments);
      const srt = new Blob([toSRT(cues)], { type: 'application/x-subrip' });
      const vtt = new Blob([toVTT(cues)], { type: 'text/vtt' });
      srtLink.href = URL.createObjectURL(srt); srtLink.download = S.name + '.srt';
      vttLink.href = URL.createObjectURL(vtt); vttLink.download = S.name + '.vtt';
      urls.push(srtLink.href, vttLink.href);
      links.hidden = !cues.length;
      S.fileCues = cues;
    }
    function refreshCues() {
      const m = S.style.mode;
      S.cues = withHold(m === 'line' ? fileCues(S.segments) : wordCues(S.segments, Number(m) || 2));
      invalidate();
    }
    function refreshAll() { renderSegs(); refreshFiles(); refreshCues(); }
    const timeLabel = (s) => s.start.toFixed(2) + ' → ' + s.end.toFixed(2) + ' s';
    function renderSegs() {
      segList.innerHTML = '';
      S.segments.forEach((s, i) => {
        const row = el('div', 'aivid-seg'); row.dataset.i = i;
        const head = el('div', 'aivid-seg-head');
        const time = el('span', 'aivid-seg-time', timeLabel(s));
        const minus = button('−0.1 s', 'btn-ghost', () => nudge(i, -0.1));
        const plus = button('+0.1 s', 'btn-ghost', () => nudge(i, 0.1));
        const split = button('Split', 'btn-ghost', () => splitSeg(i));
        const del = button('×', 'btn-ghost', () => { S.segments.splice(i, 1); refreshAll(); });
        del.setAttribute('aria-label', 'Remove this segment');
        head.append(time, minus, plus, split, del);
        const ta = el('textarea', 'control aivid-seg-text'); ta.rows = 2; ta.value = s.text; ta.setAttribute('aria-label', 'Caption text ' + (i + 1));
        ta.addEventListener('input', () => { s.text = ta.value; s.words = Wh.wordsFor(s); refreshFiles(); refreshCues(); });
        ta.addEventListener('focus', () => { if (!S.playing) { S.t = s.start + 0.01; if (S.media) S.media.currentTime = S.t; scrub.value = S.duration ? Math.round(S.t / S.duration * 1000) : 0; clockEl.textContent = S.t.toFixed(1) + ' s'; invalidate(); } });
        row.append(head, ta);
        segList.appendChild(row);
      });
    }
    function nudge(i, d) {
      const s = S.segments[i]; if (!s) return;
      const lo = -s.start, hi = Math.max(0, S.duration - s.end);
      d = clamp(d, lo, hi);
      if (!d) return;
      s.start += d; s.end += d; for (const w of s.words) { w.start += d; w.end += d; }
      refreshAll();
    }
    function splitSeg(i) {
      const s = S.segments[i]; if (!s || s.words.length < 2) return;
      const k = Math.ceil(s.words.length / 2);
      const a = s.words.slice(0, k), b = s.words.slice(k);
      const mk = (ws) => ({ start: ws[0].start, end: ws[ws.length - 1].end, text: ws.map((w) => w.text).join(' '), words: ws.map((w) => ({ text: w.text, start: w.start, end: w.end })) });
      S.segments.splice(i, 1, mk(a), mk(b));
      refreshAll();
    }
    /** Reflow every word into segments of at most n words, breaking early at the end of a sentence. */
    function resplit(n) {
      const words = S.segments.flatMap((s) => s.words);
      if (!words.length) return;
      const out = [];
      let cur = [];
      const flush = () => { if (cur.length) { out.push({ start: cur[0].start, end: cur[cur.length - 1].end, text: cur.map((w) => w.text).join(' '), words: cur.map((w) => ({ text: w.text, start: w.start, end: w.end })) }); cur = []; } };
      for (const w of words) {
        cur.push(w);
        if (cur.length >= n || /[.!?…]["”’)]?$/.test(w.text)) flush();
      }
      flush();
      S.segments = out;
      refreshAll();
    }
    function markLive() {
      let live = -1;
      for (let i = 0; i < S.segments.length; i++) { const s = S.segments[i]; if (S.t >= s.start && S.t < s.end) { live = i; break; } }
      if (live === S.live) return;
      S.live = live;
      for (const row of segList.children) row.classList.toggle('is-live', Number(row.dataset.i) === live);
    }

    /* ---------------- style pane ---------------- */
    const swatches = el('div', 'aivid-swatches');
    const swatchBtns = {};
    for (const [k, label, desc] of STYLES) {
      const b = button('', 'aivid-swatch', () => { S.style.preset = k; syncSwatches(); invalidate(); });
      b.dataset.preset = k; b.title = desc;
      const sample = el('span', 'aivid-sample is-' + k);
      sample.innerHTML = k === 'karaoke' ? '<em>Word by</em> word' : k === 'pop' ? 'Word <em>by</em> word' : 'Word by word';
      b.append(sample, el('span', 'aivid-swatch-name', label));
      swatches.appendChild(b); swatchBtns[k] = b;
    }
    function syncSwatches() { for (const k in swatchBtns) { const onIt = k === S.style.preset; swatchBtns[k].classList.toggle('is-on', onIt); swatchBtns[k].setAttribute('aria-pressed', onIt ? 'true' : 'false'); } }
    syncSwatches();
    const modeSel = on(select('aivid-mode', MODES, S.style.mode), () => { S.style.mode = modeSel.value; refreshCues(); });
    const posSel = on(select('aivid-pos', POSITIONS, S.style.position), () => { S.style.position = posSel.value; invalidate(); });
    const sizeCtl = on(range('aivid-size', 4, 12, 0.5, S.style.size, (v) => v.toFixed(1) + '%'), () => { S.style.size = Number(sizeCtl.input.value); invalidate(); });
    const fontSel = on(select('aivid-font', FONTS, S.style.font), () => { S.style.font = fontSel.value; A.ensureFont({ font: S.style.font, weight: 800 }).then(invalidate); invalidate(); });
    const upper = on(check('aivid-upper', 'UPPERCASE', S.style.uppercase), () => { S.style.uppercase = upper.input.checked; invalidate(); });
    const fillC = on(colour('aivid-fill', S.style.fill), () => { S.style.fill = fillC.value; invalidate(); });
    const accentC = on(colour('aivid-accent', S.style.accent), () => { S.style.accent = accentC.value; invalidate(); });
    const strokeC = on(colour('aivid-stroke', S.style.stroke), () => { S.style.stroke = strokeC.value; invalidate(); });
    const boxC = on(colour('aivid-box', S.style.box), () => { S.style.box = boxC.value; invalidate(); });
    panes.style.append(
      h('Style'), swatches,
      grid(field('Words on screen', modeSel), field('Position', posSel)),
      field('Size', sizeCtl, 'As a share of the frame width. 6–8% suits a 9:16 Reel.'),
      grid(field('Font', fontSel), upper),
      h('Colours'),
      grid(field('Text', fillC), field('Highlight', accentC)),
      grid(field('Outline', strokeC), field('Box (Minimal)', boxC))
    );

    /* ---------------- export pane ---------------- */
    const sizeSel = select('aivid-out-size', [['1080', 'Up to 1080 × 1920 (Full HD)'], ['720', '720 px — smaller, faster']], '1080');
    const fpsSel = select('aivid-fps', [['30', '30'], ['24', '24']], '30');
    const exportBtn = button('Export the captioned video', 'btn-primary', exportVideo);
    const cancelBtn = button('Cancel', 'btn-ghost', () => { if (S.job) S.job.abort(); }); cancelBtn.hidden = true;
    const exProgress = el('div', 'aiimg-progress'); const exBar = el('i'); exProgress.appendChild(exBar); exProgress.hidden = true;
    const exStatus = el('p', 'aiimg-status aivid-exstatus', ''); exStatus.hidden = true;
    const results = el('div', 'aiimg-results');
    const exRow = el('div', 'aiimg-row'); exRow.append(exportBtn, cancelBtn);
    const audioHint = el('p', 'field-hint', 'Encoded on your device with the original sound.');
    panes.export.append(
      h('Captioned video'),
      grid(field('Size', sizeSel), field('Frames per second', fpsSel)),
      audioHint,
      el('p', 'field-hint', 'Playing the clip through once is how the frames are read, so the export takes about as long as the clip. MP4 needs a browser with on-device video encoding (Chrome, Edge, Safari 16.4+); elsewhere the clip is recorded as WebM.'),
      exRow, exProgress, exStatus, results,
      h('Caption files'),
      el('p', 'field-hint', 'The SRT and VTT on the Transcript tab carry the same words and timings as the burned-in captions, in cues of at most two lines of 42 characters.')
    );
    audioSupport().then((kind) => {
      S.audioKind = kind;
      if (kind === 'aac' || kind === 'opus') audioHint.textContent = 'Encoded on your device with the original sound (' + (kind === 'aac' ? 'AAC' : 'Opus') + ').';
      else if (kind === 'recorder') audioHint.textContent = 'Recorded on your device as WebM with the original sound.';
      else { audioHint.textContent = 'This browser cannot encode sound, so the exported clip will be silent. Chrome, Edge or Safari 16.4+ keep the sound.'; audioHint.className = 'io-msg is-warn'; }
    });

    function addResult(blob, name, label, dims, extra) {
      const row = el('div', 'aiimg-result');
      const head = el('div', 'aiimg-result-head');
      const strong = el('strong', null, name);
      const meta = el('span', null, fmtBytes(blob.size) + ' · ' + dims + (label ? ' · ' + label : ''));
      const dl = button('Download', 'btn-download', () => A.download(blob, name));
      head.append(strong, meta, dl);
      row.appendChild(head);
      const url = URL.createObjectURL(blob);
      const v = el('video'); v.controls = true; v.playsInline = true; v.src = url; v.preload = 'metadata';
      row.appendChild(v);
      const l = el('div', 'aivid-links');
      const a = el('a', 'btn-download', 'Download ' + name.split('.').pop().toUpperCase()); a.href = url; a.download = name;
      l.appendChild(a);
      if (extra) for (const x of extra) l.appendChild(x);
      row.appendChild(l);
      results.insertBefore(row, results.firstChild);
      return row;
    }

    /* ---------------- loading a file ---------------- */
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    ['dragenter', 'dragover'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    wrap.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) loadFiles(e.dataTransfer.files); });
    file.addEventListener('change', () => { if (file.files.length) loadFiles(file.files); file.value = ''; });

    function reset() {
      if (S.job) S.job.abort();
      setPlaying(false);
      if (S.media) { try { S.media.pause(); S.media.removeAttribute('src'); S.media.load(); } catch (e) { /* */ } S.media.remove(); }
      if (S.url) URL.revokeObjectURL(S.url);
      Object.assign(S, { file: null, url: null, media: null, hasVideo: false, vw: 0, vh: 0, duration: 0, audio: null, segments: [], original: [], cues: [], t: 0, transcribed: false, live: -1 });
      segList.innerHTML = ''; links.hidden = true; progress.hidden = true; say(''); note('');
    }
    async function loadFiles(files) {
      const f = files[0];
      if (!f || S.busy) return;
      const isVideo = /^video\//.test(f.type) || /\.(mp4|m4v|mov|webm|mkv|avi|ogv)$/i.test(f.name);
      const isAudio = /^audio\//.test(f.type) || /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|weba)$/i.test(f.name);
      if (!isVideo && !isAudio) { say('That does not look like a video or an audio file. Choose an MP4, MOV, WebM, MP3, WAV or M4A.', 'error'); return; }
      reset();
      S.busy = true;
      S.file = f; S.name = String(f.name || 'clip').replace(/\.[^.]+$/, '') || 'clip';
      S.url = URL.createObjectURL(f);
      drop.hidden = true; studio.hidden = false;
      showPane('words');
      status.textContent = 'Reading ' + f.name + ' (' + fmtBytes(f.size) + ')…';
      try {
        /* the media element: a video for video, an audio for audio — both drive the preview clock */
        const media = el(isVideo ? 'video' : 'audio', 'aivid-video');
        media.muted = true; media.playsInline = true; media.preload = 'auto'; media.setAttribute('aria-hidden', 'true');
        media.src = S.url;
        stage.appendChild(media);
        S.media = media;
        const meta = await new Promise((res) => {
          const done = () => res(true);
          media.addEventListener('loadedmetadata', done, { once: true });
          media.addEventListener('error', () => res(false), { once: true });
          setTimeout(() => res(media.readyState >= 1), 8000);
        });
        S.hasVideo = isVideo && meta && media.videoWidth > 0 && media.videoHeight > 0;
        if (S.hasVideo) { S.vw = media.videoWidth; S.vh = media.videoHeight; }
        /* the sound: decoded at 48 kHz for the encoders, then 16 kHz mono for Whisper */
        status.textContent = 'Decoding the sound…';
        S.audio = await Wh.decodeAudio(f, { sampleRate: AUDIO_RATE });
        S.duration = S.audio.duration;
        if (isFinite(media.duration) && media.duration > 0 && Math.abs(media.duration - S.duration) < 0.5) S.duration = Math.min(S.duration, media.duration);
        sizePreview();
        A.ensureFont({ font: S.style.font, weight: 800 }).then(invalidate);
        media.addEventListener('loadeddata', invalidate);
        media.addEventListener('seeked', invalidate);
        try { media.currentTime = 0.001; } catch (e) { /* */ }
        invalidate();
        if (S.duration > MAX_SECONDS) {
          status.textContent = 'This file is ' + fmtSec(S.duration) + ' long.';
          say('Clips of up to 10 minutes are supported — everything is held in your browser’s memory. Trim this one first.', 'error');
          S.busy = false;
          return;
        }
        if (PHONE && S.duration > PHONE_WARN_SECONDS) say('On a phone a clip this long (' + fmtSec(S.duration) + ') will take several minutes to transcribe and to re-encode. It will work; a laptop is quicker.', 'warn');
        await transcribe();
      } catch (e) {
        status.textContent = 'That file could not be used.';
        say((e && e.message) || String(e), 'error');
      } finally { S.busy = false; }
    }

    /* ---------------- transcription ---------------- */
    async function transcribe() {
      S.job = new AbortController();
      const signal = S.job.signal;
      progress.hidden = false; bar.style.width = '0%';
      const started = performance.now();
      const live = [];
      try {
        const res = await Wh.transcribe(S.audio.samples, {
          signal,
          onLoad: (p) => {
            if (p.stage === 'ready') return;
            bar.style.width = Math.round((p.fraction || 0) * 100) + '%';
            status.textContent = p.stage === 'compile' ? 'Starting the speech model…' : 'Downloading the speech model — ' + fmtBytes(p.loaded || 0) + ' of ' + fmtBytes(p.total || 0) + '. It is kept for next time.';
          },
          onProgress: (p) => {
            bar.style.width = Math.round((p.fraction || 0) * 100) + '%';
            if (p.stage === 'window' && p.eta !== null && p.eta !== undefined) status.textContent = 'Transcribing — ' + fmtSec(p.seconds) + ' of ' + fmtSec(p.total) + ', about ' + fmtSec(Math.max(1, p.eta)) + ' left.';
            else if (p.window === 0) status.textContent = 'Transcribing the first 30 seconds' + (p.stage === 'decode' && p.tokens ? ' — ' + p.tokens + ' words so far…' : '…');
            else status.textContent = 'Transcribing — ' + fmtSec(p.seconds) + ' of ' + fmtSec(p.total) + '…';
          },
          onSegment: (seg) => { live.push(seg); S.segments = cloneSegs(live); renderSegs(); refreshCues(); }
        });
        S.segments = cloneSegs(res.segments);
        S.original = cloneSegs(res.segments);
        S.transcribed = true;
        refreshAll();
        const words = res.words.length;
        const took = ((performance.now() - started) / 1000);
        bar.style.width = '100%';
        if (!S.segments.length) { status.textContent = 'No speech was recognised in ' + fmtSec(res.seconds) + ' of sound. Check the clip has a clear English voice — ready'; }
        else status.textContent = 'Transcribed ' + fmtSec(res.seconds) + ' of speech in ' + took.toFixed(1) + ' s: ' + S.segments.length + ' segment' + (S.segments.length === 1 ? '' : 's') + ', ' + words + ' word' + (words === 1 ? '' : 's') + ' — ready';
        say(S.segments.length ? 'Read the transcript through before you export. Names, brands and numbers are where the smallest Whisper slips.' : '', S.segments.length ? 'note' : '');
      } catch (e) {
        if (e && e.name === 'AbortError') status.textContent = 'Cancelled.';
        else { status.textContent = 'Transcription failed.'; say((e && e.message) || String(e), 'error'); }
      } finally {
        S.job = null;
        setTimeout(() => { progress.hidden = true; }, 600);
      }
    }

    /* ---------------- export ---------------- */
    async function exportVideo() {
      if (!S.file || S.job || !S.audio) return;
      if (!S.segments.length) { say('There are no captions to burn in yet.', 'warn'); return; }
      const { width, height } = frameSize(sizeSel.value);
      const fps = Number(fpsSel.value);
      S.job = new AbortController();
      S.exporting = true;
      setPlaying(false);
      exportBtn.disabled = true; cancelBtn.hidden = false; exProgress.hidden = false; exStatus.hidden = false; exBar.style.width = '0%';
      exStatus.textContent = 'Encoding the video…';
      note('Exporting — the preview is paused');
      const started = performance.now();
      const onProgress = (p) => {
        const f = p.fraction || 0;
        exBar.style.width = Math.round(f * 100) + '%';
        const spent = (performance.now() - started) / 1000;
        exStatus.textContent = (p.stage === 'audio' ? 'Encoding the sound' : 'Encoding the video') + ' — ' + Math.round(f * 100) + '%' + (f > 0.04 && f < 1 ? ', about ' + fmtSec(Math.max(1, spent / f - spent)) + ' left' : '') + '.';
      };
      try {
        const draw = drawOverlay;
        const media = S.media;
        const useRvfc = S.hasVideo && media && 'requestVideoFrameCallback' in media;
        const frames = S.hasVideo
          ? (useRvfc ? framesFromPlayback(media, width, height, fps, draw, S.job.signal) : framesStepped(media, width, height, fps, S.duration, draw, S.job.signal))
          : framesStepped(null, width, height, fps, S.duration, (ctx, Wd, Ht, t) => { drawBackdrop(ctx, Wd, Ht, S.name); draw(ctx, Wd, Ht, t); }, S.job.signal);
        const r = await muxVideo({ width, height, fps, frames, audioBuffer: S.audio.audioBuffer, duration: S.duration, onProgress, signal: S.job.signal });
        const name = S.name + '-captions.' + r.ext;
        const srt = el('a', 'btn-download', 'Download SRT'); srt.href = srtLink.href; srt.download = srtLink.download;
        const vtt = el('a', 'btn-download', 'Download VTT'); vtt.href = vttLink.href; vtt.download = vttLink.download;
        addResult(r.blob, name, (r.note || (r.ext === 'mp4' ? 'MP4' : 'WebM')) + ' · ' + S.duration.toFixed(1) + ' s · ' + fps + ' fps' + (r.silent ? ' · no sound' : ''), width + '×' + height, [srt, vtt]);
        A.download(r.blob, name);
        exStatus.textContent = 'Done in ' + fmtSec((performance.now() - started) / 1000) + '.' + (r.silent ? ' The sound could not be encoded by this browser, so the clip is silent.' : '');
        if (r.silent) say('This browser could not encode the sound track, so the exported clip has no sound. Chrome, Edge or Safari 16.4+ keep it.', 'warn');
        else if (r.ext === 'webm') say(r.note, 'warn');
        else say('');
      } catch (e) {
        if (e && e.name === 'AbortError') exStatus.textContent = 'Cancelled.';
        else { exStatus.textContent = 'The export failed.'; say((e && e.message) || String(e), 'error'); }
      } finally {
        S.job = null; S.exporting = false;
        exportBtn.disabled = false; cancelBtn.hidden = true; exProgress.hidden = true;
        note('');
        if (S.media) { try { S.media.pause(); S.media.currentTime = S.t; } catch (e) { /* */ } }
        invalidate();
      }
    }

    showPane('words');
    return { state: S, renderFrame, loadFiles, muxVideo, destroy: () => { mounted = false; reset(); } };
  }

  A.tools['auto-captions'] = { mount, muxVideo, drawCaptions, fileCues, wordCues, toSRT, toVTT };
})();
