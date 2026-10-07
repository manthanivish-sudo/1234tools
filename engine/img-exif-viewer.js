(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}

const FORMAT = { jpeg: 'JPEG', png: 'PNG', webp: 'WebP', heic: 'HEIC / HEIF', avif: 'AVIF', tiff: 'TIFF', gif: 'GIF', bmp: 'BMP', ico: 'ICO' };
/* the fields as one object: what the JSON export holds */
function collect(CORE, bytes, file) {
  const kind = CORE.containerOf(bytes);
  const m = kind ? CORE.extractMetadata(bytes) : {};
  const ex = CORE.readExif(bytes);
  const tags = Object.assign({}, ex.tags);
  if (tags.OrientationLabel) { tags.Orientation = tags.OrientationLabel + ' (' + tags.Orientation + ')'; delete tags.OrientationLabel; }
  const out = {
    file: file.name, bytes: bytes.length, format: FORMAT[kind] || 'unknown',
    width: m.width || null, height: m.height || null,
    exif: tags, gps: null,
    xmp: Object.fromEntries(CORE.parseXMP(m.xmp)),
    iptc: Object.fromEntries(CORE.parseIPTC(m.iptc)),
    colourProfile: m.icc ? (CORE.iccIsSRGB(m.icc) ? 'sRGB' : 'embedded (' + m.icc.length.toLocaleString('en-GB') + ' bytes)') : m.iccDeflated ? 'embedded (compressed)' : null
  };
  if (ex.gps) {
    out.gps = {};
    Object.keys(ex.gps).forEach((k) => { out.gps[k.replace(/^GPS/, '')] = ex.gps[k]; });
  }
  return { out, ex, kind };
}
const show = (v) => Array.isArray(v) ? v.map((x) => typeof x === 'number' ? +x.toFixed(6) : x).join(', ') : typeof v === 'number' ? String(+v.toFixed(6)) : String(v);

window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["exif-viewer"] = {
"title": "EXIF Metadata Viewer",
"kind": "analyse",
"multiple": false,
"readsUndecodable": true,
"accept": "image/*,.heic,.heif,.tif,.tiff,.avif",
"description": "See the hidden metadata in a photo — camera, timestamp, settings, GPS location, XMP and IPTC — from JPEG, PNG, WebP, HEIC, AVIF and TIFF files, and save it as JSON.",
"keywords": ["exif viewer","image metadata","photo metadata viewer","exif data","check photo location","gps in photo","heic metadata viewer","xmp viewer","iptc viewer"],
"controls": [],
"analyse": (api, src) => {
  const { el } = api;
  const CORE = window.MVRImage;
  const { out, ex, kind } = collect(CORE, src.bytes, src.file);

  const card = el('div', 'image-card image-card-wide');
  if (src.img) {
    const prev = el('img', 'image-preview');
    prev.src = src.url; prev.alt = src.file.name;
    card.appendChild(prev);
  } else {
    card.appendChild(el('p', 'select-hint', `This browser cannot show ${out.format} pictures, but their metadata is read from the file’s bytes, below.`));
  }
  api.stage.appendChild(card);

  const nExif = Object.keys(out.exif).length, nXmp = Object.keys(out.xmp).length, nIptc = Object.keys(out.iptc).length;
  if (ex.gps && ex.gps.latitude !== undefined) {
    api.say(`This photo contains GPS coordinates: ${ex.gps.latitude.toFixed(5)}, ${ex.gps.longitude.toFixed(5)}. Anyone you send the original file to can read them.`, 'warn');
  } else if (!nExif && !nXmp && !nIptc) {
    api.say(ex.warnings[0] || 'No EXIF, XMP or IPTC metadata found in this file. It may already have been stripped, or the format may not carry any.', 'note');
  } else {
    api.say('Metadata found. Review it below before sharing this file.', 'note');
  }

  const rows = [['File', src.file.name], ['Format', out.format], ['Size', api.fmtBytes(src.file.size)]];
  const w = src.img ? src.img.naturalWidth : out.width, h = src.img ? src.img.naturalHeight : out.height;
  if (w && h) rows.push(['Dimensions', `${w}×${h}`]);
  if (kind === 'jpeg') {
    const segs = CORE.metadataSegments(src.bytes);
    if (segs.length) rows.push(['Metadata segments', segs.map((s) => `${s.name} (${api.fmtBytes(s.bytes)})`).join(', ')]);
  }
  if (out.colourProfile) rows.push(['Colour profile', out.colourProfile]);
  Object.keys(out.exif).forEach((k) => rows.push([k, show(out.exif[k])]));
  if (ex.gps) {
    if (ex.gps.latitude !== undefined) {
      rows.push(['GPS latitude', ex.gps.latitude.toFixed(6)]);
      rows.push(['GPS longitude', ex.gps.longitude.toFixed(6)]);
    }
    Object.keys(ex.gps).forEach((k) => { if (k !== 'latitude' && k !== 'longitude') rows.push(['GPS ' + k.replace(/^GPS/, ''), show(ex.gps[k])]); });
  }
  Object.keys(out.xmp).forEach((k) => rows.push(['XMP ' + k, out.xmp[k]]));
  Object.keys(out.iptc).forEach((k) => rows.push(['IPTC ' + k, out.iptc[k]]));
  api.renderStats(rows);

  /* the same, as JSON: copy or save */
  const json = JSON.stringify(out, null, 2);
  const base = src.file.name.replace(/\.[^.]+$/, '') || 'image';
  const save = el('button', 'btn-primary', 'Save as JSON'); save.type = 'button';
  save.addEventListener('click', () => api.downloadBlob(new Blob([json], { type: 'application/json' }), base + '-metadata.json'));
  api.actions.appendChild(save);
  const copy = el('button', 'btn-ghost', 'Copy JSON'); copy.type = 'button';
  copy.addEventListener('click', () => { if (navigator.clipboard) navigator.clipboard.writeText(json); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy JSON'; }, 1200); });
  api.actions.appendChild(copy);
  if (ex.gps && ex.gps.latitude !== undefined) {
    const link = el('a', 'btn-ghost', 'Open these coordinates in a map');
    link.href = `https://www.openstreetmap.org/?mlat=${ex.gps.latitude.toFixed(6)}&mlon=${ex.gps.longitude.toFixed(6)}#map=15/${ex.gps.latitude.toFixed(6)}/${ex.gps.longitude.toFixed(6)}`;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.title = 'Opens OpenStreetMap in a new tab; only these two numbers are sent, never the photo';
    api.actions.appendChild(link);
  }
},
"collect": collect,
"tips": ["Photos taken on a phone frequently carry the exact GPS coordinates of where they were taken. That survives being emailed or sent over most chat apps.","It reads JPEG, PNG, WebP, HEIC, AVIF and TIFF files from their bytes, so an iPhone’s HEIC photo shows its metadata even in a browser that cannot display the picture.","XMP and IPTC fields — creator, copyright, caption, keywords, location names — are listed after the EXIF, as editing and agency software writes them.","“Save as JSON” keeps every field in a file; the map link opens OpenStreetMap with only the two coordinates, never the photo.","Social networks usually strip metadata on upload, but file sharing, email attachments and cloud links generally do not.","If you are about to publish a photo, check it here first, then strip it with the metadata remover."],
"faq": [{"q":"Is my photo uploaded to read the metadata?","a":"No. The file is read as bytes in your browser and parsed locally. That is deliberate: sending a photo to a server to check whether it reveals your location would defeat the purpose."},{"q":"Why does my photo show no EXIF?","a":"It may already have been stripped — many apps do this on export — or it may be a PNG or WebP, where EXIF is less common. Screenshots typically carry none."},{"q":"Can it read iPhone HEIC photos?","a":"Yes, the metadata. The EXIF, XMP and colour profile inside a HEIC file are read from its bytes in any browser. Showing the picture itself needs a browser that decodes HEIC, such as Safari on a recent Mac or iPhone."}]
};
})();
