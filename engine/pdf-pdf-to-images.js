(function(){
/* ---------- shared helpers ---------- */

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'document';
}

function rgbTriplet(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '#000000'));
  if (!m) return '0 0 0';
  return [1, 2, 3].map(i => nf(parseInt(m[i], 16) / 255)).join(' ');
}

function nf(v) {
  return Number.isInteger(v) ? String(v) : String(Number(Number(v).toFixed(4)));
}


window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["pdf-to-images"] = {
"title": "PDF to Images",
"kind": "render",
"multiple": false,
"description": "Convert PDF pages to PNG or JPEG images at any resolution, entirely in your browser.",
"keywords": ["pdf to image","pdf to png","pdf to jpg","convert pdf to picture","extract pdf pages as images"],
"needsRenderer": true,
"controls": [{"key":"pages","label":"Pages","type":"text","default":"all"},{"key":"dpi","label":"Resolution","type":"select","default":"150","options":[{"value":"72","label":"72 DPI — screen"},{"value":"150","label":"150 DPI — good"},{"value":"300","label":"300 DPI — print"},{"value":"600","label":"600 DPI — very large"}]},{"key":"format","label":"Format","type":"select","default":"image/png","options":[{"value":"image/png","label":"PNG — lossless"},{"value":"image/jpeg","label":"JPEG — smaller"},{"value":"image/webp","label":"WebP — smallest"}]},{"key":"quality","label":"Quality (JPEG/WebP)","type":"number","default":90,"min":40,"max":100}],
"tips": ["Rendering needs a PDF engine, so this page downloads one on first use — about a megabyte, cached afterwards, and only on this page.","150 DPI suits screen use and most documents. 300 DPI matches print resolution and produces files roughly four times larger.","PNG is lossless and right for text and diagrams. JPEG is smaller and better for pages that are mostly photographs.","A 600 DPI A4 page is about 5000 × 7000 pixels. A long document at that resolution will use a great deal of memory."],
"faq": [{"q":"Why does this one need a download when the other PDF tools do not?","a":"Merging, splitting and rotating only rearrange the file’s structure, which needs no rendering. Turning a page into an image means interpreting fonts, vector paths and colour spaces — that is a full rendering engine, and it cannot be written small."}]
};
})();