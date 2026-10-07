/**
 * Sound processing for the Audio Tools (window.AudioDSP; also a CommonJS
 * module for the tests, and loaded by engine/audio-worker.js so the long
 * jobs run off the page's main thread). Pure functions over Float32Array
 * channels ("planes"); nothing here touches the page.
 *
 *   loudness(planes, rate)       ITU-R BS.1770-4 / EBU R128 integrated
 *                                loudness (LUFS), sample peak and true peak
 *                                (dBFS / dBTP), loudness range is not given.
 *   gain(planes, dB)             in place.
 *   stretch(planes, rate, speed) WSOLA time-stretch: speed 2 halves the
 *                                length, the pitch stays.
 *   silences(planes, rate, o)    stretches quieter than o.threshold dBFS for
 *                                at least o.min seconds.
 *   cutRanges(planes, rate, keep, fade) the kept ranges joined with short
 *                                fades at each join (no clicks).
 *   peaks(planes, n)             min and max per column, for a waveform.
 *   fade(planes, rate, inS, outS) linear fades in place.
 *   sniffRate(bytes)             the sample rate written in a WAV, FLAC,
 *                                MP3 or Ogg (Opus or Vorbis) header.
 *
 * Written from the specifications: BS.1770-4 (K-weighting, 400 ms blocks
 * with 75% overlap, the −70 LUFS absolute and −10 LU relative gates),
 * Annex 2 (true peak by 4× oversampling), the K-filter's analogue fit for
 * rates other than 48 kHz (the constants libebur128 publishes); WSOLA after
 * Verhelst and Roelands (1993).
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* loudness                                                           */
  /* ------------------------------------------------------------------ */
  /* BS.1770's two stages for any sample rate: a high shelf (+4 dB above about 1.7 kHz, the head)
     and a high-pass (about 38 Hz), from the analogue prototypes fitted to the standard's 48 kHz
     coefficients (the constants libebur128 publishes), by the bilinear transform with pre-warping.
     At 48 kHz they give the standard's own coefficients. Each is [b0, b1, b2, a1, a2] with a0 = 1. */
  function kFilters(rate) {
    let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
    let K = Math.tan(Math.PI * f0 / rate);
    const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
    let a0 = 1 + K / Q + K * K;
    const shelf = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
    f0 = 38.13547087602444; Q = 0.5003270373238773;
    K = Math.tan(Math.PI * f0 / rate);
    a0 = 1 + K / Q + K * K;
    const hp = [1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
    return [shelf, hp];
  }
  function filter(x, k) {
    const y = new Float32Array(x.length);
    const [b0, b1, b2, a1, a2] = k;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = x[i];
      const o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o;
    }
    return y;
  }
  /** Weights per channel: 1 for the front channels, 1.41 for the fourth and fifth of five or more (the surrounds). */
  const chanWeight = (c, n) => (n >= 5 && (c === 3 || c === 4) ? 1.41 : 1);
  /**
   * { integrated (LUFS, −Infinity for silence), peak (dBFS), truePeak (dBTP), blocks, gated }
   */
  function loudness(planes, rate) {
    const n = planes[0].length, C = planes.length;
    const [hs, hp] = kFilters(rate);
    /* the K-weighted energy of each channel summed per 100 ms step; a 400 ms block is four steps
       (75% overlap), so an hour of sound needs 36,000 numbers, not a copy of the sound */
    const step = Math.max(1, Math.round(0.1 * rate));
    const nSteps = Math.floor(n / step);
    const stepSum = new Float64Array(Math.max(1, nSteps));
    let tailSum = 0;
    planes.forEach((p, c) => {
      const w = chanWeight(c, C);
      const y = filter(filter(p, hs), hp);
      for (let k = 0; k < nSteps; k++) { let e = 0; const o = k * step; for (let i = 0; i < step; i++) e += y[o + i] * y[o + i]; stepSum[k] += w * e; }
      if (!nSteps) { let e = 0; for (let i = 0; i < n; i++) e += y[i] * y[i]; tailSum += w * e; }
    });
    const sums = [];
    for (let k = 0; k + 4 <= nSteps; k++) sums.push((stepSum[k] + stepSum[k + 1] + stepSum[k + 2] + stepSum[k + 3]) / (4 * step));
    if (!sums.length && n) sums.push((nSteps ? stepSum.reduce((x, y) => x + y, 0) : tailSum) / n);
    const L = (z) => -0.691 + 10 * Math.log10(z);
    const abs = sums.filter((z) => z > 0 && L(z) > -70);
    let integrated = -Infinity, gated = 0;
    if (abs.length) {
      const rel = L(abs.reduce((x, y) => x + y, 0) / abs.length) - 10;
      const pass = abs.filter((z) => L(z) > rel);
      gated = pass.length;
      if (pass.length) integrated = L(pass.reduce((x, y) => x + y, 0) / pass.length);
    }
    let peak = 0;
    for (const p of planes) for (let i = 0; i < p.length; i++) { const v = Math.abs(p[i]); if (v > peak) peak = v; }
    const tp = truePeak(planes, rate, peak);
    return { integrated, peak: 20 * Math.log10(peak || 1e-12), truePeak: 20 * Math.log10(tp || 1e-12), blocks: sums.length, gated };
  }
  /* True peak (BS.1770-4 Annex 2): oversample 4× (2× above 96 kHz) with a windowed-sinc interpolator and take the largest magnitude. */
  let tpTable = null;
  function truePeak(planes, rate, samplePeak) {
    const os = rate >= 96000 ? 2 : 4, taps = 12;
    if (!tpTable || tpTable.os !== os) {
      const t = [];
      for (let ph = 1; ph < os; ph++) {
        const f = ph / os, row = new Float32Array(2 * taps);
        let s = 0;
        for (let j = -taps + 1; j <= taps; j++) {
          const x = j - f, sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
          const w = 0.5 + 0.5 * Math.cos(Math.PI * x / taps);
          row[j + taps - 1] = sinc * w; s += sinc * w;
        }
        for (let k = 0; k < row.length; k++) row[k] /= s;
        t.push(row);
      }
      tpTable = { os, t };
    }
    let peak = samplePeak || 0;
    if (!samplePeak) for (const p of planes) for (let i = 0; i < p.length; i++) { const v = Math.abs(p[i]); if (v > peak) peak = v; }
    /* a peak between samples sits next to large samples: only those neighbourhoods are oversampled */
    const near = peak * 0.5;
    for (const p of planes) {
      const n = p.length;
      for (let i = 0; i < n; i++) {
        if (Math.abs(p[i]) < near && (i + 1 >= n || Math.abs(p[i + 1]) < near)) continue;
        for (const row of tpTable.t) {
          let acc = 0;
          for (let j = -taps + 1; j <= taps; j++) { const k = i + j; if (k >= 0 && k < n) acc += p[k] * row[j + taps - 1]; }
          const b = Math.abs(acc); if (b > peak) peak = b;
        }
      }
    }
    return peak;
  }
  function gain(planes, dB) {
    const g = Math.pow(10, dB / 20);
    for (const p of planes) for (let i = 0; i < p.length; i++) p[i] *= g;
    return planes;
  }

  /* ------------------------------------------------------------------ */
  /* WSOLA                                                              */
  /* ------------------------------------------------------------------ */
  /**
   * Waveform-similarity overlap-add: frames of ~42 ms with a Hann window
   * are laid down every half frame in the output; each is taken from the
   * input near where the speed says it should be (± about 12 ms), at the
   * offset whose start best continues the previous frame. The search runs
   * on a 4× decimated mono mix and is refined to the sample; the same
   * offset is used for every channel so stereo stays in step.
   * Returns new planes of about length / speed samples.
   */
  function stretch(planes, rate, speed, onProgress) {
    if (!(speed > 0)) throw new Error('speed must be above zero');
    const n = planes[0].length, C = planes.length;
    if (Math.abs(speed - 1) < 1e-6) return planes.map((p) => p.slice());
    const N = 2 * Math.round(0.021 * rate);            /* frame, even */
    const Ha = N / 2;                                   /* output hop */
    const Hs = Ha * speed;                              /* input hop */
    const D = Math.round(0.012 * rate);                 /* search ± */
    const outLen = Math.max(1, Math.round(n / speed));
    const out = planes.map(() => new Float32Array(outLen + N));
    const norm = new Float32Array(outLen + N);
    const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
    const mono = new Float32Array(n);
    for (const p of planes) for (let i = 0; i < n; i++) mono[i] += p[i] / C;
    const DEC = 4;
    const dm = new Float32Array(Math.ceil(n / DEC));
    for (let i = 0; i < dm.length; i++) { let s = 0, k = 0; for (let j = i * DEC; j < Math.min(n, i * DEC + DEC); j++) { s += mono[j]; k++; } dm[i] = s / (k || 1); }
    let prevStart = 0;   /* where the previous frame was taken from */
    const frames = Math.ceil(outLen / Ha) + 1;
    for (let f = 0; f < frames; f++) {
      const outAt = f * Ha;
      if (outAt >= outLen) break;
      const ideal = Math.round(f * Hs);
      let best = ideal;
      if (f > 0) {
        /* the natural continuation of the previous frame starts at prevStart + Ha */
        const tgt = prevStart + Ha;
        const lo = Math.max(0, ideal - D), hi = Math.min(n - N, ideal + D);
        if (hi > lo && tgt + N <= n) {
          const M = Math.floor(N / DEC), t0 = Math.floor(tgt / DEC);
          let bestC = -Infinity, bestK = Math.round(ideal / DEC);
          for (let k = Math.floor(lo / DEC); k <= Math.floor(hi / DEC); k++) {
            let c = 0, e = 1e-9;
            for (let j = 0; j < M && k + j < dm.length && t0 + j < dm.length; j++) { c += dm[k + j] * dm[t0 + j]; e += dm[k + j] * dm[k + j]; }
            const score = c / Math.sqrt(e);
            if (score > bestC) { bestC = score; bestK = k; }
          }
          /* refine to the sample around the coarse best */
          let bestR = -Infinity, r0 = bestK * DEC;
          for (let k = Math.max(lo, r0 - DEC); k <= Math.min(hi, r0 + DEC); k++) {
            let c = 0, e = 1e-9;
            for (let j = 0; j < N; j += 2) { c += mono[k + j] * mono[tgt + j]; e += mono[k + j] * mono[k + j]; }
            const score = c / Math.sqrt(e);
            if (score > bestR) { bestR = score; best = k; }
          }
        }
      }
      best = Math.max(0, Math.min(n - 1, best));
      for (let c = 0; c < C; c++) {
        const src = planes[c], dst = out[c];
        for (let j = 0; j < N && best + j < n; j++) dst[outAt + j] += src[best + j] * win[j];
      }
      for (let j = 0; j < N; j++) norm[outAt + j] += win[j];
      prevStart = best;
      if (onProgress && (f & 255) === 0) onProgress(outAt / outLen);
    }
    return out.map((p) => { const r = new Float32Array(outLen); for (let i = 0; i < outLen; i++) r[i] = norm[i] > 1e-3 ? p[i] / norm[i] : p[i]; return r; });
  }

  /* ------------------------------------------------------------------ */
  /* silence                                                            */
  /* ------------------------------------------------------------------ */
  /** Quiet stretches: [{ start, end }] in seconds, where the loudest channel's RMS over 10 ms windows stays under o.threshold dBFS for at least o.min seconds. */
  function silences(planes, rate, o) {
    const thr = Math.pow(10, (o.threshold === undefined ? -40 : o.threshold) / 20);
    const minDur = o.min === undefined ? 0.5 : o.min;
    const W = Math.max(1, Math.round(rate * 0.01));
    const n = planes[0].length;
    const out = [];
    let runStart = -1;
    for (let s = 0; s < n; s += W) {
      let loud = 0;
      for (const p of planes) { let e = 0; const end = Math.min(n, s + W); for (let i = s; i < end; i++) e += p[i] * p[i]; loud = Math.max(loud, Math.sqrt(e / (end - s))); }
      const quiet = loud < thr;
      if (quiet && runStart < 0) runStart = s;
      if ((!quiet || s + W >= n) && runStart >= 0) {
        const end = quiet ? n : s;
        if ((end - runStart) / rate >= minDur) out.push({ start: runStart / rate, end: end / rate });
        runStart = -1;
      }
    }
    return out;
  }
  /** Keep ranges [[a, b] seconds] joined with fades of `fade` seconds at each join. */
  function cutRanges(planes, rate, keep, fade) {
    const F = Math.max(0, Math.round((fade || 0) * rate));
    const parts = keep.map(([a, b]) => [Math.max(0, Math.round(a * rate)), Math.min(planes[0].length, Math.round(b * rate))]).filter(([a, b]) => b > a);
    const total = parts.reduce((s, [a, b]) => s + (b - a), 0);
    const out = planes.map(() => new Float32Array(total));
    let o = 0;
    parts.forEach(([a, b], idx) => {
      const len = b - a;
      for (let c = 0; c < planes.length; c++) {
        const src = planes[c], dst = out[c];
        for (let i = 0; i < len; i++) {
          let g = 1;
          if (F && idx > 0 && i < F) g = i / F;
          if (F && idx < parts.length - 1 && len - i <= F) g = Math.min(g, (len - i) / F);
          dst[o + i] = src[a + i] * g;
        }
      }
      o += len;
    });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* drawing and small edits                                            */
  /* ------------------------------------------------------------------ */
  /** n columns of [min, max] over all channels: Float32Array(2n). */
  function peaks(planes, n, from, to) {
    const len = planes[0].length;
    const a = Math.max(0, Math.floor(from || 0)), b = Math.min(len, Math.ceil(to === undefined ? len : to));
    const out = new Float32Array(2 * n);
    const span = (b - a) / n;
    for (let k = 0; k < n; k++) {
      const s = a + Math.floor(k * span), e = Math.max(s + 1, Math.min(b, a + Math.floor((k + 1) * span)));
      let lo = 0, hi = 0;
      for (const p of planes) for (let i = s; i < e; i += Math.max(1, Math.floor((e - s) / 512))) { const v = p[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
      out[2 * k] = lo; out[2 * k + 1] = hi;
    }
    return out;
  }
  function fade(planes, rate, inS, outS) {
    const n = planes[0].length;
    const fi = Math.min(n, Math.round((inS || 0) * rate)), fo = Math.min(n, Math.round((outS || 0) * rate));
    for (const p of planes) {
      for (let i = 0; i < fi; i++) p[i] *= i / fi;
      for (let i = 0; i < fo; i++) p[n - 1 - i] *= i / fo;
    }
    return planes;
  }

  /* ------------------------------------------------------------------ */
  /* the sample rate a file says it has                                 */
  /* ------------------------------------------------------------------ */
  /** From the first bytes of a WAV, FLAC, MP3 or Ogg file: { format, rate, channels } or null. */
  function sniffRate(u) {
    if (!u || u.length < 12) return null;
    const s4 = (p) => String.fromCharCode(u[p], u[p + 1], u[p + 2], u[p + 3]);
    const le32 = (p) => (u[p] | (u[p + 1] << 8) | (u[p + 2] << 16) | (u[p + 3] << 24)) >>> 0;
    const le16 = (p) => u[p] | (u[p + 1] << 8);
    if (s4(0) === 'RIFF' && s4(8) === 'WAVE') {
      let p = 12;
      while (p + 8 <= u.length) {
        const id = s4(p), sz = le32(p + 4);
        if (id === 'fmt ') return { format: 'wav', channels: le16(p + 10), rate: le32(p + 12), bits: le16(p + 22) };
        p += 8 + sz + (sz & 1);
      }
      return { format: 'wav' };
    }
    if (s4(0) === 'fLaC') {
      /* STREAMINFO: the first metadata block; the rate is 20 bits at byte 18 of the file */
      const rate = (u[18] << 12) | (u[19] << 4) | (u[20] >> 4);
      const channels = ((u[20] >> 1) & 7) + 1;
      return { format: 'flac', rate, channels };
    }
    if (s4(0) === 'OggS') {
      const segs = u[26];
      const body = 27 + segs;
      if (String.fromCharCode.apply(null, Array.from(u.subarray(body, body + 8))) === 'OpusHead') return { format: 'opus', rate: 48000, channels: u[body + 9] };
      if (u[body] === 1 && String.fromCharCode.apply(null, Array.from(u.subarray(body + 1, body + 7))) === 'vorbis') return { format: 'vorbis', channels: u[body + 11], rate: le32(body + 12) };
      return { format: 'ogg' };
    }
    /* MP3: skip an ID3v2 tag (its size is four 7-bit bytes), then find a frame header */
    let p = 0;
    if (u[0] === 0x49 && u[1] === 0x44 && u[2] === 0x33) p = 10 + ((u[6] & 127) << 21 | (u[7] & 127) << 14 | (u[8] & 127) << 7 | (u[9] & 127));
    for (let i = p; i + 4 <= Math.min(u.length, p + 8192); i++) {
      if (u[i] !== 0xFF || (u[i + 1] & 0xE0) !== 0xE0) continue;
      const ver = (u[i + 1] >> 3) & 3, layer = (u[i + 1] >> 1) & 3, sri = (u[i + 2] >> 2) & 3;
      if (ver === 1 || layer === 0 || sri === 3) continue;
      const base = [44100, 48000, 32000][sri];
      const rate = ver === 3 ? base : ver === 2 ? base / 2 : base / 4;
      return { format: 'mp3', rate, channels: ((u[i + 3] >> 6) & 3) === 3 ? 1 : 2 };
    }
    return null;
  }

  const api = { kFilters, loudness, truePeak, gain, stretch, silences, cutRanges, peaks, fade, sniffRate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AudioDSP = api;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : null));
