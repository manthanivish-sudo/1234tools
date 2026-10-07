(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}

/* The EXIF fields a visitor may keep, by the names readExif gives them */
const KEEP = { orientation: ['Orientation'], copyright: ['Artist', 'Copyright'], both: ['Orientation', 'Artist', 'Copyright'], none: [] };
const keptOf = (o) => (o.method === 'redraw' ? (o.keep === 'copyright' || o.keep === 'both' ? KEEP.copyright : []) : (KEEP[o.keep] || []));

window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["exif-remover"] = {
"title": "Remove Image Metadata",
"kind": "canvas",
"multiple": true,
"codecs": "wasm",
"compare": false,
"description": "Strip EXIF, GPS location and all other metadata from photos before you share them — losslessly for JPEG, PNG and WebP — keeping the copyright or orientation if you choose.",
"keywords": ["remove exif","strip metadata","remove gps from photo","clean image metadata","anonymise photo","remove photo location","remove exif without recompressing"],
"controls": [
  {"key":"method","label":"How","type":"select","default":"lossless","options":[{"value":"lossless","label":"Lossless — take the metadata out, keep the picture’s bytes"},{"value":"redraw","label":"Redraw — make a new file from the pixels (any format)"}]},
  {"key":"keep","label":"Keep","type":"select","default":"orientation","options":[{"value":"none","label":"Nothing at all"},{"value":"orientation","label":"The orientation tag only, so the photo stays upright"},{"value":"copyright","label":"Copyright and author only"},{"value":"both","label":"Orientation, copyright and author"}]},
  {"key":"format","label":"Save as","type":"select","default":"image/jpeg","when":{"method":["redraw"]},"options":[{"value":"image/jpeg","label":"JPEG"},{"value":"image/png","label":"PNG"},{"value":"image/webp","label":"WebP"}]},
  {"key":"quality","label":"Quality","type":"range","default":92,"min":50,"max":100,"when":{"method":["redraw"]}}],
"keptTags": keptOf,
/* Lossless: the file's own bytes with the metadata blocks taken out; the
   chosen fields go back in as a small EXIF block of their own. Formats with
   no lossless path here (GIF, BMP, AVIF…) are redrawn, and said so. */
"passthrough": async (s, o, api) => {
  const CORE = window.MVRImage;
  if (o.method === 'redraw') return null;
  const kind = CORE.containerOf(s.bytes);
  if (kind !== 'jpeg' && kind !== 'png' && kind !== 'webp') {
    api.problem(`${s.file.name} is ${(kind || 'an unusual format').toUpperCase()}, which has no lossless path here, so it was redrawn as ${o.format === 'image/png' ? 'PNG' : o.format === 'image/webp' ? 'WebP' : 'JPEG'}.`);
    return null;
  }
  let bytes = CORE.stripMetadata(s.bytes);
  const ex = CORE.readExif(s.bytes);
  const fields = {};
  keptOf(o).forEach((k) => { if (ex.tags[k] !== undefined && ex.tags[k] !== '') fields[k] = ex.tags[k]; });
  /* an upright photo needs no orientation tag */
  if (fields.Orientation === 1) delete fields.Orientation;
  let label = 'lossless';
  const turned = ex.tags.Orientation && ex.tags.Orientation !== 1 && fields.Orientation === undefined;
  if (Object.keys(fields).length) {
    const r = CORE.embedMetadata(bytes === s.bytes ? s.bytes.slice() : bytes, { exif: CORE.buildExif(fields) });
    if (r.written.indexOf('exif') >= 0) bytes = r.bytes;
  }
  return { bytes, type: CORE.mimeOf(bytes) || s.file.type, label,
    note: turned ? `${s.file.name} is stored on its side with a tag saying which way up it goes; without that tag it will show turned. Keep “the orientation tag only”, or use Redraw, which turns the pixels upright.` : '' };
},
"paint": (ctx, img, o, h) => {
      h.size(img.naturalWidth, img.naturalHeight);
      if (o.format === 'image/jpeg') h.fill('#ffffff');
      ctx.drawImage(img, 0, 0);
    },
"redrawMeta": (s, o) => {
  /* the redraw path's kept fields (copyright and author; orientation is
     applied to the pixels instead) */
  const CORE = window.MVRImage;
  const ex = CORE.readExif(s.bytes), fields = {};
  keptOf(o).forEach((k) => { if (ex.tags[k]) fields[k] = ex.tags[k]; });
  return Object.keys(fields).length ? { exif: CORE.buildExif(fields) } : null;
},
"showsMetadataDiff": true,
"tips": ["Lossless, the default, takes the metadata blocks out of a JPEG, PNG or WebP and leaves the picture’s own bytes exactly as they were, so nothing is recompressed and the file only gets smaller.","Keep “the orientation tag only” for phone photos: many are stored on their side with a tag saying which way up they go, and without it they would show sideways. The tag says nothing about you.","“Copyright and author” keeps just those two EXIF fields, written into a small EXIF block of their own; the camera, the time, the GPS position and everything else still go.","Redraw makes a new file from the pixels in the format you choose. Use it for GIF, BMP or AVIF, which have no lossless path here, or to change format at the same time.","The tool lists the metadata the original had, then reads each cleaned file back and reports what it really contains, rather than assuming.","Keep your original file. Once metadata is gone it cannot be recovered from the cleaned copy."],
"faq": [{"q":"Does this remove the copyright information too?","a":"By default, yes. Choose “Copyright and author only” (or with orientation) under Keep and those two EXIF fields are written back into the cleaned file; everything else, including GPS and the camera details, still goes."},{"q":"Does removing metadata reduce the photo’s quality?","a":"Not in Lossless mode: the compressed picture data is copied byte for byte, so the pixels are identical to the original’s. Redraw re-encodes the picture, which at quality 92 is hard to see but is not byte-identical."}]
};
})();
