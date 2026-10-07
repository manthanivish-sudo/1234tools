(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}

const R = window.MVRResize;
window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["bulk-image-resizer"] = {
"title": "Bulk Image Resizer",
"kind": "multi",
"multiple": true,
"codecs": "wasm",
"perFile": ["value", "format", "quality"],
"description": "Resize dozens of images at once by width, height, longest side, percentage or exact size, rename them, and download a ZIP or save to a folder.",
"keywords": ["bulk image resizer","batch resize","resize multiple images","mass image resize","batch photo resize","resize images in a folder"],
"controls": R.controls(true),
"produce": (img, o, h, s, api) => R.produce(img, o, h, s, api),
"nameJobs": (jobs, o) => R.nameJobs(jobs, o, true),
"tips": ["Resizing by longest edge is the safest bulk setting: portrait and landscape shots both end up within the same bounding box.","Images smaller than the target are never enlarged unless you set Allow enlarging to Yes; they are saved at their own size and the page tells you which. Enlarging adds file size and softness without adding detail.","Pixels are resampled with Lanczos3, the filter photo editors use for shrinking, so fine detail stays sharp instead of shimmering.","Drop a whole folder on the box to resize every image in it. In Chrome and Edge, “Save all to a folder” writes the results straight into a folder you pick; elsewhere they come as one ZIP.","Everything is processed on your device, so a large batch is limited by your machine’s memory rather than an upload queue."],
"faq": [{"q":"How many images can it handle?","a":"There is no artificial limit, but each image is decoded in memory. A few dozen photographs is comfortable on a phone; a few hundred is better done on a desktop. A long batch shows its progress and can be cancelled; what finished stays downloadable."},{"q":"Does the DPI setting change the pixels?","a":"No. It only writes a print resolution into the file (the JPEG’s JFIF header or the PNG’s pHYs chunk), so a 1200 px wide image at 300 DPI prints 4 inches wide. WebP and AVIF have no such field."}]
};
})();
