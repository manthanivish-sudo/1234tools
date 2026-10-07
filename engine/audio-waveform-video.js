/**
 * Waveform Video (/audio/waveform-video/) — an "audiogram".
 *
 * A sound file (and, if you like, a cover picture and a title) in; an MP4
 * out in which the sound plays under a moving waveform: bars or a line
 * that follow the loudness, over the picture (darkened so the bars show)
 * or a plain colour, with a thin bar along the bottom for the time. For
 * sharing a podcast or a song where only video is accepted.
 *
 * The loudness is read once (RMS over 10 ms) and each frame draws the
 * 0.8 s around its moment; frames are encoded on the device to H.264 by
 * AIImg.encodeVideoFrames (WebCodecs + mp4-muxer) with the sound as AAC
 * (or Opus where the browser has no AAC encoder). At most 10 minutes, the
 * part chosen with From and To.
 *
 * Remembered in localStorage '1234tools-waveform-video-v1': size, style,
 * colours, fps. Not the sound, the picture or the title.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit, AK = window.AudioKit;
  if (!A || !VK || !AK) return;
  const { el, field, select, colour, button, fmtBytes, clamp } = A;
  const KEY = '1234tools-waveform-video-v1';
  const MAX_SECONDS = 600;
  const SIZES = { square: [1080, 1080, 'Square 1080 × 1080'], vertical: [1080, 1920, 'Vertical 1080 × 1920 (stories, reels)'], wide: [1920, 1080, 'Landscape 1920 × 1080'], hd: [1280, 720, 'Landscape 1280 × 720 (quicker)'] };
  const STYLES = [['bars', 'Bars'], ['line', 'Line']];
  const HEX = /^#[0-9a-f]{6}$/i;

  /** RMS of the loudest channel per 10 ms, as a Float32Array (0..1). */
  function envelope(planes, rate) {
    const W = Math.max(1, Math.round(rate / 100)), n = Math.ceil(planes[0].length / W);
    const out = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      let best = 0;
      for (const p of planes) { let e = 0; const a = k * W, b = Math.min(p.length, a + W); for (let i = a; i < b; i++) e += p[i] * p[i]; best = Math.max(best, Math.sqrt(e / Math.max(1, b - a))); }
      out[k] = best;
    }
    return out;
  }
  /** One frame at time t (s from the start of the part): background, title, waveform, time bar. */
  function drawFrame(ctx, W, H, t, o) {
    ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W, H);
    if (o.image) {
      const iw = o.image.width, ih = o.image.height, s = Math.max(W / iw, H / ih);
      ctx.drawImage(o.image, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
    }
    const title = String(o.title || '').trim();
    if (title) {
      let px = Math.round(Math.min(W, H) * 0.06);
      ctx.font = '800 ' + px + 'px Sora, "Segoe UI", system-ui, sans-serif';
      while (ctx.measureText(title).width > W * 0.86 && px > 14) { px = Math.round(px * 0.92); ctx.font = '800 ' + px + 'px Sora, "Segoe UI", system-ui, sans-serif'; }
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = px * 0.2;
      ctx.fillText(title, W / 2, H * 0.2);
      ctx.shadowBlur = 0;
    }
    const env = o.env, k0 = Math.round((o.from + t) * 100), span = 80;
    const peak = o.peak || 1;
    const mid = H * 0.58, amp = H * 0.18;
    ctx.fillStyle = o.colour; ctx.strokeStyle = o.colour;
    if (o.style === 'line') {
      ctx.lineWidth = Math.max(2, W / 300); ctx.beginPath();
      for (let i = 0; i <= span; i++) {
        const v = env[clamp(k0 - span / 2 + i, 0, env.length - 1)] / peak;
        const x = W * 0.08 + (W * 0.84) * i / span, y = mid - v * amp * ((i % 2) ? 1 : -1);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    } else {
      const bars = 40, gap = 0.35, bw = (W * 0.84) / bars;
      for (let i = 0; i < bars; i++) {
        let v = 0;
        for (let j = 0; j < 2; j++) v = Math.max(v, env[clamp(k0 - span / 2 + i * 2 + j, 0, env.length - 1)] || 0);
        const h = Math.max(W / 200, (v / peak) * amp);
        ctx.fillRect(W * 0.08 + i * bw + bw * gap / 2, mid - h, bw * (1 - gap), h * 2);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(W * 0.08, H * 0.9, W * 0.84, Math.max(3, H / 200));
    ctx.fillStyle = o.colour; ctx.fillRect(W * 0.08, H * 0.9, W * 0.84 * clamp(t / o.secs, 0, 1), Math.max(3, H / 200));
  }

  function mount(root) {
    const st = VK.store(KEY, { size: 'square', style: 'bars', colour: '#f7c948', bg: '#101627', fps: 30 }, (k, v) => (k === 'size' ? !!SIZES[v] : k === 'style' ? STYLES.some((s) => s[0] === v) : k === 'fps' ? v === 25 || v === 30 : HEX.test(v || '')));
    const S = Object.assign({}, st.values);
    let snd = null, env = null, peak = 1, image = null;
    const ui = VK.shell(root, { id: 'aw', kind: 'audio', label: 'Choose the sound', hint: 'MP3, WAV, M4A, FLAC, Ogg or a video; up to 10 minutes are used. Nothing is uploaded.', accept: 'audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.opus,.weba,.webm,.mp4,.mov', onFiles: (f, n) => load(f[0], n) });
    const canvas = el('canvas', 'aiimg-canvas sv-canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Preview of the video');
    const stage = el('div', 'aiimg-stage'); stage.appendChild(canvas);
    const about = el('p', 'field-hint vk-about');
    ui.stageCol.append(stage, about);
    const sizeSel = select('aw-size', Object.entries(SIZES).map(([k, v]) => [k, v[2]]), S.size);
    const styleSel = select('aw-style', STYLES, S.style);
    const colIn = colour('aw-colour', S.colour), bgIn = colour('aw-bg', S.bg);
    const grid = el('div', 'aiimg-grid2'); grid.append(field('Waveform colour', colIn), field('Background', bgIn));
    const titleIn = el('input', 'control'); titleIn.type = 'text'; titleIn.id = 'aw-title'; titleIn.maxLength = 80; titleIn.placeholder = 'Optional: the episode or song';
    const imgIn = el('input', 'control'); imgIn.type = 'file'; imgIn.id = 'aw-image'; imgIn.accept = 'image/*';
    const fromIn = el('input', 'control'), toIn = el('input', 'control');
    for (const [i, id] of [[fromIn, 'aw-from'], [toIn, 'aw-to']]) { i.type = 'number'; i.id = id; i.min = '0'; i.step = '0.1'; i.inputMode = 'decimal'; }
    const times = el('div', 'sv-times'); times.append(field('From (seconds)', fromIn), field('To (seconds)', toIn));
    const est = el('p', 'sv-est vk-est'); est.setAttribute('aria-live', 'polite');
    const J = VK.job('Make the video', (signal, j) => run(signal, j));
    ui.side.append(field('Size', sizeSel), field('Style', styleSel), grid, field('Title', titleIn), field('Cover picture (optional)', imgIn), times, est, J.el, button('Choose another sound', 'btn-ghost', () => ui.pick()));

    const range_ = () => { const D = snd ? snd.duration : 0; let a = clamp(Number(fromIn.value) || 0, 0, D), b = clamp(toIn.value === '' ? D : Number(toIn.value), 0, D); if (b <= a) b = Math.min(D, a + 1); if (b - a > MAX_SECONDS) b = a + MAX_SECONDS; return [a, b]; };
    const opts = (secs, from) => ({ env, peak, from, secs, style: S.style, colour: S.colour, bg: S.bg, title: titleIn.value, image });
    function preview() {
      if (!snd) return;
      const [W, H] = SIZES[S.size];
      const s = Math.min(1, 540 / Math.max(W, H));
      canvas.width = Math.round(W * s); canvas.height = Math.round(H * s);
      const [a, b] = range_();
      const ctx = canvas.getContext('2d'); ctx.save(); ctx.scale(s, s);
      drawFrame(ctx, W, H, Math.min(b - a, Math.max(0, (b - a) / 3)), opts(b - a, a));
      ctx.restore();
    }
    function sync() {
      S.size = sizeSel.value; S.style = styleSel.value; S.colour = colIn.value; S.bg = bgIn.value; st.save(S);
      if (!snd) return;
      const [a, b] = range_();
      const [W, H] = SIZES[S.size];
      est.textContent = VK.fmtT(b - a, 1) + ' of video at ' + W + ' × ' + H + ', ' + S.fps + ' fps: ' + Math.round((b - a) * S.fps) + ' frames.' + (snd.duration > MAX_SECONDS ? ' The sound is ' + VK.fmtT(snd.duration, 0) + ' long; a video takes at most 10 minutes of it.' : '');
      preview();
    }
    for (const c of [sizeSel, styleSel]) c.addEventListener('change', sync);
    for (const c of [colIn, bgIn, titleIn, fromIn, toIn]) c.addEventListener('input', sync);
    imgIn.addEventListener('change', async () => {
      const f = imgIn.files[0];
      if (!f) { image = null; sync(); return; }
      try { image = (await A.loadImageFile(f)).canvas; } catch (e) { image = null; ui.say(f.name + ': ' + ((e && e.message) || e), 'error'); }
      sync();
    });

    async function load(file, notes) {
      if (J.busy) return;
      ui.say('Reading ' + file.name + '…');
      let next;
      try { next = await AK.decodeFile(file); } catch (e) { ui.say(file.name + ': ' + ((e && e.message) || e), 'error'); return; }
      snd = next;
      env = envelope(AK.planesOf(snd.buffer), snd.rate);
      peak = Math.max(1e-3, env.reduce((m, v) => Math.max(m, v), 0));
      fromIn.value = '0'; toIn.value = Math.min(snd.duration, MAX_SECONDS).toFixed(1);
      fromIn.max = toIn.max = snd.duration.toFixed(1);
      about.textContent = file.name + ': ' + AK.describe(snd) + '.';
      ui.drop.hidden = true; ui.studio.hidden = false;
      ui.say(notes && notes.length ? notes.join(' ') : '', notes && notes.length ? 'warn' : '');
      sync();
    }

    async function run(signal, j) {
      if (!snd) return;
      const [a, b] = range_();
      const [W, H] = SIZES[S.size];
      const fps = S.fps, secs = b - a, total = Math.max(1, Math.round(secs * fps));
      /* the part's sound as an AudioBuffer for the encoder */
      const r = snd.rate, i0 = Math.round(a * r), i1 = Math.round(b * r);
      const ab = new AudioBuffer({ length: Math.max(1, i1 - i0), numberOfChannels: Math.min(2, snd.channels), sampleRate: r });
      for (let c = 0; c < ab.numberOfChannels; c++) ab.copyToChannel(snd.buffer.getChannelData(c).subarray(i0, i1), c);
      const c = el('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      const o = opts(secs, a);
      const frames = (function* () { for (let i = 0; i < total; i++) { drawFrame(ctx, W, H, i / fps, o); yield { canvas: c, timestampUs: Math.round(i * 1e6 / fps), durationUs: Math.round(1e6 / fps), progress: i / total }; } })();
      const out = await A.encodeVideoFrames(frames, { fps, width: W, height: H, total, audio: { buffer: ab, bitrate: 128000 }, signal, onProgress: (x) => j.progress(x, 'Drawing and encoding') });
      const name = snd.name + '-waveform.' + VK.extOf(out.blob);
      VK.result(ui.results, out.blob, name, W + ' × ' + H + ' · ' + VK.fmtT(secs, 1), { note: out.note + '.' });
      j.status.textContent = 'Done: ' + name + ', ' + fmtBytes(out.blob.size) + ', ' + out.frames + ' frames.';
      VK.lastAudiogram = { frames: out.frames, width: out.width, height: out.height, seconds: secs, audio: out.audio };
    }
    return { state: S };
  }

  A.tools['waveform-video'] = { mount, envelope, drawFrame };
})();
