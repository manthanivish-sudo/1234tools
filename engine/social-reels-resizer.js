/**
 * Reels Resizer (/social/reels-resizer/).
 *
 * A landscape (or any) video in; a vertical 9:16 MP4 out, or a 1:1 or 4:5
 * one. The original is fitted in the frame over a blurred, darkened copy
 * of itself or a solid colour, or cropped to fill the frame around a focus
 * point the visitor drags; an optional title sits above the picture, and
 * the picture can sit higher to leave the bottom of the frame clear for
 * captions and the app's own buttons.
 *
 * One function, compose(), draws a frame for the preview and the export.
 * The export plays the video through once, muted, and takes each frame as
 * the browser shows it (requestVideoFrameCallback), pausing the video
 * whenever the encoder falls behind. A frame that goes by unseen (the
 * presented-frame count jumps, the dropped count rises, or the time jumps)
 * sends it back to a quarter of a second before the last frame taken, to
 * play on at half the speed, down to an eighth (and at an eighth, up to
 * four more tries), so frames are not skipped to keep up; where that
 * callback is missing the video is stepped by seeking instead.
 * Frames are encoded on the device to H.264 with WebCodecs and boxed into
 * an MP4 by the vendored mp4-muxer (MIT) through AIImg.encodeVideoFrames;
 * the sound is decoded from the file and re-encoded as AAC, or Opus where
 * the browser has no AAC encoder. Where WebCodecs is missing (Firefox),
 * the frame is recorded in real time with MediaRecorder, usually as WebM,
 * with the sound played into the same recording, and the page says so.
 *
 * The blur is made without ctx.filter (Safari lacked it): the frame is
 * shrunk to a 24th of the output and drawn back up with smoothing, twice.
 *
 * Limits, said on the page: 3 minutes and 500 MB per video, because the
 * file's sound is decoded whole and the finished MP4 is built in memory.
 *
 * Remembered in localStorage '1234tools-social-reels-resizer-v1': the
 * size, background, colour, darkness, position, title size and colour, and
 * fps. Not the video, its name or the title's words.
 *
 * Test hooks: window.__svForceRecorder = true takes the MediaRecorder path;
 * window.__svRrTrace = [] collects one row per frame callback (media time,
 * presented and dropped counts, the last frame taken, frame length, missed,
 * rate) for build/social/tests/reels-resizer.js to show when a check fails.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A) return;
  const { el, clamp, field, select, range, colour, button, sleep, fmtBytes } = A;

  const KEY = '1234tools-social-reels-resizer-v1';
  const MAX_SECONDS = 180;
  const MAX_BYTES = 500 * 1048576;
  const SIZES = {
    '9x16': { w: 1080, h: 1920, label: '9:16 · 1080 × 1920' },
    '9x16-720': { w: 720, h: 1280, label: '9:16 · 720 × 1280 (quicker)' },
    '4x5': { w: 1080, h: 1350, label: '4:5 · 1080 × 1350' },
    '1x1': { w: 1080, h: 1080, label: '1:1 · 1080 × 1080' }
  };
  const MODES = [['blur', 'Fit, blurred copy behind'], ['colour', 'Fit, solid colour behind'], ['fill', 'Crop to fill the frame']];
  const POSITIONS = [['centre', 'Centre'], ['high', 'Higher: keep the bottom clear for captions']];
  const TITLE_SIZES = [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']];
  const TITLE_FRAC = { s: 0.045, m: 0.06, l: 0.078 };
  const EXT = { 'video/mp4': 'mp4', 'video/webm': 'webm' };
  const extOf = (b) => EXT[String(b.type).split(';')[0]] || 'bin';
  const HEX = /^#[0-9a-f]{6}$/i;
  const VIDEO_RE = /\.(mp4|m4v|mov|webm|mkv|ogv)$/i;
  const fmtT = (s) => { const m = Math.floor(s / 60), r = Math.floor(s - m * 60); return m + ':' + (r < 10 ? '0' : '') + r; };

  function load() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { p = null; }
    const o = { size: '9x16', mode: 'blur', bg: '#101627', dark: 45, position: 'centre', titleSize: 'm', titleColour: '#ffffff', fps: 30 };
    if (!p || p.v !== 1) return o;
    if (SIZES[p.size]) o.size = p.size;
    if (MODES.some((m) => m[0] === p.mode)) o.mode = p.mode;
    if (HEX.test(p.bg || '')) o.bg = p.bg;
    if (isFinite(p.dark)) o.dark = clamp(Math.round(p.dark), 0, 85);
    if (POSITIONS.some((m) => m[0] === p.position)) o.position = p.position;
    if (TITLE_SIZES.some((m) => m[0] === p.titleSize)) o.titleSize = p.titleSize;
    if (HEX.test(p.titleColour || '')) o.titleColour = p.titleColour;
    if (p.fps === 30 || p.fps === 60) o.fps = p.fps;
    return o;
  }
  function save(S) {
    try { localStorage.setItem(KEY, JSON.stringify({ v: 1, size: S.size, mode: S.mode, bg: S.bg, dark: S.dark, position: S.position, titleSize: S.titleSize, titleColour: S.titleColour, fps: S.fps })); }
    catch (e) { /* private window or storage blocked: the settings still apply to this visit */ }
  }

  /* ------------------------------------------------------------------ */
  /* layout and drawing                                                 */
  /* ------------------------------------------------------------------ */
  /**
   * Where the picture goes in a W × H frame. Fit modes: scaled to fit
   * whole, centred across; down the frame, centred, or (position 'high')
   * with its middle at 40% of the height, but never above 12% of it.
   * Fill: scaled to cover and cut around focus (fx, fy in 0..1).
   * Returns { sx, sy, sw, sh, x, y, w, h } in whole pixels.
   */
  function layout(vw, vh, W, H, o) {
    if (o.mode === 'fill') {
      const s = Math.max(W / vw, H / vh);
      const sw = W / s, sh = H / s;
      return { sx: (vw - sw) * clamp(o.fx, 0, 1), sy: (vh - sh) * clamp(o.fy, 0, 1), sw, sh, x: 0, y: 0, w: W, h: H };
    }
    const s = Math.min(W / vw, H / vh);
    const w = Math.round(vw * s), h = Math.round(vh * s);
    const x = Math.round((W - w) / 2);
    let y = Math.round((H - h) / 2);
    if (o.position === 'high') y = Math.round(clamp(H * 0.4 - h / 2, Math.min(H * 0.12, (H - h) / 2), (H - h) / 2));
    return { sx: 0, sy: 0, sw: vw, sh: vh, x, y, w, h };
  }

  function wrapLines(ctx, text, maxW) {
    const out = [];
    for (const para of String(text).split(/\n/)) {
      const words = para.split(/\s+/).filter(Boolean);
      let line = '';
      for (const w of words) {
        const t = line ? line + ' ' + w : w;
        if (!line || ctx.measureText(t).width <= maxW) line = t; else { out.push(line); line = w; }
      }
      if (line) out.push(line);
    }
    return out;
  }
  const TITLE_FONT = (px) => '800 ' + Math.round(px) + 'px Sora, "Segoe UI", system-ui, -apple-system, sans-serif';
  /** The title, centred in the band above the picture (or near the top when cropped to fill), at most three lines. */
  function drawTitle(ctx, W, H, L, o) {
    const t = String(o.title || '').trim();
    if (!t) return null;
    const top = H * 0.08;
    const bottom = o.mode === 'fill' ? H * 0.26 : Math.max(top + H * 0.06, L.y - H * 0.025);
    const maxW = W * 0.86;
    let px = Math.min(W, H) * (TITLE_FRAC[o.titleSize] || TITLE_FRAC.m) * (H > W ? 1.25 : 1);
    let lines;
    for (;;) {
      ctx.font = TITLE_FONT(px);
      lines = wrapLines(ctx, t, maxW);
      if ((lines.length <= 3 && lines.length * px * 1.15 <= bottom - top) || px < 14) break;
      px *= 0.92;
    }
    if (lines.length > 3) { lines = lines.slice(0, 3); lines[2] = lines[2].replace(/\s*\S*$/, '') + '…'; }
    const lh = px * 1.15;
    const blockH = lines.length * lh;
    const y0 = Math.max(top, (top + bottom) / 2 - blockH / 2);
    ctx.save();
    if (o.mode === 'fill') {
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.fillRect(0, y0 - lh * 0.35, W, blockH + lh * 0.7);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = TITLE_FONT(px);
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = px * 0.18; ctx.shadowOffsetY = px * 0.04;
    ctx.fillStyle = o.titleColour || '#ffffff';
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + lh * (i + 0.5)));
    ctx.restore();
    return { top: y0, bottom: y0 + blockH, lines: lines.length };
  }

  /** A blurred, darkened copy of the frame covering W × H: shrunk to a 24th, then drawn back up twice with smoothing. */
  function blurInto(ctx, src, vw, vh, W, H, dark, scratch) {
    const tw = Math.max(4, Math.round(W / 24)), th = Math.max(4, Math.round(H / 24));
    const mw = tw * 4, mh = th * 4;
    if (!scratch.a) { scratch.a = el('canvas'); scratch.b = el('canvas'); }
    const a = scratch.a, b = scratch.b;
    if (a.width !== tw || a.height !== th) { a.width = tw; a.height = th; }
    if (b.width !== mw || b.height !== mh) { b.width = mw; b.height = mh; }
    const ax = a.getContext('2d'), bx = b.getContext('2d');
    const s = Math.max(tw / vw, th / vh);
    const cw = tw / s, ch = th / s;
    ax.imageSmoothingEnabled = true; ax.imageSmoothingQuality = 'high';
    try { ax.drawImage(src, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, tw, th); } catch (e) { ax.fillStyle = '#000'; ax.fillRect(0, 0, tw, th); }
    bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = 'high';
    bx.drawImage(a, 0, 0, mw, mh);
    ctx.save();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(b, 0, 0, W, H);
    if (dark > 0) { ctx.fillStyle = 'rgba(0,0,0,' + clamp(dark / 100, 0, 0.95) + ')'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  /** One output frame. src is the <video> (or any image) of vw × vh. */
  function compose(ctx, W, H, src, vw, vh, o, scratch) {
    const L = layout(vw, vh, W, H, o);
    ctx.save();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (o.mode === 'blur') blurInto(ctx, src, vw, vh, W, H, o.dark, scratch || {});
    else { ctx.fillStyle = o.mode === 'colour' ? o.bg : '#000'; ctx.fillRect(0, 0, W, H); }
    try { ctx.drawImage(src, L.sx, L.sy, L.sw, L.sh, L.x, L.y, L.w, L.h); } catch (e) { /* not decodable yet */ }
    ctx.restore();
    drawTitle(ctx, W, H, L, o);
    return L;
  }

  /* ------------------------------------------------------------------ */
  /* reading the video                                                  */
  /* ------------------------------------------------------------------ */
  function seek(video, t, signal) {
    return new Promise((res, rej) => {
      if (signal && signal.aborted) { rej(A.abortError()); return; }
      if (Math.abs(video.currentTime - t) < 1e-4 && video.readyState >= 2) { res(); return; }
      let done = false;
      const finish = () => { if (done) return; done = true; video.removeEventListener('seeked', finish); clearTimeout(timer); res(); };
      const timer = setTimeout(finish, 4000);
      video.addEventListener('seeked', finish);
      video.currentTime = t;
    });
  }

  /** The sound, decoded whole at 48 kHz; null when the file has none (or it cannot be decoded). */
  async function decodeSound(file) {
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Ctx) return null;
    try {
      const buf = await file.arrayBuffer();
      const ctx = new Ctx(2, 48000, 48000);
      return await new Promise((res, rej) => {
        const p = ctx.decodeAudioData(buf, res, rej);
        if (p && p.then) p.then(res, rej);
      });
    } catch (e) { return null; }
  }

  /**
   * Frames as the video plays: each one the browser presents is composed
   * and handed on with its media time. When `queue` is full the video is
   * paused until the consumer catches up, so frames are never dropped to
   * keep pace. Ends at the end of the video.
   */
  async function* playbackFrames(video, W, H, fps, draw, signal, duration, stats) {
    const canvas = el('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const queue = [];
    const MAXQ = 4, MIN_RATE = 0.125;
    let wake = null, ended = false, lastT = -1, handle = 0, paused = false, failed = null, seeking = false;
    /* it starts at half speed until two frames in a row have shown how long
       a frame lasts, then runs at normal speed; after 90 frames without a
       miss a slowed-down run doubles its speed again */
    let prevPF = null, prevDrop = 0, prevT = -1, dur = 0, rate = 0.5, clean = 0;
    stats = stats || {};
    stats.rewinds = 0; stats.late = 0; stats.slowest = 1;
    const poke = () => { if (wake) { const w = wake; wake = null; w(); } };
    const minGap = 1 / fps - 0.004;
    const dropped = () => { try { return video.getVideoPlaybackQuality().droppedVideoFrames; } catch (e) { return 0; } };
    const take = (t) => {
      draw(ctx, W, H, video);
      const ts = Math.round(t * 1e6);
      const du = Math.round(1e6 / fps);
      const item = typeof VideoFrame !== 'undefined'
        ? { frame: new VideoFrame(canvas, { timestamp: ts, duration: du }), timestampUs: ts, durationUs: du, progress: duration ? t / duration : null }
        : (() => { const c = el('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(canvas, 0, 0); return { canvas: c, timestampUs: ts, durationUs: du, progress: duration ? t / duration : null }; })();
      queue.push(item);
      lastT = t;
      poke();
    };
    /* A frame went by unseen (the page was busy, or the decoder late): go
       back a quarter of a second before the last frame taken and play on at
       half the speed. The run-up matters: a player often drops a frame or two
       just after it starts again, and those now fall on frames already taken,
       while the frames before the gap tell the check what a frame lasts.
       At an eighth of normal speed the same gap is tried again up to four
       more times before it is accepted and counted. */
    const PREROLL = 0.25, RETRIES = 4;
    let retryAt = -1, retries = 0, probes = 0;
    const rewind = () => {
      seeking = true; paused = false;
      video.pause();
      if (retryAt === lastT) retries++; else { retryAt = lastT; retries = 0; }
      rate = Math.max(MIN_RATE, rate / 2); video.playbackRate = rate;
      stats.rewinds++; stats.slowest = rate;
      video.addEventListener('seeked', () => { seeking = false; prevPF = null; prevT = -1; prevDrop = dropped(); if (!ended) video.play().catch(() => {}); }, { once: true });
      video.currentTime = Math.max(0, lastT - PREROLL);
    };
    const cb = (now, meta) => {
      if (!seeking) {
        const t = meta && isFinite(meta.mediaTime) ? meta.mediaTime : video.currentTime;
        const pf = meta && isFinite(meta.presentedFrames) ? meta.presentedFrames : null;
        const dr = dropped();
        /* a missed frame shows as a jump in the presented-frame count, a rise
           in the dropped count, or (once the frame length is known) a jump in time */
        let missed = false;
        if (t > lastT + 1e-4) {
          if (prevPF !== null && pf !== null && pf - prevPF > 1) missed = true;
          if (dr > prevDrop) missed = true;
          if (dur > 0 && t - Math.max(lastT, prevT) > dur * 1.5 + 0.002) missed = true;
          /* nothing yet to compare with (the first frame after the start or a
             seek, before any frame length is known): a gap longer than one and
             a half output frames is checked by going back, twice at most */
          if (!dur && prevPF === null && t - lastT > 1.5 / fps + 0.002 && probes < 2) { missed = true; probes++; }
        }
        if (prevPF !== null && pf !== null && pf - prevPF === 1 && prevT >= 0 && t > prevT) {
          const first = !dur;
          dur = dur ? Math.min(dur, t - prevT) : t - prevT;
          if (first && !stats.rewinds) { rate = 1; video.playbackRate = rate; }
        }
        if (window.__svRrTrace) window.__svRrTrace.push([+t.toFixed(4), pf, dr, prevPF, +lastT.toFixed(4), +dur.toFixed(4), missed ? 1 : 0, rate, video.currentTime.toFixed(4)]);
        prevPF = pf; prevDrop = dr; prevT = t;
        if (missed && !ended && (rate > MIN_RATE || retryAt !== lastT || retries < RETRIES)) { clean = 0; rewind(); }
        else {
          if (missed) stats.late++;
          else if (++clean >= 90 && rate < 1) { clean = 0; rate = Math.min(1, rate * 2); video.playbackRate = rate; }
          if (t >= lastT + minGap) take(t);
          if (queue.length >= MAXQ && !video.paused && !ended) { paused = true; video.pause(); }
        }
      }
      if (!ended) handle = video.requestVideoFrameCallback(cb);
    };
    const onEnded = () => { ended = true; poke(); };
    const onError = () => { failed = new Error('the video stopped playing part-way (it may be damaged)'); ended = true; poke(); };
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    video.muted = true; video.playbackRate = rate; video.loop = false;
    video.pause();
    await seek(video, 0, signal);
    take(0);                       /* the first frame, as the seek left it */
    prevDrop = dropped();
    handle = video.requestVideoFrameCallback(cb);
    await video.play();
    try {
      for (;;) {
        if (signal && signal.aborted) throw A.abortError();
        if (failed) throw failed;
        if (queue.length) {
          const item = queue.shift();
          if (paused && queue.length < 2 && !ended && !seeking) { paused = false; video.play().catch(() => {}); }
          yield item;
          continue;
        }
        if (ended) break;
        if (video.paused && !paused && !seeking && !ended) video.play().catch(() => {});
        await new Promise((r) => { wake = r; setTimeout(r, 250); });
      }
    } finally {
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      try { video.cancelVideoFrameCallback(handle); } catch (e) { /* */ }
      video.pause(); video.playbackRate = 1;
      for (const q of queue) if (q.frame) q.frame.close();
    }
  }
  /** Frames by seeking, for browsers without requestVideoFrameCallback. */
  async function* steppedFrames(video, W, H, fps, draw, signal, duration) {
    const canvas = el('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const total = Math.max(1, Math.floor(duration * fps));
    for (let i = 0; i < total; i++) {
      if (signal && signal.aborted) throw A.abortError();
      await seek(video, Math.min(i / fps, duration - 0.001), signal);
      draw(ctx, W, H, video);
      yield { canvas, timestampUs: Math.round(i * 1e6 / fps), durationUs: Math.round(1e6 / fps), progress: i / total };
    }
  }

  const AVC = ['avc1.42001f', 'avc1.4d001f', 'avc1.640028', 'avc1.64002a', 'avc1.640032', 'avc1.640033'];
  async function canEncode(W, H, fps) {
    if (window.__svForceRecorder || typeof VideoEncoder === 'undefined' || !VideoEncoder.isConfigSupported || typeof VideoFrame === 'undefined') return false;
    for (const codec of AVC) {
      try { const r = await VideoEncoder.isConfigSupported({ codec, width: W, height: H, bitrate: 8e6, framerate: fps, avc: { format: 'avc' } }); if (r && r.supported) return true; } catch (e) { /* next */ }
    }
    return false;
  }

  /** No WebCodecs: play the video once in real time and record the composed canvas, with the decoded sound played into the recording. */
  async function recordRealTime(video, W, H, fps, draw, sound, signal, onProgress, duration) {
    if (typeof MediaRecorder === 'undefined') throw new Error('this browser can neither encode nor record video on the device. Chrome, Edge or Safari 16.4+ can.');
    const canvas = el('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    draw(ctx, W, H, video);
    const stream = canvas.captureStream(fps);
    let ac = null, srcNode = null, withSound = false;
    if (sound && (window.AudioContext || window.webkitAudioContext)) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const dest = ac.createMediaStreamDestination();
        srcNode = ac.createBufferSource(); srcNode.buffer = sound; srcNode.connect(dest);
        for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
        withSound = true;
      } catch (e) { ac = null; }
    }
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    const mime = types.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } });
    if (!mime) throw new Error('this browser cannot record video.');
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(clamp(W * H * fps * 0.1, 2e6, 10e6)) });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((r) => { rec.onstop = r; });
    await seek(video, 0, signal);
    video.muted = true; video.playbackRate = 1;
    let raf = 0, done = false;
    const ended = new Promise((r) => video.addEventListener('ended', () => { done = true; r(); }, { once: true }));
    const tick = () => { if (done) return; draw(ctx, W, H, video); onProgress(Math.min(0.99, video.currentTime / duration)); raf = requestAnimationFrame(tick); };
    rec.start(250);
    if (srcNode) { try { if (ac.state === 'suspended') await ac.resume(); } catch (e) { /* */ } srcNode.start(0); }
    await video.play();
    raf = requestAnimationFrame(tick);
    const abortP = new Promise((r) => { if (signal) signal.addEventListener('abort', r, { once: true }); });
    await Promise.race([ended, abortP]);
    cancelAnimationFrame(raf);
    video.pause();
    await sleep(150);
    try { rec.stop(); } catch (e) { /* */ }
    await stopped;
    if (ac) { try { ac.close(); } catch (e) { /* */ } }
    if (signal && signal.aborted) throw A.abortError();
    const isMp4 = /mp4/.test(mime);
    const blob = new Blob(chunks, { type: isMp4 ? 'video/mp4' : 'video/webm' });
    return { blob, note: (isMp4 ? 'MP4' : 'WebM') + ' recorded in real time' + (withSound ? ' with sound' : ', silent') + ' — this browser has no on-device H.264 encoder (WebCodecs), so the clip was played through once and recorded as it played.' };
  }

  /* ------------------------------------------------------------------ */
  /* the tool                                                           */
  /* ------------------------------------------------------------------ */
  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const S = Object.assign(load(), { fx: 0.5, fy: 0.5, title: '', src: null, sound: null, name: 'video', busy: false, job: null });
    const scratch = {};
    const opts = () => ({ mode: S.mode, bg: S.bg, dark: S.dark, position: S.position, fx: S.fx, fy: S.fy, title: S.title, titleSize: S.titleSize, titleColour: S.titleColour });

    const wrap = el('div', 'aiimg sv-reel');
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose a video</strong><span>MP4, MOV or WebM, up to 3 minutes and 500 MB, or drop it here. Nothing is uploaded.</span>';
    const file = el('input', 'visually-hidden'); file.type = 'file'; file.accept = 'video/*,.mp4,.mov,.m4v,.webm'; file.id = 'sv-reel-file';
    file.setAttribute('aria-label', 'Choose a video to resize');
    const msg = el('div', 'io-msg'); msg.setAttribute('role', 'status');

    const studio = el('div', 'aiimg-studio sv-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage sv-stage sv-reel-stage');
    const canvas = el('canvas', 'aiimg-canvas sv-reel-canvas');
    canvas.tabIndex = 0;
    stage.appendChild(canvas);
    const playB = button('▶ Play', 'btn-ghost', () => togglePlay());
    const scrub = el('input', 'range'); scrub.type = 'range'; scrub.min = '0'; scrub.max = '1000'; scrub.value = '0'; scrub.id = 'sv-reel-scrub';
    scrub.setAttribute('aria-label', 'Position in the video');
    const clock = el('span', 'range-val sv-clock', '0:00');
    const transport = el('div', 'aiimg-transport'); transport.append(playB, scrub, clock);
    const focusHint = el('p', 'field-hint sv-focus-hint', 'Drag the picture, or select it and use the arrow keys, to choose what stays in the frame.');
    stageCol.append(stage, transport, focusHint);

    const side = el('div', 'aiimg-side');
    const sizeSel = select('sv-reel-size', Object.keys(SIZES).map((k) => [k, SIZES[k].label]), S.size);
    const modeSel = select('sv-reel-mode', MODES, S.mode);
    const bgIn = colour('sv-reel-bg', S.bg);
    const darkR = range('sv-reel-dark', 0, 85, 1, S.dark, (v) => v + '%');
    const posSel = select('sv-reel-pos', POSITIONS, S.position);
    const fxR = range('sv-reel-fx', 0, 100, 1, 50, (v) => v + '%');
    const fyR = range('sv-reel-fy', 0, 100, 1, 50, (v) => v + '%');
    const titleIn = el('textarea', 'control'); titleIn.id = 'sv-reel-title'; titleIn.rows = 2; titleIn.maxLength = 120; titleIn.placeholder = 'Optional, e.g. 3 things I wish I knew';
    const tSizeSel = select('sv-reel-tsize', TITLE_SIZES, S.titleSize);
    const tColIn = colour('sv-reel-tcolour', S.titleColour);
    const fpsSel = select('sv-reel-fps', [[30, '30'], [60, '60 (when the video has them)']], S.fps);
    const fBg = field('Background colour', bgIn), fDark = field('Darken the blurred copy', darkR), fPos = field('Position', posSel);
    const fFx = field('Focus, left to right', fxR), fFy = field('Focus, top to bottom', fyR);
    const g1 = el('div', 'aiimg-grid2'); g1.append(field('Title size', tSizeSel), field('Title colour', tColIn));
    const exportB = button('Make the MP4', 'btn-primary', () => runExport());
    const cancelB = button('Cancel', 'btn-ghost', () => { if (S.job) S.job.abort(); }); cancelB.hidden = true;
    const prog = el('div', 'aiimg-progress'); prog.hidden = true; prog.setAttribute('role', 'progressbar'); prog.setAttribute('aria-valuemin', '0'); prog.setAttribute('aria-valuemax', '100');
    const bar = el('i'); prog.appendChild(bar);
    const status = el('p', 'aiimg-status sv-status'); status.setAttribute('aria-live', 'polite');
    const route = el('p', 'field-hint sv-route');
    const row = el('div', 'aiimg-row'); row.append(exportB, cancelB);
    const another = button('Choose another video', 'btn-ghost', () => file.click());
    side.append(field('Size', sizeSel, '9:16 is for Reels, Shorts, TikTok and Stories; 4:5 and 1:1 for a feed post.'), field('Background', modeSel), fBg, fDark, fPos, fFx, fFy,
      field('Title above the video', titleIn), g1, field('Frames per second', fpsSel),
      row, prog, status, route,
      el('p', 'field-hint', 'The video is re-encoded, so the picture quality is your browser’s encoder’s, at about 8 Mbps for 1080 px wide. It is played through once to read every frame, so a one-minute video takes at least a minute; when the device falls behind, it goes back and plays that part more slowly rather than skip frames. Keep this tab in front while it runs. Up to 3 minutes and 500 MB, because the sound and the finished file are held in your browser’s memory.'),
      another);
    studio.append(stageCol, side);
    const results = el('div', 'aiimg-results');
    wrap.append(drop, file, msg, studio, results);
    io.appendChild(wrap);

    const say = (t, kind) => { msg.textContent = t || ''; msg.className = 'io-msg' + (kind ? ' is-' + kind : ''); };
    const pctx = canvas.getContext('2d');

    /* route note: which encoder this browser will use */
    canEncode(1080, 1920, 30).then((ok) => {
      S.webcodecs = ok;
      route.textContent = ok ? 'Encoded on your device: H.264 MP4 with the original sound (AAC, or Opus where this browser has no AAC encoder).'
        : 'This browser has no on-device H.264 encoder (WebCodecs), so the video will be recorded in real time as it plays — usually as WebM. Chrome, Edge or Safari 16.4+ make an MP4.';
    });

    /* ---------- preview ---------- */
    const PREVIEW = 3;   /* the preview is a third of the output size */
    let queued = false;
    function drawPreview() {
      queued = false;
      if (!S.src) return;
      const z = SIZES[S.size];
      const W = Math.round(z.w / PREVIEW), H = Math.round(z.h / PREVIEW);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      compose(pctx, W, H, S.src.video, S.src.width, S.src.height, opts(), scratch);
      const v = S.src.video;
      if (document.activeElement !== scrub) scrub.value = String(Math.round(v.currentTime / S.src.duration * 1000));
      clock.textContent = fmtT(v.currentTime) + ' / ' + fmtT(S.src.duration);
      canvas.setAttribute('aria-label', 'Preview, ' + z.w + ' by ' + z.h + (S.mode === 'fill' ? '. Arrow keys move what stays in the frame.' : ''));
    }
    const redraw = () => { if (!queued) { queued = true; requestAnimationFrame(drawPreview); } };
    let playing = false, raf = 0;
    function stopPlay() { if (!playing) return; playing = false; cancelAnimationFrame(raf); try { S.src.video.pause(); } catch (e) { /* */ } playB.textContent = '▶ Play'; }
    async function togglePlay() {
      if (!S.src || S.busy) return;
      if (playing) { stopPlay(); return; }
      const v = S.src.video;
      if (v.ended || v.currentTime >= S.src.duration - 0.05) await seek(v, 0);
      playing = true; playB.textContent = '❚❚ Pause';
      try { await v.play(); } catch (e) { stopPlay(); return; }
      const tick = () => { if (!playing) return; if (v.ended) { stopPlay(); } drawPreview(); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }
    scrub.addEventListener('input', () => { if (!S.src) return; stopPlay(); seek(S.src.video, Number(scrub.value) / 1000 * S.src.duration).then(redraw); });

    /* focus: drag the picture, or the arrow keys, in fill mode */
    function setFocus(fx, fy) {
      S.fx = clamp(fx, 0, 1); S.fy = clamp(fy, 0, 1);
      fxR.set(Math.round(S.fx * 100)); fyR.set(Math.round(S.fy * 100));
      redraw();
    }
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => {
      if (!S.src || S.mode !== 'fill') return;
      canvas.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, fx: S.fx, fy: S.fy };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const z = SIZES[S.size];
      const r = canvas.getBoundingClientRect();
      const L = layout(S.src.width, S.src.height, z.w, z.h, opts());
      /* moving the picture right shows more of its left: the focus moves the other way */
      const spareX = S.src.width - L.sw, spareY = S.src.height - L.sh;
      const perPxX = L.sw / r.width, perPxY = L.sh / r.height;
      setFocus(spareX > 1 ? drag.fx - (e.clientX - drag.x) * perPxX / spareX : 0.5, spareY > 1 ? drag.fy - (e.clientY - drag.y) * perPxY / spareY : 0.5);
    });
    const endDrag = () => { drag = null; };
    canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('keydown', (e) => {
      if (!S.src || S.mode !== 'fill') return;
      const k = e.shiftKey ? 0.2 : 0.05;
      const d = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, -k], ArrowDown: [0, k] }[e.key];
      if (!d) return;
      e.preventDefault();
      setFocus(S.fx + d[0], S.fy + d[1]);
    });

    /* ---------- settings ---------- */
    function syncFields() {
      fBg.hidden = S.mode !== 'colour';
      fDark.hidden = S.mode !== 'blur';
      fPos.hidden = S.mode === 'fill';
      fFx.hidden = fFy.hidden = S.mode !== 'fill';
      focusHint.hidden = S.mode !== 'fill';
      canvas.style.cursor = S.mode === 'fill' ? 'grab' : 'default';
    }
    function changed() {
      S.size = sizeSel.value; S.mode = modeSel.value; S.bg = bgIn.value; S.dark = Number(darkR.input.value);
      S.position = posSel.value; S.titleSize = tSizeSel.value; S.titleColour = tColIn.value; S.fps = Number(fpsSel.value);
      S.fx = Number(fxR.input.value) / 100; S.fy = Number(fyR.input.value) / 100;
      S.title = titleIn.value;
      save(S);
      syncFields();
      redraw();
    }
    for (const c of [sizeSel, modeSel, posSel, tSizeSel, fpsSel]) c.addEventListener('change', changed);
    for (const c of [bgIn, darkR.input, fxR.input, fyR.input, titleIn, tColIn]) c.addEventListener('input', changed);
    syncFields();

    /* ---------- loading ---------- */
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    ['dragenter', 'dragover'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    wrap.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) loadFiles(e.dataTransfer.files); });
    file.addEventListener('change', () => { if (file.files.length) loadFiles(file.files); file.value = ''; });

    async function loadFiles(list) {
      if (S.busy) return;
      const files = Array.from(list);
      const isVideo = (f) => /^video\//.test(f.type) || VIDEO_RE.test(f.name || '');
      const vids = files.filter(isVideo);
      const notes = files.filter((f) => !isVideo(f)).map((f) => f.name + ': not a video (choose an MP4, MOV or WebM).');
      if (!vids.length) { say(notes.join(' '), 'error'); return; }
      if (vids.length > 1) notes.push('One video at a time: using ' + vids[0].name + '; ' + vids.slice(1).map((f) => f.name).join(', ') + ' not used.');
      const f = vids[0];
      if (f.size > MAX_BYTES) { say(f.name + ': ' + fmtBytes(f.size) + ' is over the 500 MB this tool takes, because the whole file is read into memory. Trim or compress it first.', 'error'); return; }
      say('Reading ' + f.name + '…');
      S.busy = true;
      const url = URL.createObjectURL(f);
      const v = el('video', 'sv-hidden-video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('aria-hidden', 'true');
      v.src = url;
      try {
        const ok = await new Promise((res) => {
          const t = setTimeout(() => res(v.readyState >= 1), 15000);
          v.addEventListener('loadedmetadata', () => { clearTimeout(t); res(true); }, { once: true });
          v.addEventListener('error', () => { clearTimeout(t); res(false); }, { once: true });
        });
        if (!ok || !v.videoWidth) throw new Error('this browser could not read a picture from it. It may use a codec the browser lacks (HEVC MOVs often do): try an MP4 (H.264) or a WebM.');
        stage.appendChild(v);
        if (!isFinite(v.duration) || !v.duration) {
          await new Promise((res) => { const t = setTimeout(res, 8000); v.addEventListener('durationchange', function g() { if (isFinite(v.duration) && v.duration) { v.removeEventListener('durationchange', g); clearTimeout(t); res(); } }); v.currentTime = 1e7; });
          await seek(v, 0);
        }
        if (!isFinite(v.duration) || !v.duration) throw new Error('its length could not be read.');
        if (v.duration > MAX_SECONDS + 0.5) throw new Error('it is ' + fmtT(v.duration) + ' long; this tool takes up to 3 minutes, because the sound and the finished MP4 are held in memory. Trim it first.');
        say('Decoding the sound of ' + f.name + '…');
        const sound = await decodeSound(f);
        if (S.src) { stopPlay(); try { S.src.video.removeAttribute('src'); S.src.video.load(); } catch (e) { /* */ } S.src.video.remove(); URL.revokeObjectURL(S.src.url); }
        S.src = { video: v, url, width: v.videoWidth, height: v.videoHeight, duration: v.duration };
        S.sound = sound;
        S.name = String(f.name || 'video').replace(/\.[^.]+$/, '') || 'video';
        drop.hidden = true; studio.hidden = false;
        await seek(v, Math.min(0.5, v.duration / 2));
        drawPreview();
        say(f.name + ': ' + v.videoWidth + ' × ' + v.videoHeight + ', ' + v.duration.toFixed(1) + ' s, ' + (sound ? 'with sound' : 'no sound track found') + '.' + (notes.length ? ' ' + notes.join(' ') : ''), notes.length ? 'warn' : '');
        status.textContent = '';
      } catch (e) {
        try { v.removeAttribute('src'); v.load(); } catch (x) { /* */ } v.remove(); URL.revokeObjectURL(url);
        say(f.name + ': ' + ((e && e.message) || e) + (notes.length ? ' ' + notes.join(' ') : ''), 'error');
      } finally { S.busy = false; }
    }

    /* ---------- export ---------- */
    async function runExport() {
      if (!S.src || S.busy) return;
      stopPlay();
      const z = SIZES[S.size];
      const W = z.w, H = z.h, fps = S.fps;
      const o = opts();
      const src = S.src;
      const draw = (ctx, w, h, video) => compose(ctx, w, h, video, src.width, src.height, o, scratch);
      S.busy = true; S.job = new AbortController();
      const signal = S.job.signal;
      exportB.disabled = true; cancelB.hidden = false; prog.hidden = false; bar.style.width = '0%';
      const started = performance.now();
      const onProgress = (p) => {
        const f = clamp(p, 0, 1), v = Math.round(f * 100);
        bar.style.width = v + '%'; prog.setAttribute('aria-valuenow', String(v));
        const spent = (performance.now() - started) / 1000;
        status.textContent = 'Encoding — ' + v + '%' + (f > 0.05 && f < 1 ? ', about ' + Math.max(1, Math.round(spent / f - spent)) + ' s left' : '') + '.';
      };
      status.textContent = 'Starting…';
      try {
        let r;
        const stats = {};
        if (await canEncode(W, H, fps)) {
          const frames = 'requestVideoFrameCallback' in src.video
            ? playbackFrames(src.video, W, H, fps, draw, signal, src.duration, stats)
            : steppedFrames(src.video, W, H, fps, draw, signal, src.duration);
          r = await A.encodeVideoFrames(frames, { fps, width: W, height: H, bitrate: W >= 1080 ? 8e6 : 5e6, audio: S.sound ? { buffer: S.sound } : null, onProgress, signal });
          r.note = r.note + (S.sound ? '' : ' (the video has no sound track)') +
            (stats.rewinds ? '. The device fell behind ' + stats.rewinds + (stats.rewinds === 1 ? ' time' : ' times') + ', so it went back and played on more slowly (down to ' + stats.slowest + '×) rather than skip a frame' : '') +
            (stats.late ? '; ' + stats.late + ' frame' + (stats.late === 1 ? '' : 's') + ' still came too late and ' + (stats.late === 1 ? 'was' : 'were') + ' left out' : '');
          S.lastStats = stats;
        } else {
          r = await recordRealTime(src.video, W, H, fps, draw, S.sound, signal, onProgress, src.duration);
        }
        if (signal.aborted) throw A.abortError();
        const name = S.name + '-' + S.size.replace(/-.*$/, '') + '.' + extOf(r.blob);
        addResult(r.blob, name, W, H, r.note);
        A.download(r.blob, name);
        onProgress(1);
        status.textContent = 'Done in ' + ((performance.now() - started) / 1000).toFixed(1) + ' s: ' + name + ', ' + fmtBytes(r.blob.size) + '. ' + r.note;
      } catch (e) {
        if (e && e.name === 'AbortError') status.textContent = 'Cancelled. Nothing was saved.';
        else { status.textContent = 'The video could not be made.'; say(S.name + ': ' + ((e && e.message) || e), 'error'); }
      } finally {
        S.busy = false; S.job = null; exportB.disabled = false; cancelB.hidden = true;
        setTimeout(() => { if (!S.busy) prog.hidden = true; }, 500);
        try { await seek(src.video, Math.min(0.5, src.duration / 2)); } catch (e) { /* */ }
        redraw();
      }
    }

    function addResult(blob, name, W, H, note) {
      const row = el('div', 'aiimg-result');
      const head = el('div', 'aiimg-result-head');
      head.append(el('strong', null, name), el('span', null, fmtBytes(blob.size) + ' · ' + W + ' × ' + H), button('Download', 'btn-download', () => A.download(blob, name)));
      const v = el('video', 'sv-result-video'); v.controls = true; v.playsInline = true; v.preload = 'metadata'; v.src = URL.createObjectURL(blob);
      row.append(head, v, el('p', 'field-hint', note));
      results.insertBefore(row, results.firstChild);
      while (results.children.length > 3) { const last = results.lastChild; const lv = last.querySelector('video'); if (lv) URL.revokeObjectURL(lv.src); last.remove(); }
    }

    return { state: S };
  }

  A.tools['reels-resizer'] = { mount, layout, compose, SIZES, MAX_SECONDS };
})();
