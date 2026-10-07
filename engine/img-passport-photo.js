(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}

/* The documents, with the size, head height and background each one's
   issuer publishes, and the page each was read from: engine/img-passport-presets.js */
const P = (typeof window !== 'undefined' && window.MVRPassportPresets) || [];
const byId = (id) => P.find((p) => p.id === id) || P[0];
const DPI = 300;
const mmToPx = (mm) => Math.round(mm / 25.4 * DPI);
const pxToMm = (px) => px / DPI * 25.4;
/* ICAO 9303: the head (chin to crown) is 70–80% of the photo's height where
   an issuer gives no figure of its own */
const headRange = (p) => p.head || [p.h * 0.7, p.h * 0.8];

/* where the guide puts the chin: low enough that the tallest head allowed
   still leaves 2 mm above the crown, and no lower than 90% of the height */
function guideOf(p) {
  const H = p.h, [hmin, hmax] = headRange(p);
  const chin = Math.min(H * 0.9, Math.max(hmax + 2, H * 0.78));
  const eyes = p.eyes ? [H - p.eyes[1], H - p.eyes[0]] : [chin - hmax * 0.6, chin - hmin * 0.5];
  return { chin, crownMin: chin - hmax, crownMax: chin - hmin, eyes, cx: p.w / 2, hmin, hmax };
}

/* the framing each photo has been given, kept across settings changes */
const frames = new Map();     // source url → { zoom, cx, cy, tilt, head }

/* Ultra-Light-Fast-Generic-Face-Detector-1MB (MIT), the 1.5 MB model the
   Face Blur tool already serves, through the AI tools' ONNX runtime */
const FACE_MODEL = '/engine/models/ultraface-rfb-640.onnx';
async function findFace(api, img, onProgress) {
  if (!window.AIImg || !window.AIImg.loadSession) await api.loadScriptOnce('/engine/aiimg-core.js');
  const R = await window.AIImg.loadSession(FACE_MODEL, { bytes: 1575192, onProgress });
  const IW = 640, IH = 480;
  const c = document.createElement('canvas'); c.width = IW; c.height = IH;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, IW, IH);
  const px = x.getImageData(0, 0, IW, IH).data;
  const n = IW * IH, input = new Float32Array(3 * n);
  for (let i = 0, j = 0; i < n; i++, j += 4) { input[i] = (px[j] - 127) / 128; input[n + i] = (px[j + 1] - 127) / 128; input[2 * n + i] = (px[j + 2] - 127) / 128; }
  const out = await R.session.run({ input: new R.ort.Tensor('float32', input, [1, 3, IH, IW]) });
  const sc = out.scores.data, bx = out.boxes.data, N = out.scores.dims[1];
  const W = img.naturalWidth, H = img.naturalHeight;
  let best = null;
  for (let i = 0; i < N; i++) {
    const s = sc[i * 2 + 1];
    if (s < 0.7) continue;
    const f = { x: bx[i * 4] * W, y: bx[i * 4 + 1] * H, w: (bx[i * 4 + 2] - bx[i * 4]) * W, h: (bx[i * 4 + 3] - bx[i * 4 + 1]) * H, score: s };
    /* the biggest confident face is the subject */
    if (!best || f.w * f.h > best.w * best.h) best = f;
  }
  return best;
}
/* The detector's box runs from the forehead to just below the chin. On
   build/promo/samples/passport.jpg (box y 251, height 697) the crown,
   eyes and chin marked by hand sit at y 135, 545 and 930: the crown 0.17
   of the box's height above its top, the eyes 0.42 and the chin 0.975 of
   it below its top. Checked on portrait.jpg (the same sitter, framed
   wider): within 8 px of the hand marks. One face is not a survey, so the
   page calls the head height it reports an estimate. */
const FACE_TO_CROWN = 0.17, FACE_TO_EYES = 0.42, FACE_TO_CHIN = 0.975;

window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["passport-photo"] = {
"title": "Passport & ID Photo Maker",
"kind": "editor",
"multiple": false,
"codecs": "wasm",
"description": "Make passport, visa and ID photos for " + (P.length || 'over 40') + " documents, framed to each issuer’s head-size guide, with a KB limit and 6×4 in or A4 print sheets.",
"keywords": ["passport photo maker","passport size photo","visa photo","id photo maker","passport photo online","35x45 photo","2x2 photo","passport photo a4 sheet"],
"controls": [
  {"key":"preset","label":"Document","type":"select","default":"in-2x2","options":P.map((p) => ({ value: p.id, label: `${p.name} — ${+p.w.toFixed(1)}×${+p.h.toFixed(1)} mm` }))},
  {"key":"bgmode","label":"Background","type":"select","default":"keep","options":[{"value":"keep","label":"Keep the photo’s background"},{"value":"replace","label":"Replace with the colour below (cut out on this device)"}]},
  {"key":"bg","label":"New background colour","type":"color","default":"#ffffff"},
  {"key":"sheet","label":"Output","type":"select","default":"both","options":[{"value":"both","label":"Single photo + 6×4 print sheet"},{"value":"single","label":"Single photo only"},{"value":"sheet","label":"6×4 print sheet only"},{"value":"a4","label":"Single photo + A4 sheet"},{"value":"all","label":"Single photo, 6×4 and A4 sheets"}]},
  {"key":"format","label":"Save as","type":"select","default":"image/jpeg","options":[{"value":"image/jpeg","label":"JPEG — what portals and kiosks ask for"},{"value":"image/png","label":"PNG — lossless"}]},
  {"key":"quality","label":"JPEG quality","type":"range","default":95,"min":60,"max":100,"when":{"format":["image/jpeg"]}},
  {"key":"target","label":"Single photo under","type":"select","default":"0","options":[{"value":"0","label":"No size limit"},{"value":"20","label":"20 KB"},{"value":"50","label":"50 KB"},{"value":"100","label":"100 KB"},{"value":"200","label":"200 KB"},{"value":"240","label":"240 KB"},{"value":"300","label":"300 KB"},{"value":"500","label":"500 KB"},{"value":"custom","label":"Another size…"}],"when":{"format":["image/jpeg"]}},
  {"key":"targetKB","label":"Size limit (KB)","type":"number","default":100,"min":5,"when":{"target":["custom"]}}
],
"presetsData": P,
"guideOf": guideOf,
"faceToCrown": FACE_TO_CROWN,
"faceToEyes": FACE_TO_EYES,
"faceToChin": FACE_TO_CHIN,
"runEditor": async (api, o) => {
  const { el } = api;
  const CORE = window.MVRImage;
  const src = api.sources[0];
  const p = byId(o.preset);
  const W = mmToPx(p.w), H = mmToPx(p.h);
  const g = guideOf(p);
  let subject = src.img;
  if (o.bgmode === 'replace') {
    subject = await api.subjectOnColour(src, o.bg || '#ffffff');
    if (!subject) return false;
    subject.naturalWidth = subject.width; subject.naturalHeight = subject.height;
  }
  const nw = src.img.naturalWidth, nh = src.img.naturalHeight;
  const cover = Math.max(W / nw, H / nh);
  if (!frames.has(src.url)) frames.set(src.url, { zoom: 1, cx: nw / 2, cy: nh / 2, tilt: 0, head: null, auto: false });
  const F = frames.get(src.url);

  /* draw the photo into a W×H frame (or a view of it) */
  const drawFrame = (ctx, w, h) => {
    const k = w / W;
    ctx.save();
    ctx.fillStyle = o.bgmode === 'replace' ? (o.bg || '#ffffff') : '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.translate(w / 2, h / 2);
    ctx.rotate(F.tilt * Math.PI / 180);
    const s = cover * F.zoom * k;
    ctx.scale(s, s);
    ctx.translate(-F.cx, -F.cy);
    ctx.drawImage(subject, 0, 0);
    ctx.restore();
  };

  /* ---- the framing view ---- */
  const wrap = el('div', 'select-wrap pp-wrap');
  wrap.appendChild(el('p', 'select-hint', 'Drag the photo, or use the arrow keys, until the chin sits on the gold line and the top of the head falls between the two dashed lines; zoom to fit. Or let the page frame it for you.'));
  const tools = el('div', 'crop-tools');
  const autoBtn = el('button', 'btn-ghost', 'Frame my face automatically'); autoBtn.type = 'button';
  autoBtn.title = 'Finds the face with a 1.5 MB detector run on this device (the AI runtime, 14 MB, is fetched from this site the first time)';
  tools.appendChild(autoBtn);
  const mk = (label, min, max, step, val, fmt) => {
    const l = el('label', 'crop-straighten'); l.appendChild(el('span', null, label));
    const r = el('input', 'range'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = val; r.setAttribute('aria-label', label);
    const out = el('span', 'range-val', fmt(val));
    r.addEventListener('input', () => { out.textContent = fmt(Number(r.value)); });
    l.appendChild(r); l.appendChild(out); tools.appendChild(l);
    return r;
  };
  const zoomR = mk('Zoom', 100, 400, 1, Math.round(F.zoom * 100), (v) => v + '%');
  const tiltR = mk('Tilt', -15, 15, 0.5, F.tilt, (v) => v + '°');
  const resetBtn = el('button', 'btn-ghost', 'Reset framing'); resetBtn.type = 'button'; tools.appendChild(resetBtn);
  wrap.appendChild(tools);
  const view = el('canvas', 'select-canvas pp-view');
  const VH = 460, vk = VH / H;
  view.width = Math.round(W * vk); view.height = VH;
  view.tabIndex = 0;
  view.setAttribute('aria-label', 'Framing. Drag or use the arrow keys to move the photo; plus and minus zoom.');
  wrap.appendChild(view);
  const legend = el('p', 'pp-legend', '');
  wrap.appendChild(legend);
  api.stage.appendChild(wrap);
  const vctx = view.getContext('2d');
  const mmY = (mm) => mm / p.h * view.height, mmX = (mm) => mm / p.w * view.width;
  function paintView() {
    drawFrame(vctx, view.width, view.height);
    vctx.save();
    vctx.lineWidth = 1.5;
    /* the crown band: two dashed lines; the chin line in gold; the eye band */
    vctx.setLineDash([6, 4]); vctx.strokeStyle = 'rgba(255,255,255,.9)';
    [g.crownMin, g.crownMax].forEach((y) => { vctx.beginPath(); vctx.moveTo(0, mmY(y)); vctx.lineTo(view.width, mmY(y)); vctx.stroke(); });
    vctx.fillStyle = 'rgba(45,212,255,.18)';
    vctx.fillRect(0, mmY(g.eyes[0]), view.width, mmY(g.eyes[1]) - mmY(g.eyes[0]));
    vctx.setLineDash([]); vctx.strokeStyle = '#f7c948'; vctx.lineWidth = 2;
    vctx.beginPath(); vctx.moveTo(0, mmY(g.chin)); vctx.lineTo(view.width, mmY(g.chin)); vctx.stroke();
    vctx.strokeStyle = 'rgba(255,255,255,.5)'; vctx.lineWidth = 1; vctx.setLineDash([2, 4]);
    vctx.beginPath(); vctx.moveTo(view.width / 2, 0); vctx.lineTo(view.width / 2, view.height); vctx.stroke();
    /* the head oval at the middle of the allowed height */
    const hm = (g.hmin + g.hmax) / 2;
    vctx.setLineDash([]); vctx.strokeStyle = 'rgba(247,201,72,.75)';
    vctx.beginPath(); vctx.ellipse(view.width / 2, mmY(g.chin - hm / 2), mmX(hm * 0.37), mmY(hm / 2), 0, 0, Math.PI * 2); vctx.stroke();
    vctx.restore();
    legend.textContent = `Head (chin to crown) ${+g.hmin.toFixed(1)}–${+g.hmax.toFixed(1)} mm${p.head ? '' : ' (70–80% of the height, the ICAO figure; this issuer gives none)'}${p.eyes ? `; eyes ${p.eyes[0]}–${p.eyes[1]} mm above the bottom (blue band)` : ''}. Background: ${p.bg || 'plain and light'}.`;
  }
  /* drag to pan, wheel or slider to zoom */
  let drag = null;
  view.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: F.cx, cy: F.cy }; view.setPointerCapture(e.pointerId); e.preventDefault(); });
  view.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const k = view.getBoundingClientRect().width / view.width;
    const s = cover * F.zoom * vk * k;
    const dx = (e.clientX - drag.x) / s, dy = (e.clientY - drag.y) / s;
    const a = -F.tilt * Math.PI / 180;
    F.cx = drag.cx - (dx * Math.cos(a) - dy * Math.sin(a));
    F.cy = drag.cy - (dx * Math.sin(a) + dy * Math.cos(a));
    F.auto = false;
    paintView();
  });
  const endDrag = () => { if (drag) { drag = null; update(); } };
  view.addEventListener('pointerup', endDrag); view.addEventListener('pointercancel', endDrag);
  view.addEventListener('wheel', (e) => { e.preventDefault(); F.zoom = Math.max(1, Math.min(4, F.zoom * (e.deltaY < 0 ? 1.05 : 1 / 1.05))); zoomR.value = Math.round(F.zoom * 100); zoomR.dispatchEvent(new Event('input')); paintView(); update(); }, { passive: false });
  view.addEventListener('keydown', (e) => {
    const step = (e.shiftKey ? 20 : 4) / (cover * F.zoom);
    const m = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (m) { F.cx += m[0]; F.cy += m[1]; }
    else if (e.key === '+' || e.key === '=') F.zoom = Math.min(4, F.zoom * 1.05);
    else if (e.key === '-') F.zoom = Math.max(1, F.zoom / 1.05);
    else return;
    e.preventDefault(); zoomR.value = Math.round(F.zoom * 100); zoomR.dispatchEvent(new Event('input')); F.auto = false; paintView(); update();
  });
  zoomR.addEventListener('input', () => { F.zoom = Number(zoomR.value) / 100; paintView(); });
  zoomR.addEventListener('change', () => update());
  tiltR.addEventListener('input', () => { F.tilt = Number(tiltR.value); paintView(); });
  tiltR.addEventListener('change', () => update());
  resetBtn.addEventListener('click', () => { Object.assign(F, { zoom: 1, cx: nw / 2, cy: nh / 2, tilt: 0, head: null, auto: false }); zoomR.value = 100; tiltR.value = 0; [zoomR, tiltR].forEach((r) => r.dispatchEvent(new Event('input'))); paintView(); update(); });
  autoBtn.addEventListener('click', async () => {
    autoBtn.disabled = true;
    try {
      api.say('Finding the face on this device…', 'note');
      const f = await findFace(api, src.img, (q) => { if (q.stage === 'download') api.say(`Downloading the face finder: ${Math.round((q.fraction || 0) * 100)}% (from this site, once)`, 'note'); });
      if (!f) { api.say('No face was found. Frame the photo by hand with the guide.', 'warn'); return; }
      const crown = f.y - f.h * FACE_TO_CROWN, chin = f.y + f.h * FACE_TO_CHIN;
      const headPx = chin - crown;
      /* scale so the head is the middle of the allowed height, chin on the line */
      const wantHead = (g.hmin + g.hmax) / 2 / p.h * H;      // output px
      F.zoom = Math.max(1, (wantHead / headPx) / cover);
      const s = cover * F.zoom;
      F.tilt = 0;
      F.cx = f.x + f.w / 2;
      F.cy = chin - (mmToPx(g.chin) - H / 2) / s;
      F.head = { crown, chin, eyes: f.y + f.h * FACE_TO_EYES };
      F.auto = true;
      zoomR.value = Math.round(F.zoom * 100); zoomR.dispatchEvent(new Event('input')); tiltR.value = 0; tiltR.dispatchEvent(new Event('input'));
      api.say(F.zoom * cover > 1 ? '' : '');
      paintView(); update();
    } catch (e) {
      api.say('The face finder could not run' + (e && e.message ? ' (' + e.message + ')' : '') + '. Frame the photo by hand with the guide.', 'error');
    } finally { autoBtn.disabled = false; }
  });

  /* ---- the files ---- */
  let chain = Promise.resolve();
  const update = () => { chain = chain.then(make, make); return chain; };
  const resultHost = el('div', 'pp-results');
  api.stage.appendChild(resultHost);
  async function make() {
    const oo = api.readOpts();
    const single = el('canvas'); single.width = W; single.height = H;
    drawFrame(single.getContext('2d'), W, H);
    const jobs = [];
    const mode = oo.sheet || 'both';
    if (mode !== 'sheet') jobs.push({ name: `${p.w}x${p.h}mm`, label: p.name, canvas: single, target: api.targetOf(oo) });
    const sheet = (Wmm, Hmm, label, suffix, margin) => {
      const SW = mmToPx(Wmm), SH = mmToPx(Hmm);
      const gap = Math.round(DPI * 0.04);
      const m = mmToPx(margin);
      const cols = Math.max(1, Math.floor((SW - 2 * m + gap) / (W + gap)));
      const rows = Math.max(1, Math.floor((SH - 2 * m + gap) / (H + gap)));
      const c = el('canvas'); c.width = SW; c.height = SH;
      const x = c.getContext('2d');
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, SW, SH);
      const offX = Math.round((SW - (cols * W + (cols - 1) * gap)) / 2), offY = Math.round((SH - (rows * H + (rows - 1) * gap)) / 2);
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
        const px = offX + k * (W + gap), py = offY + r * (H + gap);
        x.drawImage(single, px, py);
        x.strokeStyle = '#d0d0d0'; x.lineWidth = 1; x.strokeRect(px + 0.5, py + 0.5, W - 1, H - 1);
      }
      jobs.push({ name: suffix, label: `${label} — ${cols * rows} copies`, canvas: c, copies: cols * rows });
    };
    if (mode === 'both' || mode === 'sheet' || mode === 'all') sheet(152.4, 101.6, 'Print sheet on 6×4in', 'print-sheet-6x4', 0);
    if (mode === 'a4' || mode === 'all') sheet(210, 297, 'A4 sheet', 'print-sheet-a4', 5);

    api.revokePreviews();
    resultHost.innerHTML = ''; api.actions.innerHTML = '';
    const outs = [];
    let singleInfo = null;
    for (const j of jobs) {
      const res = await api.encodeOut(j.canvas, oo.format || 'image/jpeg', oo, src.file.name + ' (' + j.label + ')', { dpi: DPI, targetBytes: j.target || 0, defaultQuality: 95 });
      if (!res) continue;
      const name = `${api.baseName(src)}-${j.name}.${api.extOfType(res.type)}`;
      outs.push({ name, blob: res.blob });
      if (j.target !== undefined) singleInfo = res.info;
      const card = el('div', 'image-card');
      const prev = el('img', 'image-preview'); prev.src = api.previewUrl(res.blob); prev.alt = j.label;
      card.appendChild(prev);
      const cap = el('div', 'image-cap');
      cap.appendChild(el('span', null, j.label));
      cap.appendChild(el('span', 'file-size', `${j.canvas.width}×${j.canvas.height} · ${api.fmtBytes(res.blob.size)}` + (j.target && res.info.quality !== undefined ? ` · quality ${res.info.quality}` : '')));
      card.appendChild(cap);
      const dl = el('button', 'btn-ghost', 'Save'); dl.type = 'button';
      dl.addEventListener('click', () => api.downloadBlob(res.blob, name));
      card.appendChild(dl);
      resultHost.appendChild(card);
    }
    api.setOutputs(outs);
    api.addBatchActions();

    /* ---- the checks the page can make ---- */
    const hints = [];
    const zoomPx = cover * F.zoom;                 // output px per source px
    if (zoomPx > 1.05) hints.push(`The photo is enlarged ${zoomPx.toFixed(2)}× to fill the frame, so it may print soft. Use a sharper or closer photo.`);
    if (F.auto && F.head) {
      const headMm = pxToMm((F.head.chin - F.head.crown) * zoomPx);
      const ok = headMm >= g.hmin - 0.5 && headMm <= g.hmax + 0.5;
      hints.push(`Head height about ${headMm.toFixed(1)} mm, estimated from the face the detector found; ${p.name} asks for ${+g.hmin.toFixed(1)}–${+g.hmax.toFixed(1)} mm${ok ? '.' : ' — adjust the zoom.'}`);
    }
    /* the background: the top corners of the photo, where the head is not */
    const x = single.getContext('2d', { willReadFrequently: true });
    const band = x.getImageData(0, 0, W, Math.max(1, Math.round(H * 0.12))).data;
    let sum = 0, sum2 = 0, n = 0;
    for (let yy = 0; yy < band.length / 4 / W; yy++) for (const xx of [[0, 0.18], [0.82, 1]]) {
      for (let i = Math.round(xx[0] * W); i < Math.round(xx[1] * W); i++) {
        const j = (yy * W + i) * 4; const l = 0.2126 * band[j] + 0.7152 * band[j + 1] + 0.0722 * band[j + 2];
        sum += l; sum2 += l * l; n++;
      }
    }
    const mean = sum / n, sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
    if (sd > 18) hints.push(`The background is uneven (its brightness varies by ${sd.toFixed(0)} levels at the top corners). ${p.name} asks for ${p.bg || 'a plain background'}; “Replace with the colour below” cuts the person out.`);
    else if (mean < 150) hints.push(`The background is dark (brightness ${mean.toFixed(0)} of 255 at the top corners). ${p.name} asks for ${p.bg || 'a light, plain background'}.`);
    api.renderStats([
      ['Print size', `${W}×${H} px at ${DPI} DPI = ${pxToMm(W).toFixed(2)} × ${pxToMm(H).toFixed(2)} mm`],
      ['Rounding', `${p.w}×${p.h} mm is ${(p.w / 25.4 * DPI).toFixed(2)} × ${(p.h / 25.4 * DPI).toFixed(2)} px; pixels are whole, so each side is rounded to the nearest one`],
      ['Resolution in the file', `${DPI} DPI`],
      ['Background', o.bgmode === 'replace' ? 'replaced with ' + String(o.bg || '#ffffff').toUpperCase() + ' — cut out on this device' : 'as photographed'],
      ['Head height asked for', `${+g.hmin.toFixed(1)}–${+g.hmax.toFixed(1)} mm` + (p.head ? '' : ' (ICAO 70–80%)')],
      ['Files produced', String(outs.length)],
      ...(singleInfo && singleInfo.quality !== undefined && api.targetOf(oo) ? [['Single photo', `quality ${singleInfo.quality}${singleInfo.missed ? ', still over the limit' : ''}`]] : []),
      ['Source of these sizes', p.source ? p.source.replace(/^https?:\/\//, '') : 'see the page']
    ]);
    if (hints.length) api.say(hints.join(' '), 'warn'); else api.say('');
  }
  paintView();
  await update();
},
"tips": ["Drag the photo until the chin sits on the gold line and the top of the head falls between the dashed lines, or press “Frame my face automatically”. The guide uses each issuer’s own head-size figure where it publishes one, and the ICAO 70–80% where it does not.","Check the issuing authority’s own specification before printing: each document in the list, except the generic stamp size, names the page its size came from, and requirements change.","Every file is 300 DPI and says so inside it (the JPEG’s JFIF header, the PNG’s pHYs chunk), so it prints at its size when printed at 100%. Pixels are whole, so sizes are rounded to the nearest pixel: 51 mm is 602.36 px at 300 DPI and comes out as 602 px, 50.97 mm.","The print sheets lay out as many copies as fit on a 6×4 inch photo print or an A4 page at 300 DPI, with thin grey cutting lines.","“Single photo under” finds the highest JPEG quality that fits a portal’s KB limit (a KB there is 1,000 bytes).","“Replace with the colour below” cuts the person out with MODNet, the portrait model the AI Background Remover uses, on your device: a 25 MB model and the runtime are fetched from this site the first time, then kept by your browser. Check the hair edge before you print; a plain, evenly lit wall still gives the cleanest result."],
"faq": [{"q":"Will this photo definitely be accepted?","a":"No tool can promise that. The page checks what it can measure — the size, the head height against the guide, how even and light the background is, and whether the photo had to be enlarged — but expression, lighting, shadows and glasses are judged by a person or an automated checker when you apply."},{"q":"Is my photo uploaded to find my face?","a":"No. The face finder is a 1.5 MB model that runs in your browser, fetched from this site only when you press the button; the photo never leaves your device."}]
};
})();
