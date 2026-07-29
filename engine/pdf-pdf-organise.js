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
window.PDF_TOOLS["pdf-organise"] = {
"title": "Organise PDF Pages",
"kind": "render",
"multiple": false,
"description": "See page thumbnails and reorder, rotate or delete pages visually before saving.",
"keywords": ["organise pdf","reorder pdf pages","rearrange pdf","pdf page organizer","move pdf pages"],
"needsRenderer": true,
"controls": [],
"tips": ["Thumbnails need a rendering engine, downloaded once on first use and cached afterwards.","Drag thumbnails to reorder, use the rotate button on each, and the cross to mark a page for removal.","Nothing is changed until you save. The original file on your device is never modified.","If you already know the page numbers you want, the extract, delete and rotate tools do the same job without any download."],
"faq": [{"q":"Is there a page limit?","a":"Thumbnails are rendered on demand as you scroll, so long documents work — but a document of several hundred pages will use noticeable memory. For very large files, the numeric tools are lighter."}]
};
})();