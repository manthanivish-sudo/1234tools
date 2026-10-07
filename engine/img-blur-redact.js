(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}

/* A box blur run three times (close to a Gaussian), on the pixels
   themselves, so every browser gives the same result: Safari's canvas has
   no ctx.filter. Separable running sums: the cost does not grow with the
   radius. */
function boxBlur(data, w, h, r) {
  r = Math.max(1, Math.round(r));
  const tmp = new Uint8ClampedArray(data.length);
  const pass = (src, dst, horizontal) => {
    const len = horizontal ? w : h, lines = horizontal ? h : w;
    const step = horizontal ? 4 : w * 4;
    for (let l = 0; l < lines; l++) {
      const base = horizontal ? l * w * 4 : l * 4;
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) sum += src[base + Math.max(0, Math.min(len - 1, k)) * step + c];
        for (let i = 0; i < len; i++) {
          dst[base + i * step + c] = sum / (2 * r + 1);
          const add = Math.min(len - 1, i + r + 1), drop = Math.max(0, i - r);
          sum += src[base + add * step + c] - src[base + drop * step + c];
        }
      }
    }
  };
  for (let n = 0; n < 3; n++) { pass(data, tmp, true); pass(tmp, data, false); }
  return data;
}

/* what was drawn on each picture, kept across settings changes */
const regionsOf = new Map();          // source url → { list: [...], undo: [...] }
const stateFor = (url) => { if (!regionsOf.has(url)) regionsOf.set(url, { list: [] }); return regionsOf.get(url); };

/* the effect, on a copy of the picture, kept only where the shapes are */
function applyRegions(ctx, img, regions, o, h) {
  const W = img.naturalWidth, H = img.naturalHeight;
  h.size(W, H);
  ctx.drawImage(img, 0, 0);
  const shapes = o.scope === 'whole' ? [{ kind: 'rect', x: 0, y: 0, w: W, h: H }] : regions;
  if (!shapes.length) return 0;
  const s = Math.max(2, Number(o.strength) || 16);
  /* the area all the shapes cover, so the effect is only worked out there */
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (const r of shapes) {
    const b = boundsOf(r);
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
  }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1));
  const bw = x1 - x0, bh = y1 - y0;
  if (bw < 1 || bh < 1) return 0;
  const fx = h.scratch(bw, bh);
  if (o.method === 'block') {
    fx.ctx.fillStyle = o.color || '#000000';
    fx.ctx.fillRect(0, 0, bw, bh);
  } else if (o.method === 'blur') {
    /* a margin of picture around the area, so the edge of the blur is not darkened */
    const m = Math.min(s * 3, 200);
    const ax = Math.max(0, x0 - m), ay = Math.max(0, y0 - m), aw = Math.min(W, x1 + m) - ax, ah = Math.min(H, y1 + m) - ay;
    const big = h.scratch(aw, ah);
    big.ctx.drawImage(img, ax, ay, aw, ah, 0, 0, aw, ah);
    const d = big.ctx.getImageData(0, 0, aw, ah);
    boxBlur(d.data, aw, ah, s / 2);
    big.ctx.putImageData(d, 0, 0);
    fx.ctx.drawImage(big.canvas, x0 - ax, y0 - ay, bw, bh, 0, 0, bw, bh);
  } else {
    /* pixelate: blocks of s pixels on the picture's own grid, each one flat colour */
    const gx0 = Math.floor(x0 / s) * s, gy0 = Math.floor(y0 / s) * s;
    const cols = Math.ceil((x1 - gx0) / s), rows = Math.ceil((y1 - gy0) / s);
    const small = h.scratch(cols, rows);
    small.ctx.imageSmoothingEnabled = true;
    small.ctx.drawImage(img, gx0, gy0, cols * s, rows * s, 0, 0, cols, rows);
    fx.ctx.imageSmoothingEnabled = false;
    fx.ctx.drawImage(small.canvas, 0, 0, cols, rows, gx0 - x0, gy0 - y0, cols * s, rows * s);
  }
  /* cut the effect to the shapes */
  const mask = h.scratch(bw, bh);
  mask.ctx.translate(-x0, -y0);
  mask.ctx.fillStyle = '#000'; mask.ctx.strokeStyle = '#000'; mask.ctx.lineCap = 'round'; mask.ctx.lineJoin = 'round';
  for (const r of shapes) drawShape(mask.ctx, r);
  fx.ctx.globalCompositeOperation = 'destination-in';
  fx.ctx.drawImage(mask.canvas, 0, 0);
  fx.ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(fx.canvas, x0, y0);
  return shapes.length;
}
function drawShape(c, r) {
  if (r.kind === 'rect') c.fillRect(r.x, r.y, r.w, r.h);
  else if (r.kind === 'ellipse') { c.beginPath(); c.ellipse(r.x + r.w / 2, r.y + r.h / 2, Math.max(0.5, r.w / 2), Math.max(0.5, r.h / 2), 0, 0, Math.PI * 2); c.fill(); }
  else if (r.kind === 'brush') {
    c.lineWidth = r.size;
    c.beginPath();
    r.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    if (r.pts.length === 1) c.lineTo(r.pts[0][0] + 0.01, r.pts[0][1]);
    c.stroke();
  }
}
function boundsOf(r) {
  if (r.kind !== 'brush') return { x: r.x, y: r.y, w: r.w, h: r.h };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  r.pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  const m = r.size / 2 + 1;
  return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
}

window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["blur-redact"] = {
"title": "Blur & Redact Image",
"kind": "editor",
"multiple": false,
"description": "Blur, pixelate or black out several areas of an image — boxes, ovals or brush strokes — to hide faces, addresses or account details before sharing.",
"keywords": ["blur image","pixelate image","redact screenshot","hide face in photo","censor image","blur part of image","blur multiple faces"],
"controls": [{"key":"method","label":"Method","type":"select","default":"pixelate","options":[{"value":"pixelate","label":"Pixelate — irreversible"},{"value":"blur","label":"Blur"},{"value":"block","label":"Solid block — safest"}]},{"key":"strength","label":"Strength","type":"range","default":16,"min":2,"max":60},{"key":"color","label":"Block colour","type":"color","default":"#000000","when":{"method":["block"]}},{"key":"shape","label":"Draw with","type":"select","default":"rect","options":[{"value":"rect","label":"Box"},{"value":"ellipse","label":"Oval — faces"},{"value":"brush","label":"Brush — free strokes"}]},{"key":"brush","label":"Brush size (px)","type":"range","default":40,"min":4,"max":200,"when":{"shape":["brush"]}},{"key":"scope","label":"Apply to","type":"select","default":"selection","options":[{"value":"selection","label":"The areas you draw"},{"value":"whole","label":"Whole image"}]},{"key":"format","label":"Save as","type":"select","default":"image/png","options":[{"value":"image/png","label":"PNG — lossless"},{"value":"image/jpeg","label":"JPEG — much smaller for photos"},{"value":"image/webp","label":"WebP — small"}]},{"key":"quality","label":"Quality (JPEG / WebP)","type":"range","default":92,"min":10,"max":100}],
"stateKey": () => '',
"applyRegions": applyRegions,
"boxBlur": boxBlur,
"runEditor": async (api, o) => {
  const { el } = api;
  const src = api.sources[0];
  const img = src.img;
  const W = img.naturalWidth, H = img.naturalHeight;
  const st = stateFor(src.url);
  const wrap = el('div', 'select-wrap redact-wrap');
  const hint = el('p', 'select-hint', 'Drag on the picture to cover an area; draw as many as you need. Ctrl+Z (⌘Z) undoes the last one.');
  const tools = el('div', 'crop-tools');
  const undo = el('button', 'btn-ghost', 'Undo'); undo.type = 'button';
  const clear = el('button', 'btn-ghost', 'Clear all'); clear.type = 'button';
  const count = el('span', 'redact-count');
  tools.appendChild(undo); tools.appendChild(clear); tools.appendChild(count);
  const view = el('canvas', 'select-canvas');
  view.tabIndex = 0;
  view.setAttribute('aria-label', 'The picture. Drag to cover an area.');
  const scale = Math.min(1, 720 / W);
  view.width = Math.max(1, Math.round(W * scale)); view.height = Math.max(1, Math.round(H * scale));
  const vctx = view.getContext('2d');
  wrap.appendChild(hint); wrap.appendChild(tools); wrap.appendChild(view);
  api.stage.appendChild(wrap);
  const resultHost = el('div', 'image-card');
  api.stage.appendChild(resultHost);

  /* the live view: the effect drawn at view size, then the outlines */
  const small = el('canvas'); small.width = view.width; small.height = view.height;
  small.getContext('2d').drawImage(img, 0, 0, view.width, view.height);
  small.naturalWidth = view.width; small.naturalHeight = view.height;
  let pending = null;
  const scaled = (r) => r.kind === 'brush' ? { kind: 'brush', size: r.size * scale, pts: r.pts.map(([x, y]) => [x * scale, y * scale]) }
    : { kind: r.kind, x: r.x * scale, y: r.y * scale, w: r.w * scale, h: r.h * scale };
  function paintView() {
    const oo = api.readOpts();
    const list = st.list.concat(pending ? [pending] : []);
    const helpers = api.makeHelpers(view, vctx, []);
    applyRegions(vctx, small, list.map(scaled), Object.assign({}, oo, { strength: Math.max(2, (Number(oo.strength) || 16) * scale) }), helpers);
    vctx.save();
    vctx.strokeStyle = '#f7c948'; vctx.lineWidth = 2; vctx.setLineDash([6, 4]);
    for (const r of list.map(scaled)) {
      const b = boundsOf(r);
      if (r.kind === 'ellipse') { vctx.beginPath(); vctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2); vctx.stroke(); }
      else if (r.kind === 'rect') vctx.strokeRect(b.x, b.y, b.w, b.h);
    }
    vctx.restore();
    count.textContent = st.list.length === 1 ? '1 area' : st.list.length + ' areas';
    undo.disabled = !st.list.length; clear.disabled = !st.list.length;
  }
  const pos = (e) => {
    const rect = view.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: Math.max(0, Math.min(W, (t.clientX - rect.left) / rect.width * W)), y: Math.max(0, Math.min(H, (t.clientY - rect.top) / rect.height * H)) };
  };
  let start = null;
  const onDown = (e) => {
    if (api.readOpts().scope === 'whole') return;
    e.preventDefault();
    const p = pos(e); start = p;
    const oo = api.readOpts();
    pending = oo.shape === 'brush' ? { kind: 'brush', size: Number(oo.brush) || 40, pts: [[Math.round(p.x), Math.round(p.y)]] }
      : { kind: oo.shape === 'ellipse' ? 'ellipse' : 'rect', x: Math.round(p.x), y: Math.round(p.y), w: 1, h: 1 };
    paintView();
  };
  const onMove = (e) => {
    if (!pending) return;
    e.preventDefault();
    const p = pos(e);
    if (pending.kind === 'brush') pending.pts.push([Math.round(p.x), Math.round(p.y)]);
    else {
      pending.x = Math.round(Math.min(start.x, p.x)); pending.y = Math.round(Math.min(start.y, p.y));
      pending.w = Math.max(1, Math.round(Math.abs(p.x - start.x))); pending.h = Math.max(1, Math.round(Math.abs(p.y - start.y)));
    }
    paintView();
  };
  const onUp = () => {
    if (!pending) return;
    if (pending.kind === 'brush' || pending.w > 2 || pending.h > 2) st.list.push(pending);
    pending = null;
    paintView(); render();
  };
  view.addEventListener('mousedown', onDown);
  view.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup', onUp);
  window.addEventListener('touchend', onUp);
  const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/^(INPUT|TEXTAREA)$/.test((e.target || {}).tagName || '')) { e.preventDefault(); doUndo(); } };
  document.addEventListener('keydown', onKey);
  api.setDetach(() => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('touchmove', onMove, { passive: false });
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('touchend', onUp);
    document.removeEventListener('keydown', onKey);
  });
  function doUndo() { if (!st.list.length) return; st.list.pop(); paintView(); render(); }
  undo.addEventListener('click', doUndo);
  clear.addEventListener('click', () => { st.list = []; paintView(); render(); });

  let chain = Promise.resolve();
  const render = () => { chain = chain.then(renderNow, renderNow); return chain; };
  async function renderNow() {
    const oo = api.readOpts();
    const canvas = el('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const n = applyRegions(ctx, img, st.list, oo, api.makeHelpers(canvas, ctx, []));
    const fmt = oo.format || 'image/png';
    const res = await api.encodeOut(canvas, fmt, oo, src.file.name, {});
    api.revokePreviews();
    resultHost.innerHTML = ''; api.actions.innerHTML = '';
    if (!res) { api.setOutputs([]); return; }
    const name = `${api.baseName(src)}-blur-redact.${api.extOfType(res.type)}`;
    api.setOutputs([{ name, blob: res.blob }]);
    const prev = el('img', 'image-preview'); prev.src = api.previewUrl(res.blob); prev.alt = 'Result';
    resultHost.appendChild(prev);
    const cap = el('div', 'image-cap');
    cap.appendChild(el('span', null, `${canvas.width}×${canvas.height}`));
    cap.appendChild(el('span', 'file-size', api.fmtBytes(res.blob.size)));
    resultHost.appendChild(cap);
    const dl = el('button', 'btn-primary', 'Download result'); dl.type = 'button';
    dl.addEventListener('click', () => api.downloadBlob(res.blob, name));
    api.actions.appendChild(dl);
    api.renderStats([
      ['Source', `${W}×${H}`],
      ['Areas covered', oo.scope === 'whole' ? 'the whole image' : String(n)],
      ['Method', oo.method === 'block' ? 'solid block' : oo.method === 'blur' ? `blur, radius ${Math.max(1, Math.round((Number(oo.strength) || 16) / 2))} px, three box passes` : `pixelate, ${Math.max(2, Number(oo.strength) || 16)} px blocks`],
      ['Output size', api.fmtBytes(res.blob.size)]
    ]);
    if (!n && oo.scope !== 'whole') api.say('Nothing is covered yet: drag on the picture to cover an area.', 'note');
    else api.say('');
  }
  paintView();
  await render();
},
"tips": ["A solid block is the only method that is provably irreversible. Both blur and pixelation have been reversed in published research, particularly on short strings like numbers.","Draw as many areas as you need — boxes for text, ovals for faces, the brush for anything irregular. Undo takes back the last one.","Never redact by drawing a shape in a document editor and exporting — the original pixels often survive underneath. Re-exporting the flattened image, as this tool does, is what actually removes them.","For screenshots containing account numbers or addresses, use the solid block and check the result before sharing."],
"faq": [{"q":"Is pixelation safe for hiding text?","a":"No. Pixelated text has been recovered by researchers, because the process is deterministic and the space of possible characters is small. Use a solid block for anything sensitive."},{"q":"Does the saved file keep my photo’s location?","a":"No. The result is a new file made from the pixels only, with none of the original’s EXIF, GPS or other metadata."}]
};
})();
