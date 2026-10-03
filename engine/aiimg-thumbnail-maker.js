/**
 * YouTube Thumbnail Maker.
 *
 * The people (or any chosen layer) are cut out on the device and placed on
 * a 16:9 frame over a punched-up background, with a glow outline, a bold
 * title and an accent. One function draws the frame for the preview and
 * every export, and the same function with a few settings swapped draws
 * the A, B and C variants.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A) return;
  const { el, clamp, field, select, range, colour, check, button, sleep, fmtBytes } = A;

  const W0 = 1280, H0 = 720;
  const FONTS = ['Impact', 'Arial Black', 'Sora', 'Inter', 'Verdana', 'Georgia'];
  const BG_MODES = [['blur', 'Original, blurred and darkened'], ['sharp', 'Original, punchier'], ['solid', 'Solid colour'], ['gradient', 'Gradient'], ['pattern', 'Pattern']];
  const PATTERNS = [['dots', 'Dots'], ['stripes', 'Diagonal stripes'], ['grid', 'Grid']];
  const GLOWS = [['both', 'Outline and glow'], ['hard', 'Hard outline'], ['soft', 'Soft glow'], ['none', 'None']];
  const ACCENTS = [['none', 'None'], ['arrow', 'Arrow'], ['circle', 'Circle'], ['box', 'Box']];
  const PALETTE = ['#f7c948', '#ff3b3b', '#2dd4ff', '#39ff88', '#ff5cf0', '#ffffff'];
  const YT_LIMIT = 2000000;
  /* Layers that are never picked as the subject by default. */
  const BACKDROP = new Set(['sky', 'wall', 'floor', 'ceiling', 'road', 'sidewalk', 'earth', 'grass', 'field', 'sand', 'sea', 'water', 'mountain', 'hill', 'land', 'building', 'tree', 'path', 'river', 'lake', 'curtain', 'rug', 'windowpane', 'door', 'fence', 'railing']);

  const pct = (v) => Math.round(v) + '%';
  const on = (ctrl, fn) => { const t = ctrl.input || ctrl; t.addEventListener('input', fn); t.addEventListener('change', fn); return ctrl; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const nextColour = (c, n) => { const i = PALETTE.indexOf(String(c).toLowerCase()); return PALETTE[((i < 0 ? -1 : i) + n + PALETTE.length) % PALETTE.length]; };

  let seq = 0;
  function newText(partial) {
    return Object.assign({
      id: 'text-' + (++seq), text: 'YOUR TITLE\nHERE', font: 'Impact', weight: 900, italic: false, uppercase: true,
      size: 15, letterSpacing: 0.01, lineHeight: 1.0, align: 'left', x: 0.3, y: 0.42, rotation: 0, opacity: 1,
      fillMode: 'solid', fill: '#ffffff', fill2: '#f7c948', gradientAngle: 90,
      strokeWidth: 7, stroke: '#000000', shadowBlur: 10, shadowX: 0, shadowY: 3, shadowColor: '#000000', shadowOpacity: 0.7,
      glow: 0, blend: 'source-over', depth: 'behind',
      anim: { type: 'none', direction: 'left', speed: 1, amplitude: 0.5, waves: 1.5 }
    }, partial || {});
  }

  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const S = {
      image: null, seg: null, guide: null, keys: new Set(), alpha: null, cut: null, tint: null, crop: null,
      softness: 3, shift: 0, detail: 'standard',
      bg: { mode: 'blur', c1: '#141a33', c2: '#7c5cff', dark: 0.45, blur: 14, zoom: 1.1, pattern: 'dots' },
      subject: { scale: 1, x: 0.68, y: 1.02, mirror: false, twin: false, front: true, baseH: 0.95 }, mainOnly: true,
      glow: { style: 'both', colour: '#f7c948', width: 14, strength: 0.9 },
      text: newText(),
      accent: { kind: 'none', colour: '#ff3b3b', x: 0.5, y: 0.6, size: 0.22, rot: 0, width: 9 },
      variant: null, bgCache: {}, scratch: {}, showLayers: false, exporting: false, sel: 'subject'
    };

    /* ---------------- skeleton ---------------- */
    const wrap = el('div', 'aiimg aiimg-thumb');
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose a photo of yourself or your subject</strong><span>or drag it here — nothing is uploaded. Any shape; the thumbnail comes out 16:9.</span>';
    const file = el('input', 'visually-hidden');
    file.type = 'file'; file.accept = 'image/*'; file.setAttribute('aria-label', 'Choose a photo');

    const studio = el('div', 'aiimg-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage');
    const canvas = el('canvas', 'aiimg-canvas');
    canvas.width = W0; canvas.height = H0;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Thumbnail preview at 1280 by 720. Drag the cut-out or the title to move them.');
    const stageMsg = el('div', 'aiimg-stagemsg'); stageMsg.hidden = true;
    stage.append(canvas, stageMsg);
    const transport = el('div', 'aiimg-transport');
    const sizeNote = el('span', 'aiimg-thumb-size', '1280 × 720 — what YouTube shows');
    const change = button('Change photo', 'btn-ghost', () => file.click());
    transport.append(sizeNote, change);
    stageCol.append(stage, transport);

    const side = el('div', 'aiimg-side');
    const tabs = el('div', 'aiimg-tabs'); tabs.setAttribute('role', 'tablist');
    const panes = {};
    for (const [k, label] of [['layers', 'Subject'], ['background', 'Background'], ['glow', 'Glow'], ['text', 'Title'], ['accent', 'Accent'], ['export', 'Export']]) {
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
    const hasFilter = 'filter' in pctx;
    let dirty = true;
    const invalidate = () => { dirty = true; };
    const rebg = () => { S.bgCache = {}; dirty = true; };
    const view = () => S.variant || S;

    function scratch(name, W, H) {
      const key = name + W + 'x' + H;
      let c = S.scratch[key];
      if (!c) { c = S.scratch[key] = el('canvas'); c.width = W; c.height = H; }
      return c;
    }

    /** The 16:9 window of the photo centred on the subject. */
    function computeCrop() {
      const img = S.image;
      let w = img.width, h = Math.round(w * H0 / W0);
      if (h > img.height) { h = img.height; w = Math.round(h * W0 / H0); }
      let cx = img.width / 2, cy = img.height / 2;
      if (S.cut) { cx = S.cut.x + S.cut.w / 2; cy = S.cut.y + S.cut.h / 2; }
      S.crop = { x: clamp(Math.round(cx - w / 2), 0, img.width - w), y: clamp(Math.round(cy - h / 2), 0, img.height - h), w, h };
    }

    function background(W, H, B) {
      const key = W + '|' + JSON.stringify(B);
      if (S.bgCache[key]) return S.bgCache[key];
      const keys = Object.keys(S.bgCache);
      if (keys.length >= 4) delete S.bgCache[keys[0]];
      const c = el('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d');
      const k = W / W0;
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      if (B.mode === 'blur' || B.mode === 'sharp') {
        const cr = S.crop;
        const blur = B.mode === 'blur' ? B.blur * k : 0;
        const over = blur * 2.5;
        const zoom = Math.max(1, Number(B.zoom) || 1);
        const dw = (W + 2 * over) * zoom, dh = (H + 2 * over) * zoom;
        x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
        x.save();
        if (hasFilter) x.filter = B.mode === 'blur' ? 'blur(' + blur.toFixed(1) + 'px)' : 'contrast(1.15) saturate(1.3)';
        if (B.mode === 'blur' && !hasFilter) {
          /* no filter support: a cheap blur by shrinking and growing */
          const small = A.scaled(S.image.canvas, Math.max(8, Math.round(W / 16)), Math.max(8, Math.round(H / 16)));
          x.drawImage(small, 0, 0, small.width, small.height, (W - dw) / 2, (H - dh) / 2, dw, dh);
        } else {
          x.drawImage(S.image.canvas, cr.x, cr.y, cr.w, cr.h, (W - dw) / 2, (H - dh) / 2, dw, dh);
        }
        x.restore();
        const dark = clamp(Number(B.dark) || 0, 0, 0.9) * (B.mode === 'sharp' ? 0.5 : 1);
        if (dark > 0) { x.fillStyle = 'rgba(0,0,0,' + dark + ')'; x.fillRect(0, 0, W, H); }
      } else if (B.mode === 'solid') {
        x.fillStyle = B.c1; x.fillRect(0, 0, W, H);
        const g = x.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.3, H * 0.2, W * 0.9);
        g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
        x.fillStyle = g; x.fillRect(0, 0, W, H);
      } else if (B.mode === 'gradient') {
        const g = x.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, B.c1); g.addColorStop(1, B.c2);
        x.fillStyle = g; x.fillRect(0, 0, W, H);
        const r = x.createRadialGradient(W * 0.3, H * 0.15, 0, W * 0.3, H * 0.15, W * 0.7);
        r.addColorStop(0, 'rgba(255,255,255,0.2)'); r.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = r; x.fillRect(0, 0, W, H);
      } else {
        x.fillStyle = B.c1; x.fillRect(0, 0, W, H);
        x.save();
        x.globalAlpha = 0.35; x.fillStyle = B.c2; x.strokeStyle = B.c2;
        const step = 48 * k;
        if (B.pattern === 'dots') {
          for (let yy = step / 2; yy < H; yy += step) for (let xx = step / 2; xx < W; xx += step) { x.beginPath(); x.arc(xx, yy, 4 * k, 0, Math.PI * 2); x.fill(); }
        } else if (B.pattern === 'stripes') {
          x.lineWidth = 14 * k;
          for (let d = -H; d < W + H; d += step * 1.4) { x.beginPath(); x.moveTo(d, 0); x.lineTo(d + H, H); x.stroke(); }
        } else {
          x.lineWidth = 2 * k;
          for (let xx = 0; xx < W; xx += step) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, H); x.stroke(); }
          for (let yy = 0; yy < H; yy += step) { x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); }
        }
        x.restore();
      }
      return (S.bgCache[key] = c);
    }

    /** Where the cut-out sits on a W×H frame. */
    function subjectRect(W, H, SU) {
      const cut = S.cut; if (!cut) return null;
      const sh = H * SU.baseH * SU.scale;
      const sw = sh * cut.w / cut.h;
      return { x: SU.x * W - sw / 2, y: SU.y * H - sh, w: sw, h: sh };
    }
    function drawCut(ctx, R, mirror) {
      ctx.save();
      if (mirror) { ctx.translate(R.x + R.w, R.y); ctx.scale(-1, 1); ctx.drawImage(S.cut.canvas, 0, 0, R.w, R.h); }
      else ctx.drawImage(S.cut.canvas, R.x, R.y, R.w, R.h);
      ctx.restore();
    }
    /** The glow or outline under the cut-out, then the cut-out itself. */
    function drawSubject(ctx, W, H, R, mirror, G, alpha) {
      const k = W / W0;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (G.style !== 'none' && G.width > 0 && G.strength > 0) {
        const sil = scratch('sil', W, H);
        const sx = sil.getContext('2d');
        sx.globalCompositeOperation = 'source-over';
        sx.clearRect(0, 0, W, H);
        drawCut(sx, R, mirror);
        sx.globalCompositeOperation = 'source-in';
        sx.fillStyle = G.colour; sx.fillRect(0, 0, W, H);
        const r = G.width * k;
        if (G.style === 'hard' || G.style === 'both') {
          ctx.save();
          ctx.globalAlpha = alpha * clamp(G.strength, 0, 1);
          const n = 24;
          for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; ctx.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r); }
          if (r > 6 * k) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.drawImage(sil, Math.cos(a) * r / 2, Math.sin(a) * r / 2); }
          ctx.restore();
        }
        if (G.style === 'soft' || G.style === 'both') {
          ctx.save();
          ctx.globalAlpha = alpha * clamp(G.strength, 0, 1);
          if (hasFilter) { ctx.filter = 'blur(' + (r * 1.4).toFixed(1) + 'px)'; ctx.drawImage(sil, 0, 0); ctx.drawImage(sil, 0, 0); }
          else { ctx.globalAlpha = alpha * G.strength * 0.5; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.drawImage(sil, Math.cos(a) * r * 1.6, Math.sin(a) * r * 1.6); } }
          ctx.restore();
        }
      }
      drawCut(ctx, R, mirror);
      ctx.restore();
    }
    function drawAccent(ctx, W, H, AC) {
      if (!AC || AC.kind === 'none') return;
      const k = W / W0;
      ctx.save();
      ctx.translate(AC.x * W, AC.y * H);
      ctx.rotate((Number(AC.rot) || 0) * Math.PI / 180);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const lw = AC.width * k, s = AC.size * W;
      const pass = (stroke, extra) => {
        ctx.strokeStyle = stroke; ctx.lineWidth = lw + extra;
        ctx.beginPath();
        if (AC.kind === 'arrow') {
          const head = Math.max(lw * 2.2, s * 0.22);
          ctx.moveTo(-s / 2, 0); ctx.lineTo(s / 2, 0);
          ctx.moveTo(s / 2 - head, -head * 0.8); ctx.lineTo(s / 2, 0); ctx.lineTo(s / 2 - head, head * 0.8);
        } else if (AC.kind === 'circle') {
          ctx.ellipse(0, 0, s / 2, s / 2 * 0.72, 0, 0, Math.PI * 2);
        } else {
          const w = s, h = s * 0.62, r = lw * 1.5;
          ctx.roundRect ? ctx.roundRect(-w / 2, -h / 2, w, h, r) : ctx.rect(-w / 2, -h / 2, w, h);
        }
        ctx.stroke();
      };
      pass('rgba(0,0,0,0.55)', lw * 0.9);
      pass(AC.colour, 0);
      ctx.restore();
    }
    function renderFrame(ctx, W, H, t) {
      const V = view();
      ctx.save();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(background(W, H, V.bg), 0, 0, W, H);
      const title = () => A.drawText(ctx, V.text, 0, W, H, 1);
      if (V.subject.front) title();
      if (S.cut) {
        if (V.subject.twin) {
          const TW = Object.assign({}, V.subject, { x: 1 - V.subject.x, scale: V.subject.scale * 0.92 });
          drawSubject(ctx, W, H, subjectRect(W, H, TW), !V.subject.mirror, V.glow, 0.85);
        }
        drawSubject(ctx, W, H, subjectRect(W, H, V.subject), V.subject.mirror, V.glow, 1);
      }
      drawAccent(ctx, W, H, V.accent);
      if (!V.subject.front) title();
      ctx.restore();
    }
    function draw() {
      if (!S.image) return;
      renderFrame(pctx, canvas.width, canvas.height, 0);
      if (!S.exporting) {
        pctx.save();
        pctx.setLineDash([6, 5]); pctx.lineWidth = 1.5; pctx.strokeStyle = 'rgba(247,201,72,.9)';
        if (S.sel === 'text') {
          const box = A.textBox(pctx, S.text, 0, canvas.width, canvas.height, 1);
          pctx.beginPath(); box.pts.forEach((p, i) => i ? pctx.lineTo(p[0], p[1]) : pctx.moveTo(p[0], p[1])); pctx.closePath(); pctx.stroke();
        } else if (S.sel === 'subject' && S.cut) {
          const R = subjectRect(canvas.width, canvas.height, S.subject);
          pctx.strokeRect(R.x, R.y, R.w, R.h);
        }
        pctx.restore();
      }
      dirty = false;
    }
    let mounted = true;
    function loop() {
      if (!mounted) return;
      if (dirty) draw();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    /* drag the cut-out or the title */
    let drag = null;
    const toCanvas = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * canvas.width, y: (e.clientY - r.top) / r.height * canvas.height }; };
    canvas.addEventListener('pointerdown', (e) => {
      if (!S.image || S.exporting) return;
      const p = toCanvas(e);
      const W = canvas.width, H = canvas.height;
      const box = A.textBox(pctx, S.text, 0, W, H, 1);
      const R = S.cut ? subjectRect(W, H, S.subject) : null;
      const inSubject = R && p.x >= R.x && p.x <= R.x + R.w && p.y >= R.y && p.y <= R.y + R.h;
      if (A.pointInBox(box, p.x, p.y) && (S.sel === 'text' || !inSubject)) {
        S.sel = 'text';
        drag = { what: 'text', dx: p.x - S.text.x * W, dy: p.y - S.text.y * H };
      } else if (inSubject) {
        S.sel = 'subject';
        drag = { what: 'subject', dx: p.x - S.subject.x * W, dy: p.y - S.subject.y * H };
      } else return;
      canvas.setPointerCapture(e.pointerId);
      canvas.focus({ preventScroll: true });
      e.preventDefault();
      invalidate();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = toCanvas(e);
      const W = canvas.width, H = canvas.height;
      if (drag.what === 'text') {
        S.text.x = clamp((p.x - drag.dx) / W, -0.3, 1.3); S.text.y = clamp((p.y - drag.dy) / H, -0.3, 1.3);
        tX.set(Math.round(S.text.x * 100)); tY.set(Math.round(S.text.y * 100));
      } else {
        S.subject.x = clamp((p.x - drag.dx) / W, -0.3, 1.3); S.subject.y = clamp((p.y - drag.dy) / H, 0.2, 1.6);
        sX.set(Math.round(S.subject.x * 100)); sY.set(Math.round(S.subject.y * 100));
      }
      invalidate();
    });
    const endDrag = () => { drag = null; };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    /* ---------------- the cut-out ---------------- */
    /** Keep only the largest 8-connected blob of a 0/1 mask: the main subject, not every passer-by. */
    function keepLargest(bin, w, h) {
      const lab = new Int32Array(w * h), stack = new Int32Array(w * h);
      let best = 0, bestSize = 0, next = 0;
      for (let i = 0; i < bin.length; i++) {
        if (!bin[i] || lab[i]) continue;
        next++; let size = 0, sp = 0; stack[sp++] = i; lab[i] = next;
        while (sp) {
          const j = stack[--sp]; size++;
          const x = j % w, y = (j - x) / w;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const k = yy * w + xx;
            if (bin[k] && !lab[k]) { lab[k] = next; stack[sp++] = k; }
          }
        }
        if (size > bestSize) { bestSize = size; best = next; }
      }
      for (let i = 0; i < bin.length; i++) if (lab[i] !== best) bin[i] = 0;
    }
    /** Fill holes the background cannot reach from the frame's edge — a nose the model called something else. */
    function fillHoles(bin, w, h) {
      const seen = new Uint8Array(w * h), stack = new Int32Array(w * h);
      let sp = 0;
      const push = (k) => { if (!bin[k] && !seen[k]) { seen[k] = 1; stack[sp++] = k; } };
      for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
      while (sp) {
        const j = stack[--sp], x = j % w;
        if (x > 0) push(j - 1); if (x < w - 1) push(j + 1);
        if (j >= w) push(j - w); if (j < (h - 1) * w) push(j + w);
      }
      for (let i = 0; i < bin.length; i++) if (!bin[i] && !seen[i]) bin[i] = 1;
    }
    let maskTimer = 0, maskToken = 0;
    function scheduleMask() { clearTimeout(maskTimer); maskTimer = setTimeout(rebuildMask, 120); }
    async function rebuildMask() {
      if (!S.seg || !S.image) return;
      const token = ++maskToken;
      const { mw, mh, classMap } = S.seg;
      const inKeep = new Uint8Array(256);
      for (const k of S.keys) inKeep[k] = 1;
      const bin = new Float32Array(mw * mh);
      let any = false;
      for (let i = 0; i < bin.length; i++) if (inKeep[classMap[i]]) { bin[i] = 1; any = true; }
      if (any && S.mainOnly) keepLargest(bin, mw, mh);
      if (any) fillHoles(bin, mw, mh);
      if (!any) { S.alpha = null; S.cut = null; }
      else {
        note('Refining the edge…');
        setStatus('refining the edge…');
        await sleep(0);
        if (token !== maskToken) return;
        if (!S.guide) S.guide = A.guideOf(S.image, mw, mh);
        S.alpha = A.refine(bin, S.guide, { softness: S.softness, shift: S.shift });
        if (token !== maskToken) return;
        /* the cut-out, cropped to what it contains */
        let x0 = mw, y0 = mh, x1 = -1, y1 = -1;
        for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) if (S.alpha[y * mw + x] > 0.02) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
        if (x1 < 0) { S.alpha = null; S.cut = null; }
        else {
          const full = A.cutOut(S.image, S.alpha, mw, mh);
          const sx = S.image.width / mw, sy = S.image.height / mh;
          const pad = Math.round(Math.max(S.image.width, S.image.height) * 0.01);
          const cx = clamp(Math.floor(x0 * sx) - pad, 0, S.image.width - 1), cy = clamp(Math.floor(y0 * sy) - pad, 0, S.image.height - 1);
          const cw = clamp(Math.ceil((x1 + 1) * sx) + pad, cx + 1, S.image.width) - cx, ch = clamp(Math.ceil((y1 + 1) * sy) + pad, cy + 1, S.image.height) - cy;
          const c = el('canvas'); c.width = cw; c.height = ch;
          c.getContext('2d').drawImage(full, cx, cy, cw, ch, 0, 0, cw, ch);
          S.cut = { canvas: c, x: cx, y: cy, w: cw, h: ch };
          /* fit by height, unless that would make a wide subject wider than the frame */
          S.subject.baseH = Math.min(0.95, 0.9 * (W0 / H0) * ch / cw);
        }
        note('');
      }
      computeCrop();
      rebg();
      setStatus('ready');
    }
    function setStatus(tail) {
      if (!S.seg) return;
      const n = S.seg.layers.length;
      const kept = S.seg.layers.filter((l) => S.keys.has(l.key)).map((l) => l.name);
      status.textContent = n + ' layer' + (n === 1 ? '' : 's') + ' found' + (kept.length ? '. Cut out: ' + kept.slice(0, 3).join(', ') + (kept.length > 3 ? '…' : '') : '. Nothing cut out yet') + ' — ' + tail;
    }

    /* ---------------- panes ---------------- */
    const h = (t) => el('p', 'aiimg-h', t);
    const grid = (...fields) => { const g = el('div', 'aiimg-grid2'); g.append(...fields); return g; };
    const palette = (id, get, set) => {
      const row = el('div', 'aiimg-thumb-palette');
      for (const c of PALETTE) {
        const b = button('', 'aiimg-thumb-chip', () => { set(c); sync(); });
        b.style.background = c; b.dataset.colour = c; b.title = c; b.setAttribute('aria-label', 'Colour ' + c);
        row.appendChild(b);
      }
      const pick = on(colour(id, get()), () => { set(pick.value); sync(); });
      row.appendChild(pick);
      function sync() { pick.value = get(); for (const b of row.children) if (b.dataset.colour) b.classList.toggle('is-on', b.dataset.colour === get().toLowerCase()); }
      row.sync = sync;
      sync();
      return row;
    };

    /* subject */
    const status = el('p', 'aiimg-status', 'Choose a photo to begin.');
    const progress = el('div', 'aiimg-progress'); const bar = el('i'); progress.appendChild(bar); progress.hidden = true;
    const layerList = el('div', 'aiimg-layers');
    const layersHint = el('p', 'field-hint', 'The ticked layers are cut out and placed on the thumbnail. People are ticked for you.');
    const soft = on(range('aiimg-soft', 0, 10, 1, S.softness), () => { S.softness = Number(soft.input.value); scheduleMask(); });
    const shiftCtl = on(range('aiimg-shift', -5, 5, 1, S.shift, (v) => (v > 0 ? '+' : '') + v), () => { S.shift = Number(shiftCtl.input.value); scheduleMask(); });
    const detailSel = on(select('aiimg-detail', Object.entries(A.DETAIL).map(([k, m]) => [k, m.label]), S.detail), () => { if (detailSel.value !== S.detail) { S.detail = detailSel.value; runSegmentation(); } });
    const sScale = on(range('aiimg-thumb-scale', 40, 200, 2, 100, pct), () => { S.subject.scale = Number(sScale.input.value) / 100; invalidate(); });
    const sX = on(range('aiimg-thumb-x', -20, 120, 1, Math.round(S.subject.x * 100), pct), () => { S.subject.x = Number(sX.input.value) / 100; invalidate(); });
    const sY = on(range('aiimg-thumb-y', 30, 150, 1, Math.round(S.subject.y * 100), pct), () => { S.subject.y = Number(sY.input.value) / 100; invalidate(); });
    const mirror = on(check('aiimg-thumb-mirror', 'Mirror the cut-out', false), () => { S.subject.mirror = mirror.input.checked; invalidate(); });
    const twin = on(check('aiimg-thumb-twin', 'Add a mirrored twin on the other side', false), () => { S.subject.twin = twin.input.checked; invalidate(); });
    const front = on(check('aiimg-thumb-front', 'Cut-out in front of the title', true), () => { S.subject.front = front.input.checked; invalidate(); });
    const mainOnly = on(check('aiimg-thumb-main', 'Largest subject only', true), () => { S.mainOnly = mainOnly.input.checked; scheduleMask(); });
    const showTint = on(check('aiimg-tint', 'Colour the layers on the preview', false), () => { S.showLayers = showTint.input.checked; invalidate(); });
    panes.layers.append(status, progress, layerList, layersHint,
      h('Placement'),
      field('Size', sScale), grid(field('Across', sX), field('Bottom edge', sY, 'Over 100% hides the cut edge below the frame.')),
      mainOnly, el('p', 'field-hint', 'Keeps the biggest person or object and drops the passers-by. Untick to cut out everyone in the ticked layers.'),
      mirror, twin, front,
      h('Edge'),
      field('Edge softness', soft, 'Higher follows hair more loosely; lower keeps a crisp cut.'),
      field('Grow or shrink the cut', shiftCtl, 'Grow it to hide a halo of background; shrink it if a fringe is being clipped.'),
      field('Detail', detailSel, 'High and Maximum look at the picture at a higher resolution, which is sharper on hair and small parts and takes longer.'));
    function renderLayers() {
      layerList.innerHTML = '';
      if (!S.seg) return;
      for (const L of S.seg.layers) {
        const row = el('label', 'aiimg-layer');
        const cb = el('input'); cb.type = 'checkbox'; cb.checked = S.keys.has(L.key);
        cb.addEventListener('change', () => { if (cb.checked) S.keys.add(L.key); else S.keys.delete(L.key); scheduleMask(); });
        const sw = el('span', 'aiimg-swatch'); sw.style.background = L.colour;
        const name = el('span', 'aiimg-lname', L.name);
        const area = el('span', 'aiimg-area', (L.area * 100).toFixed(L.area < 0.1 ? 1 : 0) + '%');
        row.append(cb, sw, name, area);
        layerList.appendChild(row);
      }
    }

    /* background */
    const bgMode = on(select('aiimg-thumb-bg', BG_MODES, S.bg.mode), () => { S.bg.mode = bgMode.value; syncBg(); rebg(); });
    const bgDark = on(range('aiimg-thumb-dark', 0, 90, 5, Math.round(S.bg.dark * 100), pct), () => { S.bg.dark = Number(bgDark.input.value) / 100; rebg(); });
    const bgBlur = on(range('aiimg-thumb-blur', 0, 40, 1, S.bg.blur, (v) => v + ' px'), () => { S.bg.blur = Number(bgBlur.input.value); rebg(); });
    const bgZoom = on(range('aiimg-thumb-zoom', 100, 125, 1, Math.round(S.bg.zoom * 100), pct), () => { S.bg.zoom = Number(bgZoom.input.value) / 100; rebg(); });
    const bgC1 = on(colour('aiimg-thumb-c1', S.bg.c1), () => { S.bg.c1 = bgC1.value; rebg(); });
    const bgC2 = on(colour('aiimg-thumb-c2', S.bg.c2), () => { S.bg.c2 = bgC2.value; rebg(); });
    const bgPattern = on(select('aiimg-thumb-pattern', PATTERNS, S.bg.pattern), () => { S.bg.pattern = bgPattern.value; rebg(); });
    const fDark = field('Darken', bgDark), fBlur = field('Blur', bgBlur), fZoom = field('Zoom', bgZoom, 'A little zoom hides the blurred edge of the frame.');
    const fC1 = field('Colour', bgC1), fC2 = field('Second colour', bgC2), fPattern = field('Pattern', bgPattern);
    panes.background.append(field('Background', bgMode), fDark, fBlur, fZoom, grid(fC1, fC2), fPattern);
    function syncBg() {
      const m = S.bg.mode;
      bgMode.value = m;
      fDark.hidden = !(m === 'blur' || m === 'sharp'); fBlur.hidden = m !== 'blur'; fZoom.hidden = !(m === 'blur' || m === 'sharp');
      fC1.hidden = !(m === 'solid' || m === 'gradient' || m === 'pattern'); fC2.hidden = !(m === 'gradient' || m === 'pattern'); fPattern.hidden = m !== 'pattern';
      bgDark.set(Math.round(S.bg.dark * 100)); bgBlur.set(S.bg.blur); bgZoom.set(Math.round(S.bg.zoom * 100)); bgC1.value = S.bg.c1; bgC2.value = S.bg.c2; bgPattern.value = S.bg.pattern;
    }
    syncBg();

    /* glow */
    const glowStyle = on(select('aiimg-thumb-glow', GLOWS, S.glow.style), () => { S.glow.style = glowStyle.value; invalidate(); });
    const glowPalette = palette('aiimg-thumb-glowc', () => S.glow.colour, (c) => { S.glow.colour = c; invalidate(); });
    const glowWidth = on(range('aiimg-thumb-glomw', 2, 60, 1, S.glow.width, (v) => v + ' px'), () => { S.glow.width = Number(glowWidth.input.value); invalidate(); });
    const glowStrength = on(range('aiimg-thumb-glows', 0, 100, 5, Math.round(S.glow.strength * 100), pct), () => { S.glow.strength = Number(glowStrength.input.value) / 100; invalidate(); });
    panes.glow.append(field('Style', glowStyle, 'A hard outline reads on a busy background; a soft glow reads on a dark or blurred one.'),
      field('Colour', glowPalette), grid(field('Width', glowWidth), field('Strength', glowStrength)));

    /* title */
    const textArea = el('textarea', 'control'); textArea.id = 'aiimg-text'; textArea.rows = 2; textArea.value = S.text.text; textArea.placeholder = 'Three to five words. A new line starts a second row.';
    on(textArea, () => { S.text.text = textArea.value.split('\n').slice(0, 2).join('\n'); invalidate(); });
    const fontSel = on(select('aiimg-font', FONTS.map((f) => [f, f]), S.text.font), () => { S.text.font = fontSel.value; A.ensureFont(S.text).then(invalidate); invalidate(); });
    const tSize = on(range('aiimg-size', 5, 40, 0.5, S.text.size, (v) => v + '%'), () => { S.text.size = Number(tSize.input.value); invalidate(); });
    const tAlign = on(select('aiimg-align', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], S.text.align), () => { S.text.align = tAlign.value; invalidate(); });
    const tX = on(range('aiimg-x', -20, 120, 1, Math.round(S.text.x * 100), pct), () => { S.text.x = Number(tX.input.value) / 100; invalidate(); });
    const tY = on(range('aiimg-y', -20, 120, 1, Math.round(S.text.y * 100), pct), () => { S.text.y = Number(tY.input.value) / 100; invalidate(); });
    const tFillMode = on(select('aiimg-fillmode', [['solid', 'One colour'], ['gradient', 'Two-colour gradient']], S.text.fillMode), () => { S.text.fillMode = tFillMode.value; fFill2.hidden = tFillMode.value !== 'gradient'; invalidate(); });
    const tFill = on(colour('aiimg-fill', S.text.fill), () => { S.text.fill = tFill.value; invalidate(); });
    const tFill2 = on(colour('aiimg-fill2', S.text.fill2), () => { S.text.fill2 = tFill2.value; invalidate(); });
    const tStrokeW = on(range('aiimg-strokew', 0, 20, 0.5, S.text.strokeWidth, (v) => v + '%'), () => { S.text.strokeWidth = Number(tStrokeW.input.value); invalidate(); });
    const tStroke = on(colour('aiimg-stroke', S.text.stroke), () => { S.text.stroke = tStroke.value; invalidate(); });
    const tShadow = on(range('aiimg-shblur', 0, 40, 1, S.text.shadowBlur, (v) => v + '%'), () => { S.text.shadowBlur = Number(tShadow.input.value); invalidate(); });
    const tShadowY = on(range('aiimg-shy', -20, 20, 1, S.text.shadowY, (v) => v + '%'), () => { S.text.shadowY = Number(tShadowY.input.value); invalidate(); });
    const tUpper = on(check('aiimg-upper', 'UPPERCASE', true), () => { S.text.uppercase = tUpper.input.checked; invalidate(); });
    const fFill2 = field('Second colour', tFill2); fFill2.hidden = true;
    panes.text.append(field('Title', textArea, 'Up to two lines. Click the title on the preview to select it, then drag it.'),
      grid(field('Font', fontSel), field('Alignment', tAlign)), tUpper,
      field('Size', tSize, 'As a share of the width. 12–18% reads at thumbnail size.'),
      grid(field('Across', tX), field('Down', tY)),
      h('Fill'), field('Fill', tFillMode), grid(field('Colour', tFill), fFill2),
      h('Outline and shadow'), grid(field('Outline width', tStrokeW), field('Outline colour', tStroke)), grid(field('Shadow blur', tShadow), field('Shadow down', tShadowY)));

    /* accent */
    const acKind = on(select('aiimg-thumb-accent', ACCENTS, S.accent.kind), () => { S.accent.kind = acKind.value; invalidate(); });
    const acPalette = palette('aiimg-thumb-acc', () => S.accent.colour, (c) => { S.accent.colour = c; invalidate(); });
    const acX = on(range('aiimg-thumb-ax', 0, 100, 1, Math.round(S.accent.x * 100), pct), () => { S.accent.x = Number(acX.input.value) / 100; invalidate(); });
    const acY = on(range('aiimg-thumb-ay', 0, 100, 1, Math.round(S.accent.y * 100), pct), () => { S.accent.y = Number(acY.input.value) / 100; invalidate(); });
    const acSize = on(range('aiimg-thumb-asize', 5, 60, 1, Math.round(S.accent.size * 100), pct), () => { S.accent.size = Number(acSize.input.value) / 100; invalidate(); });
    const acRot = on(range('aiimg-thumb-arot', -180, 180, 5, S.accent.rot, (v) => v + '°'), () => { S.accent.rot = Number(acRot.input.value); invalidate(); });
    const acWidth = on(range('aiimg-thumb-awidth', 3, 24, 1, S.accent.width, (v) => v + ' px'), () => { S.accent.width = Number(acWidth.input.value); invalidate(); });
    panes.accent.append(field('Accent', acKind, 'An arrow at the thing the video is about, or a circle around it.'), field('Colour', acPalette),
      grid(field('Across', acX), field('Down', acY)), grid(field('Size', acSize), field('Rotation', acRot)), field('Line width', acWidth));

    /* export */
    const outSize = select('aiimg-thumb-outsize', [['1280', '1280 × 720 (YouTube)'], ['1920', '1920 × 1080']], '1280');
    const pngBtn = button('Download PNG', 'btn-primary', () => exportOne('image/png'));
    const jpgBtn = button('Download JPEG under 2 MB', 'btn-ghost', () => exportOne('image/jpeg'));
    const variantsBtn = button('Export 3 variants (A, B, C)', 'btn-primary', exportVariants);
    const cutBtn = button('Download the cut-out as a transparent PNG', 'btn-ghost', exportCutout);
    const results = el('div', 'aiimg-results');
    const exportStatus = el('p', 'aiimg-status', ''); exportStatus.hidden = true;
    panes.export.append(
      h('This thumbnail'), field('Size', outSize),
      (() => { const r = el('div', 'aiimg-row'); r.append(pngBtn, jpgBtn); return r; })(),
      h('A/B test'),
      el('p', 'field-hint', 'A is what you see. B swaps sides, the accent colour and the background. C puts the title on top over a solid or patterned background with a third colour. Three 1280×720 PNGs, named -a, -b and -c.'),
      (() => { const r = el('div', 'aiimg-row aiimg-thumb-variants'); r.append(variantsBtn); return r; })(),
      h('Pieces'),
      (() => { const r = el('div', 'aiimg-row'); r.append(cutBtn); return r; })(),
      exportStatus, results
    );

    const baseName = () => (S.image ? S.image.name : 'image') + '-thumbnail';
    function dims() { const W = Number(outSize.value) || W0; return { width: W, height: Math.round(W * H0 / W0) }; }
    function addResult(blob, name, label, d) {
      const row = el('div', 'aiimg-result');
      const head = el('div', 'aiimg-result-head');
      const strong = el('strong', null, name);
      const meta = el('span', null, fmtBytes(blob.size) + ' · ' + d + (label ? ' · ' + label : ''));
      const dl = button('Download', 'btn-download', () => A.download(blob, name));
      head.append(strong, meta, dl);
      row.appendChild(head);
      const img = el('img'); img.alt = 'Result preview'; img.src = URL.createObjectURL(blob); row.appendChild(img);
      results.insertBefore(row, results.firstChild);
      return row;
    }
    async function exportOne(fmt) {
      if (!S.image) return;
      try {
        S.exporting = true;
        const { width, height } = dims();
        let blob, q = 0.92;
        if (fmt === 'image/png') blob = await A.exportStill(renderFrame, { width, height, format: fmt });
        else {
          for (;;) {
            blob = await A.exportStill(renderFrame, { width, height, format: fmt, quality: q });
            if (!blob || blob.size <= YT_LIMIT || q <= 0.4) break;
            q = Math.round((q - 0.07) * 100) / 100;
          }
        }
        if (!blob) throw new Error('This browser could not encode that format. Try PNG.');
        const name = baseName() + (fmt === 'image/png' ? '.png' : '.jpg');
        addResult(blob, name, fmt === 'image/png' ? 'PNG' : 'JPEG, quality ' + Math.round(q * 100) + '%' + (blob.size <= YT_LIMIT ? ' · under 2 MB' : ' · still over 2 MB'), width + '×' + height);
        A.download(blob, name);
        say('');
      } catch (e) { say((e && e.message) || String(e), 'error'); }
      finally { S.exporting = false; invalidate(); }
    }
    function variantOf(v) {
      const V = { bg: clone(S.bg), subject: clone(S.subject), glow: clone(S.glow), text: clone(S.text), accent: clone(S.accent) };
      if (v === 'b') {
        V.glow.colour = nextColour(S.glow.colour, 1); V.accent.colour = V.glow.colour; V.text.fill2 = V.glow.colour;
        V.bg.mode = S.bg.mode === 'gradient' ? 'blur' : 'gradient';
        V.text.x = 1 - S.text.x; V.text.align = S.text.align === 'left' ? 'right' : S.text.align === 'right' ? 'left' : 'center';
        V.subject.x = 1 - S.subject.x; V.subject.mirror = !S.subject.mirror; V.accent.x = 1 - S.accent.x;
        if (V.accent.kind === 'arrow') V.accent.rot = 180 - S.accent.rot;
      } else if (v === 'c') {
        V.glow.colour = nextColour(S.glow.colour, 2); V.accent.colour = V.glow.colour; V.text.fill2 = V.glow.colour;
        V.bg.mode = S.bg.mode === 'solid' ? 'pattern' : 'solid'; V.bg.c1 = '#0b0f1e'; V.bg.c2 = V.glow.colour;
        V.text.x = 0.5; V.text.align = 'center'; V.text.fillMode = 'gradient';
        V.text.y = Math.max(0.2, A.layout(pctx, V.text, W0).blockH / 2 / H0 + 0.05);
        V.subject.front = true; V.glow.style = S.glow.style === 'soft' ? 'hard' : 'both';
      }
      return V;
    }
    async function exportVariants() {
      if (!S.image || S.exporting) return;
      try {
        S.exporting = true;
        exportStatus.hidden = false;
        for (const v of ['a', 'b', 'c']) {
          exportStatus.textContent = 'Rendering variant ' + v.toUpperCase() + '…';
          S.variant = v === 'a' ? null : variantOf(v);
          const blob = await A.exportStill(renderFrame, { width: W0, height: H0, format: 'image/png' });
          S.variant = null;
          const name = baseName() + '-' + v + '.png';
          addResult(blob, name, 'variant ' + v.toUpperCase(), W0 + '×' + H0);
          A.download(blob, name);
          await sleep(300);
        }
        exportStatus.textContent = 'Three variants exported.';
        say('');
      } catch (e) { S.variant = null; exportStatus.textContent = 'The export failed.'; say((e && e.message) || String(e), 'error'); }
      finally { S.exporting = false; invalidate(); }
    }
    async function exportCutout() {
      if (!S.cut) { say('Nothing is cut out yet. Tick a layer first.', 'warn'); return; }
      const blob = await new Promise((r) => S.cut.canvas.toBlob(r, 'image/png'));
      const name = (S.image.name || 'image') + '-cutout.png';
      addResult(blob, name, 'transparent PNG', S.cut.w + '×' + S.cut.h);
      A.download(blob, name);
    }

    /* ---------------- segmentation and loading ---------------- */
    let segToken = 0;
    async function runSegmentation() {
      if (!S.image) return;
      const token = ++segToken;
      progress.hidden = false; bar.style.width = '0%';
      status.textContent = 'Preparing the AI model…';
      note('Finding the subject…');
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
        S.seg = seg; S.guide = null; S.tint = null; S.alpha = null; S.cut = null;
        const people = seg.layers.filter((l) => l.label === 'person');
        const subjects = seg.layers.filter((l) => l.subject);
        const other = seg.layers.filter((l) => !BACKDROP.has(l.label));
        const pick = people.length ? people : subjects.length ? [subjects[0]] : other.length ? [other[0]] : [seg.layers[0]];
        S.keys = new Set(pick.map((l) => l.key));
        renderLayers();
        if (!people.length) say('No people were found, so the ' + pick[0].name.toLowerCase() + ' layer is the cut-out. Tick any layer to change that.', 'note');
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
    async function loadFiles(files) {
      const f = files && files[0]; if (!f) return;
      try {
        say(''); note('Reading the photo…'); status.textContent = 'Reading the photo…';
        const img = await A.loadImageFile(f);
        segToken++;
        S.image = img; S.seg = null; S.guide = null; S.alpha = null; S.cut = null; S.keys = new Set(); S.tint = null; S.bgCache = {}; S.variant = null;
        computeCrop();
        studio.hidden = false; drop.hidden = true;
        layerList.innerHTML = '';
        results.innerHTML = '';
        await A.ensureFont(S.text);
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
    showPane('layers');
    const api = { state: S, renderFrame, loadFiles, variantOf, results, panes, destroy: () => { mounted = false; } };
    root.aiimgTool = api;
    return api;
  }

  A.tools['thumbnail-maker'] = { mount };
})();
