(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}

const CORE = (typeof window !== 'undefined' && window.MVRImage) || {};
const PRESETS = CORE.SOCIAL_PRESETS || [];
const AS_OF = CORE.SOCIAL_AS_OF || '';
const asOfWords = AS_OF ? new Date(AS_OF + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';

/* where each picture is centred: one focal point per photo, and a nudge per slot */
const focus = new Map();     // source url → { fx, fy, per: { slot: { fx, fy } } }

/* The layout of one slot: cover crops around the focal point; contain fits
   the whole photo with bars, or on a blurred, darkened copy of itself. */
function layout(nw, nh, W, H, mode, f) {
  if (mode === 'cover') {
    const s = Math.max(W / nw, H / nh);
    const dw = nw * s, dh = nh * s;
    /* the focal point as near the middle as the edges allow */
    const x = Math.max(W - dw, Math.min(0, W / 2 - f.fx * dw));
    const y = Math.max(H - dh, Math.min(0, H / 2 - f.fy * dh));
    return { s, x, y, dw, dh };
  }
  const s = Math.min(W / nw, H / nh);
  const dw = nw * s, dh = nh * s;
  return { s, x: (W - dw) / 2, y: (H - dh) / 2, dw, dh };
}
async function paintSlot(ctx, img, W, H, o, f, h) {
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const L = layout(nw, nh, W, H, o.mode, f);
  if (o.mode === 'blur') {
    /* the photo again, covering the frame, made soft by drawing it 1/24 the
       size and back, then darkened: works the same in every browser */
    const C = layout(nw, nh, W, H, 'cover', f);
    const k = 24;
    const sw = Math.max(1, Math.round(W / k)), sh = Math.max(1, Math.round(H / k));
    const small = h.scratch(sw, sh);
    small.ctx.imageSmoothingEnabled = true; small.ctx.imageSmoothingQuality = 'high';
    small.ctx.drawImage(img, C.x / k, C.y / k, C.dw / k, C.dh / k);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small.canvas, 0, 0, sw, sh, 0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(0, 0, W, H);
  } else if (o.mode === 'contain') {
    ctx.fillStyle = o.bg || '#0a0e1a'; ctx.fillRect(0, 0, W, H);
  }
  /* Lanczos3 for the photo itself, at the size it is drawn */
  const dw = Math.max(1, Math.round(L.dw)), dh = Math.max(1, Math.round(L.dh));
  const src = await h.resample(img, dw, dh, `${W}×${H}`);
  ctx.drawImage(src, Math.round(L.x), Math.round(L.y));
  return L;
}

window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["social-media-resizer"] = {
"title": "Social Media Image Resizer",
"kind": "editor",
"multiple": false,
"codecs": "wasm",
"description": "Produce correctly sized images for Instagram, Facebook, X, LinkedIn, YouTube and more in one pass, centred on the part of the photo you pick.",
"keywords": ["social media image sizes","instagram image size","youtube thumbnail size","social media resizer","facebook cover size","linkedin banner size","resize image for instagram"],
"asOf": AS_OF,
"controls": [{"key":"presets","label":"Platforms (sizes as of " + asOfWords + ")","type":"presets","default":"all","wide":true},
  {"key":"custom","label":"Also a size of my own","type":"select","default":"no","options":[{"value":"no","label":"No"},{"value":"yes","label":"Yes — the width and height below"}]},
  {"key":"cw","label":"Own width (px)","type":"number","default":1200,"min":16,"max":8000,"when":{"custom":["yes"]}},
  {"key":"ch","label":"Own height (px)","type":"number","default":1200,"min":16,"max":8000,"when":{"custom":["yes"]}},
  {"key":"mode","label":"Fitting","type":"select","default":"cover","options":[{"value":"cover","label":"Fill and crop (no bars)"},{"value":"contain","label":"Fit whole image (adds bars)"},{"value":"blur","label":"Fit whole image on a blurred copy of itself"}]},
  {"key":"bg","label":"Bar colour","type":"color","default":"#0a0e1a","when":{"mode":["contain"]}},
  {"key":"format","label":"Format","type":"select","default":"image/jpeg","options":[{"value":"image/jpeg","label":"JPEG"},{"value":"image/png","label":"PNG"},{"value":"image/webp","label":"WebP"}]},
  {"key":"quality","label":"Quality (JPEG / WebP)","type":"range","default":90,"min":10,"max":100,"when":{"format":["image/jpeg","image/webp"]}}],
"layout": layout,
"runEditor": async (api, o, token) => {
  const { el } = api;
  const src = api.sources[0];
  const img = src.img;
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!focus.has(src.url)) focus.set(src.url, { fx: 0.5, fy: 0.5, per: {} });
  const F = focus.get(src.url);
  const slots = (Array.isArray(o.presets) ? o.presets : []).map((i) => PRESETS[i] && Object.assign({ key: 'p' + i }, PRESETS[i])).filter(Boolean);
  if (o.custom === 'yes') {
    const w = Math.max(16, Math.min(8000, Math.round(Number(o.cw) || 1200))), h = Math.max(16, Math.min(8000, Math.round(Number(o.ch) || 1200)));
    slots.push({ key: 'own', group: 'Own size', name: `${w}×${h}`, w, h });
  }
  /* the focal point picker */
  const pick = el('div', 'select-wrap sm-focus');
  pick.appendChild(el('p', 'select-hint', o.mode === 'cover' ? 'Click the part of the photo every crop should keep in view, such as a face. Drag on any result below to move it in that one frame only.' : 'Every frame shows the whole photo. The focal point matters only for Fill and crop.'));
  const view = el('canvas', 'select-canvas sm-focus-view');
  const vs = Math.min(1, 560 / nw);
  view.width = Math.round(nw * vs); view.height = Math.round(nh * vs);
  view.tabIndex = 0;
  view.setAttribute('aria-label', 'Focal point. Click, or move it with the arrow keys.');
  const vx = view.getContext('2d');
  const paintFocus = () => {
    vx.drawImage(img, 0, 0, view.width, view.height);
    const x = F.fx * view.width, y = F.fy * view.height;
    vx.strokeStyle = '#f7c948'; vx.lineWidth = 2;
    vx.beginPath(); vx.arc(x, y, 14, 0, Math.PI * 2); vx.stroke();
    vx.beginPath(); vx.moveTo(x - 22, y); vx.lineTo(x + 22, y); vx.moveTo(x, y - 22); vx.lineTo(x, y + 22); vx.stroke();
  };
  const setFocus = (fx, fy) => { F.fx = Math.max(0, Math.min(1, fx)); F.fy = Math.max(0, Math.min(1, fy)); F.per = {}; paintFocus(); makeAll(); };
  view.addEventListener('click', (e) => { const r = view.getBoundingClientRect(); setFocus((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); });
  view.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, -0.02], ArrowDown: [0, 0.02] }[e.key];
    if (!d) return; e.preventDefault(); setFocus(F.fx + d[0], F.fy + d[1]);
  });
  pick.appendChild(view);
  if (o.mode === 'cover') api.stage.appendChild(pick);
  paintFocus();
  const host = el('div', 'pp-results');
  api.stage.appendChild(host);

  const files = new Map();     // slot key → { name, blob }
  let enlargedNote = [];
  async function makeOne(slot, card) {
    const oo = api.readOpts();
    const c = el('canvas'); c.width = slot.w; c.height = slot.h;
    const ctx = c.getContext('2d');
    const notes = [];
    const f = F.per[slot.key] || F;
    await paintSlot(ctx, img, slot.w, slot.h, oo, f, api.makeHelpers(c, ctx, notes));
    const res = await api.encodeOut(c, oo.format || 'image/jpeg', oo, `${src.file.name} (${slot.group} · ${slot.name})`, { defaultQuality: 90 });
    if (!res) return null;
    const suffix = `${slot.group}-${slot.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const name = `${api.baseName(src)}-${suffix}.${api.extOfType(res.type)}`;
    files.set(slot.key, { name, blob: res.blob });
    const big = notes.find((n) => n.enlarged);
    const prev = card.querySelector('img');
    const old = prev.src;
    prev.src = api.previewUrl(res.blob);
    if (old && old.startsWith('blob:')) URL.revokeObjectURL(old);
    card.querySelector('.file-size').textContent = `${slot.w}×${slot.h} · ${api.fmtBytes(res.blob.size)}` + (big ? ` · enlarged ${Math.max(big.to[0] / big.from[0], big.to[1] / big.from[1]).toFixed(2)}×` : '');
    card._big = big;
    return res;
  }
  const cards = slots.map((slot) => {
    const card = el('div', 'image-card sm-card');
    const prev = el('img', 'image-preview'); prev.alt = `${slot.group} · ${slot.name}`; prev.draggable = false;
    card.appendChild(prev);
    const cap = el('div', 'image-cap');
    cap.appendChild(el('span', null, `${slot.group} · ${slot.name}`));
    cap.appendChild(el('span', 'file-size', `${slot.w}×${slot.h}`));
    card.appendChild(cap);
    const dl = el('button', 'btn-ghost', 'Save'); dl.type = 'button';
    dl.addEventListener('click', () => { const fl = files.get(slot.key); if (fl) api.downloadBlob(fl.blob, fl.name); });
    card.appendChild(dl);
    /* per-slot reposition: drag the result itself */
    if (o.mode === 'cover') {
      prev.classList.add('sm-drag');
      prev.title = 'Drag to move the photo in this frame';
      let d = null;
      prev.addEventListener('pointerdown', (e) => { const f = F.per[slot.key] || F; d = { x: e.clientX, y: e.clientY, fx: f.fx, fy: f.fy }; prev.setPointerCapture(e.pointerId); e.preventDefault(); });
      prev.addEventListener('pointerup', async (e) => {
        if (!d) return;
        const r = prev.getBoundingClientRect();
        const L = layout(nw, nh, slot.w, slot.h, 'cover', { fx: d.fx, fy: d.fy });
        /* moving the picture right shows more of its left: the focus moves left */
        const dxOut = (e.clientX - d.x) / r.width * slot.w, dyOut = (e.clientY - d.y) / r.height * slot.h;
        F.per[slot.key] = { fx: Math.max(0, Math.min(1, d.fx - dxOut / L.dw)), fy: Math.max(0, Math.min(1, d.fy - dyOut / L.dh)) };
        d = null;
        await makeOne(slot, card); publish();
      });
      prev.addEventListener('pointercancel', () => { d = null; });
    }
    host.appendChild(card);
    return card;
  });
  function publish() {
    api.setOutputs(slots.map((s) => files.get(s.key)).filter(Boolean));
    api.actions.innerHTML = '';
    api.addBatchActions();
  }
  let busy = Promise.resolve();
  function makeAll() {
    busy = busy.then(async () => {
      api.progress.start(slots.length, 'Working…');
      for (let k = 0; k < slots.length; k++) {
        if (api.stale(token)) return;
        api.progress.step(k, `${k + 1} of ${slots.length}: ${slots[k].group} · ${slots[k].name}`);
        await makeOne(slots[k], cards[k]);
      }
      api.progress.end();
      publish();
      const total = [...files.values()].reduce((t, f) => t + f.blob.size, 0);
      const enlarged = cards.filter((c) => c._big).length;
      api.renderStats([
        ['Files produced', String(files.size)],
        ['Total size', api.fmtBytes(total)],
        ['Source', `${nw}×${nh}`],
        ['Fitting', o.mode === 'cover' ? `fill and crop, centred on ${Math.round(F.fx * 100)}% across, ${Math.round(F.fy * 100)}% down` : o.mode === 'blur' ? 'whole photo on a blurred copy' : 'whole photo with bars'],
        ['Sizes as of', asOfWords || 'see the page']
      ]);
      if (enlarged) api.say(`${enlarged} of ${slots.length} frames are bigger than the photo allows, so the photo was enlarged to fill them (shown on each card); that adds softness, not detail.`, 'warn');
      else if (!slots.length) api.say('Tick at least one platform, or add a size of your own.', 'note');
      else api.say('');
    });
    return busy;
  }
  await makeAll();
},
"tips": ["Click the part of the photo that matters — a face, a product, a logo — and every Fill-and-crop frame keeps it in view. Drag any single result to move the photo inside that frame alone.","“Fit whole image on a blurred copy” keeps every pixel of the photo and fills the bars with a soft, darkened version of it, the way phone galleries show a photo in a frame of another shape.","Keep important content — faces, logos, text — inside the middle 80%. Platforms crop previews unpredictably across devices.","A frame bigger than your photo means enlarging it; the card says by how much. Start from the largest original you have.","Sizes change. These are current at the time of writing (the date is beside the list); check the platform’s own guidance for anything mission-critical."],
"faq": [{"q":"Which size should I use for a link preview?","a":"The Open Graph preset at 1200×630 is the safe default. Facebook, LinkedIn, WhatsApp and most chat apps read the same og:image tag."},{"q":"Can I add a size that is not in the list?","a":"Yes. Set “Also a size of my own” to Yes and type the width and height; it is made alongside the ticked platforms and named after its size."}]
};
})();
