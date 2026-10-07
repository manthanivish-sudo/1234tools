(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}

/* ---- the exports, each from a list of { hex, r, g, b, name } ---- */
const hex2 = (c) => '#' + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('');
const EXPORTS = {
  css: { label: 'CSS custom properties', ext: 'css', type: 'text/css',
    make: (list, hsl) => ':root {\n' + list.map((c, i) => `  --colour-${i + 1}: ${hex2(c)}; /* ${hsl(c)} */`).join('\n') + '\n}\n' },
  json: { label: 'JSON', ext: 'json', type: 'application/json',
    make: (list, hsl) => JSON.stringify(list.map((c) => ({ name: c.name, hex: hex2(c), rgb: [c.r, c.g, c.b], hsl: hsl(c), share: c.share === undefined ? null : +c.share.toFixed(4) })), null, 2) + '\n' },
  tailwind: { label: 'Tailwind (theme colours)', ext: 'js', type: 'text/javascript',
    make: (list) => '// tailwind.config.js — theme.extend.colors\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n        palette: {\n' +
      list.map((c, i) => `          ${(i + 1) * 100}: '${hex2(c)}',`).join('\n') + '\n        }\n      }\n    }\n  }\n};\n' },
  gpl: { label: 'GIMP / Inkscape palette (.gpl)', ext: 'gpl', type: 'text/plain',
    make: (list, hsl, title) => `GIMP Palette\nName: ${title}\nColumns: ${Math.min(list.length, 8)}\n#\n` +
      list.map((c) => `${String(c.r).padStart(3)} ${String(c.g).padStart(3)} ${String(c.b).padStart(3)}\t${c.name}`).join('\n') + '\n' },
  ase: { label: 'Adobe Swatch Exchange (.ase)', ext: 'ase', type: 'application/octet-stream', binary: true, make: (list) => ase(list) },
  png: { label: 'PNG swatch card', ext: 'png', type: 'image/png', binary: true, image: true }
};
/* Adobe Swatch Exchange 1.0: "ASEF", version, block count, then one colour
   block each: type 0x0001, length, the name in UTF-16BE with its length and
   a closing 0, "RGB ", three 32-bit floats (0–1) and the colour type (2, normal) */
function ase(list) {
  const blocks = list.map((c) => {
    const name = c.name + '\0';
    const len = 2 + name.length * 2 + 4 + 12 + 2;
    const b = new DataView(new ArrayBuffer(6 + len));
    let p = 0;
    b.setUint16(p, 0x0001); p += 2;
    b.setUint32(p, len); p += 4;
    b.setUint16(p, name.length); p += 2;
    for (let k = 0; k < name.length; k++) { b.setUint16(p, name.charCodeAt(k)); p += 2; }
    'RGB '.split('').forEach((ch) => { b.setUint8(p++, ch.charCodeAt(0)); });
    [c.r, c.g, c.b].forEach((v) => { b.setFloat32(p, v / 255); p += 4; });
    b.setUint16(p, 2);
    return new Uint8Array(b.buffer);
  });
  const head = new DataView(new ArrayBuffer(12));
  [0x41, 0x53, 0x45, 0x46].forEach((v, k) => head.setUint8(k, v));
  head.setUint16(4, 1); head.setUint16(6, 0); head.setUint32(8, list.length);
  const total = 12 + blocks.reduce((t, x) => t + x.length, 0);
  const out = new Uint8Array(total);
  out.set(new Uint8Array(head.buffer), 0);
  let o = 12;
  blocks.forEach((x) => { out.set(x, o); o += x.length; });
  return out;
}

/* colours picked with the eyedropper, per photo, kept across settings changes */
const picked = new Map();

window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["color-palette-extractor"] = {
"title": "Colour Palette Extractor",
"kind": "analyse",
"multiple": false,
"description": "Pull the dominant colours out of any image as HEX, RGB and HSL with contrast checks, pick exact colours with an eyedropper, and export CSS, JSON, Tailwind, GIMP, Adobe ASE or a PNG swatch card.",
"keywords": ["color palette generator","extract colors from image","image color picker","dominant color","palette from photo","brand colours from logo","eyedropper online","ase palette export"],
"controls": [{"key":"count","label":"Number of colours","type":"range","default":6,"min":2,"max":12},
  {"key":"export","label":"Export as","type":"select","default":"css","options":Object.keys(EXPORTS).map((k) => ({ value: k, label: EXPORTS[k].label }))}],
"exports": EXPORTS,
"ase": ase,
"analyse": (api, src, o) => {
  const { el } = api;
  const CORE = window.MVRImage;
  const n = Math.max(2, Math.min(12, Number(o.count) || 6));
  const SAMPLE = 160;
  const nw = src.img.naturalWidth, nh = src.img.naturalHeight;
  const scale = Math.min(1, SAMPLE / Math.max(nw, nh));
  const c = el('canvas');
  c.width = Math.max(1, Math.round(nw * scale));
  c.height = Math.max(1, Math.round(nh * scale));
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(src.img, 0, 0, c.width, c.height);
  const pal = CORE.medianCut(cx.getImageData(0, 0, c.width, c.height).data, n);
  if (!picked.has(src.url)) picked.set(src.url, []);
  const mine = picked.get(src.url);

  const WHITE = { r: 255, g: 255, b: 255 }, BLACK = { r: 0, g: 0, b: 0 };
  /* HSL and the WCAG contrast ratio against white and black text, with the
     same maths as the Colour Converter & Contrast Checker */
  const facts = (col) => {
    const [hh, ss, ll] = CORE.rgbToHsl(col.r, col.g, col.b);
    return { hsl: `hsl(${hh}, ${ss}%, ${ll}%)`, onW: CORE.contrastRatio(col, WHITE), onB: CORE.contrastRatio(col, BLACK) };
  };
  const hslOf = (col) => facts(col).hsl;
  const ratio = (r) => r.toFixed(2) + ':1 ' + CORE.wcagGrade(r);
  const all = () => pal.map((p, i) => Object.assign({ name: 'Colour ' + (i + 1) }, p)).concat(mine.map((p, i) => Object.assign({ name: 'Picked ' + (i + 1) }, p)));

  /* ---- the eyedropper: the photo, click (or Enter at the cross) to pick a pixel ---- */
  const dropWrap = el('div', 'select-wrap pal-pick');
  dropWrap.appendChild(el('p', 'select-hint', 'Click the picture to pick the exact colour of a pixel; it is added to the palette. Or move the cross with the arrow keys and press Enter.'));
  const view = el('canvas', 'select-canvas pal-view');
  const vs = Math.min(1, 640 / nw);
  view.width = Math.max(1, Math.round(nw * vs)); view.height = Math.max(1, Math.round(nh * vs));
  view.tabIndex = 0;
  view.setAttribute('role', 'application');
  view.setAttribute('aria-label', 'Eyedropper. Arrow keys move the cross, Enter picks the colour under it.');
  const vx = view.getContext('2d', { willReadFrequently: true });
  /* the full-size pixels, for an exact pick: drawn the first time the pointer or the keys ask */
  let fx = null;
  const pixelAt = (x, y) => {
    if (!fx) { const full = el('canvas'); full.width = nw; full.height = nh; fx = full.getContext('2d', { willReadFrequently: true }); fx.drawImage(src.img, 0, 0); }
    return fx.getImageData(x, y, 1, 1).data;
  };
  let live = false;
  const cross = { x: Math.round(nw / 2), y: Math.round(nh / 2) };
  const loupe = el('span', 'pal-loupe');
  const paintView = (withLoupe) => {
    if (withLoupe) live = true;
    vx.drawImage(src.img, 0, 0, view.width, view.height);
    const x = (cross.x + 0.5) * vs, y = (cross.y + 0.5) * vs;
    vx.strokeStyle = '#000'; vx.lineWidth = 3;
    vx.beginPath(); vx.moveTo(x - 12, y); vx.lineTo(x + 12, y); vx.moveTo(x, y - 12); vx.lineTo(x, y + 12); vx.stroke();
    vx.strokeStyle = '#fff'; vx.lineWidth = 1;
    vx.beginPath(); vx.moveTo(x - 12, y); vx.lineTo(x + 12, y); vx.moveTo(x, y - 12); vx.lineTo(x, y + 12); vx.stroke();
    if (!live) { loupe.textContent = 'Point at the picture to see a pixel’s colour'; return; }
    const d = pixelAt(cross.x, cross.y);
    const h = hex2({ r: d[0], g: d[1], b: d[2] });
    loupe.style.background = h;
    loupe.textContent = `${h.toUpperCase()} at ${cross.x}, ${cross.y}`;
    loupe.style.color = facts({ r: d[0], g: d[1], b: d[2] }).onB >= facts({ r: d[0], g: d[1], b: d[2] }).onW ? '#06080f' : '#f4f6fb';
  };
  const pickAt = () => {
    const d = pixelAt(cross.x, cross.y);
    mine.push({ r: d[0], g: d[1], b: d[2], at: [cross.x, cross.y] });
    api.rerun();
  };
  view.addEventListener('mousemove', (e) => {
    const r = view.getBoundingClientRect();
    cross.x = Math.max(0, Math.min(nw - 1, Math.floor((e.clientX - r.left) / r.width * nw)));
    cross.y = Math.max(0, Math.min(nh - 1, Math.floor((e.clientY - r.top) / r.height * nh)));
    paintView(true);
  });
  view.addEventListener('click', (e) => {
    const r = view.getBoundingClientRect();
    cross.x = Math.max(0, Math.min(nw - 1, Math.floor((e.clientX - r.left) / r.width * nw)));
    cross.y = Math.max(0, Math.min(nh - 1, Math.floor((e.clientY - r.top) / r.height * nh)));
    pickAt();
  });
  view.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 1;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) { e.preventDefault(); cross.x = Math.max(0, Math.min(nw - 1, cross.x + d[0])); cross.y = Math.max(0, Math.min(nh - 1, cross.y + d[1])); paintView(true); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickAt(); }
  });
  dropWrap.appendChild(view);
  dropWrap.appendChild(loupe);
  if (mine.length) {
    const clear = el('button', 'btn-ghost', 'Clear picked colours'); clear.type = 'button';
    clear.addEventListener('click', () => { mine.length = 0; api.rerun(); });
    dropWrap.appendChild(clear);
  }
  paintView();

  /* ---- the swatches ---- */
  const grid = el('div', 'palette-grid');
  all().forEach((col) => {
    const hex = CORE.toHex(col);
    const f = facts(col);
    const sw = el('div', 'palette-swatch');
    sw.style.background = hex;
    /* the label colour is whichever of the two reads better */
    sw.style.color = f.onB >= f.onW ? '#06080f' : '#f4f6fb';
    sw.appendChild(el('span', 'palette-hex', hex.toUpperCase()));
    sw.appendChild(el('span', 'palette-share', col.share !== undefined ? Math.round(col.share * 100) + '%' : 'picked at ' + col.at.join(', ')));
    sw.appendChild(el('span', 'palette-share palette-hsl', f.hsl));
    sw.appendChild(el('span', 'palette-share palette-contrast', 'on white ' + f.onW.toFixed(2) + ':1 · on black ' + f.onB.toFixed(2) + ':1'));
    sw.title = 'Click to copy ' + hex;
    sw.tabIndex = 0;
    sw.setAttribute('role', 'button');
    const copyHex = () => {
      if (navigator.clipboard) navigator.clipboard.writeText(hex);
      const was = sw.querySelector('.palette-hex').textContent;
      sw.querySelector('.palette-hex').textContent = 'Copied';
      setTimeout(() => { sw.querySelector('.palette-hex').textContent = was; }, 1200);
    };
    sw.addEventListener('click', copyHex);
    sw.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyHex(); } });
    grid.appendChild(sw);
  });
  api.stage.appendChild(grid);

  /* ---- the export ---- */
  const kind = EXPORTS[o.export] ? o.export : 'css';
  const X = EXPORTS[kind];
  const base = (src.file.name.replace(/\.[^.]+$/, '') || 'image') + '-palette';
  const list = all();
  const pane = el('div', 'io-pane');
  const head = el('div', 'io-head');
  head.appendChild(el('span', 'io-label', X.label));
  const acts = el('div', 'io-actions');
  let text = '';
  if (!X.binary) {
    text = X.make(list, hslOf, base);
    const copy = el('button', 'btn-copy', 'Copy'); copy.type = 'button';
    copy.addEventListener('click', () => { if (navigator.clipboard) navigator.clipboard.writeText(text); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy'; }, 1200); });
    acts.appendChild(copy);
  }
  const dl = el('button', 'btn-primary', 'Download .' + X.ext); dl.type = 'button';
  dl.addEventListener('click', async () => {
    let blob;
    if (X.image) blob = await swatchCard(list, CORE, hslOf);
    else if (X.binary) blob = new Blob([X.make(list)], { type: X.type });
    else blob = new Blob([text], { type: X.type });
    api.downloadBlob(blob, base + '.' + X.ext);
  });
  acts.appendChild(dl);
  head.appendChild(acts);
  pane.appendChild(head);
  if (!X.binary) pane.appendChild(el('pre', 'code-out', text));
  else pane.appendChild(el('p', 'select-hint', X.image ? `A ${list.length}-colour card, 160 px a swatch, with each hex and RGB value under it.` : `${list.length} colours as RGB swatches, for Photoshop, Illustrator, InDesign and Affinity (Swatches › Import).`));
  api.stage.appendChild(pane);
  api.stage.appendChild(dropWrap);

  api.renderStats(list.map((c2) => {
    const hex = CORE.toHex(c2);
    const f = facts(c2);
    return [`${c2.name}  ${hex.toUpperCase()}`,
            `rgb(${c2.r}, ${c2.g}, ${c2.b}) · ${f.hsl} · ${c2.share !== undefined ? Math.round(c2.share * 100) + '% of image' : 'picked at ' + c2.at.join(', ')} · ` +
            `contrast with white text ${ratio(f.onW)}, with black text ${ratio(f.onB)}`];
  }));
},
"tips": ["Colours are found with median cut, which is deterministic — the same image always produces the same palette.","The share figure shows how much of the image each colour occupies, which is a good guide to how prominently to use it.","Click the picture to pick the exact colour of one pixel — a logo’s brand colour, say — and it joins the palette and every export.","Each colour comes with its HSL value and its WCAG contrast ratio against white and against black text, graded AAA (7:1), AA (4.5:1), AA large (3:1, large text only) or fail. Photographic colours are often mid-tone and fail with both.","Export as CSS custom properties, JSON, a Tailwind colour scale, a GIMP/Inkscape .gpl palette, an Adobe .ase swatch file or a PNG swatch card."],
"faq": [{"q":"Why are the colours slightly different from the photo?","a":"Each palette swatch is the average of a cluster of similar pixels rather than a single sampled pixel, so it represents a region rather than a point. For one exact pixel, click it on the picture: the eyedropper adds that pixel’s colour as it is."},{"q":"Can I use the palette in Photoshop or Illustrator?","a":"Yes. Choose Adobe Swatch Exchange (.ase) under Export as and download it; Photoshop, Illustrator, InDesign and Affinity import it from their Swatches panel."}]
};

/* the PNG swatch card: one 160 px square a colour, hex and RGB under it */
async function swatchCard(list, CORE, hslOf) {
  const S = 160, PAD = 16, TXT = 44;
  const cols = Math.min(list.length, 6), rows = Math.ceil(list.length / cols);
  const c = document.createElement('canvas');
  c.width = PAD + cols * (S + PAD); c.height = PAD + rows * (S + TXT + PAD);
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
  list.forEach((col, i) => {
    const px = PAD + (i % cols) * (S + PAD), py = PAD + Math.floor(i / cols) * (S + TXT + PAD);
    x.fillStyle = hex2(col); x.fillRect(px, py, S, S);
    x.strokeStyle = '#d0d0d0'; x.strokeRect(px + 0.5, py + 0.5, S - 1, S - 1);
    x.fillStyle = '#111111'; x.font = 'bold 15px system-ui, sans-serif'; x.textBaseline = 'top';
    x.fillText(hex2(col).toUpperCase(), px, py + S + 6);
    x.font = '12px system-ui, sans-serif'; x.fillStyle = '#444444';
    x.fillText(`rgb ${col.r}, ${col.g}, ${col.b}`, px, py + S + 25);
  });
  return new Promise((res) => c.toBlob(res, 'image/png'));
}
})();
