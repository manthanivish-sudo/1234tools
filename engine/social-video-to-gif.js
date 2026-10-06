/**
 * Video to GIF (/social/video-to-gif/).
 *
 * A video (MP4, MOV, WebM — whatever this browser can play) in, an animated
 * GIF out. The visitor picks the part to keep on a trim bar (two handles,
 * dragged or moved with the arrow keys, or typed as seconds), the width,
 * the frame rate (5–20), the speed (0.5–2×), how many times it plays, a
 * crop (original, 1:1, 9:16, 4:5) and an optional caption.
 *
 * How a GIF is made here:
 *   1. frames are read by seeking a hidden <video> to each moment (the
 *      decoder the browser already has: nothing is uploaded, no codec is
 *      shipped) and drawn — cropped, scaled and captioned — on a canvas by
 *      one function, renderFrame(), which the preview uses too;
 *   2. eight frames spread over the selection choose one palette of 256
 *      colours for the whole GIF, so colours do not flicker frame to frame;
 *   3. every frame's pixels go to a Web Worker (engine/social-gif-worker.js,
 *      gifenc 1.0.3, MIT) that maps them to the palette, dithers and
 *      compresses them, while the page reads the next frame. Where a module
 *      worker cannot start, the same code runs on the page between frames.
 *   4. frame delays are whole hundredths of a second (the GIF format's
 *      unit), spread so they add up to the clip's length: 15 fps is 7, 7, 6
 *      hundredths and so on, not 7 every time.
 * Before export the size is estimated by compressing four frames of the
 * selection for real and multiplying up.
 *
 * Limits, said on the page: at most MAX_FRAMES frames (30 s at 20 fps) and
 * 640 px wide, because a GIF stores every frame whole in 256 colours and
 * the file grows with each frame and pixel.
 *
 * Remembered in localStorage '1234tools-social-video-to-gif-v1': width,
 * fps, speed, loops, crop, caption position and size, dither. Never the
 * video, its name or the caption's words.
 *
 * Test hooks: window.__svGifNoWorker = true runs the encoder on the page.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A) return;
  const { el, clamp, field, select, range, check, button, sleep, fmtBytes } = A;

  const KEY = '1234tools-social-video-to-gif-v1';
  const MAX_FRAMES = 600;
  const WIDTHS = [[240, '240 px'], [320, '320 px'], [480, '480 px'], [640, '640 px']];
  const SPEEDS = [[0.5, '0.5× (slow motion)'], [0.75, '0.75×'], [1, '1× (as filmed)'], [1.25, '1.25×'], [1.5, '1.5×'], [2, '2×']];
  /* plays → the NETSCAPE2.0 repeat count gifenc writes: -1 = no block (plays once), 0 = for ever, n = n repeats after the first play */
  const LOOPS = [['0', 'Loop for ever'], ['1', 'Play once'], ['2', 'Play 2 times'], ['3', 'Play 3 times'], ['5', 'Play 5 times']];
  const repeatOf = (plays) => (Number(plays) === 0 ? 0 : Number(plays) === 1 ? -1 : Number(plays) - 1);
  const CROPS = [['original', 'Original shape'], ['square', 'Square, 1:1'], ['portrait', 'Vertical, 9:16'], ['feed', 'Portrait, 4:5']];
  const RATIO = { square: 1, portrait: 9 / 16, feed: 4 / 5 };
  const CAP_SIZES = [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']];
  const CAP_FRAC = { s: 0.075, m: 0.1, l: 0.13 };
  const EXT = { 'image/gif': 'gif' };
  const extOf = (b) => EXT[String(b.type).split(';')[0]] || 'bin';
  const VIDEO_RE = /\.(mp4|m4v|mov|webm|mkv|ogv|avi)$/i;
  const fmtT = (s) => {
    if (!isFinite(s)) return '–';
    const m = Math.floor(s / 60), r = s - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
  };

  /* ------------------------------------------------------------------ */
  /* settings                                                           */
  /* ------------------------------------------------------------------ */
  function load() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { p = null; }
    const o = { width: 480, fps: 12, speed: 1, loops: '0', crop: 'original', pos: 50, capPos: 'bottom', capSize: 'm', dither: true };
    if (!p || p.v !== 1) return o;
    if (WIDTHS.some((w) => w[0] === p.width)) o.width = p.width;
    if (isFinite(p.fps)) o.fps = clamp(Math.round(p.fps), 5, 20);
    if (SPEEDS.some((s) => s[0] === p.speed)) o.speed = p.speed;
    if (LOOPS.some((l) => l[0] === p.loops)) o.loops = p.loops;
    if (CROPS.some((c) => c[0] === p.crop)) o.crop = p.crop;
    if (isFinite(p.pos)) o.pos = clamp(Math.round(p.pos), 0, 100);
    if (p.capPos === 'top' || p.capPos === 'bottom') o.capPos = p.capPos;
    if (CAP_SIZES.some((c) => c[0] === p.capSize)) o.capSize = p.capSize;
    if (typeof p.dither === 'boolean') o.dither = p.dither;
    return o;
  }
  function save(S) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, width: S.width, fps: S.fps, speed: S.speed, loops: S.loops, crop: S.crop, pos: S.pos, capPos: S.capPos, capSize: S.capSize, dither: S.dither }));
    } catch (e) { /* private window or storage blocked: the settings still apply to this visit */ }
  }

  /* ------------------------------------------------------------------ */
  /* geometry and drawing                                               */
  /* ------------------------------------------------------------------ */
  /** The source rectangle a crop keeps, and the output size for a width. */
  function geometry(vw, vh, crop, pos, width) {
    const r = RATIO[crop] || vw / vh;
    let sx = 0, sy = 0, sw = vw, sh = vh;
    const p = clamp(pos, 0, 100) / 100;
    if (vw / vh > r) { sw = vh * r; sx = (vw - sw) * p; } else if (vw / vh < r) { sh = vw / r; sy = (vh - sh) * p; }
    const W = Math.max(2, Math.round(width));
    const H = Math.max(2, Math.round(W / r));
    return { sx, sy, sw, sh, W, H };
  }

  const CAP_FONT = (px) => '800 ' + Math.round(px) + 'px Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Black", system-ui, sans-serif';
  function wrapLines(ctx, text, maxW) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (!line || ctx.measureText(t).width <= maxW) line = t;
      else { lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    return lines;
  }
  /** The caption: white capitals-friendly type with a dark edge, at most two lines, made smaller until it fits. */
  function drawCaption(ctx, W, H, text, posn, size) {
    const t = String(text || '').trim();
    if (!t) return null;
    const maxW = W * 0.92;
    let px = Math.max(10, Math.min(W, H) * (CAP_FRAC[size] || CAP_FRAC.m) * 1.6);
    let lines;
    for (;;) {
      ctx.font = CAP_FONT(px);
      lines = wrapLines(ctx, t, maxW);
      if ((lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= maxW)) || px <= 10) break;
      px *= 0.92;
    }
    if (lines.length > 2) { lines = lines.slice(0, 2); lines[1] = lines[1].replace(/\s*\S*$/, '') + '…'; }
    const lh = px * 1.08;
    const pad = Math.max(4, H * 0.04);
    const y0 = posn === 'top' ? pad + lh / 2 : H - pad - lh * (lines.length - 0.5);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, px * 0.16);
    ctx.strokeStyle = '#000000'; ctx.fillStyle = '#ffffff';
    lines.forEach((l, i) => {
      const y = y0 + i * lh;
      ctx.strokeText(l, W / 2, y);
      ctx.fillText(l, W / 2, y);
    });
    ctx.restore();
    return { px, lines: lines.length, top: y0 - lh / 2, bottom: y0 + (lines.length - 0.5) * lh };
  }

  /** One frame exactly as it goes into the GIF: cropped, scaled, captioned. */
  function renderFrame(ctx, g, video, S) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, g.W, g.H);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    try { ctx.drawImage(video, g.sx, g.sy, g.sw, g.sh, 0, 0, g.W, g.H); } catch (e) { /* not decodable yet: black */ }
    drawCaption(ctx, g.W, g.H, S.caption, S.capPos, S.capSize);
  }

  /** Seek a video and resolve once the frame at t can be drawn. */
  function seek(video, t, signal) {
    return new Promise((res, rej) => {
      if (signal && signal.aborted) { rej(A.abortError()); return; }
      if (Math.abs(video.currentTime - t) < 1e-4 && video.readyState >= 2) { res(); return; }
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        video.removeEventListener('seeked', finish);
        clearTimeout(timer);
        res();
      };
      const timer = setTimeout(finish, 4000);
      video.addEventListener('seeked', finish);
      video.currentTime = t;
    });
  }

  /** A file the page can seek: resolves { video, url, width, height, duration } or throws with a reason. */
  async function openVideo(file) {
    const url = URL.createObjectURL(file);
    const v = el('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('aria-hidden', 'true');
    v.src = url;
    const ok = await new Promise((res) => {
      const t = setTimeout(() => res(v.readyState >= 1), 15000);
      v.addEventListener('loadedmetadata', () => { clearTimeout(t); res(true); }, { once: true });
      v.addEventListener('error', () => { clearTimeout(t); res(false); }, { once: true });
    });
    if (!ok || !v.videoWidth || !v.videoHeight) {
      URL.revokeObjectURL(url);
      throw new Error('this browser could not read a picture from it. It may use a codec the browser lacks (HEVC MOVs often do outside Safari): try an MP4 (H.264) or a WebM.');
    }
    /* a recording straight from MediaRecorder may report Infinity until it has been read to the end */
    if (!isFinite(v.duration) || !v.duration) {
      await new Promise((res) => {
        const t = setTimeout(res, 8000);
        v.addEventListener('durationchange', function f() { if (isFinite(v.duration) && v.duration) { v.removeEventListener('durationchange', f); clearTimeout(t); res(); } });
        v.currentTime = 1e7;
      });
      await seek(v, 0);
    }
    if (!isFinite(v.duration) || !v.duration) { URL.revokeObjectURL(url); throw new Error('its length could not be read.'); }
    return { video: v, url, width: v.videoWidth, height: v.videoHeight, duration: v.duration };
  }

  /* ------------------------------------------------------------------ */
  /* the encoder: a module worker, else the same code on the page       */
  /* ------------------------------------------------------------------ */
  const WORKER_URL = '/engine/social-gif-worker.js';
  function encoder() {
    let worker = null, local = null, seq = 0;
    const waiting = new Map();
    const startWorker = () => {
      if (worker || window.__svGifNoWorker) return worker;
      try {
        worker = new Worker(WORKER_URL, { type: 'module' });
        worker.onmessage = (e) => {
          const m = e.data || {};
          const w = waiting.get(m.id);
          if (!w) return;
          waiting.delete(m.id);
          if (m.ok) w.res(m); else w.rej(new Error(m.error || 'the GIF encoder failed'));
        };
        worker.onerror = (e) => {
          const err = new Error('the GIF encoder could not run' + (e && e.message ? ': ' + e.message : ''));
          for (const w of waiting.values()) w.rej(err);
          waiting.clear();
          try { worker.terminate(); } catch (x) { /* */ }
          worker = null;
          window.__svGifNoWorker = true;   /* the page's copy from now on */
        };
      } catch (e) { worker = null; }
      return worker;
    };
    let viaWorker = false;
    async function call(msg, transfer) {
      const w = window.__svGifNoWorker ? null : startWorker();
      viaWorker = !!w;
      if (w) {
        const id = ++seq;
        return new Promise((res, rej) => { waiting.set(id, { res, rej }); w.postMessage(Object.assign({ id }, msg), transfer || []); });
      }
      if (!local) local = await import(WORKER_URL);
      await sleep(0);
      return local.handle(msg);
    }
    return {
      call,
      get inWorker() { return viaWorker; },
      stop() {
        if (worker) { try { worker.terminate(); } catch (e) { /* */ } worker = null; }
        for (const w of waiting.values()) w.rej(A.abortError());
        waiting.clear();
        if (local) local.handle({ type: 'cancel' });
      }
    };
  }

  /** Whole hundredths of a second per frame, adding up to the clip: frame i lasts round((i+1)·100/fps) − round(i·100/fps). */
  function delays(n, fps) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(Math.round((i + 1) * 100 / fps) - Math.round(i * 100 / fps));
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* the tool                                                           */
  /* ------------------------------------------------------------------ */
  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const S = Object.assign(load(), { caption: '', start: 0, end: 0, file: null, src: null, grab: null, name: 'clip', busy: false });
    const enc = encoder();

    const wrap = el('div', 'aiimg sv-gif');
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose a video</strong><span>MP4, MOV or WebM, or drop it here. Nothing is uploaded.</span>';
    const file = el('input', 'visually-hidden'); file.type = 'file'; file.accept = 'video/*,.mp4,.mov,.m4v,.webm,.mkv'; file.id = 'sv-gif-file';
    file.setAttribute('aria-label', 'Choose a video to turn into a GIF');
    const msg = el('div', 'io-msg'); msg.setAttribute('role', 'status');

    const studio = el('div', 'aiimg-studio sv-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage sv-stage');
    const canvas = el('canvas', 'aiimg-canvas sv-canvas');
    canvas.width = 480; canvas.height = 270;
    canvas.setAttribute('role', 'img');
    stage.appendChild(canvas);

    /* the trim bar: two sliders on one track */
    const trim = el('div', 'sv-trim');
    const track = el('div', 'sv-trim-track');
    const sel = el('div', 'sv-trim-sel');
    const playhead = el('div', 'sv-trim-play'); playhead.hidden = true;
    const hStart = el('button', 'sv-trim-h'); hStart.type = 'button';
    const hEnd = el('button', 'sv-trim-h'); hEnd.type = 'button';
    for (const [h, label] of [[hStart, 'Start of the GIF'], [hEnd, 'End of the GIF']]) {
      h.setAttribute('role', 'slider'); h.setAttribute('aria-label', label); h.setAttribute('aria-valuemin', '0');
    }
    trim.append(track, sel, playhead, hStart, hEnd);
    const startIn = el('input', 'control'); startIn.type = 'number'; startIn.id = 'sv-gif-start'; startIn.step = '0.1'; startIn.min = '0'; startIn.inputMode = 'decimal';
    const endIn = el('input', 'control'); endIn.type = 'number'; endIn.id = 'sv-gif-end'; endIn.step = '0.1'; endIn.min = '0'; endIn.inputMode = 'decimal';
    const lenOut = el('p', 'field-hint sv-len'); lenOut.setAttribute('aria-live', 'polite');
    const times = el('div', 'sv-times');
    times.append(field('Start (seconds)', startIn), field('End (seconds)', endIn));
    const playB = button('▶ Play the selection', 'btn-ghost', () => togglePlay());
    const transport = el('div', 'aiimg-transport'); transport.append(playB);
    stageCol.append(stage, trim, times, lenOut, transport);

    const side = el('div', 'aiimg-side');
    const widthSel = select('sv-gif-width', WIDTHS, S.width);
    const fpsR = range('sv-gif-fps', 5, 20, 1, S.fps, (v) => v + ' fps');
    const speedSel = select('sv-gif-speed', SPEEDS, S.speed);
    const loopSel = select('sv-gif-loop', LOOPS, S.loops);
    const cropSel = select('sv-gif-crop', CROPS, S.crop);
    const posR = range('sv-gif-pos', 0, 100, 1, S.pos, (v) => v + '%');
    const posField = field('Crop position', posR, 'Slide to keep more of the left or top (0%) or the right or bottom (100%).');
    const capIn = el('input', 'control'); capIn.type = 'text'; capIn.id = 'sv-gif-caption'; capIn.maxLength = 80; capIn.placeholder = 'Optional, e.g. WAIT FOR IT';
    const capPosSel = select('sv-gif-cappos', [['bottom', 'Bottom'], ['top', 'Top']], S.capPos);
    const capSizeSel = select('sv-gif-capsize', CAP_SIZES, S.capSize);
    const ditherC = check('sv-gif-dither', 'Dither (smoother gradients, slightly bigger file)', S.dither);
    const grid1 = el('div', 'aiimg-grid2'); grid1.append(field('Width', widthSel), field('Speed', speedSel));
    const grid2 = el('div', 'aiimg-grid2'); grid2.append(field('Crop', cropSel), field('Plays', loopSel));
    const grid3 = el('div', 'aiimg-grid2'); grid3.append(field('Caption position', capPosSel), field('Caption size', capSizeSel));
    const est = el('p', 'sv-est'); est.setAttribute('aria-live', 'polite');
    const makeB = button('Make the GIF', 'btn-primary', () => exportGif());
    const job = el('div', 'sv-job');
    const prog = el('div', 'aiimg-progress'); prog.hidden = true; prog.setAttribute('role', 'progressbar'); prog.setAttribute('aria-valuemin', '0'); prog.setAttribute('aria-valuemax', '100');
    const bar = el('i'); prog.appendChild(bar);
    const status = el('p', 'aiimg-status sv-status'); status.setAttribute('aria-live', 'polite');
    const cancelB = button('Cancel', 'btn-ghost', () => { if (S.job) S.job.abort(); }); cancelB.hidden = true;
    const jobRow = el('div', 'aiimg-row'); jobRow.append(makeB, cancelB);
    job.append(jobRow, prog, status);
    const another = button('Choose another video', 'btn-ghost', () => file.click());
    side.append(field('Frames per second', fpsR, '5 to 20. Fewer frames make a smaller file.'), grid1, grid2, posField,
      field('Caption', capIn), grid3, ditherC, est, job,
      el('p', 'field-hint', 'A GIF has at most 256 colours and stores every frame whole, so files grow quickly with length and width. This tool stops at ' + MAX_FRAMES + ' frames (30 seconds at 20 fps) and 640 px wide; for anything longer, an MP4 is the better file.'),
      another);
    studio.append(stageCol, side);
    const results = el('div', 'aiimg-results');
    wrap.append(drop, file, msg, studio, results);
    io.appendChild(wrap);

    const say = (t, kind) => { msg.textContent = t || ''; msg.className = 'io-msg' + (kind ? ' is-' + kind : ''); };
    const pctx = canvas.getContext('2d');

    /* ---------- geometry and preview ---------- */
    const geom = () => geometry(S.src.width, S.src.height, S.crop, S.pos, S.width);
    const frameCount = () => Math.max(1, Math.round((S.end - S.start) / S.speed * S.fps));
    let drawQueued = false;
    function drawPreview() {
      drawQueued = false;
      if (!S.src) return;
      const g = geom();
      if (canvas.width !== g.W || canvas.height !== g.H) { canvas.width = g.W; canvas.height = g.H; }
      renderFrame(pctx, g, S.src.video, S);
      canvas.setAttribute('aria-label', 'Preview of the GIF at ' + fmtT(S.src.video.currentTime) + ', ' + g.W + ' by ' + g.H + ' pixels');
    }
    const redraw = () => { if (!drawQueued) { drawQueued = true; requestAnimationFrame(drawPreview); } };

    function syncTrim() {
      const D = S.src ? S.src.duration : 1;
      const a = (S.start / D) * 100, b = (S.end / D) * 100;
      hStart.style.left = a + '%'; hEnd.style.left = b + '%';
      sel.style.left = a + '%'; sel.style.width = Math.max(0, b - a) + '%';
      for (const [h, v, lo, hi] of [[hStart, S.start, 0, S.end], [hEnd, S.end, S.start, D]]) {
        h.setAttribute('aria-valuemax', D.toFixed(1)); h.setAttribute('aria-valuenow', v.toFixed(1));
        h.setAttribute('aria-valuetext', fmtT(v) + ' (from ' + fmtT(lo) + ' to ' + fmtT(hi) + ')');
      }
      if (document.activeElement !== startIn) startIn.value = S.start.toFixed(1);
      if (document.activeElement !== endIn) endIn.value = S.end.toFixed(1);
      startIn.max = D.toFixed(1); endIn.max = D.toFixed(1);
      const n = frameCount();
      const outDur = (S.end - S.start) / S.speed;
      lenOut.textContent = 'Selected ' + (S.end - S.start).toFixed(1) + ' s of ' + D.toFixed(1) + ' s → a ' + outDur.toFixed(1) + ' s GIF of ' + n + ' frame' + (n === 1 ? '' : 's') + '.';
    }
    const MIN_GAP = 0.1;
    function setRange(start, end, which) {
      const D = S.src.duration;
      let s = clamp(Number(start) || 0, 0, D), e = clamp(Number(end) || 0, 0, D);
      if (e - s < MIN_GAP) { if (which === 'start') s = Math.max(0, e - MIN_GAP); else e = Math.min(D, s + MIN_GAP); }
      if (e - s < MIN_GAP) { s = Math.max(0, D - MIN_GAP); e = D; }
      S.start = Math.round(s * 1000) / 1000; S.end = Math.round(e * 1000) / 1000;
      syncTrim();
      stopPlay();
      seek(S.src.video, which === 'end' ? Math.max(0, S.end - 0.001) : S.start).then(redraw);
      scheduleEstimate();
    }

    /* handles: pointer and keyboard */
    for (const [h, which] of [[hStart, 'start'], [hEnd, 'end']]) {
      h.addEventListener('pointerdown', (e) => {
        if (!S.src || S.busy) return;
        e.preventDefault(); h.setPointerCapture(e.pointerId); h.focus();
        const move = (ev) => {
          const r = track.getBoundingClientRect();
          const t = clamp((ev.clientX - r.left) / r.width, 0, 1) * S.src.duration;
          if (which === 'start') setRange(t, S.end, 'start'); else setRange(S.start, t, 'end');
        };
        const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); };
        h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
      });
      h.addEventListener('keydown', (e) => {
        if (!S.src || S.busy) return;
        const step = e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown' ? 1 : 0.1;
        const now = which === 'start' ? S.start : S.end;
        let t = null;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown') t = now - step;
        else if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp') t = now + step;
        else if (e.key === 'Home') t = which === 'start' ? 0 : S.start + MIN_GAP;
        else if (e.key === 'End') t = which === 'start' ? S.end - MIN_GAP : S.src.duration;
        if (t === null) return;
        e.preventDefault();
        if (which === 'start') setRange(t, S.end, 'start'); else setRange(S.start, t, 'end');
      });
    }
    /* a click on the track moves the nearer handle */
    track.addEventListener('pointerdown', (e) => {
      if (!S.src || S.busy) return;
      const r = track.getBoundingClientRect();
      const t = clamp((e.clientX - r.left) / r.width, 0, 1) * S.src.duration;
      if (Math.abs(t - S.start) <= Math.abs(t - S.end)) setRange(t, S.end, 'start'); else setRange(S.start, t, 'end');
    });
    startIn.addEventListener('change', () => { if (S.src) setRange(startIn.value, S.end, 'start'); });
    endIn.addEventListener('change', () => { if (S.src) setRange(S.start, endIn.value, 'end'); });

    /* playing the selection on the preview, at the chosen speed, looping */
    let playing = false, raf = 0;
    function stopPlay() {
      if (!playing) return;
      playing = false; cancelAnimationFrame(raf);
      try { S.src.video.pause(); } catch (e) { /* */ }
      playB.textContent = '▶ Play the selection'; playhead.hidden = true;
    }
    async function togglePlay() {
      if (!S.src || S.busy) return;
      if (playing) { stopPlay(); return; }
      const v = S.src.video;
      await seek(v, S.start);
      v.playbackRate = S.speed;
      playing = true; playB.textContent = '❚❚ Pause'; playhead.hidden = false;
      try { await v.play(); } catch (e) { stopPlay(); return; }
      const tick = () => {
        if (!playing) return;
        if (v.currentTime >= S.end || v.ended) { v.currentTime = S.start; if (v.paused) v.play().catch(() => {}); }
        playhead.style.left = (v.currentTime / S.src.duration * 100) + '%';
        drawPreview();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    /* ---------- settings ---------- */
    const syncPos = () => { posField.hidden = S.crop === 'original'; };
    function changed() {
      S.width = Number(widthSel.value); S.fps = Number(fpsR.input.value); S.speed = Number(speedSel.value);
      S.loops = loopSel.value; S.crop = cropSel.value; S.pos = Number(posR.input.value);
      S.capPos = capPosSel.value; S.capSize = capSizeSel.value; S.dither = ditherC.input.checked;
      S.caption = capIn.value;
      save(S);
      syncPos();
      if (S.src) { syncTrim(); redraw(); scheduleEstimate(); }
    }
    for (const c of [widthSel, speedSel, loopSel, cropSel, capPosSel, capSizeSel]) c.addEventListener('change', changed);
    for (const c of [fpsR.input, posR.input, capIn]) c.addEventListener('input', changed);
    ditherC.input.addEventListener('change', changed);
    syncPos();

    /* ---------- the size estimate ---------- */
    let estTimer = 0, estCtl = null, estRun = Promise.resolve();
    function scheduleEstimate() {
      clearTimeout(estTimer);
      if (estCtl) estCtl.abort();
      const n = frameCount();
      if (n > MAX_FRAMES) {
        est.textContent = n + ' frames is over this tool’s ' + MAX_FRAMES + '-frame limit. Shorten the selection, lower the frame rate or raise the speed.';
        est.className = 'sv-est is-warn'; makeB.disabled = true;
        return;
      }
      makeB.disabled = S.busy;
      est.textContent = 'Estimating the size…'; est.className = 'sv-est';
      estTimer = setTimeout(() => { estRun = estRun.then(runEstimate).catch(() => {}); }, 450);
    }
    /** Four frames of the selection, compressed for real with the palette they make; the rest scaled up from them. */
    async function sampleFrames(g, k, signal, maxSide) {
      const c = el('canvas'); c.width = g.W; c.height = g.H;
      const x = c.getContext('2d', { willReadFrequently: true });
      const s = Math.min(1, (maxSide || 1e9) / Math.max(g.W, g.H));
      const sc = el('canvas'); sc.width = Math.max(1, Math.round(g.W * s)); sc.height = Math.max(1, Math.round(g.H * s));
      const sx = sc.getContext('2d', { willReadFrequently: true });
      const full = [], small = [];
      for (let i = 0; i < k; i++) {
        const t = S.start + (S.end - S.start) * (k === 1 ? 0 : (i + 0.5) / k);
        await seek(S.grab, Math.min(t, S.src.duration - 0.001), signal);
        if (signal && signal.aborted) throw A.abortError();
        renderFrame(x, g, S.grab, S);
        full.push(x.getImageData(0, 0, g.W, g.H).data.buffer);
        sx.drawImage(c, 0, 0, sc.width, sc.height);
        small.push(sx.getImageData(0, 0, sc.width, sc.height).data);
      }
      const joined = new Uint8ClampedArray(small.reduce((a, b) => a + b.length, 0));
      let o = 0; for (const b of small) { joined.set(b, o); o += b.length; }
      return { full, joined };
    }
    async function runEstimate() {
      if (!S.src || S.busy) return;
      const ctl = new AbortController(); estCtl = ctl;
      const g = geom(), n = frameCount();
      try {
        const k = Math.min(4, n);
        const { full, joined } = await sampleFrames(g, k, ctl.signal, 256);
        const { palette } = await enc.call({ type: 'palette', samples: joined.buffer, colours: 256 }, [joined.buffer]);
        if (ctl.signal.aborted) return;
        const { sizes } = await enc.call({ type: 'estimate', width: g.W, height: g.H, palette, dither: S.dither, frames: full }, full);
        if (ctl.signal.aborted) return;
        const per = k > 1 ? (sizes[k - 1] - sizes[0]) / (k - 1) : sizes[0];
        const bytes = Math.round(sizes[0] + per * (n - 1) + 1);
        S.estimate = bytes;
        est.dataset.bytes = String(bytes);
        est.textContent = 'Estimated size: about ' + fmtBytes(bytes) + ' — ' + n + ' frames at ' + g.W + ' × ' + g.H + ' px. Worked out by compressing ' + k + ' frame' + (k === 1 ? '' : 's') + ' of your clip.' +
          (bytes > 10 * 1048576 ? ' That is a big GIF: a smaller width, fewer frames per second or a shorter part will shrink it.' : '');
        est.className = 'sv-est' + (bytes > 10 * 1048576 ? ' is-warn' : '');
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        est.textContent = 'The size could not be estimated (' + ((e && e.message) || e) + ').';
      } finally { if (estCtl === ctl) estCtl = null; }
    }

    /* ---------- loading ---------- */
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    ['dragenter', 'dragover'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    wrap.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) loadFiles(e.dataTransfer.files); });
    file.addEventListener('change', () => { if (file.files.length) loadFiles(file.files); file.value = ''; });

    function release() {
      stopPlay();
      for (const s of [S.src, S.grabSrc]) if (s) { try { s.video.removeAttribute('src'); s.video.load(); } catch (e) { /* */ } s.video.remove(); URL.revokeObjectURL(s.url); }
      S.src = null; S.grab = null; S.grabSrc = null;
    }
    async function loadFiles(list) {
      if (S.busy) return;
      const files = Array.from(list);
      const isVideo = (f) => /^video\//.test(f.type) || VIDEO_RE.test(f.name || '');
      const vids = files.filter(isVideo);
      const notes = files.filter((f) => !isVideo(f)).map((f) => f.name + ': not a video (choose an MP4, MOV or WebM).');
      if (!vids.length) { say(notes.join(' '), 'error'); return; }
      if (vids.length > 1) notes.push('One video at a time: using ' + vids[0].name + '; ' + vids.slice(1).map((f) => f.name).join(', ') + ' not used.');
      const f = vids[0];
      say('Reading ' + f.name + '…');
      let src, grab;
      try {
        src = await openVideo(f);
        grab = await openVideo(f);
      } catch (e) {
        if (src) { src.video.remove(); URL.revokeObjectURL(src.url); }
        say(f.name + ': ' + ((e && e.message) || e) + (notes.length ? ' ' + notes.join(' ') : ''), 'error');
        return;
      }
      release();
      src.video.className = 'sv-hidden-video'; grab.video.className = 'sv-hidden-video';
      stage.append(src.video, grab.video);
      S.src = src; S.grabSrc = grab; S.grab = grab.video;
      S.file = f; S.name = String(f.name || 'clip').replace(/\.[^.]+$/, '') || 'clip';
      drop.hidden = true; studio.hidden = false;
      S.start = 0; S.end = Math.min(src.duration, 5);
      syncTrim();
      await seek(src.video, 0);
      drawPreview();
      say(f.name + ': ' + src.width + ' × ' + src.height + ', ' + src.duration.toFixed(1) + ' s.' + (notes.length ? ' ' + notes.join(' ') : ''), notes.length ? 'warn' : '');
      status.textContent = '';
      scheduleEstimate();
    }

    /* ---------- export ---------- */
    async function exportGif() {
      if (!S.src || S.busy) return;
      const n = frameCount();
      if (n > MAX_FRAMES) { scheduleEstimate(); return; }
      clearTimeout(estTimer);
      if (estCtl) estCtl.abort();
      await estRun;
      stopPlay();
      S.busy = true; S.job = new AbortController();
      const signal = S.job.signal;
      makeB.disabled = true; cancelB.hidden = false; prog.hidden = false; bar.style.width = '0%';
      const g = geom();
      const fps = S.fps;
      const del = delays(n, fps);
      const started = performance.now();
      const inflight = [];
      const setP = (p, label) => { const v = Math.round(clamp(p, 0, 1) * 100); bar.style.width = v + '%'; prog.setAttribute('aria-valuenow', String(v)); if (label) status.textContent = label; };
      try {
        setP(0, 'Choosing the 256 colours…');
        const k = Math.min(8, n);
        const { joined } = await sampleFrames(g, k, signal, 256);
        const { palette } = await enc.call({ type: 'palette', samples: joined.buffer, colours: 256 }, [joined.buffer]);
        await enc.call({ type: 'start', width: g.W, height: g.H, palette, repeat: repeatOf(S.loops), dither: S.dither });
        const c = el('canvas'); c.width = g.W; c.height = g.H;
        const x = c.getContext('2d', { willReadFrequently: true });
        let written = 0;
        for (let i = 0; i < n; i++) {
          if (signal.aborted) throw A.abortError();
          const t = Math.min(S.start + (i / fps) * S.speed, S.src.duration - 0.001);
          await seek(S.grab, t, signal);
          renderFrame(x, g, S.grab, S);
          const buf = x.getImageData(0, 0, g.W, g.H).data.buffer;
          inflight.push(enc.call({ type: 'frame', data: buf, delay: del[i] * 10 }, [buf]).then((r) => { written = r.frames; return r; }));
          while (inflight.length > 3) await inflight.shift();
          const spent = (performance.now() - started) / 1000, f = (i + 1) / n;
          setP(0.02 + 0.95 * f, 'Frame ' + (i + 1) + ' of ' + n + (f > 0.08 && f < 1 ? ', about ' + Math.max(1, Math.round(spent / f - spent)) + ' s left' : '') + '…');
        }
        while (inflight.length) await inflight.shift();
        if (signal.aborted) throw A.abortError();
        const done = await enc.call({ type: 'finish' });
        const blob = new Blob([done.bytes], { type: 'image/gif' });
        const name = S.name + '.' + extOf(blob);
        addResult(blob, name, g, n, fps);
        A.download(blob, name);
        setP(1);
        status.textContent = 'Done in ' + ((performance.now() - started) / 1000).toFixed(1) + ' s: ' + name + ', ' + fmtBytes(blob.size) + ', ' + written + ' frames' + (enc.inWorker ? '' : ' (encoded on the page: this browser could not start a worker)') + '.';
      } catch (e) {
        for (const pr of inflight) pr.catch(() => {});
        enc.stop();
        if (e && e.name === 'AbortError') status.textContent = 'Cancelled. Nothing was saved.';
        else { status.textContent = 'The GIF could not be made.'; say(S.name + ': ' + ((e && e.message) || e), 'error'); }
      } finally {
        S.busy = false; S.job = null;
        makeB.disabled = frameCount() > MAX_FRAMES; cancelB.hidden = true;
        setTimeout(() => { if (!S.busy) prog.hidden = true; }, 500);
      }
    }

    function addResult(blob, name, g, n, fps) {
      const row = el('div', 'aiimg-result');
      const head = el('div', 'aiimg-result-head');
      head.append(el('strong', null, name), el('span', null, fmtBytes(blob.size) + ' · ' + g.W + ' × ' + g.H + ' · ' + n + ' frames · ' + fps + ' fps'),
        button('Download', 'btn-download', () => A.download(blob, name)));
      const img = el('img'); img.alt = 'The GIF made from ' + name.replace(/\.gif$/, ''); img.width = g.W; img.height = g.H;
      img.src = URL.createObjectURL(blob);
      row.append(head, img);
      results.insertBefore(row, results.firstChild);
      while (results.children.length > 4) { const last = results.lastChild; const im = last.querySelector('img'); if (im) URL.revokeObjectURL(im.src); last.remove(); }
    }

    return { state: S, geometry, delays, renderFrame };
  }

  A.tools['video-to-gif'] = { mount, geometry, delays, repeatOf, MAX_FRAMES };
})();
