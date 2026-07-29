(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["exif-viewer"] = {
"title": "EXIF Metadata Viewer",
"kind": "analyse",
"multiple": false,
"description": "See the hidden metadata in a photo — camera, timestamp, settings and GPS location.",
"keywords": ["exif viewer","image metadata","photo metadata viewer","exif data","check photo location","gps in photo"],
"controls": [],
"tips": ["Photos taken on a phone frequently carry the exact GPS coordinates of where they were taken. That survives being emailed or sent over most chat apps.","Social networks usually strip metadata on upload, but file sharing, email attachments and cloud links generally do not.","Metadata also records the device, serial number and software, which links otherwise unrelated photos to the same camera.","If you are about to publish a photo, check it here first, then strip it with the metadata remover."],
"faq": [{"q":"Is my photo uploaded to read the metadata?","a":"No. The file is read as bytes in your browser and parsed locally. That is deliberate: sending a photo to a server to check whether it reveals your location would defeat the purpose."},{"q":"Why does my photo show no EXIF?","a":"It may already have been stripped — many apps do this on export — or it may be a PNG or WebP, where EXIF is less common. Screenshots typically carry none."}]
};
})();