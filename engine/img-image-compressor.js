(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}

const LOSSY = ['image/jpeg', 'image/webp', 'image/avif'];
window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["image-compressor"] = {
"title": "Image Compressor",
"kind": "canvas",
"multiple": true,
"codecs": "wasm",
"perFile": ["format", "quality", "maxWidth"],
"description": "Shrink JPEG, PNG, WebP and AVIF files with MozJPEG, libwebp and oxipng in your browser, with a before/after slider and a size limit mode.",
"keywords": ["image compressor","compress image","reduce image size","optimise images","compress jpeg","shrink photo","compress image to 100kb","compress png"],
"controls": [
  {"key":"format","label":"Output format","type":"select","default":"same","options":[
    {"value":"same","label":"Keep original format"},
    {"value":"image/webp","label":"WebP — small, every current browser opens it"},
    {"value":"image/avif","label":"AVIF — smallest, slowest to make"},
    {"value":"image/jpeg","label":"JPEG — opens everywhere"},
    {"value":"image/png","label":"PNG — for screenshots and logos"}]},
  {"key":"quality","label":"Quality","type":"range","default":80,"min":10,"max":100,"step":1,"when":{"format":LOSSY}},
  {"key":"jpegProgressive","label":"Progressive JPEG","type":"select","default":"yes","when":{"format":["image/jpeg"]},"options":[
    {"value":"yes","label":"Yes — loads blurry-to-sharp, usually smaller"},{"value":"no","label":"No — baseline, loads top to bottom"}]},
  {"key":"jpegSubsample","label":"Colour detail (chroma subsampling)","type":"select","default":"auto","when":{"format":["image/jpeg"]},"options":[
    {"value":"auto","label":"Automatic (4:2:0 for photos)"},{"value":"420","label":"4:2:0 — smaller"},{"value":"444","label":"4:4:4 — full colour detail, for text and sharp red edges"}]},
  {"key":"webpMode","label":"WebP mode","type":"select","default":"lossy","when":{"format":["image/webp"]},"options":[
    {"value":"lossy","label":"Lossy — photos"},{"value":"lossless","label":"Lossless — every pixel kept"}]},
  {"key":"webpEffort","label":"WebP effort (0 fastest – 6 smallest)","type":"range","default":4,"min":0,"max":6,"when":{"format":["image/webp"]}},
  {"key":"avifSpeed","label":"AVIF speed (0 smallest – 10 fastest)","type":"range","default":7,"min":0,"max":10,"when":{"format":["image/avif"]}},
  {"key":"pngColours","label":"PNG colours","type":"select","default":"256","when":{"format":["image/png"]},"options":[
    {"value":"all","label":"All — lossless"},{"value":"256","label":"256 — much smaller, close to the original"},{"value":"128","label":"128"},{"value":"64","label":"64"},{"value":"32","label":"32"},{"value":"16","label":"16"},{"value":"8","label":"8"}]},
  {"key":"pngDither","label":"Dithering","type":"select","default":"yes","when":{"format":["image/png"]},"options":[
    {"value":"yes","label":"On — smooth gradients"},{"value":"no","label":"Off — flat colour, crisp edges"}]},
  {"key":"pngLevel","label":"PNG effort (oxipng level 0–6)","type":"range","default":2,"min":0,"max":6,"when":{"format":["image/png"]}},
  {"key":"maxWidth","label":"Max width (0 = keep)","type":"number","default":0,"min":0},
  {"key":"target","label":"Make it under","type":"select","default":"0","options":[
    {"value":"0","label":"No size limit"},{"value":"20","label":"20 KB"},{"value":"50","label":"50 KB"},{"value":"100","label":"100 KB"},
    {"value":"200","label":"200 KB"},{"value":"500","label":"500 KB"},{"value":"1000","label":"1 MB"},{"value":"2000","label":"2 MB"},{"value":"custom","label":"Another size…"}]},
  {"key":"targetKB","label":"Size limit (KB)","type":"number","default":150,"min":5,"when":{"target":["custom"]}},
  {"key":"metadata","label":"Metadata","type":"select","default":"icc","options":[
    {"value":"none","label":"Remove all (colours converted to sRGB)"},
    {"value":"icc","label":"Keep the colour profile only"},
    {"value":"exif","label":"Keep colour profile and EXIF, without GPS"},
    {"value":"all","label":"Keep everything: EXIF with GPS, XMP, colour profile"}]}
],
"presets": [
  {"label":"Photo for web","values":{"format":"image/webp","quality":75,"maxWidth":1920,"metadata":"icc"},"note":"WebP at quality 75, at most 1920 px wide, colour profile kept."},
  {"label":"Screenshot","values":{"format":"image/png","pngColours":"256","pngDither":"no","pngLevel":3,"metadata":"none"},"note":"PNG with 256 colours and no dithering, so text and edges stay crisp."},
  {"label":"Email attachment","values":{"format":"image/jpeg","quality":70,"maxWidth":1600,"metadata":"none"},"note":"JPEG at quality 70, at most 1600 px wide, no metadata."},
  {"label":"WhatsApp","values":{"format":"image/jpeg","quality":80,"maxWidth":1600,"metadata":"none"},"note":"JPEG at quality 80, at most 1600 px wide, with the location and camera details removed."}
],
"paint": async (ctx, img, o, h) => {
      const { w, h: hh } = h.fit(img, Number(o.maxWidth) || 0, 0);
      /* Lanczos3 when the width is capped; the picture is never enlarged */
      const src = (w !== img.naturalWidth || hh !== img.naturalHeight) && h.resample ? await h.resample(img, w, hh) : img;
      h.size(w, hh);
      if (o.format === 'image/jpeg') h.fill('#ffffff');
      ctx.drawImage(src, 0, 0, w, hh);
    },
"tips": ["WebP is typically 25–35% smaller than JPEG at the same visual quality, and every current browser opens it. This page writes it with libwebp running in your browser, so Safari saves real WebP too; only where WebAssembly is switched off does a browser fall back to its own encoder, and Safari then saves PNG instead and says so.","Quality 80 is the usual sweet spot for photographs. Above 90 the file grows quickly for a difference almost nobody can see.","“Keep original format” turns a PNG into a 256-colour PNG with dithering, which is where PNG compressors find their big savings. Choose “All — lossless” under PNG colours to keep every pixel.","“Make it under” tries qualities, then smaller sizes, until the file fits. A KB there is 1,000 bytes, so the result fits a form whichever kilobyte it counts.","The largest saving is usually resizing, not compressing. A 4000px photo shown in an 800px column wastes most of what the visitor downloads.","Compressing an already-compressed JPEG loses more quality each time. Always start from the original."],
"faq": [{"q":"Are my images uploaded?","a":"No. The file is read by your browser and re-encoded on your device, by encoders that run inside the page. Nothing is transmitted, which is why this works with the network off."},{"q":"Why did my PNG get bigger as a JPEG?","a":"JPEG handles photographs well and flat colour badly. Screenshots, logos and diagrams belong in PNG or WebP; converting them to JPEG usually adds size and visible artefacts."},{"q":"Why is the first compression slower?","a":"The encoders are WebAssembly programs fetched from this site the first time you use each format: about 250 KB for MozJPEG, 280–340 KB for libwebp, 160 KB for oxipng and 3.3 MB for AVIF. Your browser keeps them, so later files start at once."}]
};
})();
