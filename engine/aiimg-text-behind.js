/**
 * Text Behind Image.
 *
 * The picture is split into layers on the device; any layer can sit in
 * front of the text. Text layers carry their own style and motion, and one
 * function draws the frame whether it is the live preview, a still or a
 * frame of a clip, so what is exported is what was seen.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A) return;
  const { el, clamp, field, select, range, colour, check, button, sleep, fmtBytes } = A;

  const FONTS = ['Sora', 'Inter', 'Impact', 'Arial Black', 'Arial', 'Helvetica Neue', 'Verdana', 'Trebuchet MS',
    'Segoe UI', 'Georgia', 'Times New Roman', 'Garamond', 'Palatino Linotype', 'Courier New', 'Brush Script MT',
    'Comic Sans MS', 'system-ui'];
  const WEIGHTS = [[400, 'Regular'], [500, 'Medium'], [600, 'Semi-bold'], [700, 'Bold'], [800, 'Extra bold'], [900, 'Black']];
  const ANIMS = [['none', 'None — a still'], ['scroll', 'Scroll across'], ['wave', 'Wave'], ['wave-scroll', 'Wave and scroll'],
    ['slide', 'Slide in, hold, slide out'], ['zoom', 'Zoom in'], ['typewriter', 'Typewriter'], ['bounce', 'Bounce'],
    ['pulse', 'Pulse'], ['fade', 'Fade in and out'], ['float', 'Float'], ['spin', 'Spin']];
  const DIRS = [['left', '← to the left'], ['right', '→ to the right'], ['up', '↑ upwards'], ['down', '↓ downwards'],
    ['up-left', '↖ up and left'], ['up-right', '↗ up and right'], ['down-left', '↙ down and left'], ['down-right', '↘ down and right']];
  const BLENDS = [['source-over', 'Normal'], ['overlay', 'Overlay'], ['screen', 'Screen'], ['multiply', 'Multiply'],
    ['soft-light', 'Soft light'], ['difference', 'Difference'], ['lighter', 'Add']];
  const DIRECTIONAL = new Set(['scroll', 'wave-scroll', 'slide']);
  const CYCLIC = new Set(['scroll', 'wave', 'wave-scroll', 'bounce', 'pulse', 'fade', 'float', 'spin']);
  const WAVY = new Set(['wave', 'wave-scroll']);
  const AMPLITUDE = new Set(['wave', 'wave-scroll', 'bounce', 'pulse', 'float']);
  const PREVIEW_MAX = 1280;

  let seq = 0;
  function newText(partial) {
    return Object.assign({
      id: 'text-' + (++seq), text: 'YOUR TEXT', font: 'Sora', weight: 800, italic: false, uppercase: true,
      size: 20, letterSpacing: 0.02, lineHeight: 1.05, align: 'center', x: 0.5, y: 0.4, rotation: 0, opacity: 1,
      fillMode: 'solid', fill: '#ffffff', fill2: '#f7c948', gradientAngle: 90,
      strokeWidth: 0, stroke: '#000000', shadowBlur: 0, shadowX: 0, shadowY: 0, shadowColor: '#000000', shadowOpacity: 0.6,
      glow: 0, blend: 'source-over', depth: 'behind',
      anim: { type: 'none', direction: 'left', speed: 1, amplitude: 0.5, waves: 1.5 }
    }, partial || {});
  }
  const pct = (v) => Math.round(v) + '%';
  const on = (ctrl, fn) => { const t = ctrl.input || ctrl; t.addEventListener('input', fn); t.addEventListener('change', fn); return ctrl; };

  /* The looks: six styles a chip or a ?preset= link applies to the selected
     text. Each sets colour, outline, shadow, glow and — for two — motion. */
  const LOOKS = [
    { id: 'neon-sunset', label: 'Neon sunset', swatch: 'linear-gradient(90deg, #ff3cac, #ffb347)',
      apply: (L) => { Object.assign(L, { fillMode: 'gradient', fill: '#ff3cac', fill2: '#ffb347', gradientAngle: 90, strokeWidth: 0, glow: 22, shadowBlur: 0, shadowX: 0, shadowY: 0, font: 'Sora', weight: 800, italic: false, blend: 'source-over', opacity: 1 }); } },
    { id: 'bold-white', label: 'Bold white', swatch: '#ffffff',
      apply: (L) => { Object.assign(L, { fillMode: 'solid', fill: '#ffffff', strokeWidth: 0, glow: 0, shadowBlur: 16, shadowX: 0, shadowY: 2, shadowColor: '#000000', shadowOpacity: 0.55, font: 'Sora', weight: 900, italic: false, blend: 'source-over', opacity: 1 }); } },
    { id: 'outline-black', label: 'Outline', swatch: 'linear-gradient(135deg, #ffffff 50%, #000000 50%)',
      apply: (L) => { Object.assign(L, { fillMode: 'solid', fill: '#ffffff', strokeWidth: 4, stroke: '#000000', glow: 0, shadowBlur: 0, shadowX: 0, shadowY: 0, font: 'Sora', weight: 800, italic: false, blend: 'source-over', opacity: 1 }); } },
    { id: 'gold-headline', label: 'Gold headline', swatch: 'linear-gradient(180deg, #fff3c4, #f7c948)',
      apply: (L) => { Object.assign(L, { fillMode: 'gradient', fill: '#fff3c4', fill2: '#f7c948', gradientAngle: 180, strokeWidth: 1, stroke: '#5a3d00', glow: 0, shadowBlur: 10, shadowX: 0, shadowY: 3, shadowColor: '#000000', shadowOpacity: 0.5, font: 'Sora', weight: 800, italic: false, letterSpacing: 0.06, blend: 'source-over', opacity: 1 }); } },
    { id: 'typewriter', label: 'Typewriter', swatch: '#d9dde8',
      apply: (L) => { Object.assign(L, { fillMode: 'solid', fill: '#ffffff', font: 'Courier New', weight: 700, italic: false, strokeWidth: 0, glow: 0, shadowBlur: 8, shadowX: 0, shadowY: 0, shadowOpacity: 0.6, uppercase: false, letterSpacing: 0.04, blend: 'source-over', opacity: 1 }); L.anim.type = 'typewriter'; } },
    { id: 'wave', label: 'Wave', swatch: 'linear-gradient(90deg, #7cf7ff, #3b7bff)',
      apply: (L) => { Object.assign(L, { fillMode: 'gradient', fill: '#7cf7ff', fill2: '#3b7bff', gradientAngle: 0, strokeWidth: 0, glow: 14, shadowBlur: 0, shadowX: 0, shadowY: 0, font: 'Sora', weight: 800, italic: false, blend: 'source-over', opacity: 1 }); Object.assign(L.anim, { type: 'wave', amplitude: 0.6, waves: 1.5, speed: 2 }); } }
  ];

  function mount(root) {
    const share = A.share || null;
    let presets = null;
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const S = {
      image: null, seg: null, guide: null, front: new Set(), edits: null, baseAlpha: null, frontCanvas: null, tint: null,
      softness: 3, shift: 0, texts: [newText()], sel: 0, duration: 6, t: 0, playing: false, t0: 0,
      detail: 'standard', brush: { on: false, mode: 'add', size: 30 }, undo: [], showLayers: false, exporting: false, job: null
    };

    /* ---------------- skeleton ---------------- */
    const wrap = el('div', 'aiimg');
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose a photo</strong><span>or drag it here — nothing is uploaded. JPEG, PNG, WebP or HEIC.</span>';
    const file = el('input', 'visually-hidden');
    file.type = 'file'; file.accept = 'image/*'; file.setAttribute('aria-label', 'Choose a photo');
    const fontFile = el('input', 'visually-hidden');
    fontFile.type = 'file'; fontFile.accept = '.ttf,.otf,.woff,.woff2,font/*'; fontFile.setAttribute('aria-label', 'Choose a font file');

    const studio = el('div', 'aiimg-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage');
    const canvas = el('canvas', 'aiimg-canvas');
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Preview. Drag the selected text to move it; arrow keys nudge it.');
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
    for (const [k, label] of [['layers', 'Layers'], ['text', 'Text'], ['motion', 'Motion'], ['export', 'Export']]) {
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
    wrap.append(drop, file, fontFile, studio, msg);
    io.appendChild(wrap);

    function showPane(k) {
      for (const b of tabs.children) { const onIt = b.dataset.pane === k; b.classList.toggle('is-on', onIt); b.setAttribute('aria-selected', onIt ? 'true' : 'false'); }
      for (const p in panes) panes[p].hidden = p !== k;
    }
    function say(text, kind) { msg.textContent = text || ''; msg.className = 'io-msg' + (kind ? ' is-' + kind : ''); }
    function note(text) { stageMsg.textContent = text || ''; stageMsg.hidden = !text; }

    /* ---------------- drawing ---------------- */
    const pctx = canvas.getContext('2d');
    let dirty = true;
    const invalidate = () => { dirty = true; };
    function sizePreview() {
      const img = S.image; if (!img) return;
      const s = Math.min(1, PREVIEW_MAX / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * s));
      canvas.height = Math.max(1, Math.round(img.height * s));
    }
    /** The frame: picture, text behind, the cut-out, text in front. */
    function renderFrame(ctx, W, H, t) {
      ctx.save();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(S.image.canvas, 0, 0, W, H);
      for (const L of S.texts) if (L.depth === 'behind') A.drawText(ctx, L, t, W, H, S.duration);
      if (S.frontCanvas) ctx.drawImage(S.frontCanvas, 0, 0, W, H);
      for (const L of S.texts) if (L.depth !== 'behind') A.drawText(ctx, L, t, W, H, S.duration);
      ctx.restore();
    }
    /** A frame of a clip: the frame, then the corner credit if the reader asked for it. */
    function renderClip(ctx, W, H, t) {
      renderFrame(ctx, W, H, t);
      if (share) share.drawCredit(ctx, W, H);
    }
    function tintCanvas() {
      if (S.tint) return S.tint;
      const { mw, mh, classMap, layers } = S.seg;
      const rgb = {};
      for (const L of layers) rgb[L.key] = L.rgb;
      const id = new ImageData(mw, mh);
      const d = id.data;
      for (let i = 0, j = 0; i < classMap.length; i++, j += 4) {
        const c = rgb[classMap[i]] || [255, 255, 255];
        d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 120;
      }
      const c = el('canvas'); c.width = mw; c.height = mh;
      c.getContext('2d').putImageData(id, 0, 0);
      S.tint = c;
      return c;
    }
    function draw() {
      if (!S.image) return;
      renderFrame(pctx, canvas.width, canvas.height, S.t);
      if (S.showLayers && S.seg) { pctx.save(); pctx.imageSmoothingEnabled = false; pctx.drawImage(tintCanvas(), 0, 0, canvas.width, canvas.height); pctx.restore(); }
      const L = S.texts[S.sel];
      if (L && !S.exporting && !S.brush.on) {
        const box = A.textBox(pctx, L, S.t, canvas.width, canvas.height, S.duration);
        pctx.save();
        pctx.setLineDash([6, 5]); pctx.lineWidth = 1.5; pctx.strokeStyle = 'rgba(247,201,72,.9)';
        pctx.beginPath(); box.pts.forEach((p, i) => i ? pctx.lineTo(p[0], p[1]) : pctx.moveTo(p[0], p[1])); pctx.closePath(); pctx.stroke();
        pctx.restore();
      }
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

    /* ---------------- pointer: move text, or paint ---------------- */
    let drag = null;
    const toCanvas = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * canvas.width, y: (e.clientY - r.top) / r.height * canvas.height }; };
    canvas.addEventListener('pointerdown', (e) => {
      if (!S.image || S.exporting) return;
      const p = toCanvas(e);
      if (S.brush.on) {
        if (!S.seg) return;
        pushUndo();
        paintAt(p.x, p.y);
        drag = { brush: true, last: p };
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
      const order = [S.sel].concat(S.texts.map((_, i) => i).filter((i) => i !== S.sel));
      for (const i of order) {
        if (!S.texts[i]) continue;
        const box = A.textBox(pctx, S.texts[i], S.t, canvas.width, canvas.height, S.duration);
        if (!A.pointInBox(box, p.x, p.y)) continue;
        if (i !== S.sel) { S.sel = i; refreshTextUI(); }
        const L = S.texts[i];
        drag = { dx: p.x - L.x * canvas.width, dy: p.y - L.y * canvas.height };
        canvas.setPointerCapture(e.pointerId);
        canvas.focus({ preventScroll: true });
        e.preventDefault();
        break;
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = toCanvas(e);
      if (drag.brush) { paintLine(drag.last, p); drag.last = p; return; }
      const L = S.texts[S.sel]; if (!L) return;
      L.x = clamp((p.x - drag.dx) / canvas.width, -0.5, 1.5);
      L.y = clamp((p.y - drag.dy) / canvas.height, -0.5, 1.5);
      posX.set(Math.round(L.x * 100)); posY.set(Math.round(L.y * 100));
      invalidate();
    });
    const endDrag = () => { if (!drag) return; const wasBrush = drag.brush; drag = null; if (wasBrush) composeFront(); };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('keydown', (e) => {
      const L = S.texts[S.sel]; if (!L) return;
      const step = e.shiftKey ? 0.02 : 0.005;
      if (e.key === 'ArrowLeft') L.x -= step; else if (e.key === 'ArrowRight') L.x += step;
      else if (e.key === 'ArrowUp') L.y -= step; else if (e.key === 'ArrowDown') L.y += step;
      else return;
      e.preventDefault();
      posX.set(Math.round(L.x * 100)); posY.set(Math.round(L.y * 100));
      invalidate();
    });

    /* ---------------- brush ---------------- */
    function pushUndo() {
      if (!S.seg) return;
      const { mw, mh } = S.seg;
      if (!S.edits) S.edits = new Float32Array(mw * mh);
      S.undo.push(new Float32Array(S.edits));
      if (S.undo.length > 20) S.undo.shift();
    }
    let paintTick = 0;
    function paintAt(x, y) {
      const { mw, mh } = S.seg;
      const sx = mw / canvas.width;
      const mx = x * sx, my = y * sx;
      const r = Math.max(1.5, S.brush.size * sx / 2);
      const add = S.brush.mode === 'add';
      const E = S.edits;
      const x0 = Math.max(0, Math.floor(mx - r)), x1 = Math.min(mw - 1, Math.ceil(mx + r));
      const y0 = Math.max(0, Math.floor(my - r)), y1 = Math.min(mh - 1, Math.ceil(my + r));
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          const d = Math.hypot(xx - mx, yy - my) / r;
          if (d >= 1) continue;
          const v = 1 - d * d;
          const i = yy * mw + xx;
          E[i] = add ? Math.max(E[i], v) : Math.min(E[i], -v);
        }
      }
      if ((++paintTick & 1) === 0) composeFront();
    }
    function paintLine(a, b) {
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const step = Math.max(2, S.brush.size / 4);
      const n = Math.max(1, Math.ceil(dist / step));
      for (let i = 1; i <= n; i++) paintAt(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n);
    }

    /* ---------------- the cut-out ---------------- */
    let frontTimer = 0, frontToken = 0;
    function scheduleFront() { clearTimeout(frontTimer); frontTimer = setTimeout(rebuildFront, 120); }
    async function rebuildFront() {
      if (!S.seg || !S.image) return;
      const token = ++frontToken;
      const { mw, mh, classMap } = S.seg;
      const inFront = new Uint8Array(256);
      for (const k of S.front) inFront[k] = 1;
      const bin = new Float32Array(mw * mh);
      let any = false;
      for (let i = 0; i < bin.length; i++) if (inFront[classMap[i]]) { bin[i] = 1; any = true; }
      if (!any) S.baseAlpha = bin;
      else {
        note('Refining the edges…');
        await sleep(0);
        if (token !== frontToken) return;
        if (!S.guide) S.guide = A.guideOf(S.image, mw, mh);
        S.baseAlpha = A.refine(bin, S.guide, { softness: S.softness, shift: S.shift });
        if (token !== frontToken) return;
        note('');
      }
      composeFront();
    }
    function composeFront() {
      if (!S.seg || !S.baseAlpha) return;
      const { mw, mh } = S.seg;
      let alpha = S.baseAlpha;
      if (S.edits) {
        alpha = new Float32Array(alpha.length);
        for (let i = 0; i < alpha.length; i++) alpha[i] = clamp(S.baseAlpha[i] + S.edits[i], 0, 1);
      }
      let any = false;
      for (let i = 0; i < alpha.length; i++) if (alpha[i] > 0.004) { any = true; break; }
      S.frontCanvas = any ? A.cutOut(S.image, alpha, mw, mh) : null;
      S.currentAlpha = any ? alpha : null;
      invalidate();
    }

    /* ---------------- layers pane ---------------- */
    const status = el('p', 'aiimg-status', 'Choose a photo to begin.');
    const progress = el('div', 'aiimg-progress'); const bar = el('i'); progress.appendChild(bar); progress.hidden = true;
    const layerList = el('div', 'aiimg-layers');
    const layersHint = el('p', 'field-hint', 'Ticked layers sit in front of the text. Untick to send a layer behind it; tick the sky or a building to bring it forward.');
    const soft = on(range('aiimg-soft', 0, 10, 1, S.softness), () => { S.softness = Number(soft.input.value); scheduleFront(); });
    const shiftCtl = on(range('aiimg-shift', -5, 5, 1, S.shift, (v) => (v > 0 ? '+' : '') + v), () => { S.shift = Number(shiftCtl.input.value); scheduleFront(); });
    const detailSel = on(select('aiimg-detail', Object.entries(A.DETAIL).map(([k, m]) => [k, m.label]), S.detail), () => { if (detailSel.value !== S.detail) { S.detail = detailSel.value; runSegmentation(); } });
    const showTint = on(check('aiimg-tint', 'Colour the layers on the preview', false), () => { S.showLayers = showTint.input.checked; invalidate(); });
    const brushBox = el('details', 'aiimg-brush');
    const brushSum = el('summary', null, 'Fix the cut-out by hand');
    const brushMode = on(select('aiimg-brush-mode', [['add', 'Paint: bring in front of the text'], ['erase', 'Paint: send behind the text']], 'add'), () => { S.brush.mode = brushMode.value; });
    const brushSize = on(range('aiimg-brush-size', 6, 120, 2, S.brush.size, (v) => v + ' px'), () => { S.brush.size = Number(brushSize.input.value); });
    const undoBtn = button('Undo', 'btn-ghost', () => { if (!S.undo.length) return; S.edits = S.undo.pop(); composeFront(); });
    const clearBtn = button('Clear my edits', 'btn-ghost', () => { if (!S.edits) return; pushUndo(); S.edits = null; S.undo = []; composeFront(); });
    const brushRow = el('div', 'aiimg-row'); brushRow.append(undoBtn, clearBtn);
    brushBox.append(brushSum, el('p', 'field-hint', 'While this is open, drawing on the preview paints instead of moving text. Use it where the model missed a hand or caught a bit of wall.'), field('Brush', brushMode), field('Brush size', brushSize), brushRow);
    brushBox.addEventListener('toggle', () => { S.brush.on = brushBox.open; canvas.classList.toggle('is-brush', S.brush.on); invalidate(); });
    panes.layers.append(status, progress, layerList, layersHint,
      field('Edge softness', soft, 'Higher follows hair and fur more loosely; lower keeps a crisp cut.'),
      field('Grow or shrink the cut', shiftCtl, 'Grow it to hide a halo of background around the subject; shrink it if the text is being clipped by a fringe.'),
      field('Detail', detailSel, 'Standard is right for most photos. High and Maximum look at the picture at a higher resolution, which is sharper on small parts and thin edges and takes longer. The download is the same.'),
      showTint, brushBox);

    function renderLayers() {
      layerList.innerHTML = '';
      if (!S.seg) return;
      for (const L of S.seg.layers) {
        const row = el('label', 'aiimg-layer');
        const cb = el('input'); cb.type = 'checkbox'; cb.checked = S.front.has(L.key);
        cb.addEventListener('change', () => { if (cb.checked) S.front.add(L.key); else S.front.delete(L.key); scheduleFront(); });
        const sw = el('span', 'aiimg-swatch'); sw.style.background = L.colour;
        const name = el('span', 'aiimg-lname', L.name);
        const area = el('span', 'aiimg-area', (L.area * 100).toFixed(L.area < 0.1 ? 1 : 0) + '%');
        row.append(cb, sw, name, area);
        layerList.appendChild(row);
      }
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
          } else if (p.stage === 'compile') {
            status.textContent = 'Preparing the model on your device…';
            bar.style.width = '60%';
          } else if (p.stage === 'run') {
            status.textContent = 'Finding the layers on your device…';
            bar.style.width = Math.round(60 + p.fraction * 40) + '%';
          }
        } });
        if (token !== segToken) return;
        S.seg = seg; S.guide = null; S.edits = null; S.undo = []; S.tint = null; S.baseAlpha = null;
        S.front = new Set(seg.layers.filter((l) => l.subject).map((l) => l.key));
        renderLayers();
        const subjects = seg.layers.filter((l) => l.subject).map((l) => l.name);
        status.textContent = seg.layers.length + ' layer' + (seg.layers.length === 1 ? '' : 's') + ' found' +
          (subjects.length ? '. In front of the text: ' + subjects.slice(0, 4).join(', ') + (subjects.length > 4 ? '…' : '') + '.' : '.');
        if (!subjects.length) say('No people or objects were found to put the text behind, so for now it sits on top. Tick any layer to bring that layer in front of the text.', 'note');
        else say('');
        await rebuildFront();
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
        say(''); note('Reading the photo…');
        const img = await A.loadImageFile(f);
        segToken++;
        S.image = img; S.seg = null; S.guide = null; S.frontCanvas = null; S.baseAlpha = null; S.edits = null; S.undo = []; S.front = new Set(); S.tint = null; S.currentAlpha = null;
        sizePreview();
        studio.hidden = false; drop.hidden = true;
        layerList.innerHTML = '';
        results.innerHTML = '';
        invalidate();
        await Promise.all(S.texts.map(A.ensureFont));
        /* the starter text should fit the frame whatever the photo's shape */
        for (const L of S.texts) if (!L.touched) fitToFrame(L);
        refreshTextUI();
        invalidate();
        showPane('layers');
        /* a ?preset= link applies its look once the picture is here */
        if (presets) presets.applyFromUrl();
        runSegmentation();
      } catch (e) {
        note('');
        say((e && e.message) || String(e), 'error');
      }
    }
    /** Shrink a text layer until its block spans at most 88% of the width and 60% of the height. */
    function fitToFrame(L) {
      const W = canvas.width, H = canvas.height;
      for (let i = 0; i < 8; i++) {
        const lay = A.layout(pctx, L, W);
        const over = Math.max(lay.blockW / (0.88 * W), lay.blockH / (0.6 * H));
        if (over <= 1.001) break;
        L.size = Math.max(2, Math.round(L.size / over * 2) / 2);
      }
    }
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    ['dragenter', 'dragover'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    wrap.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) loadFiles(e.dataTransfer.files); });
    file.addEventListener('change', () => { if (file.files.length) loadFiles(file.files); file.value = ''; });

    /* ---------------- text pane ---------------- */
    const cur = () => S.texts[S.sel];
    const textList = el('div', 'aiimg-textlist');
    const addBtn = button('+ Add text', 'btn-ghost', () => {
      const base = cur();
      const L = newText(base ? { text: 'MORE TEXT', y: clamp(base.y + 0.18, 0.05, 0.95), size: Math.max(6, base.size * 0.6), depth: base.depth } : {});
      S.texts.push(L); S.sel = S.texts.length - 1;
      A.ensureFont(L).then(invalidate);
      refreshTextUI(); invalidate();
    });
    const dupBtn = button('Duplicate', 'btn-ghost', () => {
      const base = cur(); if (!base) return;
      const L = newText(JSON.parse(JSON.stringify(base)));
      L.id = 'text-' + (++seq); L.y = clamp(L.y + 0.1, 0.05, 0.95);
      S.texts.splice(S.sel + 1, 0, L); S.sel++;
      refreshTextUI(); invalidate();
    });
    const delBtn = button('Delete', 'btn-ghost', () => {
      if (!S.texts.length) return;
      S.texts.splice(S.sel, 1); S.sel = Math.max(0, Math.min(S.sel, S.texts.length - 1));
      refreshTextUI(); invalidate();
    });
    const listRow = el('div', 'aiimg-row'); listRow.append(addBtn, dupBtn, delBtn);

    const textArea = el('textarea', 'control'); textArea.id = 'aiimg-text'; textArea.rows = 2; textArea.placeholder = 'Your words. A new line starts a new row.';
    on(textArea, () => { const L = cur(); if (!L) return; L.text = textArea.value; L.touched = true; renderTextList(); invalidate(); });
    const depth = on(select('aiimg-depth', [['behind', 'Behind the ticked layers'], ['front', 'In front of everything']]), () => { const L = cur(); if (L) { L.depth = depth.value; invalidate(); } });
    const fontSel = select('aiimg-font', FONTS.map((f) => [f, f]).concat([['__upload', 'Upload a font file…']]));
    on(fontSel, () => {
      const L = cur(); if (!L) return;
      if (fontSel.value === '__upload') { fontFile.click(); fontSel.value = L.font; return; }
      L.font = fontSel.value; A.ensureFont(L).then(invalidate); invalidate();
    });
    fontFile.addEventListener('change', async () => {
      const f = fontFile.files && fontFile.files[0]; fontFile.value = '';
      if (!f) return;
      try {
        const name = f.name.replace(/\.[^.]+$/, '').replace(/[^\w -]+/g, ' ').trim() || 'My font';
        const face = new FontFace(name, await f.arrayBuffer());
        await face.load();
        document.fonts.add(face);
        if (!FONTS.includes(name)) {
          FONTS.unshift(name);
          const op = el('option', null, name + ' (yours)'); op.value = name;
          fontSel.insertBefore(op, fontSel.firstChild);
        }
        const L = cur(); if (L) { L.font = name; fontSel.value = name; invalidate(); }
        say('Font loaded on this device only. It is not uploaded, and it is forgotten when you leave the page.', 'note');
      } catch (e) { say('That font could not be read. TTF, OTF, WOFF and WOFF2 files work.', 'error'); }
    });
    const weight = on(select('aiimg-weight', WEIGHTS), () => { const L = cur(); if (L) { L.weight = Number(weight.value); A.ensureFont(L).then(invalidate); invalidate(); } });
    const italic = on(check('aiimg-italic', 'Italic', false), () => { const L = cur(); if (L) { L.italic = italic.input.checked; A.ensureFont(L).then(invalidate); invalidate(); } });
    const upper = on(check('aiimg-upper', 'UPPERCASE', true), () => { const L = cur(); if (L) { L.uppercase = upper.input.checked; invalidate(); } });
    const size = on(range('aiimg-size', 2, 90, 0.5, 20, (v) => v + '%'), () => { const L = cur(); if (L) { L.size = Number(size.input.value); L.touched = true; invalidate(); } });
    const spacing = on(range('aiimg-spacing', -0.1, 0.6, 0.01, 0.02, (v) => v.toFixed(2) + ' em'), () => { const L = cur(); if (L) { L.letterSpacing = Number(spacing.input.value); invalidate(); } });
    const lineH = on(range('aiimg-lineh', 0.7, 2, 0.05, 1.05, (v) => v.toFixed(2)), () => { const L = cur(); if (L) { L.lineHeight = Number(lineH.input.value); invalidate(); } });
    const align = on(select('aiimg-align', [['center', 'Centre'], ['left', 'Left'], ['right', 'Right']]), () => { const L = cur(); if (L) { L.align = align.value; invalidate(); } });
    const posX = on(range('aiimg-x', -20, 120, 0.5, 50, pct), () => { const L = cur(); if (L) { L.x = Number(posX.input.value) / 100; invalidate(); } });
    const posY = on(range('aiimg-y', -20, 120, 0.5, 40, pct), () => { const L = cur(); if (L) { L.y = Number(posY.input.value) / 100; invalidate(); } });
    const rot = on(range('aiimg-rot', -180, 180, 1, 0, (v) => v + '°'), () => { const L = cur(); if (L) { L.rotation = Number(rot.input.value); invalidate(); } });
    const opacity = on(range('aiimg-opacity', 0, 100, 1, 100, pct), () => { const L = cur(); if (L) { L.opacity = Number(opacity.input.value) / 100; invalidate(); } });
    const fillMode = on(select('aiimg-fillmode', [['solid', 'One colour'], ['gradient', 'Two-colour gradient']]), () => { const L = cur(); if (L) { L.fillMode = fillMode.value; syncVisibility(); invalidate(); } });
    const fill = on(colour('aiimg-fill', '#ffffff'), () => { const L = cur(); if (L) { L.fill = fill.value; invalidate(); } });
    const fill2 = on(colour('aiimg-fill2', '#f7c948'), () => { const L = cur(); if (L) { L.fill2 = fill2.value; invalidate(); } });
    const gradAngle = on(range('aiimg-gradangle', 0, 360, 5, 90, (v) => v + '°'), () => { const L = cur(); if (L) { L.gradientAngle = Number(gradAngle.input.value); invalidate(); } });
    const strokeW = on(range('aiimg-strokew', 0, 20, 0.5, 0, (v) => v + '%'), () => { const L = cur(); if (L) { L.strokeWidth = Number(strokeW.input.value); invalidate(); } });
    const stroke = on(colour('aiimg-stroke', '#000000'), () => { const L = cur(); if (L) { L.stroke = stroke.value; invalidate(); } });
    const shBlur = on(range('aiimg-shblur', 0, 60, 1, 0, (v) => v + '%'), () => { const L = cur(); if (L) { L.shadowBlur = Number(shBlur.input.value); invalidate(); } });
    const shX = on(range('aiimg-shx', -30, 30, 1, 0, (v) => v + '%'), () => { const L = cur(); if (L) { L.shadowX = Number(shX.input.value); invalidate(); } });
    const shY = on(range('aiimg-shy', -30, 30, 1, 0, (v) => v + '%'), () => { const L = cur(); if (L) { L.shadowY = Number(shY.input.value); invalidate(); } });
    const shColour = on(colour('aiimg-shcolour', '#000000'), () => { const L = cur(); if (L) { L.shadowColor = shColour.value; invalidate(); } });
    const shOpacity = on(range('aiimg-shop', 0, 100, 1, 60, pct), () => { const L = cur(); if (L) { L.shadowOpacity = Number(shOpacity.input.value) / 100; invalidate(); } });
    const glow = on(range('aiimg-glow', 0, 60, 1, 0, (v) => v + '%'), () => { const L = cur(); if (L) { L.glow = Number(glow.input.value); invalidate(); } });
    const blend = on(select('aiimg-blend', BLENDS), () => { const L = cur(); if (L) { L.blend = blend.value; invalidate(); } });

    const grid = (...fields) => { const g = el('div', 'aiimg-grid2'); g.append(...fields); return g; };
    const h = (t) => el('p', 'aiimg-h', t);
    const fill2Field = field('Second colour', fill2), gradField = field('Gradient angle', gradAngle);
    const textControls = el('div');
    textControls.append(
      field('Text', textArea),
      field('Where it sits', depth),
      h('Type'),
      field('Font', fontSel),
      grid(field('Weight', weight), field('Alignment', align)),
      grid(italic, upper),
      field('Size', size, 'As a share of the picture’s width, so it exports the same at any resolution.'),
      grid(field('Letter spacing', spacing), field('Line height', lineH)),
      h('Position'),
      grid(field('Across', posX), field('Down', posY)),
      grid(field('Rotation', rot), field('Opacity', opacity)),
      h('Colour'),
      field('Fill', fillMode),
      grid(field('Colour', fill), fill2Field),
      gradField,
      h('Outline, shadow and glow'),
      grid(field('Outline width', strokeW), field('Outline colour', stroke)),
      grid(field('Shadow blur', shBlur), field('Shadow colour', shColour)),
      grid(field('Shadow across', shX), field('Shadow down', shY)),
      grid(field('Shadow strength', shOpacity), field('Glow', glow)),
      field('Blend with the photo', blend)
    );
    const noText = el('p', 'aiimg-status', 'No text layers. Add one to begin.'); noText.hidden = true;

    /* ---------------- looks ---------------- */
    const looksBox = el('div', 'aiimg-looks');
    function applyLook(p) {
      const L = cur(); if (!L) return;
      p.apply(L);
      L.touched = true;
      A.ensureFont(L).then(invalidate);
      refreshTextUI();
      if (L.anim.type !== 'none' && !S.playing) setPlaying(true);
      invalidate();
    }
    if (share) {
      looksBox.appendChild(h('Looks'));
      presets = share.presets({ root: looksBox, list: LOOKS.map((p) => ({ id: p.id, label: p.label, swatch: p.swatch, apply: () => applyLook(p) })) });
      looksBox.appendChild(el('p', 'field-hint', 'A look sets the colour, outline, shadow and motion of the selected text; everything below stays yours to change. “Copy link to this look” gives a link that opens this page with the look ready.'));
    }
    panes.text.append(textList, listRow, looksBox, noText, textControls);

    function renderTextList() {
      textList.innerHTML = '';
      S.texts.forEach((L, i) => {
        const b = button((L.text || 'Text').split('\n')[0].slice(0, 18) || 'Text', 'chip' + (i === S.sel ? ' is-on' : ''), () => { S.sel = i; refreshTextUI(); invalidate(); });
        b.title = L.text;
        textList.appendChild(b);
      });
    }
    function syncVisibility() {
      const L = cur(); if (!L) return;
      const g = L.fillMode === 'gradient';
      fill2Field.hidden = !g; gradField.hidden = !g;
      const t = (L.anim && L.anim.type) || 'none';
      dirField.hidden = !DIRECTIONAL.has(t);
      cyclesField.hidden = !CYCLIC.has(t);
      ampField.hidden = !AMPLITUDE.has(t);
      wavesField.hidden = !WAVY.has(t);
    }
    function refreshTextUI() {
      renderTextList();
      const L = cur();
      noText.hidden = !!L; textControls.hidden = !L; motionControls.hidden = !L;
      if (!L) return;
      textArea.value = L.text; depth.value = L.depth;
      if (!FONTS.includes(L.font)) { FONTS.unshift(L.font); const op = el('option', null, L.font); op.value = L.font; fontSel.insertBefore(op, fontSel.firstChild); }
      fontSel.value = L.font; weight.value = String(L.weight); italic.input.checked = !!L.italic; upper.input.checked = !!L.uppercase;
      size.set(L.size); spacing.set(L.letterSpacing); lineH.set(L.lineHeight); align.value = L.align;
      posX.set(Math.round(L.x * 1000) / 10); posY.set(Math.round(L.y * 1000) / 10); rot.set(L.rotation); opacity.set(Math.round(L.opacity * 100));
      fillMode.value = L.fillMode; fill.value = L.fill; fill2.value = L.fill2; gradAngle.set(L.gradientAngle);
      strokeW.set(L.strokeWidth); stroke.value = L.stroke;
      shBlur.set(L.shadowBlur); shX.set(L.shadowX); shY.set(L.shadowY); shColour.value = L.shadowColor; shOpacity.set(Math.round(L.shadowOpacity * 100));
      glow.set(L.glow); blend.value = L.blend;
      animSel.value = L.anim.type; dirSel.value = L.anim.direction; cycles.value = String(Math.max(1, Math.round(L.anim.speed)));
      amp.set(L.anim.amplitude); waves.set(L.anim.waves);
      syncVisibility();
    }

    /* ---------------- motion pane ---------------- */
    const animSel = on(select('aiimg-anim', ANIMS), () => { const L = cur(); if (L) { L.anim.type = animSel.value; syncVisibility(); if (animSel.value !== 'none' && !S.playing) setPlaying(true); invalidate(); } });
    const dirSel = on(select('aiimg-dir', DIRS), () => { const L = cur(); if (L) { L.anim.direction = dirSel.value; invalidate(); } });
    const cycles = on(select('aiimg-cycles', [[1, '1 — once per clip'], [2, '2'], [3, '3'], [4, '4'], [6, '6'], [8, '8']]), () => { const L = cur(); if (L) { L.anim.speed = Number(cycles.value); invalidate(); } });
    const amp = on(range('aiimg-amp', 0, 2, 0.1, 0.5, (v) => v.toFixed(1) + '×'), () => { const L = cur(); if (L) { L.anim.amplitude = Number(amp.input.value); invalidate(); } });
    const waves = on(range('aiimg-waves', 0.5, 4, 0.25, 1.5, (v) => v.toFixed(2)), () => { const L = cur(); if (L) { L.anim.waves = Number(waves.input.value); invalidate(); } });
    const durCtl = on(range('aiimg-dur', 1, 20, 0.5, S.duration, (v) => v.toFixed(1) + ' s'), () => { S.duration = Number(durCtl.input.value); S.t = Math.min(S.t, S.duration); invalidate(); });
    const dirField = field('Direction', dirSel), cyclesField = field('Times per clip', cycles, 'Whole numbers, so an exported loop joins up with itself.'),
      ampField = field('Amount', amp), wavesField = field('Waves across the text', waves);
    const motionControls = el('div');
    motionControls.append(field('Motion for this text', animSel), dirField, cyclesField, ampField, wavesField);
    panes.motion.append(motionControls, h('The clip'), field('Clip length', durCtl, 'Every text layer shares the clip. Press Play under the preview to watch it loop.'));

    /* ---------------- export pane ---------------- */
    const stillFmt = on(select('aiimg-still-fmt', [['image/png', 'PNG'], ['image/jpeg', 'JPEG'], ['image/webp', 'WebP']], 'image/png'), () => { qualityField.hidden = stillFmt.value === 'image/png'; });
    const stillSize = select('aiimg-still-size', [['0', 'Original size'], ['2048', 'Up to 2048 px'], ['1080', 'Up to 1080 px'], ['720', 'Up to 720 px']], '0');
    const quality = range('aiimg-quality', 50, 100, 1, 92, pct);
    const qualityField = field('Quality', quality); qualityField.hidden = true;
    const stillBtn = button('Download the image', 'btn-primary', exportStill);
    const cutBtn = button('Download the cut-out as a transparent PNG', 'btn-ghost', exportCutout);

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

    /* ---------------- share: credit, caption, making-of ---------------- */
    const shareBox = el('div', 'aiimg-share');
    const moBtn = button('Making-of clip (9:16)', 'btn-ghost', exportMakingOf);
    const moCancel = button('Cancel', 'btn-ghost', () => { if (S.job) S.job.abort(); }); moCancel.hidden = true;
    const moProgress = el('div', 'aiimg-progress'); const moBar = el('i'); moProgress.appendChild(moBar); moProgress.hidden = true;
    const moStatus = el('p', 'aiimg-status', ''); moStatus.hidden = true;
    const captionText = () => {
      const words = ((S.texts[0] && S.texts[0].text) || '').replace(/\s+/g, ' ').trim();
      return (words ? '“' + words + '” — ' : '') + 'text behind the subject, cut out by AI on my own device, nothing uploaded.\n#textbehindimage #photoedit #aiart #design #1234tools';
    };
    if (share) {
      const shareRow = el('div', 'aiimg-row');
      shareRow.append(share.captionButton(captionText), moBtn, moCancel);
      shareBox.append(
        share.creditControl(),
        el('p', 'field-hint', 'The credit is a small “1234tools.com” in the bottom corner of GIF and MP4 clips, never of a still. Off unless you tick it.'),
        shareRow,
        el('p', 'field-hint', 'The caption is a line and five hashtags for the post. The making-of is a six-second 1080×1920 clip for Stories and Reels: your photo, the layers peeling apart, then the result.'),
        moProgress, moStatus
      );
    }

    panes.export.append(
      h('Still image'),
      grid(field('Format', stillFmt), field('Size', stillSize)), qualityField,
      el('p', 'field-hint', 'The still is the frame shown in the preview. Scrub to the moment you want first.'),
      (() => { const r = el('div', 'aiimg-row'); r.append(stillBtn, cutBtn); return r; })(),
      h('Animated clip'),
      grid(field('Format', clipFmt), field('Long edge', clipSize)),
      field('Frames per second', clipFps),
      el('p', 'field-hint', 'Encoded on your device. MP4 needs a browser with on-device video encoding (Chrome, Edge, Safari 16.4+); elsewhere the clip is recorded as WebM. GIFs are large: keep them short and 640 px or under for sharing.'),
      clipRow, clipProgress, clipStatus
    );
    if (share) panes.export.append(h('Share'), shareBox);
    panes.export.append(results);

    /** The three layers of the making-of, back to front, at up to 1080 px. */
    function makingOfStages() {
      const img = S.image;
      const s = Math.min(1, 1080 / Math.max(img.width, img.height));
      const w = Math.max(2, Math.round(img.width * s)), h = Math.max(2, Math.round(img.height * s));
      const layer = () => { const c = el('canvas'); c.width = w; c.height = h; return c; };
      const bg = layer(), bctx = bg.getContext('2d');
      bctx.drawImage(img.canvas, 0, 0, w, h);
      if (S.frontCanvas) { bctx.globalCompositeOperation = 'destination-out'; bctx.drawImage(S.frontCanvas, 0, 0, w, h); }
      const tx = layer(), tctx = tx.getContext('2d');
      for (const L of S.texts) A.drawText(tctx, Object.assign({}, L, { anim: { type: 'none' } }), 0, w, h, S.duration);
      const stages = [{ canvas: bg, label: 'The photo' }, { canvas: tx, label: 'Your text' }];
      if (S.frontCanvas) {
        const fr = layer();
        fr.getContext('2d').drawImage(S.frontCanvas, 0, 0, w, h);
        const names = S.seg ? S.seg.layers.filter((l) => S.front.has(l.key)).map((l) => l.name) : [];
        stages.push({ canvas: fr, label: names.length ? names.slice(0, 2).join(' and ') + ' in front' : 'In front' });
      }
      return stages;
    }
    async function exportMakingOf() {
      if (!S.image || S.job || !share) return;
      S.job = new AbortController();
      S.exporting = true;
      const wasPlaying = S.playing; setPlaying(false);
      moBtn.disabled = true; clipBtn.disabled = true; moCancel.hidden = false; moProgress.hidden = false; moStatus.hidden = false; moBar.style.width = '0%';
      moStatus.textContent = 'Rendering the making-of clip…';
      const started = performance.now();
      try {
        const first = S.texts[0];
        const words = ((first && first.text) || '').split('\n')[0].trim();
        const r = await share.makingOf({
          title: words ? (first.uppercase ? words.toUpperCase() : words) : 'Text behind image',
          subtitle: 'Text behind image, made on my device',
          width: 1080, height: 1920, seconds: 6, fps: 30,
          original: S.image.canvas, stages: makingOfStages(), final: renderFrame,
          onProgress: (f) => { moBar.style.width = Math.round(f * 100) + '%'; moStatus.textContent = 'Rendering the making-of clip — ' + Math.round(f * 100) + '%.'; },
          signal: S.job.signal
        });
        const name = (S.image.name || 'image') + '-making-of.' + r.ext;
        addResult(r.blob, name, (r.ext === 'mp4' ? 'MP4' : 'WebM') + ' · making-of · 6.0 s · 30 fps', '1080×1920');
        A.download(r.blob, name);
        moStatus.textContent = 'Done in ' + ((performance.now() - started) / 1000).toFixed(1) + ' s.';
        if (r.note && /WebM/.test(r.note)) say(r.note, 'warn'); else say('');
      } catch (e) {
        if (e && e.name === 'AbortError') moStatus.textContent = 'Cancelled.';
        else { moStatus.textContent = 'The making-of could not be rendered.'; say((e && e.message) || String(e), 'error'); }
      } finally {
        S.job = null; S.exporting = false;
        moBtn.disabled = false; clipBtn.disabled = false; moCancel.hidden = true; moProgress.hidden = true;
        if (wasPlaying) setPlaying(true);
        invalidate();
      }
    }

    const outName = (ext) => (S.image ? S.image.name : 'image') + '-text-behind.' + ext;
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
    async function exportCutout() {
      if (!S.image) return;
      if (!S.frontCanvas) { say('Nothing is in front of the text yet. Tick a layer first, and this exports that layer alone on a transparent background.', 'warn'); return; }
      const blob = await new Promise((r) => S.frontCanvas.toBlob(r, 'image/png'));
      const name = (S.image.name || 'image') + '-cutout.png';
      addResult(blob, name, 'transparent PNG', S.image.width + '×' + S.image.height);
      A.download(blob, name);
    }
    async function exportClip() {
      if (!S.image || S.job) return;
      const gif = clipFmt.value === 'gif';
      const { width, height } = sizeFor(clipSize.value);
      const fps = Number(clipFps.value);
      const frames = Math.round(S.duration * fps);
      if (gif && frames * width * height > 240 * 1e6) { say('That GIF would be enormous — ' + frames + ' frames at ' + width + '×' + height + '. Shorten the clip, lower the frame rate or pick a smaller size.', 'warn'); return; }
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
        let blob, ext, note;
        if (gif) { blob = await A.encodeGIF(renderClip, o); ext = 'gif'; }
        else { const r = await A.encodeVideo(renderClip, o); blob = r.blob; ext = r.ext; note = r.note; }
        const name = outName(ext);
        addResult(blob, name, (gif ? 'GIF' : (ext === 'mp4' ? 'MP4' : 'WebM')) + ' · ' + S.duration.toFixed(1) + ' s · ' + fps + ' fps', width + '×' + height);
        A.download(blob, name);
        clipStatus.textContent = 'Done in ' + ((performance.now() - started) / 1000).toFixed(1) + ' s.';
        if (note && /WebM/.test(note)) say(note, 'warn'); else say('');
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
    refreshTextUI();
    showPane('layers');
    return { state: S, renderFrame, renderClip, loadFiles, presets, destroy: () => { mounted = false; } };
  }

  A.tools['text-behind-image'] = { mount };
})();
