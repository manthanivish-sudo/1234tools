/**
 * Face Blur (everyone but me).
 *
 * A 1.5 MB face detector (Ultra-Light-Fast-Generic-Face-Detector-1MB, MIT)
 * runs on the device through ONNX Runtime's WebAssembly build. Every face
 * it finds is blurred, pixelated or blocked out unless it is tapped to be
 * kept. A photo is exported at full size; a video is read frame by frame
 * from a hidden <video>, the faces are followed between detections, and
 * the frames are encoded again with the original sound. Nothing leaves
 * the browser.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A) return;
  const { el, clamp, field, select, range, colour, check, button, sleep, fmtBytes } = A;

  const MODEL_URL = '/engine/models/ultraface-rfb-640.onnx';
  const MODEL_BYTES = 1575192;
  const ORT_DIR = '/engine/vendor/ort/';
  const IN_W = 640, IN_H = 480;          /* what the network sees */
  const PREVIEW_MAX = 1280;
  const VIDEO_MAX_W = 1280, VIDEO_MAX_H = 720, VIDEO_MAX_SECONDS = 60;
  const MEMORY_FRAMES = 15;              /* a face is carried this long after its last sighting */
  const lerp = (a, b, t) => a + (b - a) * t;
  const abortError = () => { const e = new Error('Cancelled.'); e.name = 'AbortError'; return e; };

  /* ------------------------------------------------------------------ */
  /* the runtime and the session                                        */
  /* ------------------------------------------------------------------ */
  /* aiimg-core is growing A.runtime / A.loadSession; until a page has
     them, the same work is done here. One session per page. */
  let ortLib = null, sessionPromise = null;
  function runtime() {
    if (typeof A.runtime === 'function') return A.runtime();
    if (!ortLib) {
      ortLib = import(ORT_DIR + 'ort.wasm.min.mjs').then((m) => {
        const ort = m.default && m.default.InferenceSession ? m.default : m;
        ort.env.wasm.wasmPaths = ORT_DIR;
        ort.env.wasm.numThreads = 1;
        return ort;
      }).catch(() => {
        ortLib = null;
        throw new Error('The AI runtime could not be loaded. You may be offline — the first run needs the 14 MB runtime and the 1.5 MB detector, after which both are cached.');
      });
    }
    return ortLib;
  }
  async function fetchWithProgress(url, expected, onProgress) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('The face detector could not be downloaded (HTTP ' + res.status + ').');
    const total = Number(res.headers.get('content-length')) || expected;
    if (!res.body || !res.body.getReader) return new Uint8Array(await res.arrayBuffer());
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length;
      if (onProgress) onProgress({ stage: 'download', fraction: Math.min(1, got / Math.max(total, got)), loaded: got, total: Math.max(total, got) });
    }
    const out = new Uint8Array(got);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }
  function session(url, bytes, onProgress) {
    if (sessionPromise) return sessionPromise;
    sessionPromise = (async () => {
      if (typeof A.loadSession === 'function') {
        const r = await A.loadSession(url, { bytes, onProgress });
        if (r && r.session && r.ort) return { ort: r.ort, session: r.session };
        if (r && typeof r.run === 'function') return { ort: await runtime(), session: r };
      }
      const ort = await runtime();
      const data = await fetchWithProgress(url, bytes, onProgress);
      const s = await ort.InferenceSession.create(data, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      return { ort, session: s };
    })().catch((e) => { sessionPromise = null; throw e; });
    return sessionPromise;
  }

  /* ------------------------------------------------------------------ */
  /* the detector                                                       */
  /* ------------------------------------------------------------------ */
  const inCanvas = document.createElement('canvas');
  inCanvas.width = IN_W; inCanvas.height = IN_H;
  const inCtx = inCanvas.getContext('2d', { willReadFrequently: true });
  const inputArr = new Float32Array(3 * IN_W * IN_H);

  /** One run on a region of `src`; candidates come back in `src` pixels. */
  async function runRegion(R, src, rx, ry, rw, rh, thr, quality) {
    inCtx.imageSmoothingEnabled = true; inCtx.imageSmoothingQuality = quality || 'medium';
    inCtx.drawImage(src, rx, ry, rw, rh, 0, 0, IN_W, IN_H);
    const px = inCtx.getImageData(0, 0, IN_W, IN_H).data;
    const n = IN_W * IN_H;
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      inputArr[i] = (px[j] - 127) / 128;
      inputArr[n + i] = (px[j + 1] - 127) / 128;
      inputArr[2 * n + i] = (px[j + 2] - 127) / 128;
    }
    const out = await R.session.run({ input: new R.ort.Tensor('float32', inputArr, [1, 3, IN_H, IN_W]) });
    const sc = out.scores.data, bx = out.boxes.data, N = out.scores.dims[1];
    const found = [];
    for (let i = 0; i < N; i++) {
      const s = sc[i * 2 + 1];
      if (s < thr) continue;
      const x1 = bx[i * 4] * rw + rx, y1 = bx[i * 4 + 1] * rh + ry, x2 = bx[i * 4 + 2] * rw + rx, y2 = bx[i * 4 + 3] * rh + ry;
      if (x2 - x1 < 2 || y2 - y1 < 2) continue;
      found.push({ x: x1, y: y1, w: x2 - x1, h: y2 - y1, score: s });
    }
    return found;
  }

  /**
   * The whole picture, then a 2×2 grid of overlapping tiles when `grids`
   * has 2, then — for Small faces — tiles in the network's own 4:3 shape,
   * 320×240 source pixels on a picture up to 1600 px (so each is enlarged
   * twice and nothing is squashed), overlapping by a quarter.
   */
  function regionsFor(w, h, grids, small) {
    const out = [[0, 0, w, h]];
    for (const g of grids) {
      const tw = w / g, th = h / g, ox = tw * 0.2, oy = th * 0.2;
      for (let gy = 0; gy < g; gy++) {
        for (let gx = 0; gx < g; gx++) {
          const x0 = Math.max(0, gx * tw - ox), y0 = Math.max(0, gy * th - oy);
          const x1 = Math.min(w, (gx + 1) * tw + ox), y1 = Math.min(h, (gy + 1) * th + oy);
          out.push([x0, y0, x1 - x0, y1 - y0]);
        }
      }
    }
    if (small) {
      const tw = Math.min(w, Math.max(320, Math.max(w, h) / 5)), th = Math.min(h, tw * 0.75);
      const steps = (len, t) => { const a = []; const st = t * 0.75; for (let p = 0; p + t < len + 1e-6; p += st) a.push(p); if (!a.length || a[a.length - 1] + t < len - 1) a.push(Math.max(0, len - t)); return a; };
      for (const y of steps(h, th)) for (const x of steps(w, tw)) out.push([x, y, Math.min(tw, w - x), Math.min(th, h - y)]);
    }
    return out;
  }
  const inter = (a, b) => {
    const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return ix > 0 && iy > 0 ? ix * iy : 0;
  };
  const iou = (a, b) => { const i = inter(a, b); return i ? i / (a.w * a.h + b.w * b.h - i) : 0; };

  /* Hard NMS, greedy by score. A box also goes when it sits mostly inside
     a kept one, or merely touches a kept one three times its size: both
     are the piece of a face that a tile boundary cuts off. */
  function nms(cands) {
    cands.sort((a, b) => b.score - a.score);
    const keep = [];
    for (const c of cands) {
      let ok = true;
      for (const k of keep) {
        const i = inter(c, k);
        if (!i) continue;
        const ca = c.w * c.h, ka = k.w * k.h;
        if (i / (ca + ka - i) > 0.3 || i / Math.min(ca, ka) > 0.5 || ka > 3 * ca) { ok = false; break; }
      }
      if (ok) keep.push(c);
    }
    return keep;
  }

  /**
   * Faces in `src` (a canvas, image or video of size w×h), largest first.
   * `grids` lists the extra tilings to run (e.g. [2] or [2, 3]).
   */
  async function detectFaces(R, src, w, h, o) {
    const regions = regionsFor(w, h, o.grids || [], !!o.small);
    const smallFrom = 1 + (o.grids || []).reduce((n, g) => n + g * g, 0);
    const cands = [];
    for (let i = 0; i < regions.length; i++) {
      if (o.signal && o.signal.aborted) throw abortError();
      const [rx, ry, rw, rh] = regions[i];
      const found = await runRegion(R, src, rx, ry, rw, rh, o.thr, i >= smallFrom ? (o.smallQuality || 'medium') : 'medium');
      if (i === 0) cands.push(...found);
      else {
        /* a face cut by an inner tile edge is only part of a face */
        const tol = 0.01;
        for (const f of found) {
          if ((rx > 0 && f.x <= rx + rw * tol) || (ry > 0 && f.y <= ry + rh * tol) ||
              (rx + rw < w && f.x + f.w >= rx + rw * (1 - tol)) || (ry + rh < h && f.y + f.h >= ry + rh * (1 - tol))) continue;
          cands.push(f);
        }
      }
      if (o.onProgress) o.onProgress((i + 1) / regions.length);
      if (o.yield !== false) await sleep(0);
    }
    return nms(cands).sort((a, b) => b.w * b.h - a.w * a.h);
  }

  /* ------------------------------------------------------------------ */
  /* the effect                                                         */
  /* ------------------------------------------------------------------ */
  const scratch = [document.createElement('canvas'), document.createElement('canvas')];

  /** The box with the style's margin, in the same units. */
  function expand(f, style) {
    const m = clamp(Number(style.margin) || 0, 0, 2);
    const ex = f.w * m / 2, ey = f.h * m / 2;
    return { x: f.x - ex, y: f.y - ey - f.h * m * 0.1, w: f.w + 2 * ex, h: f.h + 2 * ey + f.h * m * 0.1 };
  }

  /**
   * Destroy one box of `ctx.canvas` in place. Blur and pixels both shrink
   * the region to a handful of samples and draw it back up — a soft blur
   * reads back with smoothing, pixel blocks without — so there is nothing
   * to reverse however the output is examined.
   */
  function maskFace(ctx, box, style) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const x0 = clamp(Math.floor(box.x), 0, W), y0 = clamp(Math.floor(box.y), 0, H);
    const x1 = clamp(Math.ceil(box.x + box.w), 0, W), y1 = clamp(Math.ceil(box.y + box.h), 0, H);
    const w = x1 - x0, h = y1 - y0;
    if (w < 1 || h < 1) return;
    ctx.save();
    if (style.oval) { ctx.beginPath(); ctx.ellipse(x0 + w / 2, y0 + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.clip(); }
    if (style.mode === 'solid') {
      ctx.fillStyle = style.colour || '#1a1a1a';
      ctx.fillRect(x0, y0, w, h);
      ctx.restore();
      return;
    }
    const pixels = style.mode === 'pixelate';
    const cells = pixels ? clamp(Math.round(Number(style.blocks) || 8), 2, 64)
      : clamp(Math.round(lerp(14, 2, (clamp(Number(style.strength) || 7, 1, 10) - 1) / 9)), 2, 64);
    const long = Math.max(w, h);
    const sw = Math.max(1, Math.round(w / long * cells)), sh = Math.max(1, Math.round(h / long * cells));
    let src = ctx.canvas, sx = x0, sy = y0, cw = w, ch = h, k = 0;
    /* halve until the final step is at most 2:1, so every source pixel counts */
    while (cw > sw * 2 && ch > sh * 2) {
      const nw = Math.max(sw, Math.round(cw / 2)), nh = Math.max(sh, Math.round(ch / 2));
      const c = scratch[k & 1]; k++;
      c.width = nw; c.height = nh;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(src, sx, sy, cw, ch, 0, 0, nw, nh);
      src = c; sx = 0; sy = 0; cw = nw; ch = nh;
    }
    const small = scratch[k & 1];
    small.width = sw; small.height = sh;
    const sctx = small.getContext('2d');
    sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(src, sx, sy, cw, ch, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = !pixels;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, sw, sh, x0, y0, w, h);
    ctx.restore();
  }

  /** Mask every face that is not kept. `s` scales face units to canvas units. */
  function maskAll(ctx, faces, s, style) {
    for (const f of faces) {
      if (f.keep) continue;
      const b = expand(f, style);
      maskFace(ctx, { x: b.x * s, y: b.y * s, w: b.w * s, h: b.h * s }, style);
    }
  }

  /* ------------------------------------------------------------------ */
  /* following faces through a clip                                     */
  /* ------------------------------------------------------------------ */
  /**
   * Boxes are matched to tracks by IoU against where each track was
   * expected to be; a matched track remembers where it was at the last
   * detection, so the frames in between get a box on the straight line
   * from there to here. An unmatched track coasts on its velocity for
   * MEMORY_FRAMES, which is what stops a face flickering when the
   * detector misses it on one pass.
   */
  function makeTracker() {
    let nextId = 1;
    const tracks = [];
    function update(dets, frame, gap) {
      for (const t of tracks) t.pred = { x: t.x + t.vx * gap, y: t.y + t.vy * gap, w: t.w, h: t.h };
      const pairs = [];
      for (const d of dets) for (const t of tracks) { const v = iou(d, t.pred); if (v > 0.2) pairs.push([v, d, t]); }
      pairs.sort((a, b) => b[0] - a[0]);
      const usedD = new Set(), usedT = new Set();
      for (const [, d, t] of pairs) {
        if (usedD.has(d) || usedT.has(t)) continue;
        usedD.add(d); usedT.add(t);
        t.prev = { x: t.x, y: t.y, w: t.w, h: t.h, frame: t.frame };
        t.vx = (d.x - t.x) / gap; t.vy = (d.y - t.y) / gap;
        t.x = d.x; t.y = d.y; t.w = d.w; t.h = d.h; t.frame = frame; t.score = d.score; t.hits++; t.missed = 0;
      }
      for (const t of tracks) {
        if (usedT.has(t)) continue;
        t.missed += gap;
        t.prev = { x: t.x, y: t.y, w: t.w, h: t.h, frame: t.frame };
        t.x = t.pred.x; t.y = t.pred.y; t.frame = frame;
        t.vx *= 0.7; t.vy *= 0.7;
      }
      for (const d of dets) {
        if (usedD.has(d)) continue;
        tracks.push({ id: nextId++, x: d.x, y: d.y, w: d.w, h: d.h, vx: 0, vy: 0, frame, prev: null, hits: 1, missed: 0, keep: false, score: d.score });
      }
      for (let i = tracks.length - 1; i >= 0; i--) if (tracks[i].missed > MEMORY_FRAMES) tracks.splice(i, 1);
    }
    /** Every live track's box at `frame`, interpolated where a frame lies between two detections. */
    function boxesAt(frame) {
      const out = [];
      for (const t of tracks) {
        if (t.missed > MEMORY_FRAMES) continue;
        if (!t.prev || frame >= t.frame || t.frame <= t.prev.frame) { out.push({ id: t.id, x: t.x, y: t.y, w: t.w, h: t.h, keep: t.keep }); continue; }
        const a = clamp((frame - t.prev.frame) / (t.frame - t.prev.frame), 0, 1);
        out.push({ id: t.id, x: lerp(t.prev.x, t.x, a), y: lerp(t.prev.y, t.y, a), w: lerp(t.prev.w, t.w, a), h: lerp(t.prev.h, t.h, a), keep: t.keep });
      }
      return out;
    }
    /** Mark the track under a tapped box as kept. */
    function keepLike(box) {
      let best = null, bv = 0.3;
      for (const t of tracks) { const v = iou(box, t); if (v > bv) { bv = v; best = t; } }
      if (best) best.keep = true;
      return !!best;
    }
    return { tracks, update, boxesAt, keepLike };
  }

  /* ------------------------------------------------------------------ */
  /* reading a clip frame by frame                                      */
  /* ------------------------------------------------------------------ */
  function seekTo(video, t) {
    return new Promise((res, rej) => {
      /* 'seeked' can come before the new frame is on the element; wait for it to be presented */
      const done = () => {
        video.removeEventListener('seeked', done); video.removeEventListener('error', fail);
        if (typeof video.requestVideoFrameCallback !== 'function') return res();
        let ok = false; const go = () => { if (!ok) { ok = true; res(); } };
        video.requestVideoFrameCallback(go); setTimeout(go, 250);
      };
      const fail = () => { video.removeEventListener('seeked', done); video.removeEventListener('error', fail); rej(new Error('The video could not be decoded.')); };
      video.addEventListener('seeked', done); video.addEventListener('error', fail);
      video.currentTime = t;
    });
  }

  /**
   * Every frame of `video` up to `until` seconds, in order, through
   * requestVideoFrameCallback. With `step` the clip is paused on each
   * frame while `onFrame` works and resumed after it, so no frame is
   * skipped however long the work takes; without it the clip plays in
   * real time and `onFrame` must keep up. Browsers without the callback
   * seek to each frame instead, at `fps` frames a second.
   */
  function readFrames(video, o) {
    if (typeof video.requestVideoFrameCallback !== 'function') {
      return (async () => {
        const n = Math.ceil(Math.min(o.until, video.duration || o.until) * o.fps);
        for (let i = 0; i < n; i++) {
          if (o.signal && o.signal.aborted) throw abortError();
          const t = i / o.fps;
          if (t >= o.until) break;
          await seekTo(video, t);
          await o.onFrame(t, 1 / o.fps);
        }
      })();
    }
    return new Promise((resolve, reject) => {
      let last = -1, done = false, lastDt = 1 / (o.fps || 30);
      const finish = (e) => {
        if (done) return;
        done = true;
        try { video.pause(); } catch (x) { /* already */ }
        video.removeEventListener('ended', onEnd); video.removeEventListener('error', onErr);
        if (e) reject(e); else resolve();
      };
      const onEnd = () => finish();
      const onErr = () => finish(new Error('The video could not be decoded.'));
      video.addEventListener('ended', onEnd);
      video.addEventListener('error', onErr);
      const tick = async (now, meta) => {
        if (done) return;
        if (o.signal && o.signal.aborted) return finish(abortError());
        const t = meta && typeof meta.mediaTime === 'number' ? meta.mediaTime : video.currentTime;
        if (t < last - 0.5) return finish();        /* it looped: the clip is over */
        if (t >= o.until) return finish();
        if (t > last) {
          if (last >= 0) lastDt = t - last;
          last = t;
          if (o.step) { try { video.pause(); } catch (x) { /* */ } }
          try { await o.onFrame(t, lastDt); } catch (e) { return finish(e); }
          if (done) return;
          if (o.step) {
            video.requestVideoFrameCallback(tick);
            video.play().catch((e) => finish(e));
            return;
          }
        }
        video.requestVideoFrameCallback(tick);
      };
      video.requestVideoFrameCallback(tick);
      video.play().catch((e) => finish(e));
    });
  }

  /* ------------------------------------------------------------------ */
  /* encoding                                                           */
  /* ------------------------------------------------------------------ */
  function asyncQueue() {
    const items = [];
    let waiting = null, closed = false, error = null;
    const wake = () => { if (waiting) { const w = waiting; waiting = null; w(); } };
    return {
      push(v) { items.push(v); wake(); },
      close(e) { closed = true; error = e || null; wake(); },
      get size() { return items.length; },
      async *[Symbol.asyncIterator]() {
        for (;;) {
          if (items.length) { yield items.shift(); continue; }
          if (closed) { if (error) throw error; return; }
          await new Promise((r) => { waiting = r; });
        }
      }
    };
  }

  const evenDown = (n) => Math.max(2, Math.floor(n / 2) * 2);
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

  /** An AudioBuffer at another sample rate, through an offline context. */
  async function resample(buffer, rate) {
    if (buffer.sampleRate === rate) return buffer;
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new Ctx(buffer.numberOfChannels, Math.ceil(buffer.duration * rate), rate);
    const src = ctx.createBufferSource();
    src.buffer = buffer; src.connect(ctx.destination); src.start();
    return ctx.startRendering();
  }

  /**
   * MP4 (or whatever the browser can make) from an async iterator of
   * frames `{ frame: VideoFrame } | { canvas }` with `timestampUs` and
   * `durationUs`, plus the soundtrack as an AudioBuffer.
   * Returns { blob, ext, note, sound } where `sound` says what happened
   * to the audio: 'kept', 'removed' or 'none'. Returns null when the
   * browser has no on-device encoder (the caller records instead).
   *
   * === muxing seam: when aiimg-core gains A.encodeVideoFrames (Mediabunny),
   * the branch below hands over to it and the mp4-muxer code can go. ===
   */
  async function muxVideo(o) {
    const { width, height, fps, frames, audioBuffer, onProgress, signal } = o;
    if (typeof A.encodeVideoFrames === 'function') {
      const r = await A.encodeVideoFrames(frames, { width, height, fps, audio: audioBuffer ? { buffer: audioBuffer } : null, onProgress, signal, totalFrames: o.totalFrames });
      if (r && r.blob) return { blob: r.blob, ext: r.ext || 'mp4', note: r.note || '', sound: r.sound || (audioBuffer ? (r.audio === false ? 'removed' : 'kept') : 'none') };
      return r;
    }
    /* ---- (b) mp4-muxer + WebCodecs, until Mediabunny lands ---- */
    const bitrate = Math.round(clamp(width * height * fps * 0.12, 1.2e6, 16e6));
    const config = await pickAvc(width, height, fps, bitrate);
    if (!config) return null;
    const M = await import('/engine/vendor/mp4-muxer.mjs');
    let audioCfg = null, audioCodec = null, audio = null;
    if (audioBuffer && typeof AudioEncoder !== 'undefined' && AudioEncoder.isConfigSupported) {
      const channels = Math.min(2, Math.max(1, audioBuffer.numberOfChannels));
      for (const [codec, name, rate] of [['mp4a.40.2', 'aac', audioBuffer.sampleRate], ['opus', 'opus', 48000], ['mp4a.40.2', 'aac', 48000]]) {
        const c = { codec, sampleRate: rate, numberOfChannels: channels, bitrate: 128000 };
        try { const r = await AudioEncoder.isConfigSupported(c); if (r && r.supported) { audioCfg = Object.assign({}, c, r.config || {}); audioCodec = name; break; } }
        catch (e) { /* next */ }
      }
      if (audioCfg) {
        try { audio = await resample(audioBuffer, audioCfg.sampleRate); }
        catch (e) { audioCfg = null; audio = null; }
      }
    }
    const target = new M.ArrayBufferTarget();
    const muxer = new M.Muxer({
      target,
      video: { codec: 'avc', width, height, frameRate: fps },
      audio: audioCfg ? { codec: audioCodec, numberOfChannels: audioCfg.numberOfChannels, sampleRate: audioCfg.sampleRate } : undefined,
      fastStart: 'in-memory', firstTimestampBehavior: 'offset'
    });
    let failure = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta); } catch (e) { failure = e; } },
      error: (e) => { failure = e; }
    });
    encoder.configure(config);
    let i = 0;
    try {
      for await (const f of frames) {
        if (signal && signal.aborted) throw abortError();
        if (failure) throw failure;
        const vf = f.frame || new VideoFrame(f.canvas, { timestamp: f.timestampUs, duration: f.durationUs });
        encoder.encode(vf, { keyFrame: i % (fps * 2) === 0 });
        vf.close();
        i++;
        while (encoder.encodeQueueSize > 4) await sleep(4);
        if (onProgress && (i & 3) === 0) onProgress(i);
      }
      await encoder.flush();
      if (failure) throw failure;
    } finally {
      try { if (encoder.state !== 'closed') encoder.close(); } catch (e) { /* done */ }
    }
    /* the soundtrack, after the picture so the two do not fight for the thread */
    let sound = audioBuffer ? 'removed' : 'none';
    if (audioCfg && audio) {
      let aFail = null;
      const aenc = new AudioEncoder({
        output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta); } catch (e) { aFail = e; } },
        error: (e) => { aFail = e; }
      });
      try {
        aenc.configure(audioCfg);
        const ch = audioCfg.numberOfChannels, rate = audio.sampleRate;
        const total = Math.min(audio.length, Math.ceil((o.seconds || audio.duration) * rate));
        const CHUNK = 4096;
        for (let off = 0; off < total; off += CHUNK) {
          if (signal && signal.aborted) throw abortError();
          const n = Math.min(CHUNK, total - off);
          const data = new Float32Array(n * ch);
          for (let c = 0; c < ch; c++) data.set(audio.getChannelData(Math.min(c, audio.numberOfChannels - 1)).subarray(off, off + n), c * n);
          const ad = new AudioData({ format: 'f32-planar', sampleRate: rate, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round(off / rate * 1e6), data });
          aenc.encode(ad);
          ad.close();
          if (aenc.encodeQueueSize > 8) await sleep(2);
        }
        await aenc.flush();
        if (aFail) throw aFail;
        sound = 'kept';
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        sound = 'removed';
      } finally {
        try { if (aenc.state !== 'closed') aenc.close(); } catch (e) { /* done */ }
      }
    }
    muxer.finalize();
    return { blob: new Blob([target.buffer], { type: 'video/mp4' }), ext: 'mp4', note: 'H.264 MP4' + (sound === 'kept' ? ' · ' + (audioCodec === 'aac' ? 'AAC' : 'Opus') + ' sound' : ''), sound };
    /* ---- /(b) ---- */
  }

  /* ------------------------------------------------------------------ */
  /* the tool                                                           */
  /* ------------------------------------------------------------------ */
  const isVideoFile = (f) => /^video\//.test(f.type || '') || /\.(mp4|m4v|mov|webm|mkv|ogv|3gp)$/i.test(f.name || '');
  const fmtTime = (s) => (s < 60 ? s.toFixed(1) + ' s' : Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0'));

  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const S = {
      kind: null, image: null, faces: [], video: null, seeds: [], frameFaces: [], t: 0,
      style: { mode: 'blur', strength: 7, blocks: 8, colour: '#1a1a1a', margin: 0.3, oval: false },
      size: 'normal', thr: 0.7, job: null, exporting: false, detecting: 0, drag: null, R: null
    };

    /* ---------------- skeleton ---------------- */
    const wrap = el('div', 'aiimg aiimg-face');
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose a photo</strong><span>or drag it here — nothing is uploaded. JPEG, PNG, WebP or HEIC.</span>';
    const altRow = el('span', 'aiimg-face-alt');
    const videoBtn = button('Or choose a video', 'btn-ghost', (e) => { e.stopPropagation(); videoFile.click(); });
    altRow.append(videoBtn, el('span', 'aiimg-face-alt-hint', 'MP4, MOV or WebM, up to a minute. Exported at up to 1280×720 with the sound kept.'));
    drop.appendChild(altRow);
    const file = el('input', 'visually-hidden');
    file.type = 'file'; file.accept = 'image/*'; file.setAttribute('aria-label', 'Choose a photo');
    const videoFile = el('input', 'visually-hidden');
    videoFile.type = 'file'; videoFile.accept = 'video/*'; videoFile.setAttribute('aria-label', 'Choose a video');
    const vid = el('video', 'aiimg-face-video');
    vid.muted = true; vid.playsInline = true; vid.preload = 'auto'; vid.setAttribute('playsinline', ''); vid.setAttribute('muted', '');

    const studio = el('div', 'aiimg-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage');
    const canvas = el('canvas', 'aiimg-canvas aiimg-face-canvas');
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Preview. Tap a face to keep it or blur it; drag to draw a box over a face that was missed.');
    const stageMsg = el('div', 'aiimg-stagemsg'); stageMsg.hidden = true;
    stage.append(canvas, stageMsg);
    const transport = el('div', 'aiimg-transport');
    const scrub = el('input', 'range');
    scrub.type = 'range'; scrub.min = 0; scrub.max = 1000; scrub.step = 1; scrub.value = 0;
    scrub.setAttribute('aria-label', 'Position in the clip');
    const clock = el('span', 'range-val', '0.0 s');
    const changeBtn = button('Change file', 'btn-ghost', () => file.click());
    const changeVideoBtn = button('Change video', 'btn-ghost', () => videoFile.click());
    transport.append(scrub, clock, changeBtn, changeVideoBtn);
    stageCol.append(stage, transport);

    const side = el('div', 'aiimg-side');
    const tabs = el('div', 'aiimg-tabs'); tabs.setAttribute('role', 'tablist');
    const panes = {};
    for (const [k, label] of [['faces', 'Faces'], ['style', 'Style'], ['export', 'Export']]) {
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
    wrap.append(drop, file, videoFile, vid, studio, msg);
    io.appendChild(wrap);

    function showPane(k) {
      for (const b of tabs.children) { const onIt = b.dataset.pane === k; b.classList.toggle('is-on', onIt); b.setAttribute('aria-selected', onIt ? 'true' : 'false'); }
      for (const p in panes) panes[p].hidden = p !== k;
    }
    function say(text, kind) { msg.textContent = text || ''; msg.className = 'io-msg' + (kind ? ' is-' + kind : ''); }
    function note(text) { stageMsg.textContent = text || ''; stageMsg.hidden = !text; }

    /* ---------------- faces pane ---------------- */
    const status = el('p', 'aiimg-status', 'Choose a photo or a video to begin.');
    const progress = el('div', 'aiimg-progress'); const bar = el('i'); progress.appendChild(bar); progress.hidden = true;
    const hint = el('p', 'field-hint aiimg-face-hint', 'Tap a face on the preview to keep it as it is — tap again to blur it. Drag across the picture to add a box over a face that was missed.');
    const faceList = el('div', 'aiimg-face-list');
    const sizeSel = select('aiimg-face-size', [['normal', 'Normal'], ['small', 'Small faces (slower)']], S.size);
    sizeSel.addEventListener('change', () => {
      S.size = sizeSel.value;
      /* tiny faces score lower: Small faces starts at 65% unless the threshold was moved by hand */
      if (S.size === 'small' && S.thr === 0.7) S.thr = 0.65; else if (S.size === 'normal' && S.thr === 0.65) S.thr = 0.7;
      thrCtl.set(Math.round(S.thr * 100));
      redetect();
    });
    const thrCtl = range('aiimg-face-thr', 50, 95, 5, Math.round(S.thr * 100), (v) => v + '%');
    thrCtl.input.addEventListener('change', () => { S.thr = Number(thrCtl.input.value) / 100; redetect(); });
    const clearManual = button('Remove the boxes I drew', 'btn-ghost', () => {
      S.faces = S.faces.filter((f) => !f.manual);
      renderFaceList(); setStatus(); invalidate();
    });
    panes.faces.append(status, progress, hint, faceList,
      field('Face size', sizeSel, 'Normal finds faces down to about 1% of the picture width. Small faces also looks at the picture in overlapping crops, each enlarged twice, and finds faces half that size; it takes longer and may box a thing that is not a face — tap any such box to keep it as it is.'),
      field('Detection threshold', thrCtl, 'Lower finds more faces and makes more mistakes. 70% suits most pictures; Small faces starts at 65%.'),
      clearManual);

    function faceLabel(f, i) {
      return (f.manual ? 'Box ' : 'Face ') + (i + 1) + ' · ' + Math.round(f.w) + '×' + Math.round(f.h) + ' px' + (f.manual ? ' · drawn by hand' : ' · ' + Math.round(f.score * 100) + '%');
    }
    function renderFaceList() {
      faceList.innerHTML = '';
      const list = S.kind === 'video' ? S.frameFaces : S.faces;
      list.forEach((f, i) => {
        const row = el('div', 'aiimg-face-row' + (f.keep ? ' is-kept' : ''));
        const sw = el('span', 'aiimg-face-swatch');
        const name = el('span', 'aiimg-lname', faceLabel(f, i));
        const tag = el('span', 'aiimg-face-tag', f.keep ? 'kept' : 'blurred');
        const toggle = button(f.keep ? 'Blur it' : 'Keep it', 'btn-ghost aiimg-face-toggle', () => toggleKeep(f));
        row.append(sw, name, tag, toggle);
        if (f.manual) row.appendChild(button('Remove', 'btn-ghost aiimg-face-toggle', () => { S.faces = S.faces.filter((x) => x !== f); renderFaceList(); setStatus(); invalidate(); }));
        faceList.appendChild(row);
      });
    }
    function setStatus() {
      const list = S.kind === 'video' ? S.frameFaces : S.faces;
      const n = list.length, kept = list.filter((f) => f.keep).length;
      const where = S.kind === 'video' ? ' on this frame' : '';
      if (!n) status.textContent = 'No faces found' + where + ' — ready. Drag across the picture to add a box by hand' + (S.size === 'normal' ? ', or choose Small faces' : '') + '.';
      else status.textContent = n + ' face' + (n === 1 ? '' : 's') + ' found' + where + (kept ? ', ' + kept + ' kept' : '') + ' — ready.';
    }
    function toggleKeep(f) {
      if (S.kind === 'video' && !f.manual) {
        /* a seed: this face, at this moment, is to be followed and kept */
        const hit = S.seeds.findIndex((s) => Math.abs(s.t - S.t) < 0.35 && iou(s, f) > 0.3);
        if (hit >= 0) { S.seeds.splice(hit, 1); f.keep = false; }
        else { S.seeds.push({ t: S.t, x: f.x, y: f.y, w: f.w, h: f.h }); f.keep = true; }
      } else f.keep = !f.keep;
      renderFaceList(); setStatus(); invalidate();
    }

    /* ---------------- style pane ---------------- */
    const on = (ctrl, fn) => { const t = ctrl.input || ctrl; t.addEventListener('input', fn); t.addEventListener('change', fn); return ctrl; };
    const modeSel = on(select('aiimg-face-mode', [['blur', 'Soft blur'], ['pixelate', 'Pixel blocks'], ['solid', 'Solid colour']], S.style.mode), () => { S.style.mode = modeSel.value; syncStyle(); invalidate(); });
    const strength = on(range('aiimg-face-strength', 1, 10, 1, S.style.strength), () => { S.style.strength = Number(strength.input.value); invalidate(); });
    const blocks = on(range('aiimg-face-blocks', 3, 20, 1, S.style.blocks, (v) => v + ' across'), () => { S.style.blocks = Number(blocks.input.value); invalidate(); });
    const solid = on(colour('aiimg-face-colour', S.style.colour), () => { S.style.colour = solid.value; invalidate(); });
    const margin = on(range('aiimg-face-margin', 0, 100, 5, Math.round(S.style.margin * 100), (v) => v + '%'), () => { S.style.margin = Number(margin.input.value) / 100; invalidate(); });
    const oval = on(check('aiimg-face-oval', 'Oval instead of a rectangle', S.style.oval), () => { S.style.oval = oval.input.checked; invalidate(); });
    const strengthField = field('Strength', strength, 'At 7 and above the face is reduced to a few samples; there is nothing to recover.');
    const blocksField = field('Blocks', blocks, 'Fewer, bigger blocks hide more. Eight across is the broadcast convention.');
    const colourField = field('Colour', solid);
    panes.style.append(field('Look', modeSel), strengthField, blocksField, colourField,
      field('Margin around the face', margin, 'The detector boxes eyebrows to chin. 30% takes in hair and ears; widen it for profiles.'),
      oval);
    function syncStyle() {
      strengthField.hidden = S.style.mode !== 'blur';
      blocksField.hidden = S.style.mode !== 'pixelate';
      colourField.hidden = S.style.mode !== 'solid';
    }
    syncStyle();

    /* ---------------- export pane ---------------- */
    const pct = (v) => Math.round(v) + '%';
    const stillFmt = on(select('aiimg-face-fmt', [['image/png', 'PNG'], ['image/jpeg', 'JPEG']], 'image/png'), () => { qualityField.hidden = stillFmt.value === 'image/png'; });
    const quality = range('aiimg-face-quality', 50, 100, 1, 92, pct);
    const qualityField = field('Quality', quality); qualityField.hidden = true;
    const stillBtn = button('Download the image', 'btn-primary', exportPhoto);
    const photoExport = el('div');
    photoExport.append(field('Format', stillFmt), qualityField, el('p', 'field-hint', 'Exported at the original resolution, with the faces blurred exactly as the preview shows them.'), stillBtn);
    const videoInfo = el('p', 'field-hint');
    const clipBtn = button('Blur the video', 'btn-primary', exportVideo);
    const cancelBtn = button('Cancel', 'btn-ghost', () => { if (S.job) S.job.abort(); }); cancelBtn.hidden = true;
    const clipRow = el('div', 'aiimg-row'); clipRow.append(clipBtn, cancelBtn);
    const clipProgress = el('div', 'aiimg-progress'); const clipBar = el('i'); clipProgress.appendChild(clipBar); clipProgress.hidden = true;
    const clipStatus = el('p', 'aiimg-status', ''); clipStatus.hidden = true;
    const videoExport = el('div');
    videoExport.append(videoInfo, clipRow, clipProgress, clipStatus);
    const results = el('div', 'aiimg-results');
    panes.export.append(photoExport, videoExport, results);

    /* ---------------- drawing ---------------- */
    const pctx = canvas.getContext('2d');
    let dirty = true, mounted = true;
    const invalidate = () => { dirty = true; };
    function previewScale() {
      if (S.kind === 'photo') return canvas.width / S.image.width;
      return 1;
    }
    /** The finished frame: picture, then every face that is not kept, destroyed. */
    function renderPhoto(ctx, W, H) {
      ctx.save();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(S.image.canvas, 0, 0, W, H);
      maskAll(ctx, S.faces, W / S.image.width, S.style);
      ctx.restore();
    }
    function renderVideoFrame(ctx, W, H) {
      ctx.save();
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, W, H);
      if (vid.readyState >= 2) ctx.drawImage(vid, 0, 0, W, H);
      maskAll(ctx, S.frameFaces.concat(S.faces), 1, S.style);
      ctx.restore();
    }
    function drawBoxes(ctx, faces, s) {
      ctx.save();
      ctx.lineWidth = 2;
      for (const f of faces) {
        const b = expand(f, S.style);
        ctx.strokeStyle = f.keep ? 'rgba(80,220,120,.95)' : f.manual ? 'rgba(120,180,255,.95)' : 'rgba(247,201,72,.95)';
        ctx.setLineDash(f.keep ? [6, 4] : []);
        if (S.style.oval) { ctx.beginPath(); ctx.ellipse((b.x + b.w / 2) * s, (b.y + b.h / 2) * s, b.w / 2 * s, b.h / 2 * s, 0, 0, Math.PI * 2); ctx.stroke(); }
        else ctx.strokeRect(b.x * s, b.y * s, b.w * s, b.h * s);
        if (f.keep) {
          ctx.setLineDash([]);
          ctx.font = 'bold 12px system-ui, sans-serif';
          const label = 'kept';
          const tw = ctx.measureText(label).width + 8;
          ctx.fillStyle = 'rgba(80,220,120,.95)';
          ctx.fillRect(b.x * s, Math.max(0, b.y * s - 16), tw, 16);
          ctx.fillStyle = '#062';
          ctx.fillText(label, b.x * s + 4, Math.max(12, b.y * s - 4));
        }
      }
      if (S.drag && S.drag.rect) {
        const r = S.drag.rect;
        ctx.setLineDash([4, 3]); ctx.strokeStyle = 'rgba(120,180,255,.95)';
        ctx.strokeRect(r.x, r.y, r.w, r.h);
      }
      ctx.restore();
    }
    function draw() {
      dirty = false;
      if (!S.kind) return;
      if (S.exporting && S.kind === 'video') return;   /* the job paints its own frames */
      if (S.kind === 'photo') {
        renderPhoto(pctx, canvas.width, canvas.height);
        drawBoxes(pctx, S.faces, previewScale());
      } else {
        renderVideoFrame(pctx, canvas.width, canvas.height);
        drawBoxes(pctx, S.frameFaces.concat(S.faces), 1);
      }
    }
    (function loop() { if (!mounted) return; if (dirty) draw(); requestAnimationFrame(loop); })();

    /* ---------------- pointer: tap to keep, drag to add ---------------- */
    const toCanvas = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * canvas.width, y: (e.clientY - r.top) / r.height * canvas.height }; };
    function faceAt(px, py) {
      const s = previewScale();
      const list = S.kind === 'video' ? S.frameFaces.concat(S.faces) : S.faces;
      let best = null, ba = Infinity;
      for (const f of list) {
        const b = expand(f, S.style);
        if (px < b.x * s || py < b.y * s || px > (b.x + b.w) * s || py > (b.y + b.h) * s) continue;
        const a = b.w * b.h;
        if (a < ba) { ba = a; best = f; }
      }
      return best;
    }
    canvas.addEventListener('pointerdown', (e) => {
      if (!S.kind || S.exporting) return;
      const p = toCanvas(e);
      S.drag = { x0: p.x, y0: p.y, rect: null, id: e.pointerId };
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!S.drag) return;
      const p = toCanvas(e);
      const dx = p.x - S.drag.x0, dy = p.y - S.drag.y0;
      if (!S.drag.rect && Math.hypot(dx, dy) < 6) return;
      S.drag.rect = { x: Math.min(p.x, S.drag.x0), y: Math.min(p.y, S.drag.y0), w: Math.abs(dx), h: Math.abs(dy) };
      invalidate();
    });
    const endDrag = (e) => {
      if (!S.drag) return;
      const d = S.drag; S.drag = null;
      if (d.rect && d.rect.w > 8 && d.rect.h > 8) {
        const s = previewScale();
        S.faces.push({ x: d.rect.x / s, y: d.rect.y / s, w: d.rect.w / s, h: d.rect.h / s, score: 1, keep: false, manual: true });
      } else if (!d.rect && e.type === 'pointerup') {
        const f = faceAt(d.x0, d.y0);
        if (f) { toggleKeep(f); return; }
      }
      renderFaceList(); setStatus(); invalidate();
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    /* ---------------- the detector, with progress ---------------- */
    async function ready() {
      if (S.R) return S.R;
      progress.hidden = false; bar.style.width = '0%';
      status.textContent = 'Preparing the face detector…';
      S.R = await session(MODEL_URL, MODEL_BYTES, (p) => {
        if (p.stage === 'download') {
          status.textContent = 'Downloading the face detector once — ' + fmtBytes(p.loaded) + ' of ' + fmtBytes(p.total) + '. Your browser keeps it for next time.';
          bar.style.width = Math.round(p.fraction * 60) + '%';
        }
      });
      return S.R;
    }
    const gridsFor = (kind) => (kind === 'video' ? (S.size === 'small' ? [2] : []) : (S.image && Math.max(S.image.width, S.image.height) > 480 ? [2] : []));

    let detectToken = 0;
    async function detectPhoto() {
      if (!S.image) return;
      const token = ++detectToken;
      try {
        const R = await ready();
        if (token !== detectToken) return;
        progress.hidden = false;
        status.textContent = 'Looking for faces on your device…';
        note('Looking for faces…');
        const kept = S.faces.filter((f) => f.keep && !f.manual);
        const manual = S.faces.filter((f) => f.manual);
        const found = await detectFaces(R, S.image.canvas, S.image.width, S.image.height, {
          grids: gridsFor('photo'), small: S.size === 'small', thr: S.thr,
          onProgress: (f) => { if (token === detectToken) bar.style.width = Math.round(60 + f * 40) + '%'; }
        });
        if (token !== detectToken) return;
        /* a face kept before this pass stays kept if it is found again */
        for (const f of found) f.keep = kept.some((k) => iou(k, f) > 0.4);
        S.faces = found.concat(manual);
        renderFaceList(); setStatus(); say('');
        invalidate();
      } catch (e) {
        if (token !== detectToken) return;
        status.textContent = 'The faces could not be found.';
        say((e && e.message) || String(e), 'error');
      } finally {
        if (token === detectToken) { progress.hidden = true; note(''); }
      }
    }
    async function detectFrame() {
      if (!S.video) return;
      const token = ++detectToken;
      try {
        const R = await ready();
        if (token !== detectToken) return;
        progress.hidden = true;
        status.textContent = 'Looking for faces on this frame…';
        const found = await detectFaces(R, vid, canvas.width, canvas.height, { grids: gridsFor('video'), thr: S.thr });
        if (token !== detectToken) return;
        for (const f of found) f.keep = S.seeds.some((s) => Math.abs(s.t - S.t) < 0.35 && iou(s, f) > 0.3);
        S.frameFaces = found;
        renderFaceList(); setStatus(); say('');
        invalidate();
      } catch (e) {
        if (token !== detectToken) return;
        status.textContent = 'The faces could not be found.';
        say((e && e.message) || String(e), 'error');
      }
    }
    function redetect() { if (S.kind === 'photo') detectPhoto(); else if (S.kind === 'video') detectFrame(); }

    /* ---------------- loading ---------------- */
    async function loadFiles(files) {
      const f = files && files[0];
      if (!f) return;
      if (isVideoFile(f)) return loadVideo(f);
      try {
        say(''); note('Reading the photo…');
        const img = await A.loadImageFile(f);
        detectToken++;
        closeVideo();
        S.kind = 'photo'; S.image = img; S.faces = []; S.frameFaces = []; S.seeds = [];
        const s = Math.min(1, PREVIEW_MAX / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * s)); canvas.height = Math.max(1, Math.round(img.height * s));
        studio.hidden = false; drop.hidden = true;
        scrub.hidden = true; clock.hidden = true; changeVideoBtn.hidden = false; changeBtn.textContent = 'Change photo';
        photoExport.hidden = false; videoExport.hidden = true;
        results.innerHTML = ''; faceList.innerHTML = '';
        invalidate(); showPane('faces');
        await detectPhoto();
      } catch (e) {
        note(''); say((e && e.message) || String(e), 'error');
      }
    }
    function closeVideo() {
      if (S.video && S.video.url) { try { vid.pause(); vid.removeAttribute('src'); vid.load(); } catch (e) { /* */ } URL.revokeObjectURL(S.video.url); }
      S.video = null;
    }
    async function loadVideo(f) {
      try {
        say(''); note('Opening the video…');
        detectToken++;
        closeVideo();
        const url = URL.createObjectURL(f);
        S.video = { url, name: String(f.name || 'video').replace(/\.[^.]+$/, '') || 'video', bytes: f.size, audio: undefined };
        vid.src = url;
        await new Promise((res, rej) => {
          const ok = () => { vid.removeEventListener('loadedmetadata', ok); vid.removeEventListener('error', bad); res(); };
          const bad = () => { vid.removeEventListener('loadedmetadata', ok); vid.removeEventListener('error', bad); rej(new Error('That video could not be opened. MP4 (H.264), MOV and WebM from a phone or a screen recorder work; HEVC and AV1 depend on the browser.')); };
          vid.addEventListener('loadedmetadata', ok); vid.addEventListener('error', bad);
        });
        if (!isFinite(vid.duration)) {
          /* a WebM straight from a recorder has no length in its header; seeking past the end reveals it */
          await new Promise((res) => { const d = () => { vid.removeEventListener('durationchange', d); res(); }; vid.addEventListener('durationchange', d); vid.currentTime = 1e101; setTimeout(res, 3000); });
          await seekTo(vid, 0);
        }
        const sw = vid.videoWidth, sh = vid.videoHeight;
        if (!sw || !sh) throw new Error('That video has no picture the browser can decode.');
        const sc = Math.min(1, VIDEO_MAX_W / sw, VIDEO_MAX_H / sh);
        const V = S.video;
        V.width = sw; V.height = sh; V.outW = evenDown(Math.round(sw * sc)); V.outH = evenDown(Math.round(sh * sc));
        V.duration = isFinite(vid.duration) ? vid.duration : VIDEO_MAX_SECONDS;
        V.until = Math.min(V.duration, VIDEO_MAX_SECONDS);
        S.kind = 'video'; S.image = null; S.faces = []; S.frameFaces = []; S.seeds = []; S.t = 0;
        canvas.width = V.outW; canvas.height = V.outH;
        studio.hidden = false; drop.hidden = true;
        scrub.hidden = false; clock.hidden = false; scrub.value = 0; clock.textContent = '0.0 s'; changeVideoBtn.hidden = true; changeBtn.textContent = 'Change file';
        photoExport.hidden = true; videoExport.hidden = false;
        videoInfo.textContent = 'Exports ' + (V.until < V.duration ? 'the first ' + VIDEO_MAX_SECONDS + ' s of the clip' : 'the whole clip (' + fmtTime(V.until) + ')') + ' at ' + V.outW + '×' + V.outH + (sc < 1 ? ' (scaled down from ' + sw + '×' + sh + ')' : '') + ', as MP4 where the browser can encode on the device. Tap the faces to keep on the frame shown; scrub to check any frame.';
        results.innerHTML = ''; faceList.innerHTML = '';
        /* the soundtrack, decoded in the background for the export */
        V.audioPromise = f.arrayBuffer().then((buf) => {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) throw new Error('no audio');
          const ctx = new Ctx();
          return ctx.decodeAudioData(buf).finally(() => { if (ctx.close) ctx.close().catch(() => {}); });
        }).then((b) => { V.audio = b; return b; }).catch(() => { V.audio = null; return null; });
        await seekTo(vid, 0);
        note('');
        invalidate(); showPane('faces');
        await detectFrame();
      } catch (e) {
        note(''); say((e && e.message) || String(e), 'error');
      }
    }
    let scrubTimer = 0;
    scrub.addEventListener('input', () => {
      if (!S.video || S.exporting) return;
      S.t = Number(scrub.value) / 1000 * S.video.until;
      clock.textContent = fmtTime(S.t);
      clearTimeout(scrubTimer);
      scrubTimer = setTimeout(async () => {
        try { await seekTo(vid, S.t); } catch (e) { return; }
        invalidate();
        detectFrame();
      }, 120);
    });
    drop.addEventListener('click', (e) => { if (altRow.contains(e.target)) return; file.click(); });
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    ['dragenter', 'dragover'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    wrap.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) loadFiles(e.dataTransfer.files); });
    file.addEventListener('change', () => { if (file.files.length) loadFiles(file.files); file.value = ''; });
    videoFile.addEventListener('change', () => { if (videoFile.files.length) loadFiles(videoFile.files); videoFile.value = ''; });

    /* ---------------- results ---------------- */
    function addResult(blob, name, meta) {
      const row = el('div', 'aiimg-result');
      const head = el('div', 'aiimg-result-head');
      const strong = el('strong', null, name);
      const span = el('span', null, fmtBytes(blob.size) + ' · ' + meta);
      const dl = button('Download', 'btn-download', () => A.download(blob, name));
      head.append(strong, span, dl);
      row.appendChild(head);
      const url = URL.createObjectURL(blob);
      if (/^image\//.test(blob.type)) { const img = el('img'); img.alt = 'Result preview'; img.src = url; row.appendChild(img); }
      else { const v = el('video'); v.controls = true; v.playsInline = true; v.src = url; row.appendChild(v); }
      results.insertBefore(row, results.firstChild);
      return row;
    }
    async function exportPhoto() {
      if (!S.image) return;
      try {
        S.exporting = true;
        const fmt = stillFmt.value;
        const blob = await A.exportStill(renderPhoto, { width: S.image.width, height: S.image.height, format: fmt, quality: Number(quality.input.value) / 100 });
        if (!blob) throw new Error('This browser could not encode that format. Try PNG.');
        const ext = fmt === 'image/png' ? 'png' : 'jpg';
        const name = S.image.name + '-faces-blurred.' + ext;
        const blurred = S.faces.filter((f) => !f.keep).length, kept = S.faces.length - blurred;
        addResult(blob, name, S.image.width + '×' + S.image.height + ' · ' + blurred + ' blurred' + (kept ? ', ' + kept + ' kept' : ''));
        A.download(blob, name);
        say('');
      } catch (e) { say((e && e.message) || String(e), 'error'); }
      finally { S.exporting = false; invalidate(); }
    }

    /* ---------------- the video job ---------------- */
    /**
     * Read, follow, blur and hand every frame to `emit`. Frames are held
     * in a small buffer so the detector's answer for the last of them can
     * place boxes on the ones before it. Returns what it measured.
     */
    async function processClip(V, o) {
      const R = await ready();
      const W = V.outW, H = V.outH;
      const grids = gridsFor('video');
      const tracker = makeTracker();
      const seeds = S.seeds.map((s) => Object.assign({ used: false }, s));
      const out = el('canvas'); out.width = W; out.height = H;
      const octx = out.getContext('2d');
      const pool = [];
      let N = 3, idx = 0, lastDet = -1, buffered = [], detMs = 0, fps = 30, dts = [];
      const frameAt = (i) => { if (!pool[i]) { const c = el('canvas'); c.width = W; c.height = H; pool[i] = c; } return pool[i]; };
      async function flush(detFrame, dets) {
        if (detFrame >= 0) { tracker.update(dets, detFrame, lastDet < 0 ? 1 : detFrame - lastDet); lastDet = detFrame; }
        for (const b of buffered) {
          if (o.signal.aborted) throw abortError();
          /* a tap on this moment names the track to keep */
          for (const s of seeds) if (!s.used && Math.abs(s.t - b.t) < 0.35) { if (tracker.keepLike(s)) s.used = true; }
          const boxes = tracker.boxesAt(b.i).concat(S.faces);
          octx.drawImage(b.c, 0, 0);
          maskAll(octx, boxes, 1, S.style);
          await o.emit(out, b.t, b.dt, boxes);
          if ((b.i & 7) === 0) { pctx.drawImage(out, 0, 0, canvas.width, canvas.height); o.onProgress(b.i, b.t); }
        }
        buffered = [];
      }
      const onFrame = async (t, dt) => {
        const i = idx++;
        dts.push(dt);
        if (dts.length === 12) { const s = dts.slice(2).sort((a, b) => a - b); fps = clamp(Math.round(1 / s[Math.floor(s.length / 2)]) || 30, 5, 60); }
        const c = frameAt(buffered.length);
        c.getContext('2d').drawImage(vid, 0, 0, W, H);
        buffered.push({ c, i, t, dt });
        if (i % N === 0 || buffered.length >= 6) {
          const t0 = performance.now();
          const dets = await detectFaces(R, c, W, H, { grids, thr: S.thr, signal: o.signal, yield: false });
          detMs = performance.now() - t0;
          /* detect every 3rd frame on a quick machine, every 6th on a slow one */
          N = detMs < 80 ? 3 : detMs < 130 ? 4 : detMs < 220 ? 5 : 6;
          await flush(i, dets);
        }
      };
      await readFrames(vid, { until: V.until, step: !o.realtime, fps: 30, signal: o.signal, onFrame });
      await flush(-1, null);
      return { frames: idx, fps, detMs, N, tracks: tracker.tracks.length };
    }

    async function exportVideo() {
      const V = S.video;
      if (!V || S.job) return;
      S.job = new AbortController();
      S.exporting = true;
      const signal = S.job.signal;
      clipBtn.disabled = true; cancelBtn.hidden = false; clipProgress.hidden = false; clipStatus.hidden = false; clipBar.style.width = '0%';
      clipStatus.textContent = 'Reading the clip…';
      vid.pause();
      const started = performance.now();
      const totalGuess = () => Math.max(1, Math.round(V.until * 30));
      const onProgress = (i, t) => {
        const f = clamp(t / V.until, 0, 1);
        clipBar.style.width = Math.round(f * 100) + '%';
        const spent = (performance.now() - started) / 1000;
        clipStatus.textContent = 'Blurring the clip — ' + Math.round(f * 100) + '%' + (f > 0.04 && f < 1 ? ', about ' + Math.max(1, Math.round(spent / f - spent)) + ' s left' : '') + '.';
      };
      try {
        const audio = await V.audioPromise;
        await seekTo(vid, 0);
        let result, stats;
        const canEncode = typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' && (await pickAvc(V.outW, V.outH, 30, 4e6));
        if (canEncode || typeof A.encodeVideoFrames === 'function') {
          const q = asyncQueue();
          let fpsSeen = 30;
          const muxing = muxVideo({ width: V.outW, height: V.outH, fps: 30, frames: q, audioBuffer: audio, seconds: V.until, totalFrames: totalGuess(), signal });
          muxing.catch(() => {});
          const run = processClip(V, {
            signal, onProgress,
            emit: async (c, t, dt) => {
              const frame = new VideoFrame(c, { timestamp: Math.round(t * 1e6), duration: Math.round(Math.max(dt, 1 / 120) * 1e6) });
              q.push({ frame, timestampUs: frame.timestamp, durationUs: frame.duration });
              while (q.size > 6 && !signal.aborted) await sleep(4);
            }
          });
          try { stats = await run; q.close(); }
          catch (e) { q.close(e); throw e; }
          result = await muxing;
          fpsSeen = stats.fps;
          if (!result) throw new Error('This browser cannot encode video on the device. Chrome, Edge or Safari 16.4+ can.');
          result.fpsSeen = fpsSeen;
        } else {
          result = await recordClip(V, audio, { signal, onProgress });
          stats = result.stats;
        }
        clipStatus.textContent = 'Done in ' + ((performance.now() - started) / 1000).toFixed(1) + ' s — ' + stats.frames + ' frames, faces looked for on every ' + stats.N + (stats.N === 2 ? 'nd' : stats.N === 3 ? 'rd' : 'th') + ' frame.';
        const soundNote = result.sound === 'kept' ? 'sound kept' : result.sound === 'none' ? (audio === null ? 'no sound in the original, or it could not be read' : 'no sound') : 'sound removed — this browser cannot encode audio';
        const name = V.name + '-faces-blurred.' + result.ext;
        addResult(result.blob, name, V.outW + '×' + V.outH + ' · ' + fmtTime(V.until) + ' · ' + (result.ext === 'mp4' ? 'MP4' : 'WebM') + ' · ' + soundNote + (S.seeds.length ? ' · ' + S.seeds.length + ' kept' : ''));
        A.download(result.blob, name);
        if (result.sound === 'removed') say('The clip was exported without its sound: this browser cannot encode audio on the device. Chrome, Edge or Safari 17+ can.', 'warn');
        else if (result.ext !== 'mp4') say('This browser has no on-device MP4 encoder, so the clip was recorded in real time as WebM. It plays everywhere a browser does.', 'warn');
        else say('');
      } catch (e) {
        if (e && e.name === 'AbortError') clipStatus.textContent = 'Cancelled.';
        else { clipStatus.textContent = 'The export failed.'; say((e && e.message) || String(e), 'error'); }
      } finally {
        S.job = null; S.exporting = false;
        clipBtn.disabled = false; cancelBtn.hidden = true; clipProgress.hidden = true;
        try { await seekTo(vid, S.t); } catch (e) { /* */ }
        invalidate();
      }
    }

    /* Without WebCodecs the clip plays in real time while MediaRecorder
       captures the output canvas, with the soundtrack played into the
       same stream. Frames the device cannot keep up with repeat. */
    async function recordClip(V, audio, o) {
      if (typeof MediaRecorder === 'undefined') throw new Error('This browser cannot encode video on the device. Chrome, Edge or Safari 16.4+ can.');
      const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
      const mime = types.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } });
      if (!mime) throw new Error('This browser cannot record video.');
      const rec = el('canvas'); rec.width = V.outW; rec.height = V.outH;
      const rctx = rec.getContext('2d');
      const stream = rec.captureStream(30);
      let actx = null, sound = 'none';
      if (audio) {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          actx = new Ctx();
          const dest = actx.createMediaStreamDestination();
          const src = actx.createBufferSource(); src.buffer = audio; src.connect(dest); src.start();
          stream.addTrack(dest.stream.getAudioTracks()[0]);
          sound = 'kept';
        } catch (e) { sound = 'removed'; }
      }
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(clamp(V.outW * V.outH * 30 * 0.12, 1.2e6, 12e6)) });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise((res) => { recorder.onstop = res; });
      recorder.start(250);
      let stats;
      try {
        stats = await processClip(V, Object.assign({ realtime: true, emit: async (c) => { rctx.drawImage(c, 0, 0); } }, o));
      } finally {
        await sleep(120);
        recorder.stop();
        await stopped;
        if (actx && actx.close) actx.close().catch(() => {});
      }
      const mp4 = /mp4/.test(mime);
      return { blob: new Blob(chunks, { type: mp4 ? 'video/mp4' : 'video/webm' }), ext: mp4 ? 'mp4' : 'webm', note: mp4 ? 'MP4 (recorded)' : 'WebM (recorded)', sound, stats };
    }

    /* ---------------- go ---------------- */
    scrub.hidden = true; clock.hidden = true; changeVideoBtn.hidden = true;
    photoExport.hidden = true; videoExport.hidden = true;
    showPane('faces');
    const api = { state: S, renderPhoto, loadFiles, detectFaces: (src, w, h, o) => ready().then((R) => detectFaces(R, src, w, h, o)), destroy: () => { mounted = false; closeVideo(); } };
    A.tools['face-blur'].last = api;
    return api;
  }

  A.tools['face-blur'] = { mount, maskFace, makeTracker, muxVideo };
})();
