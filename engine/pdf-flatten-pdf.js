(function(){
/* ---------- shared helpers ---------- */

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}


window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["flatten-pdf"] = {
"title": "Flatten PDF",
"kind": "transform",
"action": "Flatten PDF",
"multiple": false,
"description": "Fix form answers, comments and stamps into the page itself, so they print as shown and can no longer be changed, moved or lost. Nothing you add is uploaded.",
"keywords": ["flatten pdf","flatten pdf form","flatten annotations","lock pdf form fields","pdf form to static"],
"glyph": "i-flatten-pdf",
"glyphSvg": "<symbol id=\"i-flatten-pdf\" viewBox=\"0 0 24 24\">\n  <path d=\"M6 2.8h7.6L18.6 8v13.2H6z\"/>\n  <path d=\"M13.6 2.8V8h5\" class=\"thin\"/>\n  <path d=\"M8.4 12.6h7.2M8.4 15.4h7.2M8.4 18.2h7.2\"/>\n</symbol>",
"progressLabel": "Flattening",
"controls": [{"key":"what","label":"Flatten","type":"select","default":"all","options":[{"value":"all","label":"Form fields and comments"},{"value":"forms","label":"Form fields only"},{"value":"comments","label":"Comments, stamps and drawings only"}]}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const forms = opts.what !== 'comments', comments = opts.what !== 'forms';
      const { bytes, stats } = await core.flattenDocument(doc, { forms, comments });
      if (!stats.fields && !stats.comments) {
        return { error: 'This PDF has no ' + (forms && comments ? 'form fields or comments' : forms ? 'form fields' : 'comments') + ' to flatten, so it would come out the same.' };
      }
      return {
        files: [{ name: docs[0].name.replace(/\.pdf$/i, '') + '-flattened.pdf', bytes }],
        stats: [
          ['Pages', String(await doc.pageCount())],
          ['Form fields drawn into the page', String(stats.fields)],
          ['Comments and stamps drawn into the page', String(stats.comments)],
          ...(stats.generated ? [['Answers with no stored appearance, drawn in Helvetica', String(stats.generated)]] : []),
          ...(stats.hidden ? [['Hidden items left out (they were not shown before either)', String(stats.hidden)]] : []),
          ['Links kept as links', String(stats.links)],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Flatten a filled-in form before you send it: the answers become part of the page, so nobody can change them by clicking a box and every printer prints them the same.","Each field and comment is drawn exactly as your viewer shows it now, from the appearance stored in the file. A field saved without one (some programs leave that to the reader) has its answer drawn plainly in Helvetica, so it is not lost.","Links are not flattened: they stay clickable. Hidden fields and comments are left out, as they were never shown.","Keep the original: a flattened form cannot be filled in again, and the form itself is removed from the file."],
"faq": [{"q":"Why flatten a PDF form?","a":"A filled-in form is still a form: anyone can click a box and change an answer, some viewers and printers show the fields differently or not at all, and a form can lose its answers when it is merged or edited elsewhere. Flattening draws the answers into the page itself, like ink on paper, so what you send is what is seen."},{"q":"Can a flattened form be edited again?","a":"Not as a form. The boxes are gone and the answers are part of the page's drawing. To change an answer, fill in the original again and flatten it again, which is why the original file on your device is never touched."},{"q":"Is my file uploaded?","a":"No. The file is read and rewritten by your own browser, in a background worker on this page. Nothing you add is uploaded."}]
};
})();
