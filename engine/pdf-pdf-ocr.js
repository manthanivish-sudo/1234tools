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
window.PDF_TOOLS["pdf-ocr"] = {
"title": "PDF OCR Tool",
"kind": "render",
"multiple": false,
"description": "Extract text from scanned PDFs using optical character recognition, entirely in your browser.",
"keywords": ["pdf ocr","extract text from scanned pdf","ocr pdf","scanned pdf to text","pdf text recognition"],
"needsRenderer": true,
"controls": [{"key":"language","label":"Language","type":"select","default":"eng","options":[{"value":"eng","label":"English"},{"value":"spa","label":"Spanish"},{"value":"fra","label":"French"},{"value":"deu","label":"German"}]},{"key":"pages","label":"Pages to process","type":"text","default":"all"}],
"tips": ["OCR requires Tesseract.js, which loads on first use (about 20MB for English).","Higher quality scans produce better OCR results.","This prototype uses basic OCR. Accuracy varies with scan quality and font complexity.","Multi-language support requires loading additional language data."],
"faq": [{"q":"Why does this need a large download?","a":"OCR requires machine learning models for text recognition. English models are about 20MB. Other languages add more data."}]
};
})();