/**
 * Colour Pop & Duotone.
 *
 * The picture is split into layers on the device. The ticked layers keep
 * their colour (or get a treatment of their own) and everything else is
 * turned to greyscale, sepia, a tint, a faded look or a two-colour
 * duotone. Inside the kept layers the colour can be narrowed to one band
 * of hue — the red of the car but not its chrome. One function draws the
 * frame for the preview, the still and every frame of the reveal clip, so
 * what is exported is what was seen.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A) return;
  const { el, clamp, lerp, field, select, range, colour, check, button, sleep, fmtBytes } = A;

  const PREVIEW_MAX = 1280;
  const MODES = [['colour', 'Full colour'], ['grey', 'Black and white'], ['sepia', 'Sepia'], ['faded', 'Faded film'],
    ['tint', 'One-colour tint'], ['duotone', 'Duotone (two colours)']];
  const ANIMS = [['wipe', 'Colour sweeps in, holds, sweeps out'], ['fade', 'Colour fades in and out'], ['pulse', 'Colour pulses'], ['none', 'None — a still']];
  const PRESETS = [
    ['red', 'Red pop'], ['bluesky', 'Blue sky pop'], ['tealorange', 'Teal–orange duotone'],
    ['noir', 'Noir subject'], ['sepia', 'Sepia world'], ['neon', 'Neon duotone']
  ];
  const HUE_FEATHER = 14;   /* degrees over which a hue band fades out */

  const pct = (v) => Math.round(v) + '%';
  const on = (ctrl, fn) => { const t = ctrl.input || ctrl; t.addEventListener('input', fn); t.addEventListener('change', fn); return ctrl; };
  const hexRgb = (hex) => { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || ''); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [255, 255, 255]; };
  const rgbHex = (r, g, b) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');

  /* ---------------- the treatments, per pixel, in place ---------------- */
  /** `d` is RGBA bytes; `mode` one of MODES; `P` that zone's settings. */
  function treat(d, mode, P) {
    const n = d.length;
    if (mode === 'colour') {
      const boost = clamp(Number(P.boost) || 0, 0, 1);
      if (boost <= 0) return;
      const k = 1 + boost;
      for (let j = 0; j < n; j += 4) {
        const r = d[j], g = d[j + 1], b = d[j + 2];
        const y = 0.299 * r + 0.587 * g + 0.114 * b;
        d[j] = clamp(y + (r - y) * k, 0, 255); d[j + 1] = clamp(y + (g - y) * k, 0, 255); d[j + 2] = clamp(y + (b - y) * k, 0, 255);
      }
      return;
    }
    if (mode === 'grey') {
      for (let j = 0; j < n; j += 4) { const y = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2]; d[j] = d[j + 1] = d[j + 2] = y; }
      return;
    }
    if (mode === 'sepia') {
      for (let j = 0; j < n; j += 4) {
        const r = d[j], g = d[j + 1], b = d[j + 2];
        d[j] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
        d[j + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
        d[j + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
      }
      return;
    }
    if (mode === 'faded') {
      for (let j = 0; j < n; j += 4) {
        const r = d[j], g = d[j + 1], b = d[j + 2];
        const y = 0.299 * r + 0.587 * g + 0.114 * b;
        d[j] = (y + (r - y) * 0.35) * 0.78 + 42; d[j + 1] = (y + (g - y) * 0.35) * 0.78 + 42; d[j + 2] = (y + (b - y) * 0.35) * 0.78 + 46;
      }
      return;
    }
    /* tint and duotone depend on luminance only: one table per channel */
    const lutR = new Uint8ClampedArray(256), lutG = new Uint8ClampedArray(256), lutB = new Uint8ClampedArray(256);
    if (mode === 'tint') {
      const t = hexRgb(P.tint || '#6fa8ff');
      const mx = Math.max(1, t[0], t[1], t[2]);
      const k = clamp(Number(P.tintStrength) || 0, 0, 1);
      for (let y = 0; y < 256; y++) {
        lutR[y] = lerp(y, y * t[0] / mx, k); lutG[y] = lerp(y, y * t[1] / mx, k); lutB[y] = lerp(y, y * t[2] / mx, k);
      }
    } else {
      const dk = hexRgb(P.duoDark || '#000000'), lt = hexRgb(P.duoLight || '#ffffff');
      const mid = clamp(Number(P.duoMid) || 0.5, 0.1, 0.9);
      for (let y = 0; y < 256; y++) {
        const v = y / 255;
        const c = v < mid ? 0.5 * v / mid : 0.5 + 0.5 * (v - mid) / (1 - mid);
        lutR[y] = dk[0] + (lt[0] - dk[0]) * c; lutG[y] = dk[1] + (lt[1] - dk[1]) * c; lutB[y] = dk[2] + (lt[2] - dk[2]) * c;
      }
    }
    for (let j = 0; j < n; j += 4) {
      const y = Math.round(0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2]);
      d[j] = lutR[y]; d[j + 1] = lutG[y]; d[j + 2] = lutB[y];
    }
  }

  /** Hue (degrees) and saturation (0–1) of one pixel. */
  function hueSat(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const s = mx ? d / mx : 0;
    let h = 0;
    if (d > 0) {
      if (mx === r) h = 60 * (((g - b) / d) % 6);
      else if (mx === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
      if (h < 0) h += 360;
    }
    return [h, s];
  }
  /** How much a pixel belongs to the chosen band of hue, 0–1, with soft edges. */
  function hueWeight(r, g, b, H) {
    const [h, s] = hueSat(r, g, b);
    let dh = Math.abs(h - H.centre); if (dh > 180) dh = 360 - dh;
    const wh = dh <= H.width ? 1 : dh >= H.width + HUE_FEATHER ? 0 : 1 - (dh - H.width) / HUE_FEATHER;
    if (!wh) return 0;
    const lo = H.satFloor - 0.08, hi = H.satFloor + 0.08;
    const ws = s <= lo ? 0 : s >= hi ? 1 : (s - lo) / (hi - lo);
    return wh * ws;
  }

  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const S = {
      image: null, seg: null, guide: null, keep: new Set(), alpha: null, tint: null,
      softness: 3, shift: 0, detail: 'standard',
      subjectMode: 'colour', worldMode: 'grey',
      subject: { boost: 0, tint: '#ffb070', tintStrength: 0.6, duoDark: '#001433', duoLight: '#2dd4ff', duoMid: 0.5 },
      world: { boost: 0, tint: '#6fa8ff', tintStrength: 0.6, duoDark: '#0b3d4d', duoLight: '#ffb06b', duoMid: 0.5 },
      hue: { on: false, centre: 0, width: 30, satFloor: 0.25 },
      swatches: [],
      anim: 'wipe', duration: 5, t: 3, playing: false, t0: 0,
      levels: {}, wipeCanvas: null, showLayers: false, exporting: false, job: null
    };

    /* ---------------- skeleton ---------------- */
    const wrap = el('div', 'aiimg aiimg-pop');
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose a photo</strong><span>or drag it here — nothing is uploaded. JPEG, PNG, WebP or HEIC.</span>';
    const file = el('input', 'visually-hidden');
    file.type = 'file'; file.accept = 'image/*'; file.setAttribute('aria-label', 'Choose a photo');

    const studio = el('div', 'aiimg-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage');
    const canvas = el('canvas', 'aiimg-canvas');
    canvas.setAttribute('aria-label', 'Preview of the colour pop effect.');
    const stageMsg = el('div', 'aiimg-stagemsg'); stageMsg.hidden = true;
    stage.append(canvas, stageMsg);
    const transport = el('div', 'aiimg-transport');
    const play = button('▶ Play', 'btn-ghost');
    const scrub = el('input', 'range');
    scrub.type = 'range'; scrub.min = 0; scrub.max = 1000; scrub.step = 1; scrub.value = 0;
    scrub.setAttribute('aria-label', 'Position in the clip');
    const clock = el('span', 'range-val', '3.0 s');
    scrub.value = 600;
    const change = button('Change photo', 'btn-ghost', () => file.click());
    transport.append(play, scrub, clock, change);
    stageCol.append(stage, transport);

    const side = el('div', 'aiimg-side');
    const tabs = el('div', 'aiimg-tabs'); tabs.setAttribute('role', 'tablist');
    const panes = {};
    for (const [k, label] of [['layers', 'Layers'], ['colour', 'Colour'], ['motion', 'Motion'], ['export', 'Export']]) {
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

    /* ---------------- the frame ---------------- */
    const pctx = canvas.getContext('2d');
    let dirty = true;
    const invalidate = () => { dirty = true; };
    const relevel = () => { S.levels = {}; dirty = true; };
    function sizePreview() {
      const img = S.image; if (!img) return;
      const s = Math.min(1, PREVIEW_MAX / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * s));
      canvas.height = Math.max(1, Math.round(img.height * s));
    }

    /**
     * The two pictures a frame is made of, at one size: the world (every
     * pixel treated as "everything else") and the pop (the kept layers,
     * treated their own way, with the layer mask and the hue band in its
     * alpha). Cached per size, rebuilt when a setting changes.
     */
    function buildLevel(w, h) {
      const src = A.scaled(S.image.canvas, w, h);
      const base = src.getContext('2d').getImageData(0, 0, w, h);
      const world = new ImageData(new Uint8ClampedArray(base.data), w, h);
      treat(world.data, S.worldMode, S.world);
      const wc = el('canvas'); wc.width = w; wc.height = h;
      wc.getContext('2d').putImageData(world, 0, 0);
      let pc = null;
      if (S.alpha && S.keep.size) {
        const pop = new ImageData(new Uint8ClampedArray(base.data), w, h);
        treat(pop.data, S.subjectMode, S.subject);
        const mc = el('canvas'); mc.width = w; mc.height = h;
        const mx = mc.getContext('2d');
        mx.imageSmoothingEnabled = true; mx.imageSmoothingQuality = 'high';
        mx.drawImage(A.maskCanvas(S.alpha, S.seg.mw, S.seg.mh), 0, 0, w, h);
        const m = mx.getImageData(0, 0, w, h).data;
        const d = pop.data, b = base.data, H = S.hue;
        if (H.on) {
          for (let j = 0; j < d.length; j += 4) {
            const a = m[j + 3];
            d[j + 3] = a ? a * hueWeight(b[j], b[j + 1], b[j + 2], H) : 0;
          }
        } else {
          for (let j = 3; j < d.length; j += 4) d[j] = m[j];
        }
        pc = el('canvas'); pc.width = w; pc.height = h;
        pc.getContext('2d').putImageData(pop, 0, 0);
      }
      return { w, h, world: wc, pop: pc };
    }
    function levelFor(w, h) {
      const key = w + 'x' + h;
      if (S.levels[key]) return S.levels[key];
      const keys = Object.keys(S.levels);
      const previewKey = canvas.width + 'x' + canvas.height;
      if (keys.length >= 2) delete S.levels[keys.find((k) => k !== previewKey) || keys[0]];
      return (S.levels[key] = buildLevel(w, h));
    }

    /** How much of the colour shows at time t, and where the wipe edge is. */
    function reveal(t) {
      const D = S.duration, p = D > 0 ? (((t % D) + D) % D) / D : 1;
      const ease = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
      switch (S.anim) {
        case 'wipe':
          if (p < 0.4) return { kind: 'wipe', edge: ease(p / 0.4), out: false };
          if (p < 0.8) return { kind: 'full', alpha: 1 };
          return { kind: 'wipe', edge: ease((p - 0.8) / 0.2), out: true };
        case 'fade':
          if (p < 0.3) return { kind: 'full', alpha: ease(p / 0.3) };
          if (p < 0.85) return { kind: 'full', alpha: 1 };
          return { kind: 'full', alpha: 1 - ease((p - 0.85) / 0.15) };
        case 'pulse': return { kind: 'full', alpha: 0.55 - 0.45 * Math.cos(2 * Math.PI * p) };
        default: return { kind: 'full', alpha: 1 };
      }
    }
    /** The frame: the treated world, then the kept colour on top. */
    function renderFrame(ctx, W, H, t) {
      ctx.save();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      const L = levelFor(W, H);
      ctx.drawImage(L.world, 0, 0, W, H);
      if (L.pop) {
        const r = reveal(t);
        if (r.kind === 'full') {
          if (r.alpha > 0) { ctx.globalAlpha = clamp(r.alpha, 0, 1); ctx.drawImage(L.pop, 0, 0, W, H); }
        } else {
          /* a soft vertical edge sweeping across: the pop is drawn on a
             scratch canvas and cut by a gradient */
          let wc = S.wipeCanvas;
          if (!wc || wc.width !== W || wc.height !== H) { wc = S.wipeCanvas = el('canvas'); wc.width = W; wc.height = H; }
          const x = wc.getContext('2d');
          x.globalCompositeOperation = 'source-over';
          x.clearRect(0, 0, W, H);
          x.drawImage(L.pop, 0, 0, W, H);
          const feather = W * 0.18;
          const e = -feather + r.edge * (W + 2 * feather);
          const g = x.createLinearGradient(e - feather, 0, e + feather, 0);
          if (r.out) { g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); }
          else { g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); }
          x.globalCompositeOperation = 'destination-in';
          x.fillStyle = g; x.fillRect(0, 0, W, H);
          ctx.drawImage(wc, 0, 0, W, H);
        }
      }
      ctx.restore();
    }
    function tintCanvas() {
      if (S.tint) return S.tint;
      const { mw, mh, classMap, layers } = S.seg;
      const rgb = {};
      for (const L of layers) rgb[L.key] = L.rgb;
      const id = new ImageData(mw, mh), d = id.data;
      for (let i = 0, j = 0; i < classMap.length; i++, j += 4) { const c = rgb[classMap[i]] || [255, 255, 255]; d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 120; }
      const c = el('canvas'); c.width = mw; c.height = mh;
      c.getContext('2d').putImageData(id, 0, 0);
      return (S.tint = c);
    }
    function draw() {
      if (!S.image) return;
      renderFrame(pctx, canvas.width, canvas.height, S.t);
      if (S.showLayers && S.seg) { pctx.save(); pctx.imageSmoothingEnabled = false; pctx.drawImage(tintCanvas(), 0, 0, canvas.width, canvas.height); pctx.restore(); }
      dirty = false;
    }
    let mounted = true;
    function loop(now) {
      if (!mounted) return;
      if (S.playing && !S.exporting) {
        S.t = ((now - S.t0) / 1000) % S.duration;
        scrub.value = Math.round(S.t / S.duration * 1000);
        clock.textContent = S.t.toFixed(1) + ' s';
        dirty = true;
      }
      if (dirty) draw();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    function setPlaying(v) {
      S.playing = v;
      if (v) S.t0 = performance.now() - S.t * 1000;
      play.textContent = v ? '❚❚ Pause' : '▶ Play';
      play.setAttribute('aria-pressed', v ? 'true' : 'false');
    }
    play.addEventListener('click', () => setPlaying(!S.playing));
    scrub.addEventListener('input', () => { setPlaying(false); S.t = Number(scrub.value) / 1000 * S.duration; clock.textContent = S.t.toFixed(1) + ' s'; invalidate(); });

    /* ---------------- the mask of the kept layers ---------------- */
    let maskTimer = 0, maskToken = 0;
    function scheduleMask() { clearTimeout(maskTimer); maskTimer = setTimeout(rebuildMask, 120); }
    async function rebuildMask() {
      if (!S.seg || !S.image) return;
      const token = ++maskToken;
      const { mw, mh, classMap } = S.seg;
      const inKeep = new Uint8Array(256);
      for (const k of S.keep) inKeep[k] = 1;
      const bin = new Float32Array(mw * mh);
      let any = false;
      for (let i = 0; i < bin.length; i++) if (inKeep[classMap[i]]) { bin[i] = 1; any = true; }
      if (!any) S.alpha = null;
      else {
        note('Refining the edge…');
        setStatus('refining the edge…');
        await sleep(0);
        if (token !== maskToken) return;
        if (!S.guide) S.guide = A.guideOf(S.image, mw, mh);
        S.alpha = A.refine(bin, S.guide, { softness: S.softness, shift: S.shift });
        if (token !== maskToken) return;
        note('');
      }
      computeSwatches();
      relevel();
      setStatus('ready');
    }
    function setStatus(tail) {
      if (!S.seg) return;
      const n = S.seg.layers.length;
      const kept = S.seg.layers.filter((l) => S.keep.has(l.key)).map((l) => l.name);
      status.textContent = n + ' layer' + (n === 1 ? '' : 's') + ' found' + (kept.length ? '. In colour: ' + kept.slice(0, 4).join(', ') + (kept.length > 4 ? '…' : '') : '. Nothing kept in colour yet') + ' — ' + tail;
    }

    /** The six main hues inside the kept layers, as swatches to click. */
    function computeSwatches() {
      S.swatches = [];
      if (!S.alpha || !S.image) { renderSwatches(); return; }
      const { mw, mh } = S.seg;
      const sw = Math.min(mw, 320), sh = Math.max(1, Math.round(mh * sw / mw));
      const px = A.scaled(S.image.canvas, sw, sh).getContext('2d').getImageData(0, 0, sw, sh).data;
      const BINS = 36;
      const wgt = new Float64Array(BINS), rs = new Float64Array(BINS), gs = new Float64Array(BINS), bs = new Float64Array(BINS), cnt = new Float64Array(BINS);
      for (let y = 0; y < sh; y++) {
        const my = Math.min(mh - 1, Math.floor((y + 0.5) / sh * mh));
        for (let x = 0; x < sw; x++) {
          const mx = Math.min(mw - 1, Math.floor((x + 0.5) / sw * mw));
          if (S.alpha[my * mw + mx] < 0.5) continue;
          const j = (y * sw + x) * 4, r = px[j], g = px[j + 1], b = px[j + 2];
          const [h, s] = hueSat(r, g, b);
          const yv = 0.299 * r + 0.587 * g + 0.114 * b;
          if (s < 0.18 || yv < 18 || yv > 245) continue;
          const bin = Math.min(BINS - 1, Math.floor(h / 360 * BINS));
          const w = s;
          wgt[bin] += w; rs[bin] += r * w; gs[bin] += g * w; bs[bin] += b * w; cnt[bin]++;
        }
      }
      const total = wgt.reduce((a, b) => a + b, 0);
      const taken = new Uint8Array(BINS);
      for (let k = 0; k < 6; k++) {
        let best = -1, bv = 0;
        for (let i = 0; i < BINS; i++) if (!taken[i] && wgt[i] > bv) { bv = wgt[i]; best = i; }
        if (best < 0 || bv < total * 0.015) break;
        taken[best] = 1; taken[(best + 1) % BINS] = 1; taken[(best + BINS - 1) % BINS] = 1;
        S.swatches.push({ hue: (best + 0.5) * 360 / BINS, share: bv / total, colour: rgbHex(rs[best] / bv, gs[best] / bv, bs[best] / bv) });
      }
      renderSwatches();
    }

    /* ---------------- layers pane ---------------- */
    const status = el('p', 'aiimg-status', 'Choose a photo to begin.');
    const progress = el('div', 'aiimg-progress'); const bar = el('i'); progress.appendChild(bar); progress.hidden = true;
    const layerList = el('div', 'aiimg-layers');
    const layersHint = el('p', 'field-hint', 'Ticked layers keep their colour; everything else gets the "everything else" treatment from the Colour pane.');
    const soft = on(range('aiimg-soft', 0, 10, 1, S.softness), () => { S.softness = Number(soft.input.value); scheduleMask(); });
    const shiftCtl = on(range('aiimg-shift', -5, 5, 1, S.shift, (v) => (v > 0 ? '+' : '') + v), () => { S.shift = Number(shiftCtl.input.value); scheduleMask(); });
    const detailSel = on(select('aiimg-detail', Object.entries(A.DETAIL).map(([k, m]) => [k, m.label]), S.detail), () => { if (detailSel.value !== S.detail) { S.detail = detailSel.value; runSegmentation(); } });
    const showTint = on(check('aiimg-tint', 'Colour the layers on the preview', false), () => { S.showLayers = showTint.input.checked; invalidate(); });
    panes.layers.append(status, progress, layerList, layersHint,
      field('Edge softness', soft, 'Higher follows hair and fur more loosely; lower keeps a crisp cut.'),
      field('Grow or shrink the cut', shiftCtl, 'Grow it if grey is creeping into the subject at its edge; shrink it if a halo of colour clings to the subject.'),
      field('Detail', detailSel, 'Standard is right for most photos. High and Maximum look at the picture at a higher resolution, which is sharper on small parts and thin edges and takes longer.'),
      showTint);

    function renderLayers() {
      layerList.innerHTML = '';
      if (!S.seg) return;
      for (const L of S.seg.layers) {
        const row = el('label', 'aiimg-layer');
        const cb = el('input'); cb.type = 'checkbox'; cb.checked = S.keep.has(L.key);
        cb.addEventListener('change', () => { if (cb.checked) S.keep.add(L.key); else S.keep.delete(L.key); scheduleMask(); });
        const sw = el('span', 'aiimg-swatch'); sw.style.background = L.colour;
        const name = el('span', 'aiimg-lname', L.name);
        const area = el('span', 'aiimg-area', (L.area * 100).toFixed(L.area < 0.1 ? 1 : 0) + '%');
        row.append(cb, sw, name, area);
        layerList.appendChild(row);
      }
    }
    function setKeep(keys) {
      S.keep = new Set(keys);
      for (const row of layerList.children) { /* the rows are in layer order */ }
      renderLayers();
      scheduleMask();
    }

    let segToken = 0;
    async function runSegmentation() {
      if (!S.image) return;
      const token = ++segToken;
      progress.hidden = false; bar.style.width = '0%';
      status.textContent = 'Preparing the AI model…';
      note('Finding the layers…');
      try {
        const seg = await A.segment(S.image, { detail: S.detail, onProgress: (p) => {
          if (token !== segToken) return;
          if (p.stage === 'download') {
            status.textContent = 'Downloading the model once' + (p.total ? ' — ' + fmtBytes(p.loaded) + ' of ' + fmtBytes(p.total) : '') + '. Your browser keeps it for next time.';
            bar.style.width = Math.round(p.fraction * 60) + '%';
          } else if (p.stage === 'run') {
            status.textContent = 'Finding the layers on your device…';
            bar.style.width = Math.round(60 + p.fraction * 40) + '%';
          }
        } });
        if (token !== segToken) return;
        S.seg = seg; S.guide = null; S.tint = null; S.alpha = null;
        const subjects = seg.layers.filter((l) => l.subject);
        S.keep = new Set((subjects.length ? subjects : seg.layers.slice(0, 1)).map((l) => l.key));
        renderLayers();
        if (!subjects.length) say('No people or objects were found, so the largest layer is kept in colour. Tick any layer to keep it in colour instead.', 'note');
        else say('');
        await rebuildMask();
      } catch (e) {
        if (token !== segToken) return;
        status.textContent = 'The layers could not be found.';
        say((e && e.message) || String(e), 'error');
      } finally {
        if (token === segToken) { progress.hidden = true; note(''); }
      }
    }

    /* ---------------- loading ---------------- */
    async function loadFiles(files) {
      const f = files && files[0]; if (!f) return;
      try {
        say(''); note('Reading the photo…'); status.textContent = 'Reading the photo…';
        const img = await A.loadImageFile(f);
        segToken++;
        S.image = img; S.seg = null; S.guide = null; S.alpha = null; S.keep = new Set(); S.tint = null; S.swatches = []; S.levels = {};
        sizePreview();
        studio.hidden = false; drop.hidden = true;
        layerList.innerHTML = '';
        results.innerHTML = '';
        renderSwatches();
        invalidate();
        showPane('layers');
        runSegmentation();
      } catch (e) {
        note('');
        say((e && e.message) || String(e), 'error');
      }
    }
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    ['dragenter', 'dragover'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    wrap.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) loadFiles(e.dataTransfer.files); });
    file.addEventListener('change', () => { if (file.files.length) loadFiles(file.files); file.value = ''; });

    /* ---------------- colour pane ---------------- */
    const h = (t) => el('p', 'aiimg-h', t);
    const grid = (...fields) => { const g = el('div', 'aiimg-grid2'); g.append(...fields); return g; };
    const presetRow = el('div', 'aiimg-pop-presets');
    for (const [k, label] of PRESETS) { const b = button(label, 'chip', () => applyPreset(k)); b.dataset.preset = k; presetRow.appendChild(b); }

    /* one zone's controls: a mode and the settings the mode needs */
    function zone(prefix, P, getMode, setMode) {
      const mode = on(select(prefix + '-mode', MODES, getMode()), () => { setMode(mode.value); sync(); relevel(); });
      const boost = on(range(prefix + '-boost', 0, 100, 5, Math.round(P.boost * 100), pct), () => { P.boost = Number(boost.input.value) / 100; relevel(); });
      const tint = on(colour(prefix + '-tint', P.tint), () => { P.tint = tint.value; relevel(); });
      const tintK = on(range(prefix + '-tintk', 0, 100, 5, Math.round(P.tintStrength * 100), pct), () => { P.tintStrength = Number(tintK.input.value) / 100; relevel(); });
      const dark = on(colour(prefix + '-dark', P.duoDark), () => { P.duoDark = dark.value; relevel(); });
      const light = on(colour(prefix + '-light', P.duoLight), () => { P.duoLight = light.value; relevel(); });
      const mid = on(range(prefix + '-mid', 10, 90, 1, Math.round(P.duoMid * 100), (v) => (v / 100).toFixed(2)), () => { P.duoMid = Number(mid.input.value) / 100; relevel(); });
      const fBoost = field('Extra saturation', boost), fTint = grid(field('Tint colour', tint), field('Strength', tintK));
      const fDuo = grid(field('Shadows', dark), field('Highlights', light)), fMid = field('Mid-point', mid, 'Where the two colours meet. Lower for a dark, moody frame; higher for a bright, washed one.');
      const box = el('div');
      box.append(field(null, mode), fBoost, fTint, fDuo, fMid);
      function sync() {
        const m = getMode();
        mode.value = m;
        fBoost.hidden = m !== 'colour'; fTint.hidden = m !== 'tint'; fDuo.hidden = m !== 'duotone'; fMid.hidden = m !== 'duotone';
        boost.set(Math.round(P.boost * 100)); tint.value = P.tint; tintK.set(Math.round(P.tintStrength * 100));
        dark.value = P.duoDark; light.value = P.duoLight; mid.set(Math.round(P.duoMid * 100));
      }
      sync();
      return { box, sync };
    }
    const subjectZone = zone('aiimg-pop-subject', S.subject, () => S.subjectMode, (m) => { S.subjectMode = m; });
    const worldZone = zone('aiimg-pop-world', S.world, () => S.worldMode, (m) => { S.worldMode = m; });

    const hueOn = on(check('aiimg-pop-hue', 'Only one colour within the kept layers', false), () => { S.hue.on = hueOn.input.checked; syncHue(); relevel(); });
    const swatchRow = el('div', 'aiimg-pop-swatches');
    const hueCentre = on(range('aiimg-pop-huec', 0, 360, 1, S.hue.centre, (v) => v + '°'), () => { S.hue.centre = Number(hueCentre.input.value); syncHue(); relevel(); });
    const hueWidth = on(range('aiimg-pop-huew', 5, 90, 1, S.hue.width, (v) => '±' + v + '°'), () => { S.hue.width = Number(hueWidth.input.value); syncHue(); relevel(); });
    const satFloor = on(range('aiimg-pop-sat', 0, 100, 1, Math.round(S.hue.satFloor * 100), pct), () => { S.hue.satFloor = Number(satFloor.input.value) / 100; relevel(); });
    const hueBar = el('div', 'aiimg-pop-huebar'); const hueMark = el('i'); hueBar.appendChild(hueMark);
    const hueBox = el('div');
    hueBox.append(el('p', 'field-hint', 'Click the colour to keep. These are the main hues the tool found inside the kept layers.'), swatchRow,
      field('Hue', hueCentre), hueBar, field('Band width', hueWidth, 'Widen it if parts of the colour drop out in shadow; narrow it if a neighbouring colour joins in.'),
      field('Saturation floor', satFloor, 'Greys and near-whites inside the layer fall below this and lose their colour.'));
    function syncHue() {
      hueBox.hidden = !S.hue.on; hueOn.input.checked = S.hue.on;
      hueCentre.set(Math.round(S.hue.centre)); hueWidth.set(S.hue.width); satFloor.set(Math.round(S.hue.satFloor * 100));
      hueMark.style.left = (S.hue.centre / 360 * 100) + '%';
      hueMark.style.width = Math.max(2, S.hue.width * 2 / 360 * 100) + '%';
      for (const b of swatchRow.children) {
        let dh = Math.abs(Number(b.dataset.hue) - S.hue.centre); if (dh > 180) dh = 360 - dh;
        b.classList.toggle('is-on', S.hue.on && dh <= S.hue.width);
      }
    }
    function renderSwatches() {
      swatchRow.innerHTML = '';
      if (!S.swatches.length) { swatchRow.appendChild(el('span', 'field-hint', S.alpha ? 'No strong colours found inside the kept layers.' : 'Keep a layer first.')); return; }
      for (const sw of S.swatches) {
        const b = button('', 'aiimg-pop-swatch', () => { S.hue.on = true; S.hue.centre = Math.round(sw.hue); syncHue(); relevel(); });
        b.dataset.hue = String(Math.round(sw.hue));
        b.style.background = sw.colour;
        b.title = 'Hue ' + Math.round(sw.hue) + '° — ' + Math.round(sw.share * 100) + '% of the colour in the layer';
        b.setAttribute('aria-label', b.title);
        swatchRow.appendChild(b);
      }
      syncHue();
    }
    syncHue();
    panes.colour.append(
      h('Presets'), presetRow,
      h('Kept layers'), subjectZone.box,
      h('Everything else'), worldZone.box,
      h('Only one colour'), hueOn, hueBox
    );

    function applyPreset(k) {
      const seg = S.seg;
      const subjects = seg ? seg.layers.filter((l) => l.subject).map((l) => l.key) : [];
      const cars = seg ? seg.layers.filter((l) => /^(car|bus|truck|van|minibike)$/.test(l.label)).map((l) => l.key) : [];
      const sky = seg ? seg.layers.filter((l) => l.label === 'sky').map((l) => l.key) : [];
      S.hue.on = false;
      S.subjectMode = 'colour'; S.worldMode = 'grey';
      S.subject.boost = 0;
      let keep = null;
      switch (k) {
        case 'red': S.hue = { on: true, centre: 0, width: 28, satFloor: 0.3 }; keep = cars.length ? cars : null; break;
        case 'bluesky':
          if (sky.length) keep = sky; else S.hue = { on: true, centre: 210, width: 35, satFloor: 0.2 };
          break;
        case 'tealorange':
          S.worldMode = 'duotone'; Object.assign(S.world, { duoDark: '#0b3d4d', duoLight: '#ffb06b', duoMid: 0.5 });
          S.subject.boost = 0.2; break;
        case 'noir':
          S.subjectMode = 'duotone'; Object.assign(S.subject, { duoDark: '#000000', duoLight: '#ffffff', duoMid: 0.45 });
          S.worldMode = 'colour'; S.world.boost = 0.1; break;
        case 'sepia': S.worldMode = 'sepia'; break;
        case 'neon':
          S.worldMode = 'duotone'; Object.assign(S.world, { duoDark: '#1a0033', duoLight: '#ff2fd6', duoMid: 0.5 });
          S.subjectMode = 'duotone'; Object.assign(S.subject, { duoDark: '#001433', duoLight: '#2dd4ff', duoMid: 0.5 });
          break;
        default: break;
      }
      if (keep === null && seg) keep = subjects.length ? subjects : [seg.layers[0].key];
      subjectZone.sync(); worldZone.sync(); syncHue();
      for (const b of presetRow.children) b.classList.toggle('is-on', b.dataset.preset === k);
      if (seg && keep) setKeep(keep); else relevel();
    }

    /* ---------------- motion pane ---------------- */
    const animSel = on(select('aiimg-anim', ANIMS, S.anim), () => { S.anim = animSel.value; if (S.anim !== 'none' && !S.playing) setPlaying(true); invalidate(); });
    const durCtl = on(range('aiimg-dur', 3, 10, 0.5, S.duration, (v) => v.toFixed(1) + ' s'), () => { S.duration = Number(durCtl.input.value); S.t = Math.min(S.t, S.duration); invalidate(); });
    panes.motion.append(field('The reveal', animSel, 'The clip loops: the colour sweeps or fades in, holds, and leaves again, so a GIF or a looping video joins up with itself.'),
      field('Clip length', durCtl, 'Press Play under the preview to watch it loop.'));

    /* ---------------- export pane ---------------- */
    const stillFmt = on(select('aiimg-still-fmt', [['image/png', 'PNG'], ['image/jpeg', 'JPEG'], ['image/webp', 'WebP']], 'image/png'), () => { qualityField.hidden = stillFmt.value === 'image/png'; });
    const stillSize = select('aiimg-still-size', [['0', 'Original size'], ['2048', 'Up to 2048 px'], ['1080', 'Up to 1080 px'], ['720', 'Up to 720 px']], '0');
    const quality = range('aiimg-quality', 50, 100, 1, 92, pct);
    const qualityField = field('Quality', quality); qualityField.hidden = true;
    const stillBtn = button('Download the image', 'btn-primary', exportStill);
    const clipFmt = on(select('aiimg-clip-fmt', [['mp4', 'MP4 video (H.264)'], ['gif', 'Animated GIF']], 'mp4'), () => { syncClipOptions(); });
    const clipSize = select('aiimg-clip-size', [], '1080');
    const clipFps = select('aiimg-clip-fps', [], '30');
    const clipBtn = button('Export the clip', 'btn-primary', exportClip);
    const cancelBtn = button('Cancel', 'btn-ghost', () => { if (S.job) S.job.abort(); }); cancelBtn.hidden = true;
    const clipProgress = el('div', 'aiimg-progress'); const clipBar = el('i'); clipProgress.appendChild(clipBar); clipProgress.hidden = true;
    const clipStatus = el('p', 'aiimg-status', ''); clipStatus.hidden = true;
    const results = el('div', 'aiimg-results');
    const clipRow = el('div', 'aiimg-row'); clipRow.append(clipBtn, cancelBtn);
    function fillSelect(sel, options, value) { sel.innerHTML = ''; for (const [v, l] of options) { const op = el('option', null, l); op.value = v; sel.appendChild(op); } sel.value = options.some((o) => String(o[0]) === String(value)) ? value : options[0][0]; }
    function syncClipOptions() {
      const gif = clipFmt.value === 'gif';
      fillSelect(clipSize, gif ? [['480', '480 px'], ['640', '640 px'], ['800', '800 px'], ['1080', '1080 px — large files']] : [['720', '720 px'], ['1080', '1080 px (Full HD)'], ['1440', '1440 px'], ['1920', '1920 px']], gif ? '640' : '1080');
      fillSelect(clipFps, gif ? [['10', '10'], ['12', '12'], ['15', '15'], ['20', '20']] : [['24', '24'], ['30', '30'], ['60', '60']], gif ? '15' : '30');
    }
    syncClipOptions();
    panes.export.append(
      h('Still image'),
      grid(field('Format', stillFmt), field('Size', stillSize)), qualityField,
      el('p', 'field-hint', 'The still is the frame shown in the preview. The preview opens on the full-colour moment of the reveal; scrub elsewhere if you want a half-swept frame.'),
      (() => { const r = el('div', 'aiimg-row'); r.append(stillBtn); return r; })(),
      h('Reveal clip'),
      grid(field('Format', clipFmt), field('Long edge', clipSize)),
      field('Frames per second', clipFps),
      el('p', 'field-hint', 'Encoded on your device. MP4 needs a browser with on-device video encoding (Chrome, Edge, Safari 16.4+); elsewhere the clip is recorded as WebM. GIFs are large: keep them short and 640 px or under for sharing.'),
      clipRow, clipProgress, clipStatus, results
    );

    const outName = (ext) => (S.image ? S.image.name : 'image') + '-colour-pop.' + ext;
    function sizeFor(longEdge) {
      const W = S.image.width, H = S.image.height;
      const cap = Number(longEdge) || 0;
      const s = cap ? Math.min(1, cap / Math.max(W, H)) : 1;
      return { width: Math.max(2, Math.round(W * s)), height: Math.max(2, Math.round(H * s)) };
    }
    function addResult(blob, name, label, dims) {
      const row = el('div', 'aiimg-result');
      const head = el('div', 'aiimg-result-head');
      const strong = el('strong', null, name);
      const meta = el('span', null, fmtBytes(blob.size) + ' · ' + dims + (label ? ' · ' + label : ''));
      const dl = button('Download', 'btn-download', () => A.download(blob, name));
      head.append(strong, meta, dl);
      row.appendChild(head);
      const url = URL.createObjectURL(blob);
      if (/^image\//.test(blob.type)) { const img = el('img'); img.alt = 'Result preview'; img.src = url; row.appendChild(img); }
      else { const v = el('video'); v.controls = true; v.muted = true; v.loop = true; v.playsInline = true; v.src = url; row.appendChild(v); }
      results.insertBefore(row, results.firstChild);
      return row;
    }
    async function exportStill() {
      if (!S.image) return;
      try {
        S.exporting = true;
        const fmt = stillFmt.value;
        const { width, height } = sizeFor(stillSize.value);
        /* a still of a sweep caught half-way is rarely what is wanted: with
           the reveal on, export the full-colour moment unless it was scrubbed */
        const blob = await A.exportStill(renderFrame, { width, height, format: fmt, quality: Number(quality.input.value) / 100, t: S.t });
        if (!blob) throw new Error('This browser could not encode that format. Try PNG.');
        const ext = fmt === 'image/png' ? 'png' : fmt === 'image/webp' ? 'webp' : 'jpg';
        const name = outName(ext);
        addResult(blob, name, null, width + '×' + height);
        A.download(blob, name);
        say('');
      } catch (e) { say((e && e.message) || String(e), 'error'); }
      finally { S.exporting = false; invalidate(); }
    }
    async function exportClip() {
      if (!S.image || S.job) return;
      const gif = clipFmt.value === 'gif';
      const { width, height } = sizeFor(clipSize.value);
      const fps = Number(clipFps.value);
      const frames = Math.round(S.duration * fps);
      if (gif && frames * width * height > 240 * 1e6) { say('That GIF would be enormous — ' + frames + ' frames at ' + width + '×' + height + '. Shorten the clip, lower the frame rate or pick a smaller size.', 'warn'); return; }
      if (S.anim === 'none') { say('The reveal is set to None, so the clip would be a still. Pick a reveal in the Motion pane first.', 'warn'); return; }
      S.job = new AbortController();
      S.exporting = true;
      const wasPlaying = S.playing; setPlaying(false);
      clipBtn.disabled = true; cancelBtn.hidden = false; clipProgress.hidden = false; clipStatus.hidden = false; clipBar.style.width = '0%';
      clipStatus.textContent = gif ? 'Encoding the GIF…' : 'Encoding the video…';
      const started = performance.now();
      const onProgress = (f) => {
        clipBar.style.width = Math.round(f * 100) + '%';
        const spent = (performance.now() - started) / 1000;
        clipStatus.textContent = (gif ? 'Encoding the GIF' : 'Encoding the video') + ' — ' + Math.round(f * 100) + '%' + (f > 0.05 && f < 1 ? ', about ' + Math.max(1, Math.round(spent / f - spent)) + ' s left' : '') + '.';
      };
      try {
        const o = { width, height, fps, duration: S.duration, onProgress, signal: S.job.signal };
        let blob, ext, noteText;
        if (gif) { blob = await A.encodeGIF(renderFrame, o); ext = 'gif'; }
        else { const r = await A.encodeVideo(renderFrame, o); blob = r.blob; ext = r.ext; noteText = r.note; }
        const name = outName(ext);
        addResult(blob, name, (gif ? 'GIF' : (ext === 'mp4' ? 'MP4' : 'WebM')) + ' · ' + S.duration.toFixed(1) + ' s · ' + fps + ' fps', width + '×' + height);
        A.download(blob, name);
        clipStatus.textContent = 'Done in ' + ((performance.now() - started) / 1000).toFixed(1) + ' s.';
        if (noteText && /WebM/.test(noteText)) say(noteText, 'warn'); else say('');
      } catch (e) {
        if (e && e.name === 'AbortError') clipStatus.textContent = 'Cancelled.';
        else { clipStatus.textContent = 'The export failed.'; say((e && e.message) || String(e), 'error'); }
      } finally {
        S.job = null; S.exporting = false;
        clipBtn.disabled = false; cancelBtn.hidden = true; clipProgress.hidden = true;
        if (wasPlaying) setPlaying(true);
        invalidate();
      }
    }

    /* ---------------- go ---------------- */
    showPane('layers');
    const api = { state: S, renderFrame, loadFiles, applyPreset, results, panes, destroy: () => { mounted = false; } };
    root.aiimgTool = api;
    return api;
  }

  A.tools['color-pop'] = { mount };
})();
