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
window.PDF_TOOLS["pdf-compare"] = {
"title": "PDF Comparison Tool",
"kind": "inspect",
"multiple": true,
"description": "Compare two PDFs and highlight differences in content, structure, or metadata.",
"keywords": ["pdf compare","compare pdf files","pdf diff","difference checker pdf","pdf comparison"],
"controls": [{"key":"mode","label":"Comparison mode","type":"select","default":"content","options":[{"value":"content","label":"Text content"},{"value":"structure","label":"Page structure"},{"value":"metadata","label":"Metadata only"}]}],
"run": async ({ docs, core }) => {
      if (docs.length !== 2) return { error: 'Select exactly two PDFs to compare.' };

      const doc1 = docs[0].doc;
      const doc2 = docs[1].doc;
      
      const info1 = await doc1.getInfo();
      const info2 = await doc2.getInfo();
      const pages1 = await doc1.getPages();
      const pages2 = await doc2.getPages();

      const differences = [];
      
      // Compare page count
      if (pages1.length !== pages2.length) {
        differences.push(`Page count: ${pages1.length} vs ${pages2.length}`);
      }

      // Compare metadata
      for (const key of Object.keys(info1)) {
        if (info1[key] !== info2[key]) {
          differences.push(`Metadata ${key}: "${info1[key]}" vs "${info2[key]}"`);
        }
      }

      // Basic content comparison (prototype)
      for (let i = 0; i < Math.min(pages1.length, pages2.length); i++) {
        const text1 = await core.extractTextFromPage(doc1, i);
        const text2 = await core.extractTextFromPage(doc2, i);
        if (text1 !== text2) {
          differences.push(`Page ${i + 1}: content differs`);
        }
      }

      const report = differences.length 
        ? differences.join('\n')
        : 'No differences found in the compared aspects.';

      return {
        files: [],
        report,
        stats: [
          ['File 1', docs[0].name],
          ['File 2', docs[1].name],
          ['Differences found', String(differences.length)],
          ['Comparison mode', opts.mode]
        ]
      };
    },
"tips": ["Upload the two PDFs you want to compare.","Content comparison checks text content, not visual appearance.","For visual comparison, use the organise tool to view pages side by side.","Metadata comparison checks author, title, creation date, etc."],
"faq": [{"q":"Can this detect visual differences?","a":"This prototype compares text content and structure. Visual difference detection requires pixel-by-pixel comparison, which needs the rendering engine."}]
};
})();