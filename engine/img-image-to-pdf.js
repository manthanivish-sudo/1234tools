(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}

/* zlib-compress bytes in the browser (CompressionStream 'deflate' writes
   zlib), or store them uncompressed where that is missing */
async function deflate(bytes) {
  if (typeof CompressionStream === 'function') {
    const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(cs).arrayBuffer());
  }
  return window.MVRImage.zlibStored(bytes);
}
/* the pixels of a picture as PDF image data: RGB rows, PNG-filtered and
   deflated, and the alpha channel as a soft mask when any pixel is see-through */
async function flatePage(img, CORE) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, w, h).data;
  const n = w * h;
  const rgb = new Uint8Array(n * 3), a = new Uint8Array(n);
  let alpha = false;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    rgb[i * 3] = d[j]; rgb[i * 3 + 1] = d[j + 1]; rgb[i * 3 + 2] = d[j + 2];
    a[i] = d[j + 3]; if (d[j + 3] !== 255) alpha = true;
  }
  const page = { bytes: await deflate(CORE.pngFilterRows(rgb, w, h, 3)), width: w, height: h, filter: 'FlateDecode', predictor: true, colorSpace: 'DeviceRGB' };
  if (alpha) page.smask = { bytes: await deflate(CORE.pngFilterRows(a, w, h, 1)), predictor: true };
  return page;
}
const LOSSLESS = ['image/png', 'image/gif', 'image/bmp'];

window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["image-to-pdf"] = {
"title": "Image to PDF Converter",
"kind": "binary",
"multiple": true,
"description": "Combine JPEG and PNG images into one PDF — JPEGs untouched, PNGs lossless — with drag-to-reorder pages, per-page rotation, page size, fit or fill, and your own file name.",
"keywords": ["image to pdf","jpg to pdf","png to pdf","photos to pdf","combine images pdf","convert image to pdf","png to pdf lossless"],
"controls": [{"key":"pageSize","label":"Page size","type":"select","default":"a4","options":[{"value":"a4","label":"A4"},{"value":"letter","label":"US Letter"},{"value":"legal","label":"Legal"},{"value":"a5","label":"A5"},{"value":"fit","label":"Fit to image"}]},
  {"key":"orientation","label":"Orientation","type":"select","default":"auto","options":[{"value":"auto","label":"Match each image"},{"value":"portrait","label":"Portrait"},{"value":"landscape","label":"Landscape"}]},
  {"key":"fill","label":"Image on the page","type":"select","default":"fit","options":[{"value":"fit","label":"Fit — the whole image, inside the margin"},{"value":"fill","label":"Fill — cover the page, trimming the overflow"}]},
  {"key":"margin","label":"Margin (pt)","type":"number","default":28,"min":0,"max":144},
  {"key":"jpeg","label":"JPEG photos","type":"select","default":"keep","options":[{"value":"keep","label":"Keep as they are — no re-encode"},{"value":"reencode","label":"Re-encode at the quality below (smaller PDF)"}]},
  {"key":"png","label":"PNG, GIF and BMP images","type":"select","default":"lossless","options":[{"value":"lossless","label":"Lossless — every pixel kept"},{"value":"jpeg","label":"As JPEG at the quality below (smaller)"}]},
  {"key":"quality","label":"Quality for re-encoded images","type":"range","default":88,"min":40,"max":100},
  {"key":"filename","label":"File name","type":"text","default":"images","placeholder":"images"}],
"runBinary": async (api, o, token) => {
  const { el } = api;
  const CORE = window.MVRImage;
  const sources = api.sources;
  /* the page order and turns: thumbnails to drag, or move with the buttons */
  const grid = el('div', 'pdf-order');
  grid.setAttribute('aria-label', 'Pages in order. Drag a page, or use its arrow buttons, to move it.');
  let dragFrom = -1;
  sources.forEach((s, i) => {
    s.rot = s.rot || 0;
    const card = el('div', 'image-card pdf-page');
    card.draggable = true;
    card.addEventListener('dragstart', (e) => { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)); } catch (x) { /* */ } card.classList.add('is-dragging'); });
    card.addEventListener('dragend', () => card.classList.remove('is-dragging'));
    card.addEventListener('dragover', (e) => { if (dragFrom >= 0) { e.preventDefault(); card.classList.add('is-over'); } });
    card.addEventListener('dragleave', () => card.classList.remove('is-over'));
    card.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (dragFrom < 0 || dragFrom === i) return;
      const [m] = sources.splice(dragFrom, 1); sources.splice(i, 0, m); dragFrom = -1;
      api.rerun();
    });
    const th = el('img', 'pdf-thumb'); th.src = s.url; th.alt = s.file.name; th.draggable = false;
    th.style.transform = s.rot ? `rotate(${s.rot}deg)` : '';
    card.appendChild(th);
    card.appendChild(el('div', 'image-cap', `Page ${i + 1} · ${s.file.name}`));
    const btns = el('div', 'img-card-btns');
    const b = (label, title, fn) => { const x = el('button', 'btn-ghost', label); x.type = 'button'; x.title = title; x.setAttribute('aria-label', title + ': ' + s.file.name); x.addEventListener('click', fn); btns.appendChild(x); };
    b('←', 'Move earlier', () => { if (!i) return; [sources[i - 1], sources[i]] = [sources[i], sources[i - 1]]; api.rerun(); });
    b('→', 'Move later', () => { if (i === sources.length - 1) return; [sources[i + 1], sources[i]] = [sources[i], sources[i + 1]]; api.rerun(); });
    b('⟲', 'Turn left', () => { s.rot = (s.rot + 270) % 360; api.rerun(); });
    b('⟳', 'Turn right', () => { s.rot = (s.rot + 90) % 360; api.rerun(); });
    card.appendChild(btns);
    grid.appendChild(card);
  });
  api.stage.appendChild(grid);

  api.say('Building PDF…', 'note');
  const pages = [];
  let asIs = 0, again = 0, lossless = 0, metaOut = 0;
  const reasons = [];
  const q = Math.max(40, Math.min(100, Number(o.quality) || 88));
  for (const s of sources) {
    if (api.stale(token)) return false;
    const info = CORE.jpegInfo(s.bytes);
    const type = CORE.mimeOf(s.bytes);
    let page = null;
    if (info && info.passthrough && o.jpeg !== 'reencode') {
      const bytes = CORE.stripJpegMetadata(s.bytes);
      if (bytes !== s.bytes) metaOut++;
      page = { bytes, width: info.width, height: info.height,
               colorSpace: info.components === 1 ? 'DeviceGray' : 'DeviceRGB', icc: CORE.jpegICC(s.bytes) };
      asIs++;
    } else if (LOSSLESS.indexOf(type) >= 0 && o.png !== 'jpeg') {
      page = await flatePage(s.img, CORE);
      lossless++;
    } else {
      if (info && !info.passthrough && o.jpeg !== 'reencode') reasons.push(s.file.name + ': ' + info.why);
      const c = el('canvas');
      c.width = s.img.naturalWidth; c.height = s.img.naturalHeight;
      const cx = c.getContext('2d');
      cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, c.width, c.height);
      cx.drawImage(s.img, 0, 0);
      const res = await api.encodeOut(c, 'image/jpeg', { quality: q }, s.file.name, { opaque: true, defaultQuality: 88 });
      if (!res) continue;                               // said by name; the other pages carry on
      page = { bytes: new Uint8Array(await res.blob.arrayBuffer()), width: c.width, height: c.height };
      again++;
    }
    page.rotate = s.rot || 0;
    pages.push(page);
    const cards = grid.querySelectorAll('.pdf-page');
    const cap = cards[pages.length - 1] && cards[pages.length - 1].querySelector('.image-cap');
    if (cap) cap.textContent = `Page ${pages.length} · ` + (page.filter === 'FlateDecode' ? 'lossless' : page.colorSpace ? 'JPEG as it is' : 're-encoded at quality ' + q) + (page.rotate ? `, turned ${page.rotate}°` : '');
  }
  if (!pages.length) { api.say('No page could be made.', 'error'); return; }
  const pdf = CORE.buildPDF(pages, { pageSize: o.pageSize, orientation: o.orientation, margin: Number(o.margin), fill: o.fill });
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const base = String(o.filename || '').trim().replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120) || 'images';
  const name = base + '.pdf';
  api.setOutputs([{ name, blob }]);
  const dl = el('button', 'btn-primary', `Download PDF (${pages.length} page${pages.length > 1 ? 's' : ''})`);
  dl.type = 'button';
  dl.addEventListener('click', () => api.downloadBlob(blob, name));
  api.actions.appendChild(dl);

  api.say(reasons.length ? 'Re-encoded instead of embedded as they are — ' + reasons.join('; ') + '.' : '', reasons.length ? 'note' : undefined);
  const how = [];
  if (asIs) how.push(`${asIs} JPEG${asIs > 1 ? 's' : ''} embedded as ${asIs > 1 ? 'they are' : 'it is'}, not re-encoded` +
    (metaOut ? ` (EXIF, GPS and other metadata left out of ${metaOut})` : ''));
  if (lossless) how.push(`${lossless} image${lossless > 1 ? 's' : ''} kept lossless (FlateDecode)`);
  if (again) how.push(`${again} image${again > 1 ? 's' : ''} re-encoded as JPEG at quality ${q}`);
  api.renderStats([
    ['Pages', String(pages.length)],
    ['PDF size', api.fmtBytes(blob.size)],
    ['Page size', (o.pageSize || 'a4').toUpperCase()],
    ['Embedding', how.join('; ')],
    ['File name', name]
  ]);
},
"tips": ["A JPEG goes into the PDF as it is: its own compressed bytes are the page image (the PDF DCTDecode filter), so it loses nothing. Only EXIF, GPS and other metadata blocks are left out.","PNG, GIF and BMP images go in lossless, deflated with PNG row filters (FlateDecode), with any transparency kept as a soft mask. WebP and AVIF are encoded as JPEG at the quality slider’s setting, flattened onto white.","A JPEG is re-encoded anyway when its EXIF tag says to turn it (phone photos taken sideways), so that it stands the right way up, and when it is CMYK or 12-bit; the page says which and why.","Drag the page thumbnails into the order you want, or use their arrow buttons; ⟲ and ⟳ turn a single page without re-encoding it.","Choose “Re-encode at the quality below” to make a PDF of large phone photos smaller, and “As JPEG” for screenshots you do not need pixel-perfect.","\"Fit to image\" makes each page exactly the size of its image, which suits screenshots and scans better than forcing them onto A4."],
"faq": [{"q":"Is there a page or file limit?","a":"No artificial limit. Everything is assembled in memory on your device, so very large batches are bounded by available RAM rather than by an upload cap."},{"q":"Can it convert a PDF back to images?","a":"Yes, with the PDF to Images tool on this site (/pdf/pdf-to-images/): it renders each page of a PDF as a PNG or JPEG in your browser, with nothing uploaded. It lives on its own page so this one stays small."},{"q":"Does turning a page re-encode it?","a":"No. The page draws the same image data at a quarter turn, so a JPEG is still embedded byte for byte and a PNG stays lossless."}]
};
})();
