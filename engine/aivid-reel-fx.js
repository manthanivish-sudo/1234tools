/**
 * Reel Maker effects — transitions, colour grades, beat detection, stickers
 * and export destinations (window.AIVidReelFX).
 *
 * The Reel Maker (aivid-reel-maker.js) draws every frame with one function;
 * this file holds the pieces that function borrows, kept apart so each can be
 * tested on its own (build/ai-video/tests/reel-fx.js loads this file in Node
 * with a stub window and checks the maths against independent references).
 *
 *   TRANSITIONS, transitionDuration(kind), compose(ctx, W, H, kind, p, A, B)
 *     A and B are the outgoing and incoming frames, already drawn whole
 *     (background and scene) on canvases; p runs 0 → 1 over the transition.
 *   GRADES, gradePixels(data, id) — a per-pixel colour transform on RGBA
 *     bytes, the same in every browser (no ctx.filter, which Safari lacks).
 *   detectBeats(samples, sampleRate) — onsets by spectral flux with an
 *     adaptive threshold, a tempo from the autocorrelation of the onset
 *     envelope, and a beat grid fitted to it. Pure, so it runs here in a Web
 *     Worker: this same file, loaded with new Worker(), answers postMessage.
 *   snapToBeats(seconds[], beats[], o) — scene lengths whose cuts land on beats.
 *   STICKERS, drawSticker(ctx, st, W, H, alpha, emojiImage) — shapes, arrows
 *     and badges drawn with paths; emoji come from the vendored Noto Emoji
 *     subset (engine/vendor/noto-emoji/, Apache-2.0), fetched on first use.
 *   DESTINATIONS — size, frame rates, bitrates and safe areas per platform,
 *     each with the page its figures come from.
 *
 * Nothing here contacts anything but this site, and only when asked.
 */
(function (G) {
  'use strict';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const easeInOut = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const ease3 = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

  /* ------------------------------------------------------------------ */
  /* transitions                                                        */
  /* ------------------------------------------------------------------ */
  /* 'auto' is resolved by the Reel Maker: the template's own choice for the
     scene, else the look's crossfade (the behaviour before this file). */
  const TRANSITIONS = [
    ['auto', 'Auto (by template)'], ['cut', 'Cut'], ['fade', 'Crossfade'],
    ['slide-left', 'Slide left'], ['slide-right', 'Slide right'], ['slide-up', 'Slide up'], ['slide-down', 'Slide down'],
    ['zoom-in', 'Zoom in'], ['zoom-out', 'Zoom out'], ['whip', 'Whip pan'], ['dip-black', 'Dip to black'], ['dip-white', 'Dip to white']
  ];
  const TRANS_IDS = TRANSITIONS.map((t) => t[0]);
  function transitionDuration(kind) {
    if (kind === 'cut') return 0;
    if (kind === 'whip') return 0.32;
    if (/^slide-/.test(kind)) return 0.4;
    if (/^zoom-/.test(kind)) return 0.45;
    if (/^dip-/.test(kind)) return 0.6;
    return 0.35;
  }
  function drawScaled(ctx, img, W, H, s, alpha) {
    if (alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const w = W * s, h = H * s;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    ctx.restore();
  }
  /**
   * The frame between two scenes. ctx is the frame (logical W×H, any
   * transform); A and B are canvases holding the whole outgoing and incoming
   * frames. p is the linear progress 0 → 1.
   */
  function compose(ctx, W, H, kind, p, A, B) {
    p = clamp(p, 0, 1);
    const e = easeInOut(p);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    switch (kind) {
      case 'slide-left': case 'slide-right': case 'slide-up': case 'slide-down': {
        const dx = kind === 'slide-left' ? -1 : kind === 'slide-right' ? 1 : 0;
        const dy = kind === 'slide-up' ? -1 : kind === 'slide-down' ? 1 : 0;
        ctx.drawImage(A, dx * W * e, dy * H * e, W, H);
        ctx.drawImage(B, -dx * W * (1 - e), -dy * H * (1 - e), W, H);
        break;
      }
      case 'zoom-in':
        drawScaled(ctx, B, W, H, 1.25 - 0.25 * e, 1);
        drawScaled(ctx, A, W, H, 1 + 0.6 * e, 1 - e);
        break;
      case 'zoom-out':
        drawScaled(ctx, B, W, H, 1.15 - 0.15 * e, 1);
        drawScaled(ctx, A, W, H, 1 - 0.4 * e, 1 - e);
        break;
      case 'whip': {
        /* a fast pan: both frames move left together, smeared along the move
           by averaging N copies spread over the distance moved in one frame
           (a box blur along x, strongest mid-move, none at the ends) */
        const N = 16;
        const smear = W * 0.14 * Math.sin(Math.PI * p);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < N; k++) {
          const off = (k / (N - 1) - 0.5) * smear;
          ctx.globalAlpha = 1 / N;
          ctx.drawImage(A, -W * e + off, 0, W, H);
          ctx.drawImage(B, W * (1 - e) + off, 0, W, H);
        }
        break;
      }
      case 'dip-black': case 'dip-white': {
        const col = kind === 'dip-black' ? '#000000' : '#ffffff';
        if (p < 0.5) { ctx.drawImage(A, 0, 0, W, H); ctx.globalAlpha = ease3(p * 2); }
        else { ctx.drawImage(B, 0, 0, W, H); ctx.globalAlpha = ease3((1 - p) * 2); }
        ctx.fillStyle = col; ctx.fillRect(0, 0, W, H);
        break;
      }
      case 'cut':
        ctx.drawImage(B, 0, 0, W, H);
        break;
      default: /* 'fade' */
        ctx.drawImage(A, 0, 0, W, H);
        ctx.globalAlpha = e;
        ctx.drawImage(B, 0, 0, W, H);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* colour grades                                                      */
  /* ------------------------------------------------------------------ */
  /* Each grade: channel gain and offset (white balance), saturation about
     Rec. 709 luma, a split tone (a tint weighted to the shadows and one to
     the highlights), a contrast S-curve about mid-grey, and a black and
     white point (a lifted black is the "faded" look). Values in 0..1. */
  const GRADES = [
    ['none', 'None'],
    ['warm', 'Warm'], ['cool', 'Cool'], ['vintage', 'Vintage'], ['bw', 'Black and white'],
    ['contrast', 'High contrast'], ['faded', 'Faded'], ['tealorange', 'Teal and orange'], ['vivid', 'Vivid']
  ];
  const GRADE_SPEC = {
    none: null,
    warm: { gain: [1.07, 1.01, 0.9], add: [0.02, 0.005, -0.01], sat: 1.06 },
    cool: { gain: [0.9, 0.99, 1.07], add: [-0.01, 0.005, 0.025], sat: 1.0 },
    vintage: { gain: [1.04, 1.0, 0.88], add: [0.03, 0.02, 0], sat: 0.72, contrast: 0.92, black: 0.07, white: 0.93 },
    bw: { sat: 0, contrast: 1.12 },
    contrast: { sat: 1.1, contrast: 1.45 },
    faded: { sat: 0.82, contrast: 0.88, black: 0.13, white: 0.94 },
    tealorange: { sat: 1.12, contrast: 1.1, shadow: [-0.07, 0.03, 0.08], high: [0.09, 0.03, -0.08] },
    vivid: { sat: 1.42, contrast: 1.08 }
  };
  const GRADE_IDS = GRADES.map((g) => g[0]);
  /**
   * The contrast curve about mid-grey. k > 1: a tanh S-curve normalised so
   * 0 → 0 and 1 → 1 (shadows darker, highlights brighter, ends kept);
   * k < 1: a straight line of slope k through 0.5 (flatter, greys meet).
   */
  function sCurve(x, k) {
    if (k === 1) return x;
    const d = x - 0.5;
    if (k < 1) return 0.5 + d * k;
    const a = 2 * (k - 1) + 0.5;
    return 0.5 + Math.tanh(d * 2 * a) / (2 * Math.tanh(a));
  }
  const lutCache = {};
  function curveLut(spec) {
    const key = JSON.stringify([spec.contrast || 1, spec.black || 0, spec.white || 1]);
    if (lutCache[key]) return lutCache[key];
    const lut = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      let x = i / 1023;
      x = clamp(sCurve(x, spec.contrast || 1), 0, 1);
      x = (spec.black || 0) + x * ((spec.white === undefined ? 1 : spec.white) - (spec.black || 0));
      lut[i] = x;
    }
    return (lutCache[key] = lut);
  }
  /** Grade RGBA bytes in place. Returns the array. */
  function gradePixels(data, id) {
    const spec = GRADE_SPEC[id];
    if (!spec) return data;
    const gain = spec.gain || [1, 1, 1], add = spec.add || [0, 0, 0];
    const sat = spec.sat === undefined ? 1 : spec.sat;
    const sh = spec.shadow, hi = spec.high;
    const lut = curveLut(spec);
    const inv = 1 / 255;
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i] * inv * gain[0] + add[0], g = data[i + 1] * inv * gain[1] + add[1], b = data[i + 2] * inv * gain[2] + add[2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (sat !== 1) { r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat; }
      if (sh) {
        const L = clamp(l, 0, 1), ws = (1 - L) * (1 - L), wh = L * L;
        r += sh[0] * ws + hi[0] * wh; g += sh[1] * ws + hi[1] * wh; b += sh[2] * ws + hi[2] * wh;
      }
      data[i] = Math.round(lut[clamp(Math.round(r * 1023), 0, 1023)] * 255);
      data[i + 1] = Math.round(lut[clamp(Math.round(g * 1023), 0, 1023)] * 255);
      data[i + 2] = Math.round(lut[clamp(Math.round(b * 1023), 0, 1023)] * 255);
    }
    return data;
  }

  /* ------------------------------------------------------------------ */
  /* beat detection                                                     */
  /* ------------------------------------------------------------------ */
  /** In-place radix-2 FFT of (re, im), length a power of two. */
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2;
          const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }
  /**
   * Onsets, tempo and beats of a mono signal.
   *   samples: Float32Array (mono), sampleRate: Hz.
   * Returns { onsets: [s], beats: [s], bpm, hop (s), flux: Float32Array }.
   * Method: the signal is decimated to about 11 kHz, cut into 46 ms frames
   * every 11.6 ms (Hann window, 512-point FFT at 11,025 Hz); the spectral
   * flux is the sum over bins of the rise in log magnitude from one frame to
   * the next; a frame is an onset when its flux is the largest within ±35 ms
   * and above an adaptive threshold (the local mean over ±0.25 s, times 1.3,
   * plus a small fraction of the median), no closer than 100 ms to the last.
   * The tempo is the lag (60–180 BPM) where the onset envelope's
   * autocorrelation, weighted by a log-normal prior centred on 120 BPM, peaks;
   * the beat grid is the phase at that period that collects the most
   * envelope, and each beat then moves to the strongest envelope frame within
   * ±35 ms of the grid.
   */
  function detectBeats(samples, sampleRate, opts) {
    opts = opts || {};
    const minBpm = opts.minBpm || 60, maxBpm = opts.maxBpm || 180;
    const factor = Math.max(1, Math.round(sampleRate / 11025));
    const sr = sampleRate / factor;
    const n = Math.floor(samples.length / factor);
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s = 0; const o = i * factor; for (let k = 0; k < factor; k++) s += samples[o + k]; x[i] = s / factor; }
    const N = 512, hopN = Math.max(1, Math.round(sr * 0.0116));
    const frames = Math.max(0, Math.floor((n - N) / hopN) + 1);
    const hop = hopN / sr;
    /* a frame's time is its centre, plus how far the flux runs ahead of a sharp
       attack: the rise shows as soon as the attack enters the window. The
       7 ms was measured on synthetic click tracks (build/ai-video/tests/reel-fx.js) */
    const lead = N / sr / 2 + 0.007;
    const win = new Float32Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    const bins = N / 2;
    let prev = new Float32Array(bins), cur = new Float32Array(bins);
    const flux = new Float32Array(frames);
    const re = new Float32Array(N), im = new Float32Array(N);
    for (let f = 0; f < frames; f++) {
      const o = f * hopN;
      for (let i = 0; i < N; i++) { re[i] = x[o + i] * win[i]; im[i] = 0; }
      fft(re, im);
      let s = 0;
      for (let k = 1; k < bins; k++) {
        const m = Math.log1p(100 * Math.sqrt(re[k] * re[k] + im[k] * im[k]));
        cur[k] = m;
        const d = m - prev[k];
        if (d > 0 && f > 0) s += d;
      }
      flux[f] = s;
      const t = prev; prev = cur; cur = t;
    }
    if (frames < 8) return { onsets: [], beats: [], bpm: 0, hop, flux };
    /* adaptive threshold and peak picking */
    const sorted = Array.from(flux).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 0;
    const Wm = Math.max(2, Math.round(0.25 / hop)), Wp = Math.max(1, Math.round(0.035 / hop)), gap = Math.max(1, Math.round(0.1 / hop));
    const pre = new Float64Array(frames + 1);
    for (let i = 0; i < frames; i++) pre[i + 1] = pre[i] + flux[i];
    const onsets = [];
    let last = -1e9;
    const env = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      const a = Math.max(0, i - Wm), b = Math.min(frames, i + Wm + 1);
      const mean = (pre[b] - pre[a]) / (b - a);
      env[i] = Math.max(0, flux[i] - mean);
      const thr = mean * 1.3 + median * 0.1;
      if (flux[i] <= thr) continue;
      let peak = true;
      for (let k = Math.max(0, i - Wp); k <= Math.min(frames - 1, i + Wp); k++) if (flux[k] > flux[i]) { peak = false; break; }
      if (!peak || i - last < gap) continue;
      onsets.push(i * hop + lead);
      last = i;
    }
    /* tempo: autocorrelation of the envelope */
    const lagMin = Math.max(1, Math.floor(60 / maxBpm / hop)), lagMax = Math.min(frames - 1, Math.ceil(60 / minBpm / hop));
    const ac = new Float64Array(lagMax + 2);
    let best = -1, bestLag = 0;
    for (let L = lagMin; L <= lagMax + 1; L++) {
      let s = 0;
      for (let i = L; i < frames; i++) s += env[i] * env[i - L];
      ac[L] = s / (frames - L);
    }
    for (let L = lagMin; L <= lagMax; L++) {
      const bpm = 60 / (L * hop);
      const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 1.0, 2));
      const v = ac[L] * prior;
      if (v > best) { best = v; bestLag = L; }
    }
    if (!bestLag || best <= 0) return { onsets, beats: [], bpm: 0, hop, flux };
    /* an impulse train correlates as well at twice its period as at its
       period: when half the chosen lag is nearly as strong, the faster tempo
       is the real one (150 BPM is not 75) */
    for (const h of [Math.floor(bestLag / 2), Math.ceil(bestLag / 2)]) {
      if (h >= lagMin && ac[h] >= 0.7 * ac[bestLag] && 60 / (h * hop) <= maxBpm) { bestLag = h; break; }
    }
    /* parabolic interpolation of the peak for a period finer than one hop */
    let lag = bestLag;
    if (bestLag > lagMin && bestLag < lagMax) {
      const y0 = ac[bestLag - 1], y1 = ac[bestLag], y2 = ac[bestLag + 1];
      const den = y0 - 2 * y1 + y2;
      if (den < 0) lag = bestLag + clamp(0.5 * (y0 - y2) / den, -0.5, 0.5);
    }
    /* phase: the offset whose grid collects the most envelope */
    let bestPhase = 0, bestSum = -1;
    const steps = Math.max(1, Math.round(lag));
    for (let ph = 0; ph < steps; ph++) {
      let s = 0;
      for (let t = ph; t < frames; t += lag) {
        const i = Math.round(t);
        let m = 0;
        for (let k = Math.max(0, i - 1); k <= Math.min(frames - 1, i + 1); k++) if (env[k] > m) m = env[k];
        s += m;
      }
      if (s > bestSum) { bestSum = s; bestPhase = ph; }
    }
    let beats = [];
    const strength = [];
    for (let t = bestPhase; t < frames; t += lag) {
      const i = Math.round(t);
      let bi = i, bm = -1;
      for (let k = Math.max(0, i - Wp); k <= Math.min(frames - 1, i + Wp); k++) if (env[k] > bm) { bm = env[k]; bi = k; }
      beats.push(bi * hop + lead); strength.push(bm);
    }
    /* the grid runs to both ends of the audio; before the music starts and after it stops there is nothing there to call a beat */
    const med = strength.slice().sort((a, b) => a - b)[Math.floor(strength.length / 2)] || 0;
    let a0 = 0, a1 = beats.length;
    while (a0 < a1 && strength[a0] < 0.1 * med) a0++;
    while (a1 > a0 && strength[a1 - 1] < 0.1 * med) a1--;
    beats = beats.slice(a0, a1);
    /* the tempo from a straight line through the beats, finer than the lag */
    let bpm = 60 / (lag * hop);
    if (beats.length >= 4) {
      const m = beats.length; let sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (let i = 0; i < m; i++) { sx += i; sy += beats[i]; sxx += i * i; sxy += i * beats[i]; }
      const slope = (m * sxy - sx * sy) / (m * sxx - sx * sx);
      if (slope > 0) bpm = 60 / slope;
    }
    return { onsets, beats, bpm, hop, flux };
  }
  /**
   * Scene lengths whose cuts land on beats. seconds: the current lengths;
   * beats: beat times on the reel's clock. Each cut moves to the beat nearest
   * to where it is, keeping every scene between o.min and o.max seconds; a
   * cut with no beat in reach stays put. The last scene ends on a beat too
   * when one is in reach. Returns the new lengths (rounded to 0.01 s).
   */
  function snapToBeats(seconds, beats, o) {
    o = o || {};
    const min = o.min || 1, max = o.max || 15;
    const out = [];
    let start = 0, orig = 0;
    for (let i = 0; i < seconds.length; i++) {
      orig += seconds[i];
      const lo = start + min, hi = start + max;
      let best = null;
      for (const b of beats) if (b >= lo - 1e-9 && b <= hi + 1e-9 && (best === null || Math.abs(b - orig) < Math.abs(best - orig))) best = b;
      const end = best === null ? clamp(orig, lo, hi) : best;
      out.push(Math.round((end - start) * 100) / 100);
      start = start + out[i];
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* stickers                                                           */
  /* ------------------------------------------------------------------ */
  /* kind 'shape' | 'arrow' | 'badge' | 'emoji'. Shapes and arrows are
     outlines or fills in one colour; badges are a pill with a word. */
  const STICKERS = {
    shape: [['circle', 'Circle'], ['ring', 'Ring'], ['box', 'Box outline'], ['star', 'Star'], ['heart', 'Heart'], ['burst', 'Burst'], ['check', 'Tick'], ['cross', 'Cross']],
    arrow: [['right', 'Arrow right'], ['left', 'Arrow left'], ['up', 'Arrow up'], ['down', 'Arrow down'], ['curve', 'Curved arrow'], ['chunky', 'Chunky arrow']],
    badge: [['NEW', 'NEW'], ['SALE', 'SALE'], ['FREE', 'FREE'], ['LIVE', 'LIVE'], ['TIP', 'TIP'], ['HOT', 'HOT'], ['custom', 'Your word']]
  };
  function starPath(ctx, cx, cy, r, points, inner) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / points, rr = i % 2 ? r * inner : r;
      const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
  function arrowPath(ctx, s) {
    /* pointing right, centred on 0,0, within ±s/2 */
    const h = s / 2;
    ctx.beginPath();
    ctx.moveTo(-h, -h * 0.18); ctx.lineTo(h * 0.25, -h * 0.18); ctx.lineTo(h * 0.25, -h * 0.5); ctx.lineTo(h, 0);
    ctx.lineTo(h * 0.25, h * 0.5); ctx.lineTo(h * 0.25, h * 0.18); ctx.lineTo(-h, h * 0.18); ctx.closePath();
  }
  /** Where a sticker sits, in pixels: centre, size (the side of its square), rotation. */
  function stickerBox(st, W, H) {
    const U = Math.min(W, H);
    return { cx: (Number(st.x) || 0.5) * W, cy: (Number(st.y) || 0.5) * H, s: clamp(Number(st.size) || 0.2, 0.03, 1) * U, rot: (Number(st.rot) || 0) * Math.PI / 180 };
  }
  /** Draw one sticker. emoji: a ready image (canvas or img) for st.key when kind is 'emoji'. */
  function drawSticker(ctx, st, W, H, alpha, emoji) {
    const b = stickerBox(st, W, H);
    const s = b.s, col = st.color || '#f7c948';
    ctx.save();
    ctx.globalAlpha *= clamp(alpha === undefined ? 1 : alpha, 0, 1);
    ctx.translate(b.cx, b.cy);
    if (b.rot) ctx.rotate(b.rot);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const lw = Math.max(2, s * 0.07);
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = s * 0.06; ctx.shadowOffsetY = s * 0.02;
    if (st.kind === 'emoji') {
      if (emoji) ctx.drawImage(emoji, -s / 2, -s / 2, s, s);
    } else if (st.kind === 'arrow') {
      ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = Math.max(1.5, s * 0.02);
      const dir = { right: 0, down: 90, left: 180, up: 270 }[st.key];
      if (dir !== undefined) { ctx.rotate(dir * Math.PI / 180); arrowPath(ctx, s); ctx.fill(); ctx.stroke(); }
      else if (st.key === 'chunky') { ctx.scale(1, 1.6); arrowPath(ctx, s); ctx.fill(); ctx.stroke(); }
      else {
        /* a curved arrow: an arc and a head */
        ctx.strokeStyle = col; ctx.lineWidth = lw * 1.3;
        ctx.beginPath(); ctx.arc(0, s * 0.25, s * 0.42, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        const ax = Math.cos(Math.PI * 1.85) * s * 0.42, ay = s * 0.25 + Math.sin(Math.PI * 1.85) * s * 0.42;
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(ax + s * 0.16, ay + s * 0.02); ctx.lineTo(ax - s * 0.06, ay - s * 0.14); ctx.lineTo(ax - s * 0.04, ay + s * 0.16); ctx.closePath(); ctx.fill();
      }
    } else if (st.kind === 'badge') {
      const word = String(st.key === 'custom' ? (st.text || 'WOW') : st.key).toUpperCase().slice(0, 14);
      let px = s * 0.34;
      ctx.font = '800 ' + px + 'px "Sora", "Inter", Arial, sans-serif';
      let tw = ctx.measureText(word).width;
      const maxW = s * 1.6;
      if (tw > maxW) { px *= maxW / tw; ctx.font = '800 ' + px + 'px "Sora", "Inter", Arial, sans-serif'; tw = ctx.measureText(word).width; }
      const w = tw + px * 1.1, h = px * 1.6;
      ctx.fillStyle = col;
      ctx.beginPath(); const r = h / 2; ctx.moveTo(-w / 2 + r, -h / 2); ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, r); ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, r); ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r); ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r); ctx.closePath(); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = inkOn(col); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(word, 0, px * 0.04);
    } else {
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = lw;
      const h = s / 2;
      switch (st.key) {
        case 'ring': ctx.beginPath(); ctx.arc(0, 0, h - lw / 2, 0, Math.PI * 2); ctx.stroke(); break;
        case 'box': ctx.strokeRect(-h + lw / 2, -h * 0.66 + lw / 2, s - lw, s * 0.66 - lw); break;
        case 'star': starPath(ctx, 0, 0, h, 5, 0.45); ctx.fill(); break;
        case 'burst': starPath(ctx, 0, 0, h, 12, 0.72); ctx.fill(); break;
        case 'heart':
          ctx.beginPath(); ctx.moveTo(0, h * 0.85);
          ctx.bezierCurveTo(-h * 1.1, h * 0.05, -h * 0.75, -h * 0.95, 0, -h * 0.35);
          ctx.bezierCurveTo(h * 0.75, -h * 0.95, h * 1.1, h * 0.05, 0, h * 0.85); ctx.closePath(); ctx.fill(); break;
        case 'check': ctx.lineWidth = lw * 1.6; ctx.beginPath(); ctx.moveTo(-h * 0.7, 0); ctx.lineTo(-h * 0.15, h * 0.55); ctx.lineTo(h * 0.75, -h * 0.55); ctx.stroke(); break;
        case 'cross': ctx.lineWidth = lw * 1.6; ctx.beginPath(); ctx.moveTo(-h * 0.6, -h * 0.6); ctx.lineTo(h * 0.6, h * 0.6); ctx.moveTo(h * 0.6, -h * 0.6); ctx.lineTo(-h * 0.6, h * 0.6); ctx.stroke(); break;
        default: ctx.beginPath(); ctx.arc(0, 0, h, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    return b;
  }
  /** Black or white, whichever reads better on a hex colour (WCAG relative luminance). */
  function inkOn(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!m) return '#000000';
    const lum = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    const L = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
    return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#000000' : '#ffffff';
  }

  /* ---- the Noto Emoji subset: fetched on first use, each emoji rasterised once ---- */
  const EMOJI_URL = '/engine/vendor/noto-emoji/noto-subset.json';
  let emojiSetP = null;
  const emojiImgs = new Map();
  function loadEmojiSet() {
    if (!emojiSetP) emojiSetP = fetch(EMOJI_URL).then((r) => { if (!r.ok) throw new Error('the emoji set could not be loaded (' + r.status + ')'); return r.json(); })
      .catch((e) => { emojiSetP = null; throw e; });
    return emojiSetP;
  }
  /** A canvas of the emoji at 256 px, or null while it is being drawn (onReady is called when it is). */
  function emojiImage(set, key, onReady) {
    if (emojiImgs.has(key)) { const e = emojiImgs.get(key); return e.ready ? e.canvas : null; }
    const ic = set && set.icons && set.icons[key];
    if (!ic || typeof document === 'undefined') return null;
    const entry = { ready: false, canvas: null };
    emojiImgs.set(key, entry);
    const w = ic.width || set.width || 128, h = ic.height || set.height || 128;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="256" height="256">' + ic.body + '</svg>';
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 256;
      c.getContext('2d').drawImage(img, 0, 0, 256, 256);
      entry.canvas = c; entry.ready = true;
      if (onReady) onReady();
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* export destinations                                                */
  /* ------------------------------------------------------------------ */
  /* safe: fractions of the frame the app's own buttons and text cover.
     Meta's ad guides for Reels and Stories ask for "at least 14% of the top,
     35% of the bottom and 6% on each side" to be left free; TikTok and
     YouTube publish no single figure for organic posts (TikTok's varies with
     the caption's length), so those two use Meta's margins and are marked
     approximate. Bitrates: YouTube recommends 8 Mbps for 1080p at 24–30 fps
     and 12 Mbps at 48–60 fps; X asks for at least 5,000 kbps and recommends
     1280×720 at 30 or 60 fps; LinkedIn's video specification gives 1:1 up to
     1920×1920 and a frame rate under 30. Checked 6 October 2026. */
  const META_SAFE = { top: 0.14, bottom: 0.35, side: 0.06 };
  const DESTINATIONS = [
    { id: 'custom', label: 'Custom — choose the size and quality yourself' },
    { id: 'reels', label: 'Instagram Reels', size: '1080x1920', rates: { 30: 8e6, 60: 12e6 }, fps: [30, 60], safe: META_SAFE,
      source: 'facebook.com/business/ads-guide/update/video/instagram-reels' },
    { id: 'tiktok', label: 'TikTok', size: '1080x1920', rates: { 30: 8e6, 60: 12e6 }, fps: [30, 60], safe: META_SAFE, approx: true,
      source: 'ads.tiktok.com/help/article/tiktok-auction-in-feed-ads (safe zone varies with the caption); Meta’s margins used' },
    { id: 'shorts', label: 'YouTube Shorts', size: '1080x1920', rates: { 30: 8e6, 60: 12e6 }, fps: [30, 60], safe: META_SAFE, approx: true,
      source: 'support.google.com/youtube/answer/1722171 (bitrates); no published safe zone, Meta’s margins used' },
    { id: 'stories', label: 'Instagram Stories', size: '1080x1920', rates: { 30: 8e6, 60: 12e6 }, fps: [30, 60], safe: META_SAFE,
      source: 'facebook.com/business/ads-guide/update/video/instagram-story' },
    { id: 'linkedin', label: 'LinkedIn', size: '1080x1080', rates: { 30: 8e6 }, fps: [30], safe: null,
      source: 'linkedin.com/help/linkedin/answer/85306' },
    { id: 'x', label: 'X', size: '1280x720', rates: { 30: 6e6, 60: 9e6 }, fps: [30, 60], safe: null,
      source: 'docs.x.com/x-api/media/quickstart/best-practices' }
  ];

  const FX = {
    TRANSITIONS, TRANS_IDS, transitionDuration, compose,
    GRADES, GRADE_IDS, GRADE_SPEC, gradePixels,
    fft, detectBeats, snapToBeats,
    STICKERS, drawSticker, stickerBox, inkOn, loadEmojiSet, emojiImage, EMOJI_URL,
    DESTINATIONS
  };

  /* beats off the main thread: this same file, started as a worker */
  let worker = null, wseq = 0;
  const waiting = new Map();
  /** detectBeats in a Web Worker (falls back to the main thread where workers are missing). signal: AbortSignal. */
  FX.detectBeatsAsync = function (samples, sampleRate, signal) {
    if (typeof Worker === 'undefined' || typeof document === 'undefined') return Promise.resolve(detectBeats(samples, sampleRate));
    if (!worker) {
      try {
        worker = new Worker('/engine/aivid-reel-fx.js');
        worker.onmessage = (e) => { const w = waiting.get(e.data.id); if (!w) return; waiting.delete(e.data.id); if (e.data.error) w.reject(new Error(e.data.error)); else w.resolve(e.data.result); };
        worker.onerror = (e) => { for (const w of waiting.values()) w.reject(new Error((e && e.message) || 'the beat worker failed')); waiting.clear(); worker = null; };
      } catch (e) { return Promise.resolve(detectBeats(samples, sampleRate)); }
    }
    const id = ++wseq;
    return new Promise((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      if (signal) signal.addEventListener('abort', () => { if (waiting.delete(id)) { const e = new Error('Cancelled.'); e.name = 'AbortError'; reject(e); } }, { once: true });
      const copy = new Float32Array(samples);
      worker.postMessage({ id, samples: copy, sampleRate }, [copy.buffer]);
    });
  };

  const isWorker = typeof document === 'undefined' && typeof importScripts === 'function' && typeof self !== 'undefined';
  if (isWorker) {
    self.onmessage = (e) => {
      const d = e.data || {};
      try {
        const r = detectBeats(d.samples, d.sampleRate);
        self.postMessage({ id: d.id, result: { onsets: r.onsets, beats: r.beats, bpm: r.bpm, hop: r.hop } });
      } catch (err) { self.postMessage({ id: d.id, error: (err && err.message) || String(err) }); }
    };
  }
  G.AIVidReelFX = FX;
  if (typeof module !== 'undefined' && module.exports) module.exports = FX;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
