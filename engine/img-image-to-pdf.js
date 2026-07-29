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
"controls": [{"key":"pageSize","label":"Page size","type":"select","default":"a4","options":[{"value":"a4","label":"A4"},{"value":"letter","label":"US Letter"},{"value":"legal","label":"Legal"},{"value":"a5","label":"A5"},{"value":"fit","label":"Fit to image"}]},{"key":"orientation","label":"Orientation","type":"select","default":"auto","options":[{"value":"auto","label":"Match each image"},{"value":"portrait","label":"Portrait"},{"value":"landscape","label":"Landscape"}]},{"key":"margin","label":"Margin (pt)","type":"number","default":28,"min":0,"max":144},{"key":"quality","label":"Image quality","type":"range","default":88,"min":40,"max":100}],
"tips": ["Images are embedded as JPEG using the PDF DCTDecode filter, which is why the file stays compact — there is no re-compression layer on top.","Drag files into the drop area in the order you want the pages. The list can be reordered before generating.","\"Fit to image\" makes each page exactly the size of its image, which suits screenshots and scans better than forcing them onto A4.","Transparency is flattened onto white, because PDF image XObjects here do not carry an alpha channel."],
"faq": [{"q":"Is there a page or file limit?","a":"No artificial limit. Everything is assembled in memory on your device, so very large batches are bounded by available RAM rather than by an upload cap."},{"q":"Can it convert a PDF back to images?","a":"Not here. Rendering PDF pages needs a full PDF engine — roughly a megabyte of extra code — which would slow every other tool on the site down for a feature most visitors never use."}]
};
})();