(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}

const NAMES = { png: 'PNG', jpg: 'JPG', jpeg: 'JPG', webp: 'WebP', avif: 'AVIF', gif: 'GIF', bmp: 'BMP', ico: 'ICO', svg: 'SVG', heic: 'HEIC', tiff: 'TIFF' };
const ACCEPT = { png: '.png,image/png', jpg: '.jpg,.jpeg,image/jpeg', jpeg: '.jpg,.jpeg,image/jpeg', webp: '.webp,image/webp', avif: '.avif,image/avif', gif: '.gif,image/gif', bmp: '.bmp,image/bmp', svg: '.svg,image/svg+xml', ico: '.ico,image/x-icon' };
window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["image-converter"] = {
"title": "Image Format Converter",
"kind": "canvas",
"multiple": true,
"codecs": "wasm",
"passthroughAnimated": true,
"perFile": ["format", "quality"],
"liveCompare": true,
"legacy": {"maxSide": ["width", "height"]},
"noLargerNote": true,
"description": "Convert between PNG, JPEG, WebP, AVIF, GIF, BMP and ICO in your browser, one file or a batch. No upload, no queue, no watermark.",
"keywords": ["image converter","png to jpg","jpg to png","webp converter","convert image format","png to webp","jpg to avif","png to ico","webp to jpg"],
"controls": [
  {"key":"format","label":"Convert to","type":"select","default":"image/png","options":[
    {"value":"image/png","label":"PNG — lossless, supports transparency"},
    {"value":"image/jpeg","label":"JPEG — small, no transparency"},
    {"value":"image/webp","label":"WebP — small, supports transparency"},
    {"value":"image/avif","label":"AVIF — smallest, supports transparency"},
    {"value":"image/gif","label":"GIF — 256 colours, for old systems"},
    {"value":"image/bmp","label":"BMP — uncompressed, for old software"},
    {"value":"image/x-icon","label":"ICO — a Windows or site icon, 16 to 256 px"}]},
  {"key":"quality","label":"Quality (JPEG / WebP / AVIF)","type":"range","default":92,"min":10,"max":100,"when":{"format":["image/jpeg","image/webp","image/avif"]}},
  {"key":"bg","label":"Background for transparency","type":"color","default":"#ffffff","when":{"format":["image/jpeg"]}},
  {"key":"scale","label":"Scale","type":"select","default":"100","group":"resize","options":[
    {"value":"100","label":"100% — its own size"},{"value":"75","label":"75%"},{"value":"50","label":"50% — a quarter of the pixels"},{"value":"33","label":"33%"},{"value":"25","label":"25%"}]},
  {"key":"width","label":"Width (px)","type":"number","default":0,"min":0,"max":30000,"group":"resize","blankZero":true},
  {"key":"height","label":"Height (px)","type":"number","default":0,"min":0,"max":30000,"group":"resize","blankZero":true},
  {"key":"lockAspect","label":"Keep the shape","type":"select","default":"yes","group":"resize","options":[
    {"value":"yes","label":"Locked — the picture fits inside the width and height"},{"value":"no","label":"Unlocked — stretched to both"}]},
  {"key":"resizeMethod","label":"Resize method","type":"select","default":"lanczos3","group":"resize","options":[
    {"value":"lanczos3","label":"Lanczos3 — sharpest"},{"value":"browser","label":"Browser — fastest"}]},
  {"key":"metadata","label":"Metadata","type":"select","default":"icc","options":[
    {"value":"none","label":"Remove all (colours converted to sRGB)"},
    {"value":"icc","label":"Keep the colour profile only"},
    {"value":"exif","label":"Keep colour profile and EXIF, without GPS"},
    {"value":"all","label":"Keep everything: EXIF with GPS, XMP, colour profile"}]}
],
/* ?from=png&to=jpg: "to" chooses the format (the shell reads it as format);
   "from" names what the page expects, so a link from "PNG to JPG" opens a
   page that asks for PNG files */
"setup": (api) => {
  const q = new URLSearchParams(location.search);
  const from = String(q.get('from') || '').toLowerCase();
  const to = String(q.get('to') || '').toLowerCase();
  if (!NAMES[from]) return;
  const drop = api.io.querySelector('.dropzone');
  const strong = drop && drop.querySelector('strong');
  if (strong) strong.textContent = 'Choose ' + NAMES[from] + ' images' + (NAMES[to] ? ' to convert to ' + NAMES[to] : '');
  const input = drop && drop.querySelector('input[type=file]');
  if (input && ACCEPT[from]) input.accept = ACCEPT[from] + ',image/*';
},
"paint": async (ctx, img, o, h) => {
      /* the Resize panel's size; a smaller picture is never enlarged */
      const { w, h: hh } = h.resizeDims(img, o);
      const src = (w !== img.naturalWidth || hh !== img.naturalHeight) && o.resizeMethod !== 'browser' && h.resample ? await h.resample(img, w, hh) : img;
      h.size(w, hh);
      if (o.format === 'image/jpeg') h.fill(o.bg || '#ffffff');
      ctx.drawImage(src, 0, 0, w, hh);
    },
"tips": ["JPEG has no alpha channel. Converting a transparent PNG to JPEG fills the transparency with the background colour chosen above.","PNG is lossless, so the quality slider has no effect on it — the setting applies to JPEG, WebP and AVIF only.","An animated GIF or WebP converted to the same format is kept exactly as it is, every frame. Converted to anything else, only its first frame is used, and the page says so.","Each file in a batch can have its own format: open “Own settings” beside it.","Converting JPEG to PNG will not restore detail already lost. It usually just produces a much larger file.","Resize can make the converted picture smaller too: a percentage, a width or a height, with the shape kept unless you unlock it. With one picture, a before/after view shows the result beside the original; scroll or pinch to zoom."],
"faq": [{"q":"Can you convert HEIC from my iPhone?","a":"Only in Safari. HEIC needs a decoder that Chrome, Edge and Firefox do not have, and the free decoders for it are under licences this site does not ship. Safari on an iPhone, iPad or Mac opens HEIC itself, so this page converts it there. On an iPhone you can also set Settings › Camera › Formats to Most Compatible, which saves JPEG."},{"q":"Can I link straight to one conversion?","a":"Yes. Add ?from=png&to=jpg (or webp, avif, gif, bmp, ico) to this page’s address: the format is set and the page asks for the right kind of file. The link never carries an image."}]
};
})();
