/**
 * Sticker Maker.
 *
 * A die-cut sticker from any layer the model finds: the cut-out (people
 * through the MODNet matte, so hair survives), a border of any width and
 * colour grown from the cut by an exact distance transform, an optional
 * glow or drop shadow, and a smoothing that rounds the outline the way a
 * real die cutter would. Exports a PNG at a chosen size, a 512×512 WebP
 * under 100 KB for WhatsApp and Telegram, a 1080×1920 story, the PNG to
 * the clipboard, and a pack from up to thirty photos.
 *
 * The export pane is a plain list of buttons and result rows, so a share
 * strip (aiimg-share.js) can be appended to it without touching this file.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A) return;
  const M = A.matte;
  if (!M) return;
  const { el, clamp, field, select, range, colour, check, button, sleep, fmtBytes } = A;

  const PREVIEW_MAX = 1024;
  const PREVIEW_BUILD = 640;
  const BATCH_MAX = 30;
  const PACK = 512, PACK_MARGIN = 16, PACK_LIMIT = 100 * 1024;
  const STORY_W = 1080, STORY_H = 1920;
  const on = (ctrl, fn) => { const t = ctrl.input || ctrl; t.addEventListener('input', fn); t.addEventListener('change', fn); return ctrl; };
  const pct = (v) => v + '%';
  const toBlob = (c, type, q) => new Promise((r) => c.toBlob(r, type, q));

  /* ---------------- the sticker itself ---------------- */
  /** A canvas painted `colour` where the mask has alpha. */
  function fillThrough(mask, col) {
    const c = el('canvas'); c.width = mask.width; c.height = mask.height;
    const x = c.getContext('2d');
    x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(mask, 0, 0);
    return c;
  }
  const anyAlpha = (a) => { for (let i = 0; i < a.length; i++) if (a[i] > 0.004) return true; return false; };

  /**
   * Build the sticker on a transparent canvas whose long edge is about
   * `maxEdge` pixels. Returns { canvas, box } with box the tight bounds
   * [x0, y0, x1, y1] of what is visible, or null when nothing is kept.
   */
  function build(item, alpha, o) {
    const { mw, mh } = item.seg;
    const bb = M.bbox(alpha, mw, mh, 0.02);
    if (!bb) return null;
    const img = item.image;
    const sx = img.width / mw, sy = img.height / mh;
    const rx = bb[0] * sx, ry = bb[1] * sy, rw = (bb[2] - bb[0] + 1) * sx, rh = (bb[3] - bb[1] + 1) * sy;
    const long = Math.max(rw, rh);
    const R = clamp(Math.round(long), 128, o.maxEdge || 1024);
    const k = R / long;
    const cw0 = Math.max(2, Math.round(rw * k)), ch0 = Math.max(2, Math.round(rh * k));
    const b = (Number(o.border) || 0) / 100 * R;
    const g = o.glow ? (Number(o.glowSize) || 0) / 100 * R : 0;
    const sb = o.shadow ? (Number(o.shadowBlur) || 0) / 100 * R : 0;
    const so = o.shadow ? (Number(o.shadowY) || 0) / 100 * R : 0;
    const pad = Math.ceil(b + Math.max(g * 2.5, sb * 2.5 + Math.abs(so)) + 2);
    const cw = cw0 + 2 * pad, ch = ch0 + 2 * pad;
    const n = cw * ch;

    /* the cut-out's alpha at working size, padded */
    const a = M.resampleRect(alpha, mw, mh, [bb[0], bb[1], bb[2] - bb[0] + 1, bb[3] - bb[1] + 1], cw0, ch0);
    const aw = new Float32Array(n);
    for (let y = 0; y < ch0; y++) aw.set(a.subarray(y * cw0, (y + 1) * cw0), (y + pad) * cw + pad);

    /* the die-cut shape: the cut-out, closed (grown then shrunk by the
       smoothing radius) so gaps are bridged and corners rounded without a
       thin strap or a bicycle frame ever being dropped, then grown by the
       border */
    const inside = new Uint8Array(n);
    for (let i = 0; i < n; i++) inside[i] = aw[i] > 0.5 ? 1 : 0;
    const smooth = Number(o.smooth) || 0;
    const rs = smooth > 0 ? smooth / 100 * R : 0;
    if (rs >= 1) {
      const d1 = M.distance(inside, cw, ch);
      const grownOut = new Uint8Array(n);
      for (let i = 0; i < n; i++) grownOut[i] = d1[i] > rs ? 1 : 0;      /* the complement of the dilation */
      const d2 = M.distance(grownOut, cw, ch);
      for (let i = 0; i < n; i++) if (d2[i] > rs) inside[i] = 1;          /* eroded back: the closing */
    }
    let sil = aw;
    const hasBorder = b >= 0.5;
    if (hasBorder) {
      const dist = M.distance(inside, cw, ch);
      sil = new Float32Array(n);
      for (let i = 0; i < n; i++) sil[i] = clamp(b + 0.5 - dist[i], 0, 1);
    }
    const silMask = A.maskCanvas(sil, cw, ch);

    /* the picture through the cut-out's alpha */
    const cut = el('canvas'); cut.width = cw; cut.height = ch;
    const cx = cut.getContext('2d');
    cx.drawImage(A.maskCanvas(aw, cw, ch), 0, 0);
    cx.globalCompositeOperation = 'source-in';
    cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
    cx.drawImage(img.canvas, rx, ry, rw, rh, pad, pad, cw0, ch0);

    const out = el('canvas'); out.width = cw; out.height = ch;
    const x = out.getContext('2d');
    const canFilter = 'filter' in x;
    if (o.shadow && sb + Math.abs(so) > 0) {
      x.save();
      x.globalAlpha = clamp(Number(o.shadowOpacity) || 0.35, 0, 1);
      if (canFilter && sb > 0) x.filter = 'blur(' + sb.toFixed(1) + 'px)';
      x.drawImage(fillThrough(silMask, '#000000'), 0, so);
      x.restore();
    }
    if (o.glow && g > 0) {
      const glowC = fillThrough(silMask, o.glowColour || '#f7c948');
      x.save();
      if (canFilter) x.filter = 'blur(' + g.toFixed(1) + 'px)';
      x.drawImage(glowC, 0, 0); x.drawImage(glowC, 0, 0);
      x.restore();
    }
    if (hasBorder) x.drawImage(fillThrough(silMask, o.borderColour || '#ffffff'), 0, 0);
    x.drawImage(cut, 0, 0);

    /* tight bounds of what was painted */
    const d = x.getImageData(0, 0, cw, ch).data;
    let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
    for (let y = 0, i = 3; y < ch; y++) for (let xx = 0; xx < cw; xx++, i += 4) {
      if (d[i] < 6) continue;
      if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) return null;
    return { canvas: out, box: [x0, y0, x1, y1], w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  /** The sticker's visible part scaled to fit a w×h box, on a W×H canvas, centred. */
  function place(st, W, H, boxW, boxH, bg) {
    const c = el('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, W, H); }
    const s = Math.min(boxW / st.w, boxH / st.h);
    const dw = Math.max(1, Math.round(st.w * s)), dh = Math.max(1, Math.round(st.h * s));
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(st.canvas, st.box[0], st.box[1], st.w, st.h, Math.round((W - dw) / 2), Math.round((H - dh) / 2), dw, dh);
    return c;
  }
  /** The sticker alone, its long edge exactly `size` pixels. */
  function tight(st, size) {
    const s = size / Math.max(st.w, st.h);
    const W = Math.max(1, Math.round(st.w * s)), H = Math.max(1, Math.round(st.h * s));
    return place(st, W, H, W, H, null);
  }
  /** WebP under a byte limit, lowering the quality until it fits. */
  async function webpUnder(canvas, limit) {
    const steps = [0.92, 0.85, 0.78, 0.7, 0.62, 0.54, 0.46, 0.38, 0.3, 0.22, 0.15];
    let last = null, q = 1;
    for (q of steps) {
      const blob = await toBlob(canvas, 'image/webp', q);
      if (!blob) return null;
      if (blob.type !== 'image/webp') return { blob, q, fits: false, unsupported: true };
      last = blob;
      if (blob.size <= limit) return { blob, q, fits: true };
    }
    return { blob: last, q, fits: false };
  }

  /* ---------------- the tool ---------------- */
  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const S = {
      main: null, kept: new Set(), hair: true, softness: 3, shift: 0, detail: 'standard',
      st: { border: 4, borderColour: '#ffffff', smooth: 2, glow: false, glowColour: '#f7c948', glowSize: 5, shadow: false, shadowOpacity: 0.35, shadowBlur: 1.5, shadowY: 0.8 },
      size: 1024, storyBg: 'transparent', storyColour: '#111827', batchMode: 'pack', busy: false, batch: null, outputs: [], preview: null
    };

    /* skeleton */
    const wrap = el('div', 'aiimg aiimg-stk');
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose a photo</strong><span>or drag it here — nothing is uploaded. JPEG, PNG, WebP or HEIC.</span>';
    const file = el('input', 'visually-hidden');
    file.type = 'file'; file.accept = 'image/*'; file.setAttribute('aria-label', 'Choose a photo');
    const batchFile = el('input', 'visually-hidden');
    batchFile.type = 'file'; batchFile.accept = 'image/*'; batchFile.multiple = true; batchFile.setAttribute('aria-label', 'Choose photos for a sticker pack');

    const studio = el('div', 'aiimg-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage');
    const canvas = el('canvas', 'aiimg-canvas aiimg-stk-canvas is-checker');
    canvas.setAttribute('aria-label', 'Preview of the sticker');
    const stageMsg = el('div', 'aiimg-stagemsg'); stageMsg.hidden = true;
    stage.append(canvas, stageMsg);
    const transport = el('div', 'aiimg-transport');
    const change = button('Change photo', 'btn-ghost', () => file.click());
    const batchAdd = button('Add photos for a pack', 'btn-ghost', () => batchFile.click());
    batchAdd.id = 'aiimg-stk-batch-add';
    transport.append(change, batchAdd);
    stageCol.append(stage, transport);

    const side = el('div', 'aiimg-side');
    const tabs = el('div', 'aiimg-tabs'); tabs.setAttribute('role', 'tablist');
    const panes = {};
    for (const [k, label] of [['layers', 'Layers'], ['sticker', 'Sticker'], ['export', 'Export']]) {
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
    wrap.append(drop, file, batchFile, studio, msg);
    io.appendChild(wrap);

    function showPane(k) {
      for (const b of tabs.children) { const onIt = b.dataset.pane === k; b.classList.toggle('is-on', onIt); b.setAttribute('aria-selected', onIt ? 'true' : 'false'); }
      for (const p in panes) panes[p].hidden = p !== k;
    }
    function say(text, kind) { msg.textContent = text || ''; msg.className = 'io-msg' + (kind ? ' is-' + kind : ''); }
    function note(text) { stageMsg.textContent = text || ''; stageMsg.hidden = !text; }

    /* preview */
    const pctx = canvas.getContext('2d');
    let dirty = false, mounted = true;
    const invalidate = () => { if (!dirty) { dirty = true; requestAnimationFrame(draw); } };
    function sizePreview(w, h) {
      const s = Math.min(1, PREVIEW_MAX / Math.max(w, h));
      canvas.width = Math.max(1, Math.round(w * s));
      canvas.height = Math.max(1, Math.round(h * s));
    }
    function draw() {
      dirty = false;
      if (!mounted) return;
      const item = S.main; if (!item) return;
      const W = canvas.width, H = canvas.height;
      pctx.clearRect(0, 0, W, H);
      pctx.imageSmoothingEnabled = true; pctx.imageSmoothingQuality = 'high';
      if (!S.preview) {
        /* before the sticker exists, the photo itself */
        pctx.save(); pctx.globalAlpha = item.seg ? 0.35 : 1;
        pctx.drawImage(item.image.canvas, 0, 0, W, H);
        pctx.restore();
        return;
      }
      const st = S.preview;
      const m = Math.round(Math.min(W, H) * 0.06);
      const s = Math.min((W - 2 * m) / st.w, (H - 2 * m) / st.h);
      const dw = Math.max(1, Math.round(st.w * s)), dh = Math.max(1, Math.round(st.h * s));
      pctx.drawImage(st.canvas, st.box[0], st.box[1], st.w, st.h, Math.round((W - dw) / 2), Math.round((H - dh) / 2), dw, dh);
    }

    /* ---------------- layers pane ---------------- */
    const status = el('p', 'aiimg-status', 'Choose a photo to begin.');
    const progress = el('div', 'aiimg-progress'); const bar = el('i'); progress.appendChild(bar); progress.hidden = true;
    const layerList = el('div', 'aiimg-layers');
    const keepHint = el('p', 'field-hint', 'Ticked layers become the sticker. People and objects start ticked; tick a building or a tree to make a sticker of that instead.');
    const hairCtl = on(check('aiimg-stk-hair', 'Hair-quality edges for people', true), async () => {
      S.hair = hairCtl.input.checked;
      const item = S.main;
      if (S.hair && item && item.seg && !item.matte && !item.matteError) await ensureMatte(item);
      scheduleRebuild();
    });
    const hairField = el('div'); hairField.append(hairCtl, el('p', 'field-hint', 'A portrait matting model (MODNet, 25 MB, downloaded once) redraws the edge of every person it finds, strand by strand.'));
    hairField.hidden = true;
    const soft = on(range('aiimg-stk-soft', 0, 10, 1, S.softness), () => { S.softness = Number(soft.input.value); scheduleRebuild(); });
    const shiftCtl = on(range('aiimg-stk-shift', -5, 5, 1, S.shift, (v) => (v > 0 ? '+' : '') + v), () => { S.shift = Number(shiftCtl.input.value); scheduleRebuild(); });
    const detailSel = on(select('aiimg-stk-detail', Object.entries(A.DETAIL).map(([k, m]) => [k, m.label]), S.detail), () => { if (detailSel.value !== S.detail) { S.detail = detailSel.value; if (S.main) analyseMain(S.main.image); } });
    panes.layers.append(status, progress, layerList, keepHint, hairField,
      field('Edge softness', soft, 'Higher follows hair and fur more loosely; lower keeps a crisp cut.'),
      field('Grow or shrink the cut', shiftCtl, 'Grow it to hide a halo of background around the subject; shrink it if a fringe of background clings to the edge.'),
      field('Detail', detailSel, 'Standard suits most photos. High and Maximum look at the picture at a higher resolution — sharper on small parts, slower.'));

    /* ---------------- sticker pane ---------------- */
    const grid = (...fields) => { const g = el('div', 'aiimg-grid2'); g.append(...fields); return g; };
    const h = (t) => el('p', 'aiimg-h', t);
    const borderW = on(range('aiimg-stk-border', 0, 15, 0.5, S.st.border, pct), () => { S.st.border = Number(borderW.input.value); scheduleBuild(); });
    const borderCol = on(colour('aiimg-stk-border-colour', S.st.borderColour), () => { S.st.borderColour = borderCol.value; scheduleBuild(); });
    const smoothCtl = on(range('aiimg-stk-smooth', 0, 10, 0.5, S.st.smooth, (v) => (v ? v + '%' : 'off')), () => { S.st.smooth = Number(smoothCtl.input.value); scheduleBuild(); });
    const glowOn = on(check('aiimg-stk-glow', 'Glow around the border', false), () => { S.st.glow = glowOn.input.checked; syncSticker(); scheduleBuild(); });
    const glowCol = on(colour('aiimg-stk-glow-colour', S.st.glowColour), () => { S.st.glowColour = glowCol.value; scheduleBuild(); });
    const glowSize = on(range('aiimg-stk-glow-size', 1, 15, 0.5, S.st.glowSize, pct), () => { S.st.glowSize = Number(glowSize.input.value); scheduleBuild(); });
    const shadowOn = on(check('aiimg-stk-shadow', 'Drop shadow', false), () => { S.st.shadow = shadowOn.input.checked; syncSticker(); scheduleBuild(); });
    const shadowOp = on(range('aiimg-stk-shadow-op', 5, 100, 5, 35, pct), () => { S.st.shadowOpacity = Number(shadowOp.input.value) / 100; scheduleBuild(); });
    const shadowBlur = on(range('aiimg-stk-shadow-blur', 0, 8, 0.5, S.st.shadowBlur, pct), () => { S.st.shadowBlur = Number(shadowBlur.input.value); scheduleBuild(); });
    const shadowY = on(range('aiimg-stk-shadow-y', -5, 5, 0.5, S.st.shadowY, pct), () => { S.st.shadowY = Number(shadowY.input.value); scheduleBuild(); });
    const glowFields = grid(field('Glow colour', glowCol), field('Glow size', glowSize));
    const shadowFields = el('div');
    shadowFields.append(grid(field('Shadow strength', shadowOp), field('Shadow blur', shadowBlur)), field('Shadow offset (down)', shadowY));
    panes.sticker.append(
      h('Border'),
      grid(field('Border width', borderW), field('Border colour', borderCol)),
      el('p', 'field-hint', 'Sizes are a share of the sticker\'s long edge, so the look is the same at 512 px and at 2048 px. WhatsApp\'s design guide suggests about 1.5% (8 px on a 512 px sticker).'),
      field('Die-cut smoothing', smoothCtl, 'Rounds the outline and bridges small gaps the way a die cutter would. The cut-out itself keeps its detail; only the border\'s shape is smoothed.'),
      h('Effects'),
      glowOn, glowFields,
      shadowOn, shadowFields
    );
    function syncSticker() { glowFields.hidden = !S.st.glow; shadowFields.hidden = !S.st.shadow; }
    syncSticker();

    /* ---------------- export pane ---------------- */
    const sizeSel = on(select('aiimg-stk-size', [['512', '512 px'], ['1024', '1024 px'], ['2048', '2048 px']], String(S.size)), () => { S.size = Number(sizeSel.value); });
    const pngBtn = button('Download the sticker (PNG)', 'btn-primary', exportPng); pngBtn.id = 'aiimg-stk-png';
    const copyBtn = button('Copy to clipboard', 'btn-ghost', copyPng); copyBtn.id = 'aiimg-stk-copy';
    const packBtn = button('Export for WhatsApp / Telegram (512×512 WebP)', 'btn-primary', exportPack); packBtn.id = 'aiimg-stk-pack';
    const storyBg = on(select('aiimg-stk-story-bg', [['transparent', 'Transparent'], ['colour', 'A solid colour']], 'transparent'), () => { S.storyBg = storyBg.value; storyColourField.hidden = S.storyBg !== 'colour'; });
    const storyColour = on(colour('aiimg-stk-story-colour', S.storyColour), () => { S.storyColour = storyColour.value; });
    const storyColourField = field('Story colour', storyColour); storyColourField.hidden = true;
    const storyBtn = button('Export a story (1080×1920 PNG)', 'btn-primary', exportStory); storyBtn.id = 'aiimg-stk-story';
    const batchMode = on(select('aiimg-stk-batch-mode', [['pack', 'WhatsApp / Telegram stickers — 512×512 WebP'], ['png', 'PNG stickers at the size above']], 'pack'), () => { S.batchMode = batchMode.value; });
    const batchStatus = el('p', 'aiimg-status', ''); batchStatus.hidden = true;
    const batchProgress = el('div', 'aiimg-progress'); const batchBar = el('i'); batchProgress.appendChild(batchBar); batchProgress.hidden = true;
    const batchCancel = button('Stop', 'btn-ghost', () => { if (S.batch) S.batch.cancel = true; }); batchCancel.hidden = true;
    const dlAll = button('Download all', 'btn-ghost', downloadAll); dlAll.id = 'aiimg-stk-download-all'; dlAll.hidden = true;
    const results = el('div', 'aiimg-results');
    const row = (...b) => { const r = el('div', 'aiimg-row'); r.append(...b); return r; };
    if (!(navigator.clipboard && typeof window.ClipboardItem === 'function')) { copyBtn.disabled = true; copyBtn.title = 'This browser cannot put images on the clipboard.'; }
    panes.export.append(
      h('Sticker'),
      field('Long edge', sizeSel),
      row(pngBtn, copyBtn),
      h('WhatsApp and Telegram'),
      el('p', 'field-hint', 'WhatsApp stickers are 512×512 WebP files under 100 KB with a transparent background; the sticker is fitted inside a 16 px margin and the quality lowered until it fits. Telegram takes the same file. Add it with any sticker-maker app, or import a whole pack.'),
      row(packBtn),
      h('Story'),
      grid(field('Behind the sticker', storyBg), storyColourField),
      row(storyBtn),
      h('A pack from many photos'),
      field('Make each photo into', batchMode, 'Up to ' + BATCH_MAX + ' photos go through the same settings — the same kinds of layer kept, border, effects.'),
      row(dlAll, batchCancel),
      batchStatus, batchProgress, results
    );

    /* ---------------- results ---------------- */
    function addResult(out, extra) {
      const r = el('div', 'aiimg-result');
      const head = el('div', 'aiimg-result-head');
      const strong = el('strong', null, out.name);
      const meta = el('span', null, fmtBytes(out.blob.size) + ' · ' + out.width + '×' + out.height + (extra ? ' · ' + extra : ''));
      const url = URL.createObjectURL(out.blob);
      const dl = el('a', 'btn-download', 'Download'); dl.href = url; dl.download = out.name;
      head.append(strong, meta, dl);
      const img = el('img'); img.alt = 'Sticker preview'; img.src = url; img.loading = 'lazy'; img.className = 'aiimg-stk-thumb';
      r.append(head, img);
      results.insertBefore(r, results.firstChild);
      S.outputs.push(out);
      dlAll.hidden = S.outputs.length < 2;
      return r;
    }
    function addNote(name, text) {
      const r = el('div', 'aiimg-result');
      const head = el('div', 'aiimg-result-head');
      head.append(el('strong', null, name), el('span', null, text));
      r.appendChild(head);
      results.insertBefore(r, results.firstChild);
    }
    async function downloadAll() {
      if (!S.outputs.length) return;
      dlAll.disabled = true; dlAll.textContent = 'Packing…';
      try { S.lastZip = await M.downloadAll(S.outputs, 'stickers.zip'); }
      catch (e) { say((e && e.message) || String(e), 'error'); }
      finally { dlAll.disabled = false; dlAll.textContent = 'Download all'; }
    }

    /* ---------------- processing ---------------- */
    let mainToken = 0;
    function onProgress(p) {
      if (p.model === 'segment') {
        if (p.stage === 'download') { status.textContent = 'Downloading the layer model once' + (p.total ? ' — ' + fmtBytes(p.loaded) + ' of ' + fmtBytes(p.total) : '') + '. Your browser keeps it.'; bar.style.width = Math.round(p.fraction * 30) + '%'; }
        else if (p.stage === 'run') { status.textContent = 'Finding the layers on your device…'; bar.style.width = Math.round(30 + p.fraction * 30) + '%'; }
      } else if (p.model === 'matte') {
        if (p.stage === 'download') { status.textContent = 'Downloading the hair model once' + (p.total ? ' — ' + fmtBytes(p.loaded) + ' of ' + fmtBytes(p.total) : '') + '. Your browser keeps it.'; bar.style.width = Math.round(60 + p.fraction * 25) + '%'; }
        else { status.textContent = 'Drawing the hair edges…'; bar.style.width = '90%'; }
      }
    }
    async function ensureMatte(item) {
      try {
        progress.hidden = false;
        const m = await M.run(item.image, { mw: item.seg.mw, mh: item.seg.mh, onProgress: (p) => onProgress(Object.assign({ model: 'matte' }, p)) });
        item.matte = m.alpha; item.matteInfo = { input: m.input, ms: m.ms };
      } catch (e) { item.matteError = (e && e.message) || String(e); say('Hair-quality edges are off: ' + item.matteError, 'warn'); }
      finally { progress.hidden = true; }
    }
    async function analyseMain(image) {
      const token = ++mainToken;
      S.busy = true; batchAdd.disabled = true;
      progress.hidden = false; bar.style.width = '0%';
      status.textContent = 'Preparing the AI model…';
      note('Finding the layers…');
      try {
        const item = await M.analyse(image, { detail: S.detail, hair: S.hair, onProgress: (p) => { if (token === mainToken) onProgress(p); } });
        if (token !== mainToken) return;
        S.main = item;
        S.kept = new Set(item.seg.layers.filter((l) => l.subject).map((l) => l.key));
        M.layerRows(layerList, item.seg, S.kept, () => scheduleRebuild());
        hairField.hidden = M.personKey(item.seg) < 0;
        if (item.matteError) say('Hair-quality edges are off for this photo: ' + item.matteError, 'warn'); else say('');
        if (!S.kept.size) say('No person or object was found to make a sticker of. Tick any layer to use it.', 'note');
        await rebuild();
      } catch (e) {
        if (token !== mainToken) return;
        status.textContent = 'The layers could not be found.';
        say((e && e.message) || String(e), 'error');
      } finally {
        if (token === mainToken) { progress.hidden = true; note(''); S.busy = false; batchAdd.disabled = false; }
      }
    }
    let rebuildTimer = 0, rebuildToken = 0;
    function scheduleRebuild() { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuild, 120); }
    async function rebuild() {
      const item = S.main; if (!item || !item.seg) return;
      const token = ++rebuildToken;
      note('Refining the edges…');
      await sleep(0);
      if (token !== rebuildToken) return;
      const r = M.cut(item, { kept: S.kept, softness: S.softness, shift: S.shift, hair: S.hair });
      if (token !== rebuildToken) return;
      item.alphaLayer = r.alphaLayer; item.alphaFull = r.alphaFull; item.box = r.box; item.matteUsed = r.matteUsed; item.matteSkipped = r.matteSkipped;
      await buildPreview();
      if (token !== rebuildToken) return;
      note('');
      const n = item.seg.layers.length;
      const names = item.seg.layers.filter((l) => S.kept.has(l.key)).map((l) => l.name);
      let hair = '';
      if (S.hair && item.matte && names.some((x) => x === 'People')) hair = r.matteUsed ? ' Hair-quality edges on.' : ' The portrait model did not find the people clearly, so they keep the layer edge.';
      status.textContent = n + ' layer' + (n === 1 ? '' : 's') + ' found' + (names.length ? '; sticker of ' + names.slice(0, 4).join(', ') + (names.length > 4 ? '…' : '') + '.' : '; nothing kept.') + hair + ' — ready';
    }
    let buildTimer = 0, buildToken = 0;
    function scheduleBuild() { clearTimeout(buildTimer); buildTimer = setTimeout(buildPreview, 100); }
    async function buildPreview() {
      const item = S.main; if (!item || !item.alphaFull) return;
      const token = ++buildToken;
      note('Cutting the sticker…');
      await sleep(0);
      if (token !== buildToken) return;
      S.preview = anyAlpha(item.alphaFull) ? build(item, item.alphaFull, Object.assign({ maxEdge: PREVIEW_BUILD }, S.st)) : null;
      note('');
      invalidate();
    }

    async function loadMain(f) {
      try {
        say(''); note('Reading the photo…');
        status.textContent = 'Reading the photo…';
        mainToken++;
        const image = await A.loadImageFile(f);
        S.main = { image, seg: null }; S.preview = null;
        S.kept = new Set();
        sizePreview(image.width, image.height);
        studio.hidden = false; drop.hidden = true;
        layerList.innerHTML = '';
        invalidate();
        showPane('layers');
        await analyseMain(image);
      } catch (e) {
        note('');
        say((e && e.message) || String(e), 'error');
      }
    }
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    ['dragenter', 'dragover'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    wrap.addEventListener('drop', (e) => {
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      if (e.dataTransfer.files.length > 1 && S.main && S.main.seg) runBatch(e.dataTransfer.files); else loadMain(e.dataTransfer.files[0]);
    });
    file.addEventListener('change', () => { if (file.files.length) loadMain(file.files[0]); file.value = ''; });
    batchFile.addEventListener('change', () => { if (batchFile.files.length) runBatch(batchFile.files); batchFile.value = ''; });

    /* ---------------- exports ---------------- */
    const ready = () => S.main && S.main.seg && S.main.alphaFull && !S.busy;
    function stickerAt(item, maxEdge) {
      if (!item.alphaFull || !anyAlpha(item.alphaFull)) return null;
      return build(item, item.alphaFull, Object.assign({ maxEdge }, S.st));
    }
    async function pngOf(item, size) {
      const st = stickerAt(item, size);
      if (!st) throw new Error('Nothing is kept yet. Tick a layer first.');
      const c = tight(st, size);
      const blob = await toBlob(c, 'image/png');
      return { blob, name: item.image.name + '-sticker.png', width: c.width, height: c.height };
    }
    async function packOf(item) {
      const st = stickerAt(item, PACK);
      if (!st) throw new Error('Nothing is kept yet. Tick a layer first.');
      const c = place(st, PACK, PACK, PACK - 2 * PACK_MARGIN, PACK - 2 * PACK_MARGIN, null);
      const r = await webpUnder(c, PACK_LIMIT);
      if (!r) throw new Error('This browser could not encode WebP.');
      return { blob: r.blob, name: item.image.name + '-sticker-512.webp', width: PACK, height: PACK, q: r.q, fits: r.fits, unsupported: r.unsupported };
    }
    async function storyOf(item) {
      const st = stickerAt(item, Math.round(STORY_W * 0.8));
      if (!st) throw new Error('Nothing is kept yet. Tick a layer first.');
      const c = place(st, STORY_W, STORY_H, Math.round(STORY_W * 0.7), Math.round(STORY_H * 0.7), S.storyBg === 'colour' ? S.storyColour : null);
      const blob = await toBlob(c, 'image/png');
      return { blob, name: item.image.name + '-story.png', width: STORY_W, height: STORY_H };
    }
    async function guarded(btn, fn) {
      if (!ready()) { say('Choose a photo and wait for the layers first.', 'note'); return; }
      try { btn.disabled = true; say(''); note('Building the sticker…'); await sleep(0); await fn(); }
      catch (e) { say((e && e.message) || String(e), 'error'); }
      finally { btn.disabled = false; note(''); }
    }
    function exportPng() {
      return guarded(pngBtn, async () => { const out = await pngOf(S.main, S.size); addResult(out, 'transparent PNG'); A.download(out.blob, out.name); });
    }
    function copyPng() {
      return guarded(copyBtn, async () => {
        if (!(navigator.clipboard && typeof window.ClipboardItem === 'function')) throw new Error('This browser cannot put images on the clipboard. Download the PNG instead.');
        const out = await pngOf(S.main, Math.min(S.size, 1024));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': out.blob })]);
        say('Copied — paste it into a chat, a document or an image editor.', 'note');
        S.lastCopied = out;
      });
    }
    function exportPack() {
      return guarded(packBtn, async () => {
        const out = await packOf(S.main);
        addResult(out, out.unsupported ? 'this browser saved a PNG instead of WebP' : out.fits ? 'WebP · quality ' + Math.round(out.q * 100) + '% · under 100 KB' : 'WebP · still over 100 KB at the lowest quality');
        A.download(out.blob, out.name);
        if (out.unsupported) say('This browser cannot write WebP, so a 512×512 PNG was saved. Telegram accepts it; WhatsApp needs WebP — a sticker app will convert it.', 'warn');
        else if (!out.fits) say('Even at the lowest quality this sticker is over 100 KB (' + fmtBytes(out.blob.size) + '). A simpler subject or a thinner border makes a smaller file; WhatsApp may refuse it as it is.', 'warn');
      });
    }
    function exportStory() {
      return guarded(storyBtn, async () => { const out = await storyOf(S.main); addResult(out, 'story · 1080×1920'); A.download(out.blob, out.name); });
    }
    async function runBatch(files) {
      if (S.busy || S.batch) return;
      const list = Array.from(files).slice(0, BATCH_MAX);
      if (!list.length) return;
      if (files.length > BATCH_MAX) say('Up to ' + BATCH_MAX + ' photos at a time — the first ' + BATCH_MAX + ' were taken.', 'warn');
      if (!S.main || !S.main.seg) { await loadMain(list[0]); if (!S.main || !S.main.seg) return; }
      const batch = S.batch = { total: list.length, cancel: false, outputs: [] };
      S.busy = true; batchAdd.disabled = true; batchCancel.hidden = false;
      batchStatus.hidden = false; batchProgress.hidden = false; batchBar.style.width = '0%';
      showPane('export');
      const labels = new Set(S.main.seg.layers.filter((l) => S.kept.has(l.key)).map((l) => l.label));
      const t0 = performance.now();
      let done = 0, over = 0;
      for (let i = 0; i < list.length; i++) {
        if (batch.cancel) break;
        const f = list[i];
        const head = 'Photo ' + (i + 1) + ' of ' + list.length + ' — ' + f.name + ': ';
        batchStatus.textContent = head + 'reading…';
        try {
          const image = await A.loadImageFile(f);
          const item = await M.analyse(image, { detail: S.detail, hair: S.hair, onProgress: (p) => { batchStatus.textContent = head + (p.model === 'matte' ? 'drawing the hair edges' : p.stage === 'download' ? 'downloading a model once' : 'finding the layers') + '…'; } });
          const kept = M.keepLike(item.seg, labels);
          if (!kept.size) { addNote(f.name, 'No person or object was found to make a sticker of, so this photo was skipped.'); continue; }
          batchStatus.textContent = head + 'cutting the sticker…';
          await sleep(0);
          const r = M.cut(item, { kept, softness: S.softness, shift: S.shift, hair: S.hair });
          item.alphaFull = r.alphaFull; item.box = r.box;
          const out = S.batchMode === 'pack' ? await packOf(item) : await pngOf(item, S.size);
          if (out.fits === false) over++;
          batch.outputs.push(out);
          addResult(out, S.batchMode === 'pack' ? (out.fits ? 'WebP under 100 KB' : 'WebP over 100 KB') : 'PNG');
          done++;
          item.guide = null; item.matte = null; item.alphaFull = null;
        } catch (e) { addNote(f.name, (e && e.message) || String(e)); }
        batchBar.style.width = Math.round((i + 1) / list.length * 100) + '%';
        await sleep(0);
      }
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      batchStatus.textContent = (batch.cancel ? 'Pack stopped: ' : 'Pack done: ') + done + ' of ' + list.length + ' sticker' + (list.length === 1 ? '' : 's') + ' in ' + secs + ' s' + (over ? ' (' + over + ' over 100 KB)' : '') + ' — ready';
      batchProgress.hidden = true; batchCancel.hidden = true;
      S.batch = null; S.busy = false; batchAdd.disabled = false;
    }

    showPane('layers');
    const api = { state: S, build, place, tight, webpUnder, loadFiles: (files) => loadMain(files[0]), runBatch, exportPng, exportPack, exportStory, copyPng, destroy: () => { mounted = false; } };
    A.instances = A.instances || {};
    A.instances['sticker-maker'] = api;
    return api;
  }

  A.tools['sticker-maker'] = { mount };
})();
