(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}

const R = window.MVRResize;
window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["image-resizer"] = {
"title": "Image Resizer",
"kind": "multi",
"liveCompare": true,
"multiple": false,
"codecs": "wasm",
"description": "Resize a photo to exact pixels, a percentage or a longest side, crop or pad it to a size, set its DPI, or get it under a KB limit.",
"keywords": ["image resizer","resize image","resize photo","resize image to 1080x1080","resize image to kb","change image dpi","resize jpg","picture resizer"],
"controls": R.controls(false),
"produce": (img, o, h, s, api) => R.produce(img, o, h, s, api),
"tips": ["“Exact size, crop to fit” fills the whole frame and trims the edges that do not fit; “pad to fit” keeps the whole picture and fills the gap with the padding colour.","A picture smaller than the size you ask for is never enlarged unless you set Allow enlarging to Yes, because enlarging adds softness, not detail. Padding centres it at its own size instead.","“Make it under” finds the best quality that fits, then shrinks the size only if it must. A KB there is 1,000 bytes, so it fits a form whichever kilobyte the form counts.","DPI only tells a printer how big to print; it does not change a single pixel. 300 DPI is the usual figure for photo prints.","For many photos at once, use the Bulk Image Resizer, which adds file renaming, a ZIP and saving into a folder.","With one size chosen, a before/after view sits above the result: scroll or pinch to zoom up to 1600%, drag to look around, and it stays where you left it when you change a setting."],
"faq": [{"q":"How do I resize a photo for an online form with a KB limit?","a":"Set the pixel size the form asks for, then choose the limit under “Make it under”. The page tries qualities first and only makes the picture smaller if the best quality that fits is still too big, and it tells you the quality and size it used."},{"q":"Is my photo uploaded?","a":"No. It is decoded, resampled and encoded on your device, with encoders that run in the page; nothing is sent anywhere."}]
};
})();
