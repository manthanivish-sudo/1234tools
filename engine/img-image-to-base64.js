(function(){
function optimiseSVGRef(src, opts) {
  const fn = (typeof window !== 'undefined' && window.MVRImage && window.MVRImage.optimiseSVG)
    || (typeof require !== 'undefined' ? require('./imagecore.js').optimiseSVG : null);
  if (!fn) throw new Error('imagecore not loaded');
  return fn(src, opts);
}


window.IMAGE_TOOLS = window.IMAGE_TOOLS || {};
window.IMAGE_TOOLS["image-to-base64"] = {
"title": "Image to Base64 / Data URI",
"kind": "analyse",
"multiple": false,
"description": "Convert an image to a Base64 data URI for inlining in CSS, HTML or JSON.",
"keywords": ["image to base64","data uri generator","base64 image encoder","inline image css","convert image base64"],
"controls": [{"key":"wrap","label":"Output as","type":"select","default":"datauri","options":[{"value":"datauri","label":"Data URI"},{"value":"css","label":"CSS background-image"},{"value":"html","label":"HTML <img> tag"},{"value":"raw","label":"Raw Base64"}]}],
"tips": ["Base64 inflates data by roughly 33%, so inlining is only worth it for very small images — icons and tiny placeholders.","An inlined image cannot be cached separately from the page, so repeat visitors download it again with every page load.","For anything above a few kilobytes, a normal file reference with proper caching almost always loads faster."],
"faq": [{"q":"When is inlining actually a good idea?","a":"For small SVG icons, a 1×1 tracking pixel, or a blurred placeholder shown while the real photograph loads. Below roughly 2 KB the saved request usually outweighs the size penalty."}]
};
})();