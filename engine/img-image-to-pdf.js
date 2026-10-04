(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["image-to-pdf"] = {
"title": "Image to PDF Converter",
"kind": "binary",
"multiple": true,
"description": "Combine JPEG and PNG images into a single PDF, one image per page, with page size and margin control.",
"keywords": ["image to pdf","jpg to pdf","png to pdf","photos to pdf","combine images pdf","convert image to pdf"],
"controls": [{"key":"pageSize","label":"Page size","type":"select","default":"a4","options":[{"value":"a4","label":"A4"},{"value":"letter","label":"US Letter"},{"value":"legal","label":"Legal"},{"value":"a5","label":"A5"},{"value":"fit","label":"Fit to image"}]},{"key":"orientation","label":"Orientation","type":"select","default":"auto","options":[{"value":"auto","label":"Match each image"},{"value":"portrait","label":"Portrait"},{"value":"landscape","label":"Landscape"}]},{"key":"margin","label":"Margin (pt)","type":"number","default":28,"min":0,"max":144},{"key":"jpeg","label":"JPEG photos","type":"select","default":"keep","options":[{"value":"keep","label":"Keep as they are — no re-encode"},{"value":"reencode","label":"Re-encode at the quality below (smaller PDF)"}]},{"key":"quality","label":"Quality for re-encoded images","type":"range","default":88,"min":40,"max":100}],
"tips": ["A JPEG goes into the PDF as it is: its own compressed bytes are the page image (the PDF DCTDecode filter), so it loses nothing. Only EXIF, GPS and other metadata blocks are left out. PNG, WebP and GIF images are encoded as JPEG at the quality slider’s setting, flattened onto white.","A JPEG is re-encoded anyway when its EXIF tag says to turn it (phone photos taken sideways), so that it stands the right way up, and when it is CMYK or 12-bit; the page says which and why.","Choose “Re-encode at the quality below” to make a PDF of large phone photos smaller.","Drag files into the drop area in the order you want the pages. The list can be reordered before generating.","\"Fit to image\" makes each page exactly the size of its image, which suits screenshots and scans better than forcing them onto A4."],
"faq": [{"q":"Is there a page or file limit?","a":"No artificial limit. Everything is assembled in memory on your device, so very large batches are bounded by available RAM rather than by an upload cap."},{"q":"Can it convert a PDF back to images?","a":"Yes, with the PDF to Images tool on this site (/pdf/pdf-to-images/): it renders each page of a PDF as a PNG or JPEG in your browser, with nothing uploaded. It lives on its own page so this one stays small."}]
};
})();