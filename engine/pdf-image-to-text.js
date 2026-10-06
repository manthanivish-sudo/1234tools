(function(){
/* ---------- shared helpers ---------- */

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

/*
 * Image to Text: each picture is decoded by the browser (a photo's EXIF
 * orientation applied, as it is shown), scaled down to about 16 megapixels
 * when it is larger, and read by Tesseract (engine/pdf-ocr-engine.js) in its
 * own Web Worker. One engine serves every picture of a run and is closed at
 * the end, or the moment Cancel is pressed.
 */

const LANGS = { eng: ['eng'], hin: ['hin'], both: ['eng', 'hin'] };
const LANG_LABEL = { eng: 'English', hin: 'Hindi', both: 'English and Hindi' };
const MAX_PIXELS = 16000000;
const IMAGE_TYPE = /^image\/(png|jpeg|webp|gif|bmp|x-ms-bmp)$/i;
const IMAGE_NAME = /\.(png|jpe?g|webp|gif|bmp)$/i;

const abortError = () => { const e = new Error('Cancelled'); e.name = 'AbortError'; return e; };

/* The picture as the engine should see it: a bitmap, or a scaled canvas
   when it is larger than a browser tab should hand to Tesseract. */
async function decode(file) {
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch (e) { throw new Error('it could not be read as an image (is the file complete?)'); }
  const px = bmp.width * bmp.height;
  if (!px) { if (bmp.close) bmp.close(); throw new Error('the image is empty'); }
  if (px <= MAX_PIXELS) return { image: bmp, w: bmp.width, h: bmp.height, scaled: false, close: () => bmp.close && bmp.close() };
  const k = Math.sqrt(MAX_PIXELS / px);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.floor(bmp.width * k));
  c.height = Math.max(1, Math.floor(bmp.height * k));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const w = bmp.width, h = bmp.height;
  if (bmp.close) bmp.close();
  return { image: c, w, h, scaled: true, close: () => { c.width = c.height = 0; } };
}

window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["image-to-text"] = {
"title": "Image to Text (OCR)",
"kind": "transform",
"action": "Read the text",
"multiple": true,
"loadAs": "image",
"accept": "image/png,image/jpeg,image/webp,image/gif,image/bmp",
"acceptTest": (f) => IMAGE_TYPE.test(f.type || '') || IMAGE_NAME.test(f.name || ''),
"fileNoun": "images",
"fileKind": "a PNG, JPEG, WebP, GIF or BMP image",
"wrongType": "Those are not images this tool reads. Choose PNG, JPEG, WebP, GIF or BMP pictures.",
"needFile": "Choose an image first.",
"needsRenderer": true,
"noPreview": true,
"copyReport": true,
"progressLabel": "Loading the OCR engine",
"description": "Read the text in a photo, a screenshot or a scan, in English or Hindi, on your device, then copy it or save it as a text file. Nothing you add is uploaded.",
"keywords": ["image to text","ocr online","photo to text","extract text from image","hindi ocr"],
"glyph": "i-image-to-text",
"glyphSvg": "<symbol id=\"i-image-to-text\" viewBox=\"0 0 24 24\">\n  <rect x=\"3\" y=\"4.4\" width=\"18\" height=\"15.2\" rx=\"2\"/>\n  <path d=\"M3 15.4l4.6-4.4 3.6 3.4 2.6-2.4 6.2 5.6\" class=\"thin\"/>\n  <path d=\"M14.6 8.4h3.8\" class=\"thin\"/>\n</symbol>",
"privacy": "Your images never leave your device. The first time you use this tool it downloads the OCR engine and its language data from this site (about 5 MB for English, then cached); the recognition runs in your browser and nothing you add is uploaded.",
"controls": [
  {"key":"lang","label":"Language","type":"select","default":"eng","options":[{"value":"eng","label":"English"},{"value":"hin","label":"Hindi"},{"value":"both","label":"English and Hindi"}]}
],
"tips": [
  "Add one picture or several: PNG, JPEG, WebP, GIF or BMP. Each is read in the order listed, and the text of several comes as one .txt file with the name of each picture above its text.",
  "The first run downloads the OCR engine (about 3 MB) and the language data (English 1.9 MB, Hindi 0.9 MB) from this site. Your browser keeps them, so later runs start at once.",
  "Choose the language the picture is in, or English and Hindi when it mixes the two. Read as English, a Hindi line comes back as Latin letters that mean nothing.",
  "Photos are read the right way up, as your browser shows them: a phone's EXIF orientation is applied first.",
  "A picture larger than 16 megapixels is scaled down to that size before it is read, and the result says so.",
  "For each picture the result lists the words found and the mean confidence Tesseract reports, so a doubtful read stands out."
],
"faq": [
  {"q":"Can it read handwriting?","a":"Not reliably. Tesseract is trained on printed text; neat block capitals sometimes read, joined-up handwriting rarely does."},
  {"q":"Which languages does it read?","a":"English and Hindi (Devanagari), separately or together in the same picture."},
  {"q":"Are my pictures uploaded?","a":"No. They are decoded and read in your browser; only the engine and the language data are downloaded, from this site, the first time."},
  {"q":"How do I get text from a scanned PDF?","a":"Use OCR PDF, which reads each page and also gives you back the PDF with the text searchable and selectable."}
],
"mainRun": async (api) => {
  const list = api.entries;
  if (!list.length) return { error: 'Choose an image first.' };
  const langKey = LANGS[api.opts.lang] ? api.opts.lang : 'eng';
  const t0 = performance.now();
  const check = () => { if (api.cancelled() || (api.signal && api.signal.aborted)) throw abortError(); };

  await api.loadScript('pdf-ocr-engine.js');
  check();
  const ocr = await window.MVROcr.create({
    langs: LANGS[langKey], signal: api.signal,
    onProgress: (f, label) => api.progress(f, 1, label)
  });

  const done = [];      /* { name, text, words, conf, scaled } */
  const failed = [];    /* 'name: reason' */
  try {
    for (let n = 0; n < list.length; n++) {
      check();
      const e = list[n];
      const label = 'Reading ' + e.name + (list.length > 1 ? ' (' + (n + 1) + ' of ' + list.length + ')' : '');
      api.progress(n / list.length, 1, label);
      let img;
      try { img = await decode(e.file || new Blob([e.bytes])); }
      catch (err) { failed.push(e.name + ': ' + err.message); continue; }
      try {
        const r = await ocr.recognize(img.image, {
          signal: api.signal,
          onProgress: (f) => api.progress((n + Math.max(0, Math.min(1, f))) / list.length, 1, label)
        });
        const words = r.words.filter((w) => String(w.text || '').trim());
        const conf = words.length ? words.reduce((s, w) => s + (Number(w.confidence) || 0), 0) / words.length : 0;
        done.push({ name: e.name, text: String(r.text || '').replace(/\s+$/, ''), words: words.length, conf, scaled: img.scaled, w: img.w, h: img.h });
      } catch (err) {
        if (err && err.name === 'AbortError') throw err;
        failed.push(e.name + ': ' + ((err && err.message) || 'it could not be read'));
        if (ocr.closed) break;
      } finally { img.close(); }
    }
  } finally {
    ocr.terminate();
  }
  check();

  if (!done.length) return { error: failed.length ? 'Nothing could be read. ' + failed.join(' ') : 'Nothing could be read.' };
  const several = list.length > 1;
  const textOut = done.map((d) => (several ? '=== ' + d.name + ' ===\n' : '') + (d.text || '(no text found)')).join('\n\n') + '\n';
  const stem = String(done[0].name).replace(/\.[a-z0-9]+$/i, '') || 'image';
  const name = several ? 'image-text.txt' : stem + '.txt';
  const secs = (performance.now() - t0) / 1000;
  const stats = done.map((d) => [d.name, d.words ? d.words + ' word' + (d.words === 1 ? '' : 's') + ', ' + Math.round(d.conf) + '% mean confidence' : 'no text found']);
  stats.push(['Language', LANG_LABEL[langKey]]);
  stats.push(['Time', secs.toFixed(1) + ' s']);
  const notes = [];
  if (failed.length) notes.push('Not read: ' + failed.join('; ') + '.');
  const none = done.filter((d) => !d.words).map((d) => d.name);
  if (none.length) notes.push('No text was found in ' + none.join(', ') + '.');
  const big = done.filter((d) => d.scaled).map((d) => d.name);
  if (big.length) notes.push(big.join(', ') + (big.length > 1 ? ' were' : ' was') + ' larger than 16 megapixels and read at that size.');
  return {
    files: [{ name, bytes: new TextEncoder().encode(textOut), type: 'text/plain' }],
    stats,
    report: textOut,
    fullText: textOut,
    warn: notes.join(' ') || undefined
  };
}
};
})();
