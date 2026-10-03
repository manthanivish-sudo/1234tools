/**
 * AI Background Remover.
 *
 * The picture is split into layers on the device; the reader ticks what
 * to keep. People get their edges from MODNet, a portrait matting model,
 * so hair survives; everything else is refined against the pixels. The
 * background is transparent, a colour, a gradient or the photo blurred;
 * the frame can be cropped to a story, a square or a portrait around the
 * kept layers; and a queue of photos goes through with the same settings.
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

  const PREVIEW_MAX = 1280;
  const BATCH_MAX = 20;
  const ASPECTS = { original: null, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5, '16:9': 16 / 9 };
  const CROPS = [['original', 'Original — the whole frame'], ['9:16', '9:16 — story, Reel, TikTok'], ['1:1', '1:1 — square'], ['4:5', '4:5 — Instagram portrait'], ['16:9', '16:9 — wide']];
  const on = (ctrl, fn) => { const t = ctrl.input || ctrl; t.addEventListener('input', fn); t.addEventListener('change', fn); return ctrl; };
  const pct = (v) => Math.round(v) + '%';

  /* ---------------- geometry ---------------- */
  /** The crop frame in image pixels: the largest rect of that shape, centred on the kept layers. */
  function cropRect(item, aspect) {
    const W = item.image.width, H = item.image.height;
    const a = ASPECTS[aspect];
    if (!a) return { x: 0, y: 0, w: W, h: H };
    let w, h;
    if (W / H > a) { h = H; w = Math.round(H * a); } else { w = W; h = Math.round(W / a); }
    w = clamp(w, 2, W); h = clamp(h, 2, H);
    let cx = W / 2, cy = H / 2;
    if (item.box && item.seg) {
      const s = W / item.seg.mw;
      cx = (item.box[0] + item.box[2] + 1) / 2 * s;
      cy = (item.box[1] + item.box[3] + 1) / 2 * s;
    }
    return { x: Math.round(clamp(cx - w / 2, 0, W - w)), y: Math.round(clamp(cy - h / 2, 0, H - h)), w, h };
  }
  /** Output size for a crop under a long-edge cap; aspect crops keep their exact ratio. */
  function outSize(crop, cap, aspect) {
    const a = ASPECTS[aspect];
    const s = cap ? Math.min(1, cap / Math.max(crop.w, crop.h)) : 1;
    let width = Math.max(2, Math.round(crop.w * s)), height = Math.max(2, Math.round(crop.h * s));
    if (a) { if (a >= 1) height = Math.max(2, Math.round(width / a)); else width = Math.max(2, Math.round(height * a)); }
    return { width, height };
  }

  /* ---------------- drawing ---------------- */
  function gradientFor(ctx, W, H, bg) {
    const a = ((Number(bg.angle) || 0) - 90) * Math.PI / 180;
    const dx = Math.cos(a), dy = Math.sin(a);
    const L = (Math.abs(dx) * W + Math.abs(dy) * H) / 2;
    const g = ctx.createLinearGradient(W / 2 - dx * L, H / 2 - dy * L, W / 2 + dx * L, H / 2 + dy * L);
    g.addColorStop(0, bg.colour); g.addColorStop(1, bg.colour2);
    return g;
  }
  /** The blurred photo as a backdrop. ctx.filter where the browser has it; a shrink-and-grow otherwise. */
  function drawBlurred(ctx, W, H, image, crop, amount) {
    const px = Math.max(1, amount / 100 * Math.max(W, H) * 0.12);
    const e = Math.ceil(px * 2);
    if ('filter' in ctx) {
      ctx.save();
      ctx.filter = 'blur(' + px.toFixed(1) + 'px)';
      ctx.drawImage(image.canvas, crop.x, crop.y, crop.w, crop.h, -e, -e, W + 2 * e, H + 2 * e);
      ctx.restore();
      return;
    }
    const k = Math.max(1, px / 1.5);
    const small = document.createElement('canvas');
    small.width = Math.max(1, Math.round(W / k)); small.height = Math.max(1, Math.round(H / k));
    const sx = small.getContext('2d');
    sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = 'high';
    sx.drawImage(image.canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, small.width, small.height);
    ctx.save();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, -e, -e, W + 2 * e, H + 2 * e);
    ctx.restore();
  }
  /** One frame: the background, then the cut-out, for the crop rect mapped onto W×H. */
  function compose(ctx, W, H, item, crop, variant, bg) {
    ctx.save();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, W, H);
    if (bg.mode === 'colour') { ctx.fillStyle = bg.colour; ctx.fillRect(0, 0, W, H); }
    else if (bg.mode === 'gradient') { ctx.fillStyle = gradientFor(ctx, W, H, bg); ctx.fillRect(0, 0, W, H); }
    else if (bg.mode === 'blur') drawBlurred(ctx, W, H, item.image, crop, Number(bg.blur) || 12);
    const cut = variant === 'layer' ? item.cutLayer : item.cutFull;
    if (cut) ctx.drawImage(cut, crop.x, crop.y, crop.w, crop.h, 0, 0, W, H);
    ctx.restore();
  }
  const anyAlpha = (a) => { for (let i = 0; i < a.length; i++) if (a[i] > 0.004) return true; return false; };

  /* ---------------- the tool ---------------- */
  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const S = {
      main: null, kept: new Set(), hair: true, softness: 3, shift: 0, detail: 'standard', view: 'result',
      bg: { mode: 'transparent', colour: '#ffffff', colour2: '#f7c948', angle: 180, blur: 12 },
      crop: 'original', format: 'image/png', size: 0, quality: 0.9, busy: false, batch: null, outputs: []
    };

    /* skeleton */
    const wrap = el('div', 'aiimg aiimg-bgr');
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose a photo</strong><span>or drag it here — nothing is uploaded. JPEG, PNG, WebP or HEIC.</span>';
    const file = el('input', 'visually-hidden');
    file.type = 'file'; file.accept = 'image/*'; file.setAttribute('aria-label', 'Choose a photo');
    const batchFile = el('input', 'visually-hidden');
    batchFile.type = 'file'; batchFile.accept = 'image/*'; batchFile.multiple = true; batchFile.setAttribute('aria-label', 'Choose photos for a batch');

    const studio = el('div', 'aiimg-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage');
    const canvas = el('canvas', 'aiimg-canvas aiimg-bgr-canvas is-checker');
    canvas.setAttribute('aria-label', 'Preview of the cut-out');
    const stageMsg = el('div', 'aiimg-stagemsg'); stageMsg.hidden = true;
    stage.append(canvas, stageMsg);
    const transport = el('div', 'aiimg-transport');
    const change = button('Change photo', 'btn-ghost', () => file.click());
    const batchAdd = button('Add photos for a batch', 'btn-ghost', () => batchFile.click());
    batchAdd.id = 'aiimg-bgr-batch-add';
    transport.append(change, batchAdd);
    stageCol.append(stage, transport);

    const side = el('div', 'aiimg-side');
    const tabs = el('div', 'aiimg-tabs'); tabs.setAttribute('role', 'tablist');
    const panes = {};
    for (const [k, label] of [['layers', 'Layers'], ['background', 'Background'], ['export', 'Export']]) {
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
    function sizePreview() {
      const img = S.main.image;
      const s = Math.min(1, PREVIEW_MAX / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * s));
      canvas.height = Math.max(1, Math.round(img.height * s));
    }
    function maskCanvasOf(item) {
      if (item.maskFull) return item.maskFull;
      const { mw, mh } = item.seg;
      const c = el('canvas'); c.width = mw; c.height = mh;
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, mw, mh);
      x.globalCompositeOperation = 'destination-in';
      x.drawImage(A.maskCanvas(item.alphaFull, mw, mh), 0, 0);
      item.maskFull = c;
      return c;
    }
    function label(ctx, text, x, y, alignRight) {
      ctx.save();
      ctx.font = '600 12px "Inter", system-ui, sans-serif';
      const w = ctx.measureText(text).width + 14;
      const bx = alignRight ? x - w : x;
      ctx.fillStyle = 'rgba(6,8,15,.72)'; ctx.fillRect(bx, y, w, 22);
      ctx.fillStyle = '#f7c948'; ctx.textBaseline = 'middle'; ctx.fillText(text, bx + 7, y + 11);
      ctx.restore();
    }
    function draw() {
      dirty = false;
      if (!mounted) return;
      const item = S.main; if (!item) return;
      const W = canvas.width, H = canvas.height;
      const full = { x: 0, y: 0, w: item.image.width, h: item.image.height };
      canvas.classList.toggle('is-checker', S.bg.mode === 'transparent' && S.view !== 'mask');
      if (!item.seg || !item.alphaFull) {
        pctx.clearRect(0, 0, W, H);
        pctx.drawImage(item.image.canvas, 0, 0, W, H);
        return;
      }
      if (S.view === 'mask') {
        pctx.fillStyle = '#000'; pctx.fillRect(0, 0, W, H);
        pctx.drawImage(maskCanvasOf(item), 0, 0, W, H);
      } else if (S.view === 'split') {
        if (!item.cutLayer) item.cutLayer = anyAlpha(item.alphaLayer) ? A.cutOut(item.image, item.alphaLayer, item.seg.mw, item.seg.mh) : null;
        compose(pctx, W, H, item, full, 'layer', S.bg);
        const half = Math.round(W / 2);
        pctx.save(); pctx.beginPath(); pctx.rect(half, 0, W - half, H); pctx.clip();
        compose(pctx, W, H, item, full, 'full', S.bg);
        pctx.restore();
        pctx.save();
        pctx.strokeStyle = '#f7c948'; pctx.lineWidth = 2; pctx.beginPath(); pctx.moveTo(half, 0); pctx.lineTo(half, H); pctx.stroke();
        pctx.restore();
        label(pctx, 'Layer mask only', 8, 8);
        label(pctx, 'With hair-quality edges', W - 8, 8, true);
      } else {
        if (S.view === 'layer' && !item.cutLayer) item.cutLayer = anyAlpha(item.alphaLayer) ? A.cutOut(item.image, item.alphaLayer, item.seg.mw, item.seg.mh) : null;
        compose(pctx, W, H, item, full, S.view === 'layer' ? 'layer' : 'full', S.bg);
      }
      if (S.crop !== 'original') {
        const c = cropRect(item, S.crop);
        const s = W / item.image.width;
        const x = c.x * s, y = c.y * s, w = c.w * s, h = c.h * s;
        pctx.save();
        pctx.fillStyle = 'rgba(6,8,15,.55)';
        pctx.beginPath(); pctx.rect(0, 0, W, H); pctx.rect(x, y, w, h); pctx.fill('evenodd');
        pctx.setLineDash([6, 5]); pctx.lineWidth = 1.5; pctx.strokeStyle = 'rgba(247,201,72,.95)';
        pctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        pctx.restore();
        label(pctx, S.crop + ' crop', x + 8, y + h - 30);
      }
    }

    /* ---------------- layers pane ---------------- */
    const status = el('p', 'aiimg-status', 'Choose a photo to begin.');
    const progress = el('div', 'aiimg-progress'); const bar = el('i'); progress.appendChild(bar); progress.hidden = true;
    const layerList = el('div', 'aiimg-layers');
    const keepHint = el('p', 'field-hint', 'Ticked layers are kept; everything else becomes the background. People and objects start ticked — tick Sky alone to keep only the sky.');
    const hairCtl = on(check('aiimg-bgr-hair', 'Hair-quality edges for people', true), async () => {
      S.hair = hairCtl.input.checked;
      const item = S.main;
      if (S.hair && item && item.seg && !item.matte && !item.matteError) await ensureMatte(item);
      scheduleRebuild();
    });
    const hairField = el('div'); hairField.append(hairCtl, el('p', 'field-hint', 'A portrait matting model (MODNet, 25 MB, downloaded once) redraws the edge of every person it finds, strand by strand. Off, the person keeps the layer edge like everything else.'));
    hairField.hidden = true;
    const viewSel = on(select('aiimg-bgr-view', [['result', 'The result'], ['split', 'Compare: layer mask | hair-quality edges'], ['layer', 'Layer mask only'], ['mask', 'The alpha mask']], 'result'), () => { S.view = viewSel.value; invalidate(); });
    const soft = on(range('aiimg-bgr-soft', 0, 10, 1, S.softness), () => { S.softness = Number(soft.input.value); scheduleRebuild(); });
    const shiftCtl = on(range('aiimg-bgr-shift', -5, 5, 1, S.shift, (v) => (v > 0 ? '+' : '') + v), () => { S.shift = Number(shiftCtl.input.value); scheduleRebuild(); });
    const detailSel = on(select('aiimg-bgr-detail', Object.entries(A.DETAIL).map(([k, m]) => [k, m.label]), S.detail), () => { if (detailSel.value !== S.detail) { S.detail = detailSel.value; if (S.main) analyseMain(S.main.image); } });
    panes.layers.append(status, progress, layerList, keepHint, hairField,
      field('Show', viewSel, 'The compare view puts the plain layer mask on the left and the matted edge on the right of the same photo.'),
      field('Edge softness', soft, 'Higher follows hair and fur more loosely; lower keeps a crisp cut.'),
      field('Grow or shrink the cut', shiftCtl, 'Grow it to hide a halo of background around the subject; shrink it if a fringe of background clings to the edge.'),
      field('Detail', detailSel, 'Standard suits most photos. High and Maximum show the model the picture at a higher resolution — sharper on small parts and thin edges, slower. The download is the same.'));

    /* ---------------- background pane ---------------- */
    const bgMode = on(select('aiimg-bgr-bg', [['transparent', 'Transparent'], ['colour', 'A solid colour'], ['gradient', 'A two-colour gradient'], ['blur', 'The photo, blurred']], 'transparent'), () => { S.bg.mode = bgMode.value; syncBg(); invalidate(); });
    const bgColour = on(colour('aiimg-bgr-colour', S.bg.colour), () => { S.bg.colour = bgColour.value; invalidate(); });
    const bgColour2 = on(colour('aiimg-bgr-colour2', S.bg.colour2), () => { S.bg.colour2 = bgColour2.value; invalidate(); });
    const bgAngle = on(range('aiimg-bgr-angle', 0, 360, 5, S.bg.angle, (v) => v + '°'), () => { S.bg.angle = Number(bgAngle.input.value); invalidate(); });
    const bgBlur = on(range('aiimg-bgr-blur', 1, 40, 1, S.bg.blur), () => { S.bg.blur = Number(bgBlur.input.value); invalidate(); });
    const cropSel = on(select('aiimg-bgr-crop', CROPS, 'original'), () => { S.crop = cropSel.value; invalidate(); });
    const colourField = field('Colour', bgColour), colour2Field = field('Second colour', bgColour2), angleField = field('Gradient angle', bgAngle), blurField = field('Blur amount', bgBlur);
    const grid = (...fields) => { const g = el('div', 'aiimg-grid2'); g.append(...fields); return g; };
    const h = (t) => el('p', 'aiimg-h', t);
    panes.background.append(
      field('Behind the cut-out', bgMode, 'Transparent exports a PNG or WebP with an alpha channel. Anything else is painted in.'),
      grid(colourField, colour2Field), angleField, blurField,
      h('Crop'),
      field('Frame', cropSel, 'The frame is centred on the layers you keep and shown on the preview. The export has exactly this shape.')
    );
    function syncBg() {
      const m = S.bg.mode;
      colourField.hidden = !(m === 'colour' || m === 'gradient');
      colour2Field.hidden = m !== 'gradient'; angleField.hidden = m !== 'gradient'; blurField.hidden = m !== 'blur';
    }
    syncBg();

    /* ---------------- export pane ---------------- */
    const fmtSel = on(select('aiimg-bgr-fmt', [['image/png', 'PNG — lossless, transparent'], ['image/webp', 'WebP — smaller, transparent']], 'image/png'), () => { S.format = fmtSel.value; qualityField.hidden = S.format === 'image/png'; });
    const sizeSel = on(select('aiimg-bgr-size', [['0', 'Original size'], ['2048', 'Up to 2048 px'], ['1080', 'Up to 1080 px'], ['720', 'Up to 720 px']], '0'), () => { S.size = Number(sizeSel.value); });
    const quality = on(range('aiimg-bgr-quality', 50, 100, 1, 90, pct), () => { S.quality = Number(quality.input.value) / 100; });
    const qualityField = field('Quality', quality); qualityField.hidden = true;
    const dlBtn = button('Download', 'btn-primary', exportMain); dlBtn.id = 'aiimg-bgr-download';
    const batchStatus = el('p', 'aiimg-status', ''); batchStatus.hidden = true;
    const batchProgress = el('div', 'aiimg-progress'); const batchBar = el('i'); batchProgress.appendChild(batchBar); batchProgress.hidden = true;
    const batchCancel = button('Stop the batch', 'btn-ghost', () => { if (S.batch) S.batch.cancel = true; }); batchCancel.hidden = true;
    const dlAll = button('Download all', 'btn-ghost', downloadAll); dlAll.id = 'aiimg-bgr-download-all'; dlAll.hidden = true;
    const results = el('div', 'aiimg-results');
    const dlRow = el('div', 'aiimg-row'); dlRow.append(dlBtn, dlAll, batchCancel);
    panes.export.append(
      grid(field('Format', fmtSel), field('Size', sizeSel)), qualityField,
      el('p', 'field-hint', 'The export is what the preview shows: the ticked layers over the chosen background, in the chosen frame.'),
      dlRow,
      el('p', 'field-hint', 'Up to ' + BATCH_MAX + ' photos at once: "Add photos for a batch" under the preview sends each through the same settings — the same kinds of layer kept, the same background, frame and format — and lists every result here.'),
      batchStatus, batchProgress, results
    );

    /* ---------------- results ---------------- */
    function addResult(out, extra) {
      const row = el('div', 'aiimg-result');
      const head = el('div', 'aiimg-result-head');
      const strong = el('strong', null, out.name);
      const meta = el('span', null, fmtBytes(out.blob.size) + ' · ' + out.width + '×' + out.height + (extra ? ' · ' + extra : ''));
      const url = URL.createObjectURL(out.blob);
      const dl = el('a', 'btn-download', 'Download'); dl.href = url; dl.download = out.name;
      head.append(strong, meta, dl);
      const img = el('img'); img.alt = 'Result preview'; img.src = url; img.loading = 'lazy';
      row.append(head, img);
      results.insertBefore(row, results.firstChild);
      S.outputs.push(out);
      dlAll.hidden = S.outputs.length < 2;
      return row;
    }
    function addNote(name, text) {
      const row = el('div', 'aiimg-result');
      const head = el('div', 'aiimg-result-head');
      head.append(el('strong', null, name), el('span', null, text));
      row.appendChild(head);
      results.insertBefore(row, results.firstChild);
    }
    async function downloadAll() {
      if (!S.outputs.length) return;
      dlAll.disabled = true; dlAll.textContent = 'Packing…';
      try { S.lastZip = await M.downloadAll(S.outputs, 'no-background.zip'); }
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
        if (!S.kept.size) say('No person or object was found to keep, so nothing is cut out yet. Tick any layer to keep it — the sky, a building, the road.', 'note');
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
      item.cutFull = anyAlpha(r.alphaFull) ? A.cutOut(item.image, r.alphaFull, item.seg.mw, item.seg.mh) : null;
      item.cutLayer = null; item.maskFull = null;
      note('');
      const n = item.seg.layers.length;
      const names = item.seg.layers.filter((l) => S.kept.has(l.key)).map((l) => l.name);
      let hair = '';
      if (S.hair && item.matte && names.some((x) => x === 'People')) hair = r.matteUsed ? ' Hair-quality edges on' + (r.matteSkipped ? ' for ' + r.matteUsed + ' of ' + (r.matteUsed + r.matteSkipped) + ' people regions' : '') + '.' : ' The portrait model did not find the people clearly, so they keep the layer edge.';
      status.textContent = n + ' layer' + (n === 1 ? '' : 's') + ' found' + (names.length ? '; keeping ' + names.slice(0, 4).join(', ') + (names.length > 4 ? '…' : '') + '.' : '; nothing kept.') + hair + ' — ready';
      invalidate();
    }

    async function loadMain(f) {
      try {
        say(''); note('Reading the photo…');
        status.textContent = 'Reading the photo…';
        mainToken++;
        const image = await A.loadImageFile(f);
        S.main = { image, seg: null };
        S.kept = new Set();
        sizePreview();
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

    /* ---------------- export ---------------- */
    async function encodeItem(item) {
      const crop = cropRect(item, S.crop);
      const { width, height } = outSize(crop, S.size, S.crop);
      const blob = await A.exportStill((ctx, W, H) => compose(ctx, W, H, item, crop, 'full', S.bg), { width, height, format: S.format, quality: S.quality });
      if (!blob) throw new Error('This browser could not encode that format. Try PNG.');
      const ext = blob.type === 'image/webp' ? 'webp' : 'png';
      const name = item.image.name + '-no-background' + (S.crop !== 'original' ? '-' + S.crop.replace(':', 'x') : '') + '.' + ext;
      return { blob, name, width, height };
    }
    async function exportMain() {
      const item = S.main;
      if (!item || !item.seg || S.busy) return;
      try {
        dlBtn.disabled = true;
        const out = await encodeItem(item);
        addResult(out, S.bg.mode === 'transparent' ? 'transparent' : S.bg.mode + ' background');
        A.download(out.blob, out.name);
        if (S.format === 'image/webp' && out.blob.type !== 'image/webp') say('This browser cannot write WebP, so a PNG was saved instead.', 'warn'); else say('');
      } catch (e) { say((e && e.message) || String(e), 'error'); }
      finally { dlBtn.disabled = false; }
    }
    async function runBatch(files) {
      if (S.busy || S.batch) return;
      const list = Array.from(files).slice(0, BATCH_MAX);
      if (!list.length) return;
      if (files.length > BATCH_MAX) say('Up to ' + BATCH_MAX + ' photos at a time — the first ' + BATCH_MAX + ' were taken.', 'warn');
      if (!S.main || !S.main.seg) { await loadMain(list[0]); if (!S.main || !S.main.seg) return; }
      const batch = S.batch = { total: list.length, cancel: false, outputs: [] };
      S.busy = true; batchAdd.disabled = true; dlBtn.disabled = true; batchCancel.hidden = false;
      batchStatus.hidden = false; batchProgress.hidden = false; batchBar.style.width = '0%';
      showPane('export');
      const labels = new Set(S.main.seg.layers.filter((l) => S.kept.has(l.key)).map((l) => l.label));
      const t0 = performance.now();
      let done = 0;
      for (let i = 0; i < list.length; i++) {
        if (batch.cancel) break;
        const f = list[i];
        const head = 'Photo ' + (i + 1) + ' of ' + list.length + ' — ' + f.name + ': ';
        batchStatus.textContent = head + 'reading…';
        try {
          const image = await A.loadImageFile(f);
          const item = await M.analyse(image, { detail: S.detail, hair: S.hair, onProgress: (p) => { batchStatus.textContent = head + (p.model === 'matte' ? 'drawing the hair edges' : p.stage === 'download' ? 'downloading a model once' : 'finding the layers') + '…'; } });
          const kept = M.keepLike(item.seg, labels);
          if (!kept.size) { addNote(f.name, 'No person or object was found to keep, so this photo was skipped.'); continue; }
          batchStatus.textContent = head + 'refining the edges…';
          await sleep(0);
          const r = M.cut(item, { kept, softness: S.softness, shift: S.shift, hair: S.hair });
          item.alphaFull = r.alphaFull; item.box = r.box;
          item.cutFull = anyAlpha(r.alphaFull) ? A.cutOut(item.image, r.alphaFull, item.seg.mw, item.seg.mh) : null;
          const out = await encodeItem(item);
          batch.outputs.push(out);
          addResult(out, 'batch');
          done++;
          item.cutFull = null; item.guide = null; item.matte = null;
        } catch (e) { addNote(f.name, (e && e.message) || String(e)); }
        batchBar.style.width = Math.round((i + 1) / list.length * 100) + '%';
        await sleep(0);
      }
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      batchStatus.textContent = (batch.cancel ? 'Batch stopped: ' : 'Batch done: ') + done + ' of ' + list.length + ' photo' + (list.length === 1 ? '' : 's') + ' in ' + secs + ' s — ready';
      batchProgress.hidden = true; batchCancel.hidden = true;
      S.batch = null; S.busy = false; batchAdd.disabled = false; dlBtn.disabled = false;
    }

    showPane('layers');
    const api = { state: S, compose, cropRect, outSize, loadFiles: (files) => loadMain(files[0]), runBatch, exportMain, destroy: () => { mounted = false; } };
    A.instances = A.instances || {};
    A.instances['background-remover'] = api;
    return api;
  }

  A.tools['background-remover'] = { mount };
})();
