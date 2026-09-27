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
window.PDF_TOOLS["pdf-to-excel"] = {
"title": "PDF to Excel Converter",
"kind": "transform",
"multiple": false,
"description": "Extract tables and data from PDFs into Excel/CSV format, entirely client-side.",
"keywords": ["pdf to excel","pdf to csv","extract pdf tables","pdf data extraction","convert pdf to spreadsheet"],
"controls": [{"key":"format","label":"Output format","type":"select","default":"csv","options":[{"value":"csv","label":"CSV"},{"value":"xlsx","label":"Excel (.xlsx)"}]},{"key":"pages","label":"Pages to extract from","type":"text","default":"all"}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const total = await doc.pageCount();
      let sel;
      try { sel = new Set(core.parsePageRange(opts.pages, total)); }
      catch (e) { return { error: e.message }; }

      // Note: This is a simplified prototype. Full table extraction requires OCR and table detection
      // For rapid prototyping, we'll extract text and structure it simply
      const extractedData = [];
      
      for (const i of sel) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        extractedData.push({ page: i + 1, text: pageText });
      }

      // Convert to CSV format
      let csvContent = 'Page,Extracted Text\n';
      extractedData.forEach(row => {
        csvContent += `${row.page},"${row.text.replace(/"/g, '""')}"\n`;
      });

      const base = docs[0].name.replace(/\.pdf$/i, '');
      const csvBytes = new TextEncoder().encode(csvContent);
      
      return {
        files: [{ name: `${base}-extracted.csv`, bytes: csvBytes }],
        stats: [
          ['Pages processed', String(sel.size)],
          ['Data rows', String(extractedData.length)],
          ['Output format', opts.format],
          ['Output size', fmtBytes(csvBytes.length)]
        ],
        warn: 'This is a text extraction prototype. Full table structure requires OCR and table detection libraries.'
      };
    },
"tips": ["This prototype extracts raw text. Structured table extraction requires additional libraries.","For best results with tables, use PDFs with selectable text rather than scanned documents.","CSV output can be opened directly in Excel.","Complex multi-page tables may need manual cleanup after extraction."],
"faq": [{"q":"Why is the table structure not preserved?","a":"Full table structure detection requires OCR and machine learning libraries. This rapid prototype extracts text content that can be manually structured."}]
};
})();