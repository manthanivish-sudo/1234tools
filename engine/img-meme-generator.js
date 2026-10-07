(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}

/* Fonts served from this site (engine/vendor/meme-fonts/, licences beside
   them), loaded the first time they are chosen. Anton (OFL) is the Impact
   stand-in: Impact itself is a Microsoft font that phones and Linux lack. */
const FONT_DIR = '/engine/vendor/meme-fonts/';
const FONTS = {
  anton: { family: 'Anton', file: 'anton-latin-400-normal.woff2', weight: '400', css: '"Anton", Impact, sans-serif' },
  impact: { family: null, weight: 'bold', css: 'Impact, "Haettenschweiler", "Arial Narrow Bold", sans-serif' },
  bebas: { family: 'Bebas Neue', file: 'bebas-neue-latin-400-normal.woff2', weight: '400', css: '"Bebas Neue", sans-serif' },
  comic: { family: 'Comic Neue', file: 'comic-neue-latin-700-normal.woff2', weight: '700', css: '"Comic Neue", sans-serif' },
  marker: { family: 'Permanent Marker', file: 'permanent-marker-latin-400-normal.woff2', weight: '400', css: '"Permanent Marker", cursive' },
  arial: { family: null, weight: 'bold', css: 'Arial, Helvetica, sans-serif' }
};
const loaded = {};
function loadFont(key) {
  const f = FONTS[key];
  if (!f || !f.family || typeof FontFace === 'undefined') return Promise.resolve(true);
  if (!loaded[key]) loaded[key] = new FontFace(f.family, `url(${FONT_DIR}${f.file})`, { weight: f.weight })
    .load().then((ff) => { document.fonts.add(ff); return true; }).catch(() => { delete loaded[key]; return false; });
  return loaded[key];
}

/* the meme: the picture, then every text box, then the stickers. o.boxes
   (optional) holds the extra boxes and any moved positions, each { text,
   x, y } with x and y the box centre as fractions of the picture; the top
   and bottom captions keep the classic layout until they are moved. */
function paint(ctx, img, o, h) {
  const W = img.naturalWidth, H = img.naturalHeight;
  h.size(W, H);
  ctx.drawImage(img, 0, 0);
  const fs = H * ((Number(o.size) || 10) / 100);
  const F = FONTS[o.font] || FONTS.impact;
  ctx.font = `${F.weight} ${fs}px ${F.css}`;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(o.outlineWidth === '0' ? 0 : 2, fs * ((o.outlineWidth === undefined ? 12 : Number(o.outlineWidth)) / 100));
  ctx.strokeStyle = o.outline || '#000000';
  ctx.fillStyle = o.color || '#ffffff';

  const wrap = (text, maxW) => {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = []; let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };
  const caps = (t) => o.caps === 'yes' ? String(t).toUpperCase() : String(t);
  const stroke = (ln, x, y) => { if (ctx.lineWidth > 0) ctx.strokeText(ln, x, y); ctx.fillText(ln, x, y); };
  const boxes = (o.boxes || []);
  const moved = (id) => boxes.find((b) => b.id === id && b.x !== undefined);
  const drawAt = (text, b) => {
    const lines = wrap(caps(text), W * (b.w || 0.94));
    const lh = fs * 1.1, top = b.y * H - (lines.length * lh) / 2 + fs * 0.85;
    lines.forEach((ln, i) => stroke(ln, b.x * W, top + i * lh));
    return lines;
  };
  const classic = (text, atTop) => {
    if (!text) return;
    const lines = wrap(caps(text), W * 0.94);
    lines.forEach((ln, i) => {
      const y = atTop
        ? fs * 1.05 + i * fs * 1.1
        : H - fs * 0.35 - (lines.length - 1 - i) * fs * 1.1;
      stroke(ln, W / 2, y);
    });
  };
  ctx.textBaseline = 'alphabetic';
  if (o.top) { const m = moved('top'); if (m) drawAt(o.top, m); else classic(o.top, true); }
  if (o.bottom) { const m = moved('bottom'); if (m) drawAt(o.bottom, m); else classic(o.bottom, false); }
  for (const b of boxes) if (b.id !== 'top' && b.id !== 'bottom' && b.text) drawAt(b.text, b);
  for (const s of (o.stickers || [])) {
    const sw = s.size * W, sh = sw * (s.img.naturalHeight / s.img.naturalWidth);
    ctx.drawImage(s.img, s.x * W - sw / 2, s.y * H - sh / 2, sw, sh);
  }
}

/* what each picture's meme holds beyond the controls */
const memes = new Map();     // source url → { boxes: [...], stickers: [...] }

window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["meme-generator"] = {
"title": "Meme Generator",
"kind": "editor",
"multiple": false,
"description": "Add top and bottom captions or any number of text boxes you drag into place, in Anton or four other fonts, with outlines and image stickers.",
"keywords": ["meme generator","meme maker","add text to image","caption image","impact font meme","add sticker to photo"],
"controls": [{"key":"top","label":"Top text","type":"text","default":"ONE DOES NOT SIMPLY"},{"key":"bottom","label":"Bottom text","type":"text","default":"SHIP WITHOUT TESTS"},
  {"key":"font","label":"Font","type":"select","default":"anton","options":[{"value":"anton","label":"Anton — the classic meme look"},{"value":"impact","label":"Impact, if this device has it"},{"value":"bebas","label":"Bebas Neue"},{"value":"comic","label":"Comic Neue"},{"value":"marker","label":"Permanent Marker"},{"value":"arial","label":"Arial Bold"}]},
  {"key":"size","label":"Text size %","type":"range","default":10,"min":4,"max":20},
  {"key":"color","label":"Text colour","type":"color","default":"#ffffff"},
  {"key":"outline","label":"Outline colour","type":"color","default":"#000000"},
  {"key":"outlineWidth","label":"Outline width (% of the text size)","type":"range","default":12,"min":0,"max":30},
  {"key":"caps","label":"Force uppercase","type":"select","default":"yes","options":[{"value":"yes","label":"Yes"},{"value":"no","label":"No"}]},
  {"key":"format","label":"Save as","type":"select","default":"image/png","options":[{"value":"image/png","label":"PNG — crispest text"},{"value":"image/jpeg","label":"JPEG — much smaller for photos"},{"value":"image/webp","label":"WebP — small"}]},
  {"key":"quality","label":"Quality (JPEG / WebP)","type":"range","default":92,"min":10,"max":100}],
"fonts": FONTS,
"paint": paint,
"runEditor": async (api, o, token) => {
  const { el } = api;
  const src = api.sources[0];
  const img = src.img;
  const W = img.naturalWidth, H = img.naturalHeight;
  if (!memes.has(src.url)) memes.set(src.url, { boxes: [], stickers: [] });
  const M = memes.get(src.url);
  const fontOk = await loadFont(o.font);
  if (api.stale(token)) return false;

  const wrap = el('div', 'select-wrap meme-wrap');
  wrap.appendChild(el('p', 'select-hint', 'Drag any caption or sticker to move it. Add as many text boxes as you like.'));
  const tools = el('div', 'crop-tools');
  const addText = el('button', 'btn-ghost', 'Add a text box'); addText.type = 'button';
  const addSticker = el('button', 'btn-ghost', 'Add a sticker image…'); addSticker.type = 'button';
  const stickerIn = el('input', 'visually-hidden'); stickerIn.type = 'file'; stickerIn.accept = 'image/*'; stickerIn.tabIndex = -1;
  const resetPos = el('button', 'btn-ghost', 'Reset positions'); resetPos.type = 'button';
  tools.appendChild(addText); tools.appendChild(addSticker); tools.appendChild(stickerIn); tools.appendChild(resetPos);
  wrap.appendChild(tools);
  const view = el('canvas', 'select-canvas meme-view');
  const vs = Math.min(1, 720 / W);
  view.width = Math.round(W * vs); view.height = Math.round(H * vs);
  view.tabIndex = 0;
  view.setAttribute('aria-label', 'The meme. Drag a caption or sticker to move it.');
  wrap.appendChild(view);
  const list = el('div', 'meme-list');
  wrap.appendChild(list);
  api.stage.appendChild(wrap);
  const resultHost = el('div', 'image-card');
  api.stage.appendChild(resultHost);
  const vctx = view.getContext('2d');
  const small = el('canvas'); small.width = view.width; small.height = view.height;
  small.getContext('2d').drawImage(img, 0, 0, view.width, view.height);
  small.naturalWidth = view.width; small.naturalHeight = view.height;

  const opts = () => Object.assign({}, api.readOpts(), { boxes: M.boxes, stickers: M.stickers });
  /* where a caption sits, as a centre in fractions, measured off a paint of the view */
  const helpers = api.makeHelpers(view, vctx, []);
  function paintView() { paint(vctx, small, opts(), helpers); }
  const fsFrac = () => (Number(api.readOpts().size) || 10) / 100;
  /* the boxes that can be grabbed: moved ones where they are, and the classic top and bottom bands */
  function hit(fx, fy) {
    for (let i = M.stickers.length - 1; i >= 0; i--) {
      const s = M.stickers[i], sw = s.size, sh = s.size * (s.img.naturalHeight / s.img.naturalWidth) * (W / H);
      if (Math.abs(fx - s.x) < sw / 2 && Math.abs(fy - s.y) < sh / 2) return { kind: 'sticker', ref: s };
    }
    const f = fsFrac();
    for (const b of M.boxes) if (b.x !== undefined && Math.abs(fy - b.y) < f * 1.2 && Math.abs(fx - b.x) < 0.47) return { kind: 'box', ref: b };
    const oo = api.readOpts();
    if (oo.top && !M.boxes.some((b) => b.id === 'top' && b.x !== undefined) && fy < f * 2.4) return { kind: 'classic', id: 'top', y: f * 0.7 };
    if (oo.bottom && !M.boxes.some((b) => b.id === 'bottom' && b.x !== undefined) && fy > 1 - f * 2.4) return { kind: 'classic', id: 'bottom', y: 1 - f * 0.75 };
    return null;
  }
  let drag = null;
  const pos = (e) => { const r = view.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
  view.addEventListener('pointerdown', (e) => {
    const p = pos(e), t = hit(p.x, p.y);
    if (!t) return;
    e.preventDefault(); view.setPointerCapture(e.pointerId);
    let ref = t.ref;
    if (t.kind === 'classic') {
      ref = M.boxes.find((b) => b.id === t.id) || { id: t.id };
      if (M.boxes.indexOf(ref) < 0) M.boxes.push(ref);
      ref.x = 0.5; ref.y = t.y;
    }
    drag = { ref, dx: p.x - ref.x, dy: p.y - ref.y };
  });
  view.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = pos(e);
    drag.ref.x = Math.max(0, Math.min(1, p.x - drag.dx)); drag.ref.y = Math.max(0, Math.min(1, p.y - drag.dy));
    paintView();
  });
  const up = () => { if (drag) { drag = null; render(); } };
  view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);

  /* the extra boxes' text and the stickers' size, as fields under the picture */
  function renderList() {
    list.innerHTML = '';
    M.boxes.filter((b) => b.id !== 'top' && b.id !== 'bottom').forEach((b, k) => {
      const row = el('div', 'meme-row');
      const lab = el('label', null, `Text box ${k + 1}`);
      const t = el('input', 'control'); t.type = 'text'; t.value = b.text || ''; t.id = 'meme-box-' + k;
      lab.setAttribute('for', t.id);
      let tm = 0;
      t.addEventListener('input', () => { b.text = t.value; paintView(); clearTimeout(tm); tm = setTimeout(render, 350); });
      const rm = el('button', 'btn-ghost', '×'); rm.type = 'button'; rm.title = 'Remove this text box';
      rm.addEventListener('click', () => { M.boxes.splice(M.boxes.indexOf(b), 1); renderList(); paintView(); render(); });
      row.appendChild(lab); row.appendChild(t); row.appendChild(rm);
      list.appendChild(row);
    });
    M.stickers.forEach((s, k) => {
      const row = el('div', 'meme-row');
      const lab = el('label', null, `Sticker ${k + 1} size`);
      const r = el('input', 'range'); r.type = 'range'; r.min = 5; r.max = 100; r.value = Math.round(s.size * 100); r.id = 'meme-st-' + k;
      lab.setAttribute('for', r.id);
      r.addEventListener('input', () => { s.size = Number(r.value) / 100; paintView(); });
      r.addEventListener('change', () => render());
      const rm = el('button', 'btn-ghost', '×'); rm.type = 'button'; rm.title = 'Remove this sticker';
      rm.addEventListener('click', () => { M.stickers.splice(k, 1); renderList(); paintView(); render(); });
      row.appendChild(lab); row.appendChild(r); row.appendChild(rm);
      list.appendChild(row);
    });
  }
  addText.addEventListener('click', () => {
    M.boxes.push({ id: 'box' + Date.now(), text: 'YOUR TEXT', x: 0.5, y: 0.5 });
    renderList(); paintView(); render();
    const inputs = list.querySelectorAll('input[type=text]'); if (inputs.length) inputs[inputs.length - 1].select();
  });
  addSticker.addEventListener('click', () => stickerIn.click());
  stickerIn.addEventListener('change', () => {
    const f = stickerIn.files[0];
    if (!f) return;
    const s = new Image();
    s.onload = () => { M.stickers.push({ img: s, x: 0.5, y: 0.5, size: 0.25, name: f.name }); stickerIn.value = ''; renderList(); paintView(); render(); };
    s.onerror = () => api.problem(`${f.name} could not be read as an image, so it was not added.`);
    s.src = URL.createObjectURL(f);
  });
  resetPos.addEventListener('click', () => { M.boxes = M.boxes.filter((b) => b.id !== 'top' && b.id !== 'bottom'); M.boxes.forEach((b) => { b.x = 0.5; b.y = 0.5; }); renderList(); paintView(); render(); });

  let chain = Promise.resolve();
  const render = () => { chain = chain.then(renderNow, renderNow); return chain; };
  async function renderNow() {
    const oo = opts();
    const canvas = el('canvas');
    const ctx = canvas.getContext('2d');
    paint(ctx, img, oo, api.makeHelpers(canvas, ctx, []));
    const res = await api.encodeOut(canvas, oo.format || 'image/png', oo, src.file.name, {});
    api.revokePreviews();
    resultHost.innerHTML = ''; api.actions.innerHTML = '';
    if (!res) { api.setOutputs([]); return; }
    const name = `${api.baseName(src)}-meme-generator.${api.extOfType(res.type)}`;
    api.setOutputs([{ name, blob: res.blob }]);
    const prev = el('img', 'image-preview'); prev.src = api.previewUrl(res.blob); prev.alt = 'Result preview';
    resultHost.appendChild(prev);
    const cap = el('div', 'image-cap');
    cap.appendChild(el('span', null, `${canvas.width}×${canvas.height}`));
    cap.appendChild(el('span', 'file-size', api.fmtBytes(res.blob.size)));
    resultHost.appendChild(cap);
    api.addBatchActions();
    const F = FONTS[oo.font] || FONTS.impact;
    api.renderStats([
      ['Size', `${canvas.width}×${canvas.height}`],
      ['Font', (F.family || F.css.split(',')[0].replace(/"/g, '')) + (F.family ? ' (served from this site)' : ' (from this device, if installed)')],
      ['Text boxes', String((oo.top ? 1 : 0) + (oo.bottom ? 1 : 0) + M.boxes.filter((b) => b.id !== 'top' && b.id !== 'bottom' && b.text).length)],
      ['Stickers', String(M.stickers.length)],
      ['Output size', api.fmtBytes(res.blob.size)]
    ]);
    if (!fontOk) api.say('The font could not be loaded, so this device’s fallback was used.', 'warn');
  }
  renderList();
  paintView();
  await render();
},
"tips": ["Anton, served from this site, gives the classic meme look on every device; Impact itself is a Microsoft font that most phones lack, so choose it only if you know the device has it.","Drag the top or bottom caption anywhere on the picture, add more text boxes for labels, and drop in a sticker image such as a logo; drag stickers too.","The heavy outline exists so white text stays readable on light backgrounds. Its width is a share of the text size; keep it above about 8%.","Long captions wrap automatically. Reduce the text size if a caption covers too much of the picture."],
"faq": [{"q":"Can I put text in the middle?","a":"Yes. Drag the top or bottom caption wherever you want it, or press “Add a text box” for as many more as you need; each wraps to the picture’s width."},{"q":"Are the fonts free to use for memes I share?","a":"Yes. Anton, Bebas Neue and Comic Neue are under the SIL Open Font License and Permanent Marker under the Apache License; both allow use in images you make and share. Their licences are served beside the fonts."}]
};
})();
