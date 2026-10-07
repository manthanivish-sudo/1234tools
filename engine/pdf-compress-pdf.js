(function(){
/* ---------- shared helpers ---------- */

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

/* The presets, as resolution and JPEG quality. "Email" tries them in turn,
   largest first, until the file is under 2 MB or the last one is used. */
const PRESETS = {
  email: { label: 'Email: aim for under 2 MB', steps: [[150, 0.72], [120, 0.62], [96, 0.5], [72, 0.4]], target: 2 * 1048576 },
  screen: { label: 'Screen', steps: [[110, 0.65]] },
  print: { label: 'Print', steps: [[200, 0.85]] },
  smallest: { label: 'Smallest', steps: [[72, 0.45]] },
  lossless: { label: 'Lossless', steps: [[0, 1]], images: false }
};


window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["compress-pdf"] = {
"title": "Compress PDF",
"kind": "transform",
"action": "Compress PDF",
"multiple": false,
"description": "Make a PDF smaller in your browser: pictures scaled down to the resolution you choose and re-encoded, text and drawing streams compressed, duplicates stored once. You see the size before and after.",
"keywords": ["compress pdf","reduce pdf size","make pdf smaller","shrink pdf","pdf compressor","compress pdf for email"],
"glyph": "i-compress-pdf",
"glyphSvg": "<symbol id=\"i-compress-pdf\" viewBox=\"0 0 24 24\">\n  <path d=\"M6 2.8h7.6L18.6 8v13.2H6z\"/>\n  <path d=\"M13.6 2.8V8h5\" class=\"thin\"/>\n  <path d=\"M12.2 9.6v3.6M10.4 11.6l1.8 1.8 1.8-1.8\" class=\"thin\"/>\n  <path d=\"M12.2 19.6V16M10.4 17.6l1.8-1.8 1.8 1.8\" class=\"thin\"/>\n  <path d=\"M8.6 14.6h7.2\"/>\n</symbol>",
"progressLabel": "Compressing",
"controls": [{"key":"preset","label":"How small","type":"select","default":"email","options":[{"value":"email","label":"Email: aim for under 2 MB"},{"value":"screen","label":"Screen: 110 DPI pictures, quality 65"},{"value":"print","label":"Print: 200 DPI pictures, quality 85"},{"value":"smallest","label":"Smallest: 72 DPI pictures, quality 45"},{"value":"lossless","label":"Lossless: leave the pictures alone"},{"value":"custom","label":"My own settings (below)"}]},{"key":"dpi","label":"Picture resolution (custom)","type":"number","default":150,"min":36,"max":600,"hint":"DPI at the size each picture is printed on the page"},{"key":"quality","label":"JPEG quality (custom)","type":"number","default":75,"min":10,"max":100},{"key":"metadata","label":"Metadata","type":"select","default":"strip","options":[{"value":"strip","label":"Remove it (title, author, XMP)"},{"value":"keep","label":"Keep it"}]}],
"run": async ({ docs, opts, core, progress }) => {
      const doc = docs[0].doc;
      const before = doc.bytes.length;
      const preset = PRESETS[opts.preset] || null;
      const steps = preset ? preset.steps
        : [[Math.max(36, Math.min(600, Number(opts.dpi) || 150)), Math.max(0.1, Math.min(1, (Number(opts.quality) || 75) / 100))]];
      const images = preset ? preset.images !== false : true;
      const target = preset && preset.target ? preset.target : 0;

      let best = null, used = null, tries = 0, last = null;
      for (const [dpi, quality] of steps) {
        tries++;
        last = [dpi, quality];
        if (progress) progress(0, 0, steps.length > 1 ? 'Trying ' + dpi + ' DPI, quality ' + Math.round(quality * 100) : 'Compressing');
        const r = await core.compressDocument(doc, { dpi, quality, images, metadata: opts.metadata === 'keep' ? 'keep' : 'strip' });
        if (!best || r.bytes.length < best.bytes.length) { best = r; used = [dpi, quality]; }
        if (!target || r.bytes.length <= target) break;
      }

      const rep = best.report;
      const after = best.bytes.length;
      const saved = before - after;
      const pct = (x) => (Math.round(x * 1000) / 10).toLocaleString('en-GB') + '%';
      const keptWhy = Object.entries(rep.kept).map(([why, n]) => n + ' ' + why).join('; ');
      const stats = [
        ['Before', fmtBytes(before)],
        ['After', fmtBytes(after)],
        ['Change', saved > 0 ? fmtBytes(saved) + ' smaller (' + pct(saved / before) + ')' : fmtBytes(-saved) + ' larger'],
        ['Settings', images ? used[0] + ' DPI pictures, JPEG quality ' + Math.round(used[1] * 100) : 'Pictures left as they are'],
        ['Pictures', rep.images + ' found, ' + rep.recoded + ' re-encoded (' + rep.downsampled + ' scaled down)'],
        ...(keptWhy ? [['Pictures kept as they were', keptWhy]] : []),
        ['Picture data', fmtBytes(rep.imageBytesBefore) + ' → ' + fmtBytes(rep.imageBytesAfter)],
        ['Streams compressed', String(rep.deflated)],
        ['Duplicates stored once', String(rep.merged)],
        ['Metadata', opts.metadata === 'keep' ? 'Kept' : 'Removed']
      ];
      if (after >= before) {
        return {
          stats,
          warn: 'This PDF is already compact: rewritten with these settings it comes to ' + fmtBytes(after) + ', which is not smaller than the ' + fmtBytes(before) + ' you started with, so there is nothing to download. A stronger preset may still help if it has large pictures.'
        };
      }
      const missed = target && after > target;
      return {
        files: [{ name: docs[0].name.replace(/\.pdf$/i, '') + '-compressed.pdf', bytes: best.bytes }],
        stats,
        warn: missed ? 'Under 2 MB was not reached: the smallest result, after trying down to ' + last[0] + ' DPI and quality ' + Math.round(last[1] * 100) + ', is ' + fmtBytes(after) + '. Most of what is left is ' + (rep.imageBytesAfter > after / 2 ? 'picture data; try Smallest, or split the file.' : 'text, fonts and drawings, which compression cannot remove; try splitting the file.') : undefined
      };
    },
"tips": ["Email is the place to start: it tries 150 DPI first and steps down, to 72 DPI at the lowest, only until the file is under 2 MB, and says so if it never gets there.","The resolution is measured at the size each picture is printed on the page, so a photo shown 5 cm wide keeps enough pixels for 5 cm. A picture already at or near the resolution you choose is not scaled down; it is re-encoded only when that makes it smaller.","A picture is only replaced when the re-encoded version is actually smaller. Stencil masks, CMYK pictures and formats the browser cannot decode, such as JPEG 2000, are left as they were, and the results list says how many and why.","Lossless rewrites only the structure: text and drawing streams compressed, identical fonts and pictures stored once, unused objects left behind, the table of objects packed. Nothing you can see changes.","The size before and after is shown, measured, never estimated. A PDF that is mostly text from a modern program may shrink very little: there is not much in it to remove."],
"faq": [{"q":"How much smaller will my PDF get?","a":"It depends entirely on what is in it, which is why this page does not promise a percentage. Scans and photo-heavy files usually shrink a great deal, because their pictures are stored at far more pixels than a screen or an email needs. A text document exported from a word processor is mostly fonts and text, which are already compact; it may only lose a few per cent. The before and after sizes are shown when it finishes."},{"q":"Will the text still be sharp?","a":"Yes. Text and vector drawings are never turned into pictures: their streams are only compressed, which is lossless. Only embedded pictures are scaled and re-encoded, and only when the result is smaller."},{"q":"Is my PDF uploaded to compress it?","a":"No. The file is read, its pictures re-encoded and the new file written by your own browser, in a background worker on this page. Nothing you add is uploaded, which is also why it keeps working with the network off."},{"q":"What happens to bookmarks, links and form fields?","a":"They are kept. The document is rewritten page by page with the same engine as the merge and split tools, which carries bookmarks, links, comments and form fields across. Only the metadata is removed by default, and you can choose to keep it."}]
};
})();
