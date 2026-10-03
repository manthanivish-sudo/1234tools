/**
 * Sky Replacement.
 *
 * The model finds the sky on the device; the mask is refined against the
 * picture, pulled back from trees and buildings, and a new sky is drawn
 * behind the foreground — mirror-tiled so it can drift sideways without a
 * seam. The foreground is shifted toward the new sky's warmth and
 * brightness in roughly linear light. One function draws the frame for the
 * preview, the still and every frame of the clip.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A) return;
  const { el, clamp, lerp, field, select, range, check, button, sleep, fmtBytes } = A;

  const PREVIEW_MAX = 1280;
  const SKY_DIR = '/engine/skies/';
  /* The gallery. `file` is fetched only when the sky is chosen; a sky
     without one is drawn by the page. `swatch` is the CSS preview on the
     button, so nothing is downloaded to show the gallery. */
  const SKIES = [
    { id: 'clear-blue', name: 'Clear blue', swatch: 'linear-gradient(#2f6fd6, #9ccdf6)' },
    { id: 'soft-clouds', name: 'Soft clouds', file: 'soft-clouds.webp', swatch: 'linear-gradient(#3f8fe0, #a9d4f5 70%, #e9f2fb)' },
    { id: 'golden-hour', name: 'Golden hour', file: 'golden-hour.webp', swatch: 'linear-gradient(#5f5443, #d8a64a 55%, #f6dc8c)' },
    { id: 'sunset', name: 'Sunset', file: 'sunset.webp', swatch: 'linear-gradient(#5c4a6a, #c77a6c 50%, #f1b48c)' },
    { id: 'dusk-pink', name: 'Dusk pink', file: 'dusk-pink.webp', swatch: 'linear-gradient(#4d6b96, #c9a2a8 55%, #f3cdb3)' },
    { id: 'storm', name: 'Storm clouds', file: 'storm.webp', swatch: 'linear-gradient(#3b4653, #7d8a98 60%, #b7c3cf)' },
    { id: 'overcast', name: 'Overcast', file: 'overcast.webp', swatch: 'linear-gradient(#8f98a3, #c2c8ce 60%, #dfe3e7)' },
    { id: 'night-stars', name: 'Night stars', swatch: 'radial-gradient(circle at 30% 30%, #ffffff 0.6px, transparent 1.2px), radial-gradient(circle at 70% 60%, #ffffff 0.6px, transparent 1.2px), linear-gradient(#060a1c, #16204a)' }
  ];
  /* Layers that the sky mask is pulled out of when "Protect" is on. */
  const PROTECT = new Set(['tree', 'plant', 'palm', 'building', 'house', 'skyscraper', 'tower', 'flower', 'grass']);

  const pct = (v) => Math.round(v) + '%';
  const on = (ctrl, fn) => { const t = ctrl.input || ctrl; t.addEventListener('input', fn); t.addEventListener('change', fn); return ctrl; };

  /* ---------------- procedural skies ---------------- */
  /* Smooth value noise: a small random grid, drawn large with bilinear
     smoothing, in a few octaves. Enough for haze and a cloud deck. */
  function noiseLayer(w, h, cells, seed) {
    let s = seed >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const small = el('canvas'); small.width = cells; small.height = Math.max(2, Math.round(cells * h / w));
    const id = new ImageData(small.width, small.height);
    for (let i = 0; i < id.data.length; i += 4) { const v = Math.round(rnd() * 255); id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    small.getContext('2d').putImageData(id, 0, 0);
    const big = el('canvas'); big.width = w; big.height = h;
    const x = big.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(small, 0, 0, w, h);
    return x.getImageData(0, 0, w, h).data;
  }
  function proceduralSky(id, w, h) {
    const c = el('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    if (id === 'night-stars') {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#04071a'); g.addColorStop(0.6, '#0c1233'); g.addColorStop(1, '#1b2550');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      /* a soft band of light across the frame, the galaxy */
      x.save();
      x.translate(w / 2, h / 2); x.rotate(-0.35);
      const band = x.createLinearGradient(0, -h * 0.22, 0, h * 0.22);
      band.addColorStop(0, 'rgba(120,140,200,0)'); band.addColorStop(0.5, 'rgba(150,165,220,0.22)'); band.addColorStop(1, 'rgba(120,140,200,0)');
      x.fillStyle = band; x.fillRect(-w, -h * 0.22, 2 * w, h * 0.44);
      x.restore();
      const n1 = noiseLayer(w, h, 24, 7), n2 = noiseLayer(w, h, 96, 11);
      const img = x.getImageData(0, 0, w, h), d = img.data;
      for (let j = 0; j < d.length; j += 4) {
        const m = (n1[j] / 255) * 0.5 + (n2[j] / 255) * 0.5;
        const add = Math.max(0, m - 0.52) * 60;
        d[j] += add * 0.8; d[j + 1] += add * 0.85; d[j + 2] += add;
      }
      x.putImageData(img, 0, 0);
      let s = 12345;
      const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      for (let i = 0; i < 1800; i++) {
        const px = rnd() * w, py = rnd() * h, r = rnd();
        const size = r < 0.92 ? 0.5 + rnd() * 0.9 : 1.4 + rnd() * 1.4;
        const a = 0.35 + rnd() * 0.65;
        const tint = rnd();
        x.fillStyle = tint < 0.15 ? 'rgba(255,220,190,' + a + ')' : tint < 0.3 ? 'rgba(200,215,255,' + a + ')' : 'rgba(255,255,255,' + a + ')';
        x.beginPath(); x.arc(px, py, size, 0, Math.PI * 2); x.fill();
        if (size > 2) { x.fillStyle = 'rgba(255,255,255,0.12)'; x.beginPath(); x.arc(px, py, size * 3, 0, Math.PI * 2); x.fill(); }
      }
      return c;
    }
    /* clear blue: deep at the top, pale and a touch warm at the horizon, a breath of haze */
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2b66cf'); g.addColorStop(0.55, '#5f9fe6'); g.addColorStop(0.85, '#a7d3f4'); g.addColorStop(1, '#dbeefb');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const n1 = noiseLayer(w, h, 10, 3), n2 = noiseLayer(w, h, 40, 5);
    const img = x.getImageData(0, 0, w, h), d = img.data;
    for (let y = 0; y < h; y++) {
      const low = y / h;
      for (let xx = 0; xx < w; xx++) {
        const j = (y * w + xx) * 4;
        const m = (n1[j] / 255) * 0.65 + (n2[j] / 255) * 0.35;
        const haze = Math.max(0, m - 0.58) * 0.9 * (0.3 + low);
        d[j] = lerp(d[j], 255, haze); d[j + 1] = lerp(d[j + 1], 255, haze); d[j + 2] = lerp(d[j + 2], 255, haze);
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  /* ---------------- colour ---------------- */
  const toLin = (v) => Math.pow(v / 255, 2.2);
  const toSrgb = (v) => 255 * Math.pow(clamp(v, 0, 1), 1 / 2.2);
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

  /** Mean colour of a canvas in linear light, from a small copy. */
  function meanOfCanvas(src, w, h, mask) {
    const sw = Math.min(160, w), sh = Math.max(1, Math.round(h * sw / w));
    const d = A.scaled(src, sw, sh).getContext('2d').getImageData(0, 0, sw, sh).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 0; y < sh; y++) for (let xx = 0; xx < sw; xx++) {
      const j = (y * sw + xx) * 4;
      const wgt = mask ? mask(xx / sw, y / sh) : 1;
      if (wgt <= 0) continue;
      r += toLin(d[j]) * wgt; g += toLin(d[j + 1]) * wgt; b += toLin(d[j + 2]) * wgt; n += wgt;
    }
    return n ? [r / n, g / n, b / n] : [0.5, 0.5, 0.5];
  }

  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const S = {
      image: null, seg: null, guide: null, skyKeys: new Set(), alpha: null, tint: null, horizon: 0.5,
      softness: 3, shift: -1, protect: true, detail: 'standard',
      sky: 'soft-clouds', skyImg: null, skyLoading: null, offset: 0, scale: 1, flip: false,
      warmth: 0.7, reflect: 0.5, stats: null, luts: null,
      drift: false, speed: 3, dir: 1, duration: 6, t: 0, playing: false, t0: 0,
      levels: {}, showLayers: false, exporting: false, job: null
    };

    /* ---------------- skeleton ---------------- */
    const wrap = el('div', 'aiimg aiimg-sky');
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose a photo with some sky in it</strong><span>or drag it here — nothing is uploaded. JPEG, PNG, WebP or HEIC.</span>';
    const file = el('input', 'visually-hidden');
    file.type = 'file'; file.accept = 'image/*'; file.setAttribute('aria-label', 'Choose a photo');

    const studio = el('div', 'aiimg-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage');
    const canvas = el('canvas', 'aiimg-canvas');
    canvas.setAttribute('aria-label', 'Preview. Drag up or down to move the sky.');
    const stageMsg = el('div', 'aiimg-stagemsg'); stageMsg.hidden = true;
    stage.append(canvas, stageMsg);
    const transport = el('div', 'aiimg-transport');
    const play = button('▶ Play', 'btn-ghost');
    const scrub = el('input', 'range');
    scrub.type = 'range'; scrub.min = 0; scrub.max = 1000; scrub.step = 1; scrub.value = 0;
    scrub.setAttribute('aria-label', 'Position in the clip');
    const clock = el('span', 'range-val', '0.0 s');
    const change = button('Change photo', 'btn-ghost', () => file.click());
    transport.append(play, scrub, clock, change);
    stageCol.append(stage, transport);

    const side = el('div', 'aiimg-side');
    const tabs = el('div', 'aiimg-tabs'); tabs.setAttribute('role', 'tablist');
    const panes = {};
    for (const [k, label] of [['layers', 'Sky mask'], ['sky', 'New sky'], ['light', 'Light'], ['motion', 'Motion'], ['export', 'Export']]) {
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

    /** Per-channel tables that move the foreground toward the new sky's light. */
    function buildLuts() {
      S.luts = null;
      const st = S.stats;
      if (!st || (S.warmth <= 0 && S.reflect <= 0)) return;
      const oldL = Math.max(1e-4, lum(st.oldMean)), newL = Math.max(1e-4, lum(st.newMean));
      const gains = [0, 1, 2].map((c) => {
        const oc = st.oldMean[c] / oldL, nc = st.newMean[c] / newL;
        return clamp(lerp(1, nc / Math.max(1e-4, oc), S.warmth), 0.55, 1.8);
      });
      const bright = lerp(1, clamp(Math.pow(newL / oldL, 0.35), 0.75, 1.2), S.reflect);
      const luts = [0, 1, 2].map((c) => {
        const t = new Uint8ClampedArray(256);
        for (let v = 0; v < 256; v++) t[v] = toSrgb(toLin(v) * gains[c] * bright);
        return t;
      });
      S.luts = luts;
      S.stats.gains = gains; S.stats.bright = bright;
    }

    /** The foreground at one size: the picture, relit, with the sky cut away. */
    function buildLevel(w, h) {
      const src = A.scaled(S.image.canvas, w, h);
      const img = src.getContext('2d').getImageData(0, 0, w, h);
      const d = img.data;
      let shift = null;
      if (S.luts) {
        const [lr, lg, lb] = S.luts;
        let r0 = 0, g0 = 0, b0 = 0, r1 = 0, g1 = 0, b1 = 0, n = 0;
        for (let j = 0; j < d.length; j += 4) {
          r0 += d[j]; g0 += d[j + 1]; b0 += d[j + 2];
          d[j] = lr[d[j]]; d[j + 1] = lg[d[j + 1]]; d[j + 2] = lb[d[j + 2]];
          r1 += d[j]; g1 += d[j + 1]; b1 += d[j + 2]; n++;
        }
        shift = [(r1 - r0) / n, (g1 - g0) / n, (b1 - b0) / n];
      }
      if (S.alpha) {
        const mc = el('canvas'); mc.width = w; mc.height = h;
        const mx = mc.getContext('2d');
        mx.imageSmoothingEnabled = true; mx.imageSmoothingQuality = 'high';
        mx.drawImage(A.maskCanvas(S.alpha, S.seg.mw, S.seg.mh), 0, 0, w, h);
        const m = mx.getImageData(0, 0, w, h).data;
        for (let j = 3; j < d.length; j += 4) d[j] = 255 - m[j];
      }
      const fg = el('canvas'); fg.width = w; fg.height = h;
      fg.getContext('2d').putImageData(img, 0, 0);
      return { w, h, fg, shift };
    }
    function levelFor(w, h) {
      const key = w + 'x' + h;
      if (S.levels[key]) return S.levels[key];
      const keys = Object.keys(S.levels);
      const previewKey = canvas.width + 'x' + canvas.height;
      if (keys.length >= 2) delete S.levels[keys.find((k) => k !== previewKey) || keys[0]];
      const L = (S.levels[key] = buildLevel(w, h));
      if (key === previewKey) showShift(L.shift);
      return L;
    }

    /** Where the sky sits on a W×H frame: covering the top down to the horizon. */
    function skyRect(W, H) {
      const img = S.skyImg;
      const iw = img.width, ih = img.height;
      const hSky = Math.max(H * 0.35, H * (S.horizon + 0.08));
      const s = Math.max(W * S.scale / iw, hSky * S.scale / ih);
      const tw = iw * s, th = ih * s;
      const y = S.offset * H + hSky - th;
      return { tw, th, y, x0: (W - tw) / 2 };
    }
    function drawSkyAt(ctx, W, H, t, travel) {
      const img = S.skyImg;
      const R = skyRect(W, H);
      const period = 2 * R.tw;
      let x0 = R.x0 - (((travel % period) + period) % period);
      while (x0 > 0) x0 -= period;
      for (let k = 0; x0 + k * R.tw < W; k++) {
        const x = x0 + k * R.tw;
        if (x + R.tw < 0) continue;
        const mirrored = ((k % 2) === 1) !== S.flip;
        ctx.save();
        if (mirrored) { ctx.translate(x + R.tw, R.y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, R.tw, R.th); }
        else ctx.drawImage(img, x, R.y, R.tw, R.th);
        ctx.restore();
      }
      /* below the sky band, the sky's bottom colour, in case the mask reaches lower */
      if (R.y + R.th < H) {
        ctx.fillStyle = S.stats ? S.stats.bottom : '#9ab';
        ctx.fillRect(0, R.y + R.th - 1, W, H - (R.y + R.th) + 1);
      }
    }
    /** The frame: the new sky (drifting, mirror-tiled), the relit foreground, a light tint. */
    function renderFrame(ctx, W, H, t) {
      ctx.save();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      const L = levelFor(W, H);
      if (S.skyImg) {
        const v = S.drift ? S.dir * S.speed / 100 * W : 0;
        const D = S.duration;
        const tt = D > 0 ? ((t % D) + D) % D : 0;
        drawSkyAt(ctx, W, H, t, v * tt);
        /* the loop point: the last 0.8 s dissolve into where the clip starts */
        const fade = 0.8;
        if (S.drift && tt > D - fade) {
          ctx.globalAlpha = (tt - (D - fade)) / fade;
          drawSkyAt(ctx, W, H, t, v * (tt - D));
          ctx.globalAlpha = 1;
        }
      } else {
        ctx.drawImage(S.image.canvas, 0, 0, W, H);
      }
      ctx.drawImage(L.fg, 0, 0, W, H);
      if (S.skyImg && S.stats && S.warmth > 0) {
        ctx.globalCompositeOperation = 'soft-light';
        ctx.globalAlpha = 0.35 * S.warmth;
        ctx.fillStyle = S.stats.tint;
        ctx.fillRect(0, 0, W, H);
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

    /* drag the sky up or down */
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => {
      if (!S.image || S.exporting) return;
      drag = { y: e.clientY, offset: S.offset };
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const r = canvas.getBoundingClientRect();
      S.offset = clamp(drag.offset + (e.clientY - drag.y) / r.height, -0.6, 0.6);
      offsetCtl.set(Math.round(S.offset * 100));
      invalidate();
    });
    const endDrag = () => { drag = null; };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    /* ---------------- the sky mask ---------------- */
    let maskTimer = 0, maskToken = 0;
    function scheduleMask() { clearTimeout(maskTimer); maskTimer = setTimeout(rebuildMask, 120); }
    /** Grow a 0/1 map by r pixels in both directions. */
    function dilate(src, w, h, r) {
      const tmp = new Uint8Array(src.length), out = new Uint8Array(src.length);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let v = 0;
        for (let k = -r; k <= r && !v; k++) { const xx = x + k; if (xx >= 0 && xx < w && src[y * w + xx]) v = 1; }
        tmp[y * w + x] = v;
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let v = 0;
        for (let k = -r; k <= r && !v; k++) { const yy = y + k; if (yy >= 0 && yy < h && tmp[yy * w + x]) v = 1; }
        out[y * w + x] = v;
      }
      return out;
    }
    async function rebuildMask() {
      if (!S.seg || !S.image) return;
      const token = ++maskToken;
      const { mw, mh, classMap, layers } = S.seg;
      const isSky = new Uint8Array(256), isProt = new Uint8Array(256);
      for (const k of S.skyKeys) isSky[k] = 1;
      for (const L of layers) if (PROTECT.has(L.label) && !S.skyKeys.has(L.key)) isProt[L.key] = 1;
      const bin = new Float32Array(mw * mh);
      let any = false;
      for (let i = 0; i < bin.length; i++) if (isSky[classMap[i]]) { bin[i] = 1; any = true; }
      if (any && S.protect) {
        const prot = new Uint8Array(mw * mh);
        let anyProt = false;
        for (let i = 0; i < prot.length; i++) if (isProt[classMap[i]]) { prot[i] = 1; anyProt = true; }
        if (anyProt) {
          const grown = dilate(prot, mw, mh, Math.max(1, Math.round(mw / 400)));
          for (let i = 0; i < bin.length; i++) if (grown[i]) bin[i] = 0;
        }
      }
      if (!any) { S.alpha = null; S.horizon = 0.5; }
      else {
        note('Refining the edge…');
        setStatus('refining the edge…');
        await sleep(0);
        if (token !== maskToken) return;
        if (!S.guide) S.guide = A.guideOf(S.image, mw, mh);
        S.alpha = A.refine(bin, S.guide, { softness: S.softness, shift: S.shift });
        if (token !== maskToken) return;
        /* the horizon: the row below which almost no sky remains */
        const rows = new Float32Array(mh);
        let total = 0;
        for (let y = 0; y < mh; y++) { let s = 0; for (let x = 0; x < mw; x++) s += S.alpha[y * mw + x]; rows[y] = s; total += s; }
        let acc = 0, hy = mh - 1;
        for (let y = 0; y < mh; y++) { acc += rows[y]; if (acc >= total * 0.985) { hy = y; break; } }
        S.horizon = (hy + 1) / mh;
        note('');
      }
      computeStats();
      relevel();
      setStatus(S.alpha ? 'ready' : 'no sky in the mask, ready');
    }
    function setStatus(tail) {
      if (!S.seg) return;
      const n = S.seg.layers.length;
      const sky = S.seg.layers.filter((l) => S.skyKeys.has(l.key));
      const share = sky.reduce((a, l) => a + l.area, 0);
      status.textContent = n + ' layer' + (n === 1 ? '' : 's') + ' found' + (sky.length ? '. Sky: ' + Math.round(share * 100) + '% of the frame' : '. No sky was found — tick a layer to treat it as the sky') + ' — ' + tail;
    }

    /** The old sky's and the new sky's mean colour, for the light match. */
    function computeStats() {
      if (!S.image || !S.skyImg) { S.stats = null; S.luts = null; return; }
      const { mw, mh } = S.seg || { mw: 1, mh: 1 };
      const alpha = S.alpha;
      const oldMean = alpha
        ? meanOfCanvas(S.image.canvas, S.image.width, S.image.height, (u, v) => alpha[Math.min(mh - 1, Math.floor(v * mh)) * mw + Math.min(mw - 1, Math.floor(u * mw))] > 0.5 ? 1 : 0)
        : meanOfCanvas(S.image.canvas, S.image.width, S.image.height, (u, v) => (v < 0.35 ? 1 : 0));
      const newMean = meanOfCanvas(S.skyImg, S.skyImg.width, S.skyImg.height, null);
      const bottom = meanOfCanvas(S.skyImg, S.skyImg.width, S.skyImg.height, (u, v) => (v > 0.9 ? 1 : 0));
      const srgb = (c) => 'rgb(' + c.map((v) => Math.round(toSrgb(v))).join(',') + ')';
      S.stats = { oldMean, newMean, tint: srgb(newMean), bottom: srgb(bottom) };
      buildLuts();
    }
    const shiftNote = el('p', 'aiimg-sky-shift');
    function showShift(shift) {
      if (!shift || !S.stats) { shiftNote.textContent = S.skyImg ? 'The foreground is unchanged.' : ''; return; }
      const f = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1);
      shiftNote.textContent = 'Foreground shifted by R ' + f(shift[0]) + ', G ' + f(shift[1]) + ', B ' + f(shift[2]) + ' (mean, 0–255)' +
        (S.stats.bright ? '; brightness ×' + S.stats.bright.toFixed(2) : '') + '.';
    }

    /* ---------------- loading a sky ---------------- */
    const skyCache = new Map();   /* each sky is fetched or drawn once per visit */
    function loadSky(id) {
      const sky = SKIES.find((s) => s.id === id) || SKIES[1];
      S.sky = sky.id;
      for (const b of skyGrid.children) b.classList.toggle('is-on', b.dataset.sky === sky.id);
      const token = (S.skyLoading = {});
      const done = (img) => {
        if (S.skyLoading !== token) return;
        S.skyImg = img; S.skyLoading = null;
        computeStats(); relevel();
        skyNote.textContent = sky.file ? sky.name + ' — a CC0 photograph from Wikimedia Commons.' : sky.name + ' — drawn by this page, nothing downloaded.';
      };
      if (skyCache.has(sky.id)) { done(skyCache.get(sky.id)); return; }
      if (!sky.file) { const c = proceduralSky(sky.id, 1600, 900); skyCache.set(sky.id, c); done(c); return; }
      skyNote.textContent = 'Loading ' + sky.name + '…';
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { skyCache.set(sky.id, img); done(img); };
      img.onerror = () => { if (S.skyLoading === token) { S.skyLoading = null; say('That sky could not be loaded. You may be offline — the generated skies still work.', 'error'); } };
      img.src = SKY_DIR + sky.file;
    }

    /* ---------------- panes ---------------- */
    const h = (t) => el('p', 'aiimg-h', t);
    const grid = (...fields) => { const g = el('div', 'aiimg-grid2'); g.append(...fields); return g; };

    /* sky mask */
    const status = el('p', 'aiimg-status', 'Choose a photo to begin.');
    const progress = el('div', 'aiimg-progress'); const bar = el('i'); progress.appendChild(bar); progress.hidden = true;
    const layerList = el('div', 'aiimg-layers');
    const layersHint = el('p', 'field-hint', 'The ticked layers are replaced. The sky is ticked for you; tick a ceiling or a wall if that is what you want swapped.');
    const soft = on(range('aiimg-soft', 0, 10, 1, S.softness), () => { S.softness = Number(soft.input.value); scheduleMask(); });
    const shiftCtl = on(range('aiimg-shift', -5, 5, 1, S.shift, (v) => (v > 0 ? '+' : '') + v), () => { S.shift = Number(shiftCtl.input.value); scheduleMask(); });
    const protect = on(check('aiimg-sky-protect', 'Protect trees and buildings', S.protect), () => { S.protect = protect.input.checked; scheduleMask(); });
    const detailSel = on(select('aiimg-detail', Object.entries(A.DETAIL).map(([k, m]) => [k, m.label]), S.detail), () => { if (detailSel.value !== S.detail) { S.detail = detailSel.value; runSegmentation(); } });
    const showTint = on(check('aiimg-tint', 'Colour the layers on the preview', false), () => { S.showLayers = showTint.input.checked; invalidate(); });
    panes.layers.append(status, progress, layerList, layersHint,
      field('Edge softness', soft, 'Higher follows leaves and hair more loosely; lower keeps a crisp line along a roof.'),
      field('Shrink or grow the mask', shiftCtl, 'Shrink it to pull the new sky back from trees it has leaked into; grow it to cover a halo of old sky.'),
      protect, el('p', 'field-hint', 'Removes everything the model labelled as a tree, plant or building from the sky mask, grown by a pixel or two.'),
      field('Detail', detailSel, 'Standard is right for most photos. High and Maximum look at the picture at a higher resolution, which is sharper on chimneys, aerials and leaves and takes longer.'),
      showTint);
    function renderLayers() {
      layerList.innerHTML = '';
      if (!S.seg) return;
      for (const L of S.seg.layers) {
        const row = el('label', 'aiimg-layer');
        const cb = el('input'); cb.type = 'checkbox'; cb.checked = S.skyKeys.has(L.key);
        cb.addEventListener('change', () => { if (cb.checked) S.skyKeys.add(L.key); else S.skyKeys.delete(L.key); scheduleMask(); });
        const sw = el('span', 'aiimg-swatch'); sw.style.background = L.colour;
        const name = el('span', 'aiimg-lname', L.name);
        const area = el('span', 'aiimg-area', (L.area * 100).toFixed(L.area < 0.1 ? 1 : 0) + '%');
        row.append(cb, sw, name, area);
        layerList.appendChild(row);
      }
    }

    /* new sky */
    const skyGrid = el('div', 'aiimg-sky-grid');
    for (const sky of SKIES) {
      const b = button('', 'aiimg-sky-choice', () => loadSky(sky.id));
      b.dataset.sky = sky.id;
      const sw = el('span', 'aiimg-sky-swatch'); sw.style.background = sky.swatch;
      b.append(sw, el('span', 'aiimg-sky-name', sky.name));
      b.title = sky.name;
      skyGrid.appendChild(b);
    }
    const skyNote = el('p', 'field-hint', '');
    const offsetCtl = on(range('aiimg-sky-offset', -60, 60, 1, 0, pct), () => { S.offset = Number(offsetCtl.input.value) / 100; invalidate(); });
    const scaleCtl = on(range('aiimg-sky-scale', 100, 220, 5, 100, pct), () => { S.scale = Number(scaleCtl.input.value) / 100; invalidate(); });
    const flipCtl = on(check('aiimg-sky-flip', 'Flip the sky left to right', false), () => { S.flip = flipCtl.input.checked; invalidate(); });
    panes.sky.append(h('Gallery'), skyGrid, skyNote,
      h('Placement'),
      field('Horizon', offsetCtl, 'Drag the preview up or down, or use this. Negative lifts the sky.'),
      field('Scale', scaleCtl, 'Larger shows a smaller part of the sky, bigger clouds.'),
      flipCtl);

    /* light */
    const warmthCtl = on(range('aiimg-sky-warmth', 0, 100, 5, Math.round(S.warmth * 100), pct), () => { S.warmth = Number(warmthCtl.input.value) / 100; buildLuts(); relevel(); });
    const reflectCtl = on(range('aiimg-sky-reflect', 0, 100, 5, Math.round(S.reflect * 100), pct), () => { S.reflect = Number(reflectCtl.input.value) / 100; buildLuts(); relevel(); });
    panes.light.append(
      field('Match the light', warmthCtl, 'Shifts the foreground toward the new sky’s warmth — a colour balance in roughly linear light, plus a light tint over the whole frame.'),
      field('Reflect the sky’s light', reflectCtl, 'A darker sky darkens the ground a little; a brighter one lifts it.'),
      shiftNote);

    /* motion */
    const driftCtl = on(check('aiimg-sky-drift', 'Drifting clouds', false), () => { S.drift = driftCtl.input.checked; if (S.drift && !S.playing) setPlaying(true); invalidate(); });
    const speedCtl = on(range('aiimg-sky-speed', 0.5, 20, 0.5, S.speed, (v) => v.toFixed(1) + '% / s'), () => { S.speed = Number(speedCtl.input.value); invalidate(); });
    const dirCtl = on(select('aiimg-sky-dir', [['1', '→ to the right'], ['-1', '← to the left']], '1'), () => { S.dir = Number(dirCtl.value); invalidate(); });
    const durCtl = on(range('aiimg-dur', 4, 10, 0.5, S.duration, (v) => v.toFixed(1) + ' s'), () => { S.duration = Number(durCtl.input.value); S.t = Math.min(S.t, S.duration); invalidate(); });
    panes.motion.append(driftCtl, el('p', 'field-hint', 'The sky scrolls sideways, mirror-tiled so there is no seam, and the last moment dissolves into the first so the loop joins up.'),
      field('Speed', speedCtl, 'As a share of the picture’s width a second. 2–4% looks like weather.'),
      field('Direction', dirCtl),
      field('Clip length', durCtl, 'Press Play under the preview to watch it loop.'));

    /* export */
    const stillFmt = on(select('aiimg-still-fmt', [['image/png', 'PNG'], ['image/jpeg', 'JPEG'], ['image/webp', 'WebP']], 'image/png'), () => { qualityField.hidden = stillFmt.value === 'image/png'; });
    const stillSize = select('aiimg-still-size', [['0', 'Original size'], ['2048', 'Up to 2048 px'], ['1080', 'Up to 1080 px'], ['720', 'Up to 720 px']], '0');
    const quality = range('aiimg-quality', 50, 100, 1, 92, pct);
    const qualityField = field('Quality', quality); qualityField.hidden = true;
    const stillBtn = button('Download the image', 'btn-primary', exportStill);
    const maskBtn = button('Download the sky mask as PNG', 'btn-ghost', exportMask);
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
      (() => { const r = el('div', 'aiimg-row'); r.append(stillBtn, maskBtn); return r; })(),
      h('Drifting clouds clip'),
      grid(field('Format', clipFmt), field('Long edge', clipSize)),
      field('Frames per second', clipFps),
      el('p', 'field-hint', 'Switch on Drifting clouds in the Motion pane first. Encoded on your device; MP4 needs Chrome, Edge or Safari 16.4+, elsewhere the clip is recorded as WebM. GIFs are large: 640 px or under for sharing.'),
      clipRow, clipProgress, clipStatus, results
    );

    const outName = (ext) => (S.image ? S.image.name : 'image') + '-' + S.sky + '-sky.' + ext;
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
    async function exportMask() {
      if (!S.image || !S.alpha) { say('There is no sky mask yet.', 'warn'); return; }
      const { mw, mh } = S.seg;
      const c = el('canvas'); c.width = mw; c.height = mh;
      const x = c.getContext('2d');
      const id = new ImageData(mw, mh);
      for (let i = 0, j = 0; i < S.alpha.length; i++, j += 4) { const v = Math.round(S.alpha[i] * 255); id.data[j] = id.data[j + 1] = id.data[j + 2] = v; id.data[j + 3] = 255; }
      x.putImageData(id, 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const name = (S.image.name || 'image') + '-sky-mask.png';
      addResult(blob, name, 'white = sky', mw + '×' + mh);
      A.download(blob, name);
    }
    async function exportClip() {
      if (!S.image || S.job) return;
      const gif = clipFmt.value === 'gif';
      const { width, height } = sizeFor(clipSize.value);
      const fps = Number(clipFps.value);
      const frames = Math.round(S.duration * fps);
      if (gif && frames * width * height > 240 * 1e6) { say('That GIF would be enormous — ' + frames + ' frames at ' + width + '×' + height + '. Shorten the clip, lower the frame rate or pick a smaller size.', 'warn'); return; }
      if (!S.drift) { S.drift = true; driftCtl.input.checked = true; }
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

    /* ---------------- segmentation and loading ---------------- */
    let segToken = 0;
    async function runSegmentation() {
      if (!S.image) return;
      const token = ++segToken;
      progress.hidden = false; bar.style.width = '0%';
      status.textContent = 'Preparing the AI model…';
      note('Finding the sky…');
      try {
        const seg = await A.segment(S.image, { detail: S.detail, onProgress: (p) => {
          if (token !== segToken) return;
          if (p.stage === 'download') {
            status.textContent = 'Downloading the model once' + (p.total ? ' — ' + fmtBytes(p.loaded) + ' of ' + fmtBytes(p.total) : '') + '. Your browser keeps it for next time.';
            bar.style.width = Math.round(p.fraction * 60) + '%';
          } else if (p.stage === 'run') {
            status.textContent = 'Finding the sky on your device…';
            bar.style.width = Math.round(60 + p.fraction * 40) + '%';
          }
        } });
        if (token !== segToken) return;
        S.seg = seg; S.guide = null; S.tint = null; S.alpha = null;
        S.skyKeys = new Set(seg.layers.filter((l) => l.label === 'sky').map((l) => l.key));
        renderLayers();
        if (!S.skyKeys.size) say('No sky was found in this photo. Tick a layer in the Sky mask pane to replace that instead, or choose another photo.', 'note');
        else say('');
        await rebuildMask();
      } catch (e) {
        if (token !== segToken) return;
        status.textContent = 'The sky could not be found.';
        say((e && e.message) || String(e), 'error');
      } finally {
        if (token === segToken) { progress.hidden = true; note(''); }
      }
    }
    async function loadFiles(files) {
      const f = files && files[0]; if (!f) return;
      try {
        say(''); note('Reading the photo…'); status.textContent = 'Reading the photo…';
        const img = await A.loadImageFile(f);
        segToken++;
        S.image = img; S.seg = null; S.guide = null; S.alpha = null; S.skyKeys = new Set(); S.tint = null; S.levels = {}; S.stats = null; S.luts = null; S.offset = 0;
        offsetCtl.set(0);
        sizePreview();
        studio.hidden = false; drop.hidden = true;
        layerList.innerHTML = '';
        results.innerHTML = '';
        if (!S.skyImg && !S.skyLoading) loadSky(S.sky);
        else { computeStats(); }
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

    /* ---------------- go ---------------- */
    for (const b of skyGrid.children) b.classList.toggle('is-on', b.dataset.sky === S.sky);
    showPane('layers');
    const api = { state: S, renderFrame, loadFiles, loadSky, results, panes, SKIES, destroy: () => { mounted = false; } };
    root.aiimgTool = api;
    return api;
  }

  A.tools['sky-replacement'] = { mount };
})();
