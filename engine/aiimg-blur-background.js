/**
 * Blur Background (Portrait Mode).
 *
 * Depth-weighted blur. The picture is blurred at five increasing radii and
 * the copies are blended by each pixel's distance from the point of focus,
 * so the blur grows with depth the way a lens's does; the layers the model
 * found — people by default — are kept sharp on top, and no blur bleeds
 * into them. One pipeline draws the live preview, the still and the
 * before-and-after clip, so what is exported is what was seen.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A || !A.depth) return;
  const { el, clamp, field, select, range, check, button, sleep, fmtBytes } = A;

  const PREVIEW_MAX = 1280;
  const BANDS = 5;
  const CLIP_SECONDS = 4;
  const STYLES = [['bokeh', 'Bokeh — soft lens blur'], ['motion', 'Motion streaks — speed effect'], ['zoom', 'Zoom blur — rushing from the focus point']];
  const pct = (v) => Math.round(v) + '%';
  const on = (ctrl, fn) => { const t = ctrl.input || ctrl; t.addEventListener('input', fn); t.addEventListener('change', fn); return ctrl; };
  const free = (c) => { if (c) { c.width = 0; c.height = 0; } };

  /** Greatest value in a (2r+1)² window, separable: grows a mask by r pixels. */
  function dilate(src, w, h, r) {
    if (r <= 0) return src;
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let y = 0; y < h; y++) {
      const o = y * w;
      for (let x = 0; x < w; x++) {
        let m = 0;
        for (let k = Math.max(0, x - r), e = Math.min(w - 1, x + r); k <= e; k++) { const v = src[o + k]; if (v > m) m = v; }
        tmp[o + x] = m;
      }
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let m = 0;
        for (let k = Math.max(0, y - r), e = Math.min(h - 1, y + r); k <= e; k++) { const v = tmp[k * w + x]; if (v > m) m = v; }
        out[y * w + x] = m;
      }
    }
    return out;
  }

  /** The source drawn at W×H with its edge pixels extended p px outward, so a blur does not darken the borders. */
  function padded(src, W, H, p) {
    const c = el('canvas');
    c.width = W + 2 * p; c.height = H + 2 * p;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(src, p, p, W, H);
    if (p > 0) {
      x.drawImage(c, p, p, W, 1, p, 0, W, p);
      x.drawImage(c, p, p + H - 1, W, 1, p, p + H, W, p);
      x.drawImage(c, p, 0, 1, H + 2 * p, 0, 0, p, H + 2 * p);
      x.drawImage(c, p + W - 1, 0, 1, H + 2 * p, p + W, 0, p, H + 2 * p);
    }
    return c;
  }

  /**
   * One blurred copy of the picture at W×H: gaussian (bokeh), or a run of
   * offset draws along an angle (motion) or scaled about a point (zoom).
   * Each offset copy is drawn with alpha 1/(j+1), which makes the pile an
   * exact running mean.
   */
  function blurred(src, W, H, r, o) {
    const c = el('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    if (r < 0.3) { x.drawImage(src, 0, 0, W, H); return c; }
    const directional = o.style === 'motion' || o.style === 'zoom';
    const steps = directional ? clamp(Math.round(r / 2) + 1, 3, o.maxSteps || 16) : 1;
    const spacing = directional ? 2 * r / (steps - 1) : 0;
    const p = Math.ceil(r + spacing) + 2;
    const pad = padded(src, W, H, p);
    if (directional) {
      if (spacing > 2) x.filter = 'blur(' + (spacing / 2).toFixed(1) + 'px)';
      if (o.style === 'motion') {
        const a = (o.angle || 0) * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
        for (let j = 0; j < steps; j++) {
          const t = -r + spacing * j;
          x.globalAlpha = 1 / (j + 1);
          x.drawImage(pad, -p + dx * t, -p + dy * t);
        }
      } else {
        const cx = (o.cx === undefined ? 0.5 : o.cx) * W, cy = (o.cy === undefined ? 0.5 : o.cy) * H, L = Math.max(W, H);
        for (let j = 0; j < steps; j++) {
          const s = 1 + (j / (steps - 1)) * (2 * r / L);
          x.globalAlpha = 1 / (j + 1);
          x.setTransform(s, 0, 0, s, cx - cx * s, cy - cy * s);
          x.drawImage(pad, -p, -p);
        }
        x.setTransform(1, 0, 0, 1, 0, 0);
      }
      x.globalAlpha = 1; x.filter = 'none';
    } else {
      x.filter = 'blur(' + r.toFixed(2) + 'px)';
      x.drawImage(pad, -p, -p);
      x.filter = 'none';
    }
    free(pad);
    return c;
  }

  /** Lay one band over the result through its mask: tmp = band × mask, then source-over. */
  function layBand(ctx, tmp, mask, band, W, H) {
    const tx = tmp.getContext('2d');
    tx.imageSmoothingEnabled = true; tx.imageSmoothingQuality = 'high';
    tx.globalCompositeOperation = 'copy';
    tx.drawImage(mask, 0, 0, W, H);
    tx.globalCompositeOperation = 'source-in';
    tx.drawImage(band, 0, 0, W, H);
    tx.globalCompositeOperation = 'source-over';
    ctx.drawImage(tmp, 0, 0);
  }

  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const S = {
      image: null, depth: null, seg: null, guide: null, keep: new Set(), subjectBase: null, weight: null, masks: null, bands: [],
      strength: 50, focus: 0.9, focusTouched: false, dof: 8, falloff: 1, style: 'bokeh', angle: 0, length: 50, feather: 3, grow: 1, bloom: 0,
      cx: 0.5, cy: 0.5, compare: 0, exporting: false, job: null, timing: {}
    };

    /* ---------------- skeleton ---------------- */
    const wrap = el('div', 'aiimg');
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose a photo</strong><span>or drag it here — nothing is uploaded. JPEG, PNG, WebP or HEIC.</span>';
    const file = el('input', 'visually-hidden');
    file.type = 'file'; file.accept = 'image/*'; file.setAttribute('aria-label', 'Choose a photo');

    const studio = el('div', 'aiimg-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage');
    const stageWrap = el('div', 'aiimg-blur-wrap');
    const canvas = el('canvas', 'aiimg-canvas');
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Preview. Tap a point to focus there.');
    const compare = el('canvas', 'aiimg-blur-compare');
    compare.setAttribute('aria-hidden', 'true');
    const handle = el('div', 'aiimg-blur-handle');
    handle.setAttribute('role', 'slider'); handle.setAttribute('aria-label', 'Before and after divider'); handle.tabIndex = 0;
    const marker = el('div', 'aiimg-blur-focus');
    stageWrap.append(canvas, compare, handle, marker);
    const stageMsg = el('div', 'aiimg-stagemsg'); stageMsg.hidden = true;
    stage.append(stageWrap, stageMsg);
    const hint = el('p', 'aiimg-blur-hint', 'Tap the picture to focus there. Drag the divider across to compare with the original.');
    const transport = el('div', 'aiimg-transport');
    const change = button('Change photo', 'btn-ghost', () => file.click());
    const resetCompare = button('Hide the original', 'btn-ghost', () => setCompare(0));
    transport.append(change, resetCompare);
    stageCol.append(stage, hint, transport);

    const side = el('div', 'aiimg-side');
    const tabs = el('div', 'aiimg-tabs'); tabs.setAttribute('role', 'tablist');
    const panes = {};
    for (const [k, label] of [['blur', 'Blur'], ['subject', 'Keep sharp'], ['export', 'Export']]) {
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

    /* ---------------- the weight map and its masks ---------------- */
    /* b(i) in 0..BANDS: how far into the blur each pixel goes. Band k's
       cumulative mask is clamp(b − (k−1), 0, 1); laid in order, that
       blends exactly between the two neighbouring radii. */
    function computeWeight() {
      const D = S.depth; if (!D) return;
      const n = D.w * D.h;
      if (!S.weight || S.weight.length !== n) S.weight = new Float32Array(n);
      const w = S.weight, d = D.data;
      const tol = S.dof / 100, f = S.focus, fall = S.falloff, span = 0.5;
      const sub = S.subjectBase && S.subjectBase.length === n ? S.subjectBase : null;
      /* subject pixels count as sharp only where they are not far behind
         the focus: the layer mask may have caught a bit of wall */
      const gLo = f - tol - 0.4, gHi = f - tol - 0.25;
      for (let i = 0; i < n; i++) {
        const dd = d[i];
        let x = (Math.abs(dd - f) - tol) / span;
        x = x < 0 ? 0 : x > 1 ? 1 : x;
        if (fall !== 1) x = Math.pow(x, fall);
        if (sub) {
          const g = dd <= gLo ? 0 : dd >= gHi ? 1 : (dd - gLo) / (gHi - gLo);
          x *= 1 - sub[i] * g;
        }
        w[i] = x * BANDS;
      }
      const masks = [];
      for (let k = 1; k <= BANDS; k++) {
        const id = new ImageData(D.w, D.h);
        const px = id.data;
        for (let i = 0, j = 3; i < n; i++, j += 4) { const a = w[i] - (k - 1); px[j] = a <= 0 ? 0 : a >= 1 ? 255 : Math.round(a * 255); }
        const c = el('canvas'); c.width = D.w; c.height = D.h;
        c.getContext('2d').putImageData(id, 0, 0);
        masks.push(c);
      }
      if (S.masks) S.masks.forEach(free);
      S.masks = masks;
    }

    /* ---------------- drawing ---------------- */
    const pctx = canvas.getContext('2d');
    let needMasks = false, needBands = false, needDraw = false, mounted = true;
    const invalidate = (what) => { if (what === 'masks') needMasks = true; if (what === 'bands') needBands = true; needDraw = true; };
    const radii = (L) => { const m = S.strength / 100 * 0.045 * L * (S.style === 'bokeh' ? 1 : S.length / 50); return Array.from({ length: BANDS }, (_, k) => m * (k + 1) / BANDS); };
    const blurOpts = (maxSteps) => ({ style: S.style, angle: S.angle, cx: S.cx, cy: S.cy, maxSteps });

    function bloom(ctx, W, H, tmp, r) {
      if (S.bloom <= 0 || !S.masks) return;
      const p = Math.ceil(r) + 2;
      const pad = padded(S.image.canvas, W, H, p);
      const g = el('canvas'); g.width = W; g.height = H;
      const gx = g.getContext('2d');
      gx.filter = 'brightness(0.6) contrast(4) saturate(1.4) blur(' + Math.max(2, r * 0.8).toFixed(1) + 'px)';
      gx.drawImage(pad, -p, -p);
      gx.filter = 'none';
      free(pad);
      const tx = tmp.getContext('2d');
      tx.globalCompositeOperation = 'copy'; tx.drawImage(S.masks[1], 0, 0, W, H);
      tx.globalCompositeOperation = 'source-in'; tx.drawImage(g, 0, 0);
      tx.globalCompositeOperation = 'source-over';
      free(g);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(S.bloom / 100, 0, 1) * 0.8;
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
    }

    function sizePreview() {
      const img = S.image; if (!img) return;
      const s = Math.min(1, PREVIEW_MAX / Math.max(img.width, img.height));
      canvas.width = compare.width = Math.max(1, Math.round(img.width * s));
      canvas.height = compare.height = Math.max(1, Math.round(img.height * s));
      compare.getContext('2d').drawImage(img.canvas, 0, 0, compare.width, compare.height);
    }
    function draw() {
      if (!S.image) return;
      const W = canvas.width, H = canvas.height;
      pctx.save();
      pctx.imageSmoothingEnabled = true; pctx.imageSmoothingQuality = 'high';
      if (!S.masks) { pctx.drawImage(S.image.canvas, 0, 0, W, H); pctx.restore(); return; }
      if (needBands || S.bands.length !== BANDS + 1 || S.bands[0].width !== W) {
        S.bands.forEach(free);
        const rs = radii(Math.max(W, H));
        S.bands = [A.scaled(S.image.canvas, W, H)].concat(rs.map((r) => blurred(S.image.canvas, W, H, r, blurOpts(16))));
        needBands = false;
      }
      pctx.drawImage(S.bands[0], 0, 0);
      const tmp = el('canvas'); tmp.width = W; tmp.height = H;
      for (let k = 1; k <= BANDS; k++) layBand(pctx, tmp, S.masks[k - 1], S.bands[k], W, H);
      bloom(pctx, W, H, tmp, radii(Math.max(W, H))[BANDS - 1]);
      free(tmp);
      pctx.restore();
    }
    function loop() {
      if (!mounted) return;
      if (!S.exporting && S.image) {
        if (needMasks) { computeWeight(); needMasks = false; needDraw = true; }
        if (needDraw) { draw(); needDraw = false; }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    /* ---------------- tap to focus, drag to compare ---------------- */
    let tap = null, markerTimer = 0;
    canvas.addEventListener('pointerdown', (e) => { if (!S.depth || S.exporting) return; tap = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', (e) => {
      if (!tap) return;
      const moved = Math.hypot(e.clientX - tap.x, e.clientY - tap.y);
      tap = null;
      if (moved > 8) return;
      const r = canvas.getBoundingClientRect();
      focusAt(clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1));
    });
    canvas.addEventListener('pointercancel', () => { tap = null; });
    function focusAt(u, v) {
      if (!S.depth) return;
      setFocus(A.depth.at(S.depth, u, v, 3), true);
      S.cx = u; S.cy = v;
      if (S.style === 'zoom') invalidate('bands');
      marker.style.left = (u * 100).toFixed(2) + '%'; marker.style.top = (v * 100).toFixed(2) + '%';
      marker.classList.add('is-on');
      clearTimeout(markerTimer);
      markerTimer = setTimeout(() => marker.classList.remove('is-on'), 1400);
    }
    function setFocus(f, touched) {
      S.focus = clamp(f, 0, 1);
      if (touched) S.focusTouched = true;
      focusCtl.set(Math.round(S.focus * 100));
      invalidate('masks');
    }
    function setCompare(c) {
      S.compare = clamp(c, 0, 1);
      compare.style.clipPath = 'inset(0 ' + ((1 - S.compare) * 100).toFixed(2) + '% 0 0)';
      handle.style.left = (S.compare * 100).toFixed(2) + '%';
      handle.setAttribute('aria-valuenow', String(Math.round(S.compare * 100)));
    }
    let dragging = false;
    handle.addEventListener('pointerdown', (e) => { dragging = true; handle.setPointerCapture(e.pointerId); e.preventDefault(); });
    handle.addEventListener('pointermove', (e) => { if (!dragging) return; const r = stageWrap.getBoundingClientRect(); setCompare((e.clientX - r.left) / r.width); });
    const endDrag = () => { dragging = false; };
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
    handle.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') setCompare(S.compare - 0.05); else if (e.key === 'ArrowRight') setCompare(S.compare + 0.05); else return;
      e.preventDefault();
    });
    setCompare(0);

    /* ---------------- the subject ---------------- */
    let subjectTimer = 0, subjectToken = 0;
    function scheduleSubject() { clearTimeout(subjectTimer); subjectTimer = setTimeout(rebuildSubject, 120); }
    async function rebuildSubject() {
      if (!S.seg || !S.image) return;
      const token = ++subjectToken;
      const { mw, mh, classMap } = S.seg;
      const inKeep = new Uint8Array(256);
      for (const k of S.keep) inKeep[k] = 1;
      const bin = new Float32Array(mw * mh);
      let any = false;
      for (let i = 0; i < bin.length; i++) if (inKeep[classMap[i]]) { bin[i] = 1; any = true; }
      if (!any) { S.subjectBase = null; invalidate('masks'); return; }
      note('Refining the edges…');
      await sleep(0);
      if (token !== subjectToken) return;
      if (!S.guide) S.guide = A.guideOf(S.image, mw, mh);
      const alpha = dilate(A.refine(bin, S.guide, { softness: S.feather, shift: S.grow }), mw, mh, 2);
      if (token !== subjectToken) return;
      S.subjectBase = alpha;
      note('');
      if (!S.focusTouched && S.depth) setFocus(subjectFocus(alpha), false);
      invalidate('masks');
    }
    /* The focus a lens would choose: the near side of the subject. */
    function subjectFocus(alpha) {
      const D = S.depth; if (!D || D.data.length !== alpha.length) return S.focus;
      const hist = new Float32Array(101);
      let total = 0;
      for (let i = 0; i < alpha.length; i++) if (alpha[i] > 0.5) { hist[Math.round(D.data[i] * 100)]++; total++; }
      if (total < 20) return S.focus;
      let acc = 0;
      for (let b = 0; b <= 100; b++) { acc += hist[b]; if (acc >= total * 0.6) return b / 100; }
      return S.focus;
    }
    function nearestFocus() {
      const D = S.depth;
      const hist = new Float32Array(101);
      for (let i = 0; i < D.data.length; i++) hist[Math.round(D.data[i] * 100)]++;
      let acc = 0;
      for (let b = 100; b >= 0; b--) { acc += hist[b]; if (acc >= D.data.length * 0.1) return b / 100; }
      return 0.9;
    }
    function defaultKeep(seg) {
      const people = seg.layers.filter((l) => l.label === 'person');
      if (people.length) return new Set(people.map((l) => l.key));
      const subjects = seg.layers.filter((l) => l.subject);
      return new Set(subjects.length ? [subjects[0].key] : []);
    }

    /* ---------------- blur pane ---------------- */
    const status = el('p', 'aiimg-status', 'Choose a photo to begin.');
    const progress = el('div', 'aiimg-progress'); const bar = el('i'); progress.appendChild(bar); progress.hidden = true;
    const strengthCtl = on(range('aiimg-blur-strength', 0, 100, 1, S.strength, pct), () => { S.strength = Number(strengthCtl.input.value); invalidate('bands'); });
    const styleSel = on(select('aiimg-blur-style', STYLES, S.style), () => { S.style = styleSel.value; syncStyle(); invalidate('bands'); });
    const angleCtl = on(range('aiimg-blur-angle', -90, 90, 5, S.angle, (v) => v + '°'), () => { S.angle = Number(angleCtl.input.value); invalidate('bands'); });
    const lengthCtl = on(range('aiimg-blur-length', 10, 100, 5, S.length, pct), () => { S.length = Number(lengthCtl.input.value); invalidate('bands'); });
    const focusCtl = on(range('aiimg-blur-focus', 0, 100, 1, Math.round(S.focus * 100), (v) => v <= 15 ? 'far' : v >= 85 ? 'near' : v + '%'), () => { S.focus = Number(focusCtl.input.value) / 100; S.focusTouched = true; invalidate('masks'); });
    const dofCtl = on(range('aiimg-blur-dof', 0, 40, 1, S.dof, pct), () => { S.dof = Number(dofCtl.input.value); invalidate('masks'); });
    const falloffCtl = on(range('aiimg-blur-falloff', 0.5, 2.5, 0.1, S.falloff, (v) => v <= 0.7 ? 'quick' : v >= 1.8 ? 'gradual' : v.toFixed(1)), () => { S.falloff = Number(falloffCtl.input.value); invalidate('masks'); });
    const bloomCtl = on(range('aiimg-blur-bloom', 0, 100, 5, S.bloom, pct), () => { S.bloom = Number(bloomCtl.input.value); invalidate(); });
    const angleField = field('Streak angle', angleCtl), lengthField = field('Streak length', lengthCtl, 'Relative to the strength.');
    function syncStyle() { angleField.hidden = S.style !== 'motion'; lengthField.hidden = S.style === 'bokeh'; }
    syncStyle();
    const h = (t) => el('p', 'aiimg-h', t);
    const grid = (...fields) => { const g = el('div', 'aiimg-grid2'); g.append(...fields); return g; };
    panes.blur.append(status, progress,
      field('Strength', strengthCtl, 'The most blur, reached by the farthest things.'),
      field('Style', styleSel), angleField, lengthField,
      h('Focus'),
      field('Focus distance', focusCtl, 'Tap the picture to set it. Things at this depth are sharp.'),
      grid(field('Depth of field', dofCtl), field('Falloff', falloffCtl)),
      h('Finish'),
      field('Highlight bloom', bloomCtl, 'A soft glow on bright points in the blurred areas, like a lens.'));

    /* ---------------- keep-sharp pane ---------------- */
    const layerList = el('div', 'aiimg-layers');
    const layersHint = el('p', 'field-hint', 'Ticked layers stay sharp. People are ticked when the model finds any; tick a car, an animal or a product instead to make it the subject. A ticked thing far behind the focus — a passer-by across the street — is treated as background, so the cut cannot drag far pixels into the sharp zone.');
    const featherCtl = on(range('aiimg-blur-feather', 0, 10, 1, S.feather), () => { S.feather = Number(featherCtl.input.value); scheduleSubject(); });
    const growCtl = on(range('aiimg-blur-grow', -5, 5, 1, S.grow, (v) => (v > 0 ? '+' : '') + v), () => { S.grow = Number(growCtl.input.value); scheduleSubject(); });
    panes.subject.append(layerList, layersHint,
      field('Edge feather', featherCtl, 'Higher follows hair and fur more loosely; lower keeps a crisp cut.'),
      field('Grow or shrink the cut', growCtl, 'Grow it if blur creeps into the subject; shrink it if a halo of sharp background clings to the edge.'));
    function renderLayers() {
      layerList.innerHTML = '';
      if (!S.seg) return;
      for (const L of S.seg.layers) {
        const row = el('label', 'aiimg-layer');
        const cb = el('input'); cb.type = 'checkbox'; cb.checked = S.keep.has(L.key);
        cb.addEventListener('change', () => { if (cb.checked) S.keep.add(L.key); else S.keep.delete(L.key); scheduleSubject(); });
        const sw = el('span', 'aiimg-swatch'); sw.style.background = L.colour;
        const name = el('span', 'aiimg-lname', L.name);
        const area = el('span', 'aiimg-area', (L.area * 100).toFixed(L.area < 0.1 ? 1 : 0) + '%');
        row.append(cb, sw, name, area);
        layerList.appendChild(row);
      }
    }

    /* ---------------- analysis ---------------- */
    let runToken = 0;
    async function analyse() {
      const img = S.image; if (!img) return;
      const token = ++runToken;
      progress.hidden = false; bar.style.width = '0%';
      status.textContent = 'Preparing the depth model…';
      note('Estimating depth…');
      try {
        const t0 = performance.now();
        const depth = await A.depth.estimate(img, { onProgress: (p) => {
          if (token !== runToken) return;
          if (p.stage === 'download') {
            status.textContent = 'Downloading the depth model once' + (p.total ? ' — ' + fmtBytes(p.loaded) + ' of ' + fmtBytes(p.total) : '') + '. Your browser keeps it for next time.';
            bar.style.width = Math.round(p.fraction * 40) + '%';
          } else if (p.stage === 'run') {
            status.textContent = 'Estimating depth on your device…';
            bar.style.width = Math.round(40 + p.fraction * 30) + '%';
          }
        } });
        if (token !== runToken) return;
        S.depth = depth; S.timing.depth = performance.now() - t0; S.timing.model = depth.ms;
        setFocus(nearestFocus(), false);
        invalidate('bands');
        status.textContent = 'Depth ready — finding the layers…';
        note('Finding the layers…');
        const t1 = performance.now();
        const seg = await A.segment(img, { detail: 'standard', onProgress: (p) => {
          if (token !== runToken) return;
          if (p.stage === 'download') {
            status.textContent = 'Downloading the segmentation model once' + (p.total ? ' — ' + fmtBytes(p.loaded) + ' of ' + fmtBytes(p.total) : '') + '.';
            bar.style.width = Math.round(70 + p.fraction * 15) + '%';
          } else if (p.stage === 'run') { status.textContent = 'Finding the layers on your device…'; bar.style.width = Math.round(85 + p.fraction * 15) + '%'; }
        } });
        if (token !== runToken) return;
        if (seg.mw !== depth.w || seg.mh !== depth.h) {
          S.depth = await A.depth.estimate(img, { mw: seg.mw, mh: seg.mh });
          if (token !== runToken) return;
        }
        S.seg = seg; S.timing.seg = performance.now() - t1; S.guide = null;
        S.keep = defaultKeep(seg);
        renderLayers();
        await rebuildSubject();
        if (token !== runToken) return;
        const kept = seg.layers.filter((l) => S.keep.has(l.key)).map((l) => l.name);
        status.textContent = (kept.length ? kept.join(', ') + ' kept sharp. ' : 'No people or objects found to keep sharp; tick a layer if the wrong thing blurs. ') + 'Depth and ' + seg.layers.length + ' layers ready';
        say('');
      } catch (e) {
        if (token !== runToken) return;
        status.textContent = S.depth ? 'The layers could not be found; depth ready' : 'Depth could not be estimated.';
        say((e && e.message) || String(e), 'error');
      } finally {
        if (token === runToken) { progress.hidden = true; note(''); }
      }
    }

    /* ---------------- loading ---------------- */
    async function loadFiles(files) {
      const f = files && files[0]; if (!f) return;
      try {
        say(''); note('Reading the photo…');
        const img = await A.loadImageFile(f);
        runToken++; subjectToken++;
        S.bands.forEach(free); S.bands = [];
        if (S.masks) S.masks.forEach(free);
        S.image = img; S.depth = null; S.seg = null; S.guide = null; S.subjectBase = null; S.weight = null; S.masks = null; S.keep = new Set();
        S.focusTouched = false; S.cx = 0.5; S.cy = 0.5;
        sizePreview();
        setCompare(0);
        studio.hidden = false; drop.hidden = true;
        layerList.innerHTML = '';
        results.innerHTML = '';
        invalidate();
        showPane('blur');
        analyse();
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

    /* ---------------- export ---------------- */
    const stillFmt = on(select('aiimg-blur-still-fmt', [['image/png', 'PNG'], ['image/jpeg', 'JPEG']], 'image/png'), () => { qualityField.hidden = stillFmt.value === 'image/png'; });
    const stillSize = select('aiimg-blur-still-size', [['0', 'Original size'], ['2048', 'Up to 2048 px'], ['1080', 'Up to 1080 px'], ['720', 'Up to 720 px']], '0');
    const quality = range('aiimg-blur-quality', 50, 100, 1, 92, pct);
    const qualityField = field('Quality', quality); qualityField.hidden = true;
    const stillBtn = button('Download the image', 'btn-primary', exportStill);
    const clipFmt = on(select('aiimg-blur-clip-fmt', [['mp4', 'MP4 video (H.264)'], ['gif', 'Animated GIF']], 'mp4'), () => { syncClipOptions(); });
    const clipSize = select('aiimg-blur-clip-size', [], '1080');
    const clipBtn = button('Export the before-and-after clip', 'btn-primary', exportClip);
    const cancelBtn = button('Cancel', 'btn-ghost', () => { if (S.job) S.job.abort(); }); cancelBtn.hidden = true;
    const clipProgress = el('div', 'aiimg-progress'); const clipBar = el('i'); clipProgress.appendChild(clipBar); clipProgress.hidden = true;
    const clipStatus = el('p', 'aiimg-status', ''); clipStatus.hidden = true;
    const results = el('div', 'aiimg-results');
    const clipRow = el('div', 'aiimg-row'); clipRow.append(clipBtn, cancelBtn);
    function fillSelect(sel, options, value) { sel.innerHTML = ''; for (const [v, l] of options) { const op = el('option', null, l); op.value = v; sel.appendChild(op); } sel.value = options.some((o) => String(o[0]) === String(value)) ? value : options[0][0]; }
    function syncClipOptions() {
      const gif = clipFmt.value === 'gif';
      fillSelect(clipSize, gif ? [['480', '480 px'], ['640', '640 px'], ['800', '800 px']] : [['720', '720 px'], ['1080', '1080 px (Full HD)'], ['1440', '1440 px'], ['1920', '1920 px']], gif ? '640' : '1080');
    }
    syncClipOptions();
    panes.export.append(
      h('Still image'),
      grid(field('Format', stillFmt), field('Size', stillSize)), qualityField,
      el('p', 'field-hint', 'Rendered again at the chosen size, so the blur is as fine at full resolution as on the preview.'),
      (() => { const r = el('div', 'aiimg-row'); r.append(stillBtn); return r; })(),
      h('Before-and-after clip'),
      grid(field('Format', clipFmt), field('Long edge', clipSize)),
      el('p', 'field-hint', 'Four seconds: a divider wipes from the original to the result and back, so it loops. MP4 needs a browser with on-device video encoding (Chrome, Edge, Safari 16.4+); elsewhere the clip is recorded as WebM.'),
      clipRow, clipProgress, clipStatus, results
    );

    const outName = (suffix, ext) => (S.image ? S.image.name : 'image') + '-' + suffix + '.' + ext;
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

    /** The finished picture at W×H, built one band at a time so a 4,096 px export never holds six copies at once. */
    async function renderAt(W, H, signal) {
      const out = el('canvas'); out.width = W; out.height = H;
      const ctx = out.getContext('2d');
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(S.image.canvas, 0, 0, W, H);
      if (!S.masks) return out;
      const rs = radii(Math.max(W, H));
      const o = blurOpts(24);
      const tmp = el('canvas'); tmp.width = W; tmp.height = H;
      for (let k = 1; k <= BANDS; k++) {
        if (signal && signal.aborted) { free(tmp); free(out); const e = new Error('Cancelled.'); e.name = 'AbortError'; throw e; }
        const b = blurred(S.image.canvas, W, H, rs[k - 1], o);
        layBand(ctx, tmp, S.masks[k - 1], b, W, H);
        free(b);
        await sleep(0);
      }
      bloom(ctx, W, H, tmp, rs[BANDS - 1]);
      free(tmp);
      return out;
    }

    async function exportStill() {
      if (!S.image || S.exporting) return;
      try {
        S.exporting = true;
        note('Rendering at full size…');
        const fmt = stillFmt.value;
        const { width, height } = sizeFor(stillSize.value);
        const c = await renderAt(width, height);
        const blob = await new Promise((res) => c.toBlob(res, fmt, Number(quality.input.value) / 100));
        free(c);
        if (!blob) throw new Error('This browser could not encode that format. Try PNG.');
        const ext = fmt === 'image/png' ? 'png' : 'jpg';
        const name = outName('blur-background', ext);
        addResult(blob, name, null, width + '×' + height);
        A.download(blob, name);
        say('');
      } catch (e) { say((e && e.message) || String(e), 'error'); }
      finally { S.exporting = false; note(''); invalidate(); }
    }

    /** Frame t of the wipe: original on the left of the divider, result on the right; the divider sweeps across and back. */
    function clipRenderer(res, orig) {
      return (ctx, W, H, t) => {
        const p = ((t % CLIP_SECONDS) + CLIP_SECONDS) % CLIP_SECONDS / CLIP_SECONDS;
        const c = 0.5 + 0.5 * Math.cos(2 * Math.PI * p);
        const x = Math.round(c * W);
        ctx.save();
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(res, 0, 0, W, H);
        if (x > 0) {
          ctx.save(); ctx.beginPath(); ctx.rect(0, 0, x, H); ctx.clip();
          ctx.drawImage(orig, 0, 0, W, H);
          ctx.restore();
        }
        const lw = Math.max(2, Math.round(W / 500));
        ctx.fillStyle = 'rgba(255,255,255,.95)';
        ctx.fillRect(x - lw / 2, 0, lw, H);
        const r = Math.max(8, Math.round(Math.min(W, H) * 0.028));
        ctx.beginPath(); ctx.arc(x, H / 2, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.font = 'bold ' + Math.round(r * 1.1) + 'px "Inter", Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('◀ ▶', x, H / 2 + r * 0.05);
        const fs = Math.max(11, Math.round(Math.min(W, H) * 0.034));
        ctx.font = '600 ' + fs + 'px "Inter", Arial, sans-serif';
        ctx.textBaseline = 'top';
        const label = (text, lx, align) => {
          ctx.textAlign = align;
          const tw = ctx.measureText(text).width;
          const bx = align === 'left' ? lx - fs * 0.5 : lx - tw - fs * 0.5;
          ctx.fillStyle = 'rgba(0,0,0,.55)';
          ctx.fillRect(bx, fs * 0.8, tw + fs, fs * 1.6);
          ctx.fillStyle = '#fff';
          ctx.fillText(text, lx, fs * 1.1);
        };
        if (x > W * 0.22) label('Before', fs, 'left');
        if (x < W * 0.78) label('After', W - fs, 'right');
        ctx.restore();
      };
    }

    async function exportClip() {
      if (!S.image || S.job) return;
      const gif = clipFmt.value === 'gif';
      const { width, height } = sizeFor(clipSize.value);
      const fps = gif ? 15 : 30;
      S.job = new AbortController();
      S.exporting = true;
      clipBtn.disabled = true; cancelBtn.hidden = false; clipProgress.hidden = false; clipStatus.hidden = false; clipBar.style.width = '0%';
      clipStatus.textContent = 'Rendering the blur at ' + width + '×' + height + '…';
      const started = performance.now();
      const onProgress = (f) => {
        clipBar.style.width = Math.round(f * 100) + '%';
        const spent = (performance.now() - started) / 1000;
        clipStatus.textContent = (gif ? 'Encoding the GIF' : 'Encoding the video') + ' — ' + Math.round(f * 100) + '%' + (f > 0.05 && f < 1 ? ', about ' + Math.max(1, Math.round(spent / f - spent)) + ' s left' : '') + '.';
      };
      let res = null, orig = null;
      try {
        res = await renderAt(width, height, S.job.signal);
        orig = A.scaled(S.image.canvas, width, height);
        const render = clipRenderer(res, orig);
        const o = { width, height, fps, duration: CLIP_SECONDS, onProgress, signal: S.job.signal };
        const tE = performance.now();
        let blob, ext, noteText;
        if (gif) { blob = await A.encodeGIF(render, o); ext = 'gif'; }
        else { const r = await A.encodeVideo(render, o); blob = r.blob; ext = r.ext; noteText = r.note; }
        S.timing.encode = performance.now() - tE;
        const name = outName('before-after', ext);
        addResult(blob, name, (gif ? 'GIF' : (ext === 'mp4' ? 'MP4' : 'WebM')) + ' · ' + CLIP_SECONDS + ' s · ' + fps + ' fps', width + '×' + height);
        A.download(blob, name);
        clipStatus.textContent = 'Done in ' + ((performance.now() - started) / 1000).toFixed(1) + ' s.';
        if (noteText && /WebM/.test(noteText)) say(noteText, 'warn'); else say('');
      } catch (e) {
        if (e && e.name === 'AbortError') clipStatus.textContent = 'Cancelled.';
        else { clipStatus.textContent = 'The export failed.'; say((e && e.message) || String(e), 'error'); }
      } finally {
        free(res); free(orig);
        S.job = null; S.exporting = false;
        clipBtn.disabled = false; cancelBtn.hidden = true; clipProgress.hidden = true;
        invalidate();
      }
    }

    /* ---------------- go ---------------- */
    showPane('blur');
    const inst = { state: S, renderAt, loadFiles, focusAt, setCompare, destroy: () => { mounted = false; } };
    A.tools['blur-background'].instance = inst;
    return inst;
  }

  A.tools['blur-background'] = { mount };
})();
