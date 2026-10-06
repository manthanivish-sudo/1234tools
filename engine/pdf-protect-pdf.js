(function(){
/* ---------- shared helpers ---------- */

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}


window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["protect-pdf"] = {
"title": "Protect PDF with a Password",
"kind": "transform",
"action": "Protect PDF",
"multiple": false,
"description": "Encrypt a PDF with a password in your browser, AES-256 by default, and choose whether people may print, copy or change it. The file is never uploaded.",
"keywords": ["protect pdf","password protect pdf","encrypt pdf","add password to pdf","lock pdf","pdf permissions"],
"glyph": "i-protect-pdf",
"glyphSvg": "<symbol id=\"i-protect-pdf\" viewBox=\"0 0 24 24\">\n  <path d=\"M6 2.8h7.6L18.6 8v6\"/>\n  <path d=\"M6 2.8v18.4h5\"/>\n  <path d=\"M13.6 2.8V8h5\" class=\"thin\"/>\n  <rect x=\"13\" y=\"15.6\" width=\"8.4\" height=\"6\" rx=\"1.2\"/>\n  <path d=\"M14.8 15.6v-1.6a2.4 2.4 0 0 1 4.8 0v1.6\" class=\"thin\"/>\n</symbol>",
"noPreview": true,
"progressLabel": "Encrypting",
"controls": [{"key":"userPassword","label":"Password to open it","type":"password","hint":"Leave empty to restrict printing or copying without an open password"},{"key":"userPassword2","label":"The same password again","type":"password"},{"key":"ownerPassword","label":"Owner password (optional)","type":"password","hint":"Lifts the restrictions below. Empty: a random one nobody knows"},{"key":"method","label":"Encryption","type":"select","default":"AES-256","options":[{"value":"AES-256","label":"AES-256 (PDF 2.0, Acrobat X and later)"},{"value":"AES-128","label":"AES-128 (for older readers)"}]},{"key":"allowPrint","label":"Allow printing","type":"checkbox","default":true,"remember":true},{"key":"allowCopy","label":"Allow copying text and pictures","type":"checkbox","default":true,"remember":true},{"key":"allowModify","label":"Allow changes to the document","type":"checkbox","default":true,"remember":true},{"key":"allowAnnotate","label":"Allow comments and form filling","type":"checkbox","default":true,"remember":true}],
"run": async ({ docs, opts, core }) => {
      const doc = docs[0].doc;
      const user = String(opts.userPassword || '');
      const again = String(opts.userPassword2 || '');
      const owner = String(opts.ownerPassword || '');
      if (user !== again) return { error: 'The two passwords to open it are not the same. Type them again.' };
      const yes = (v) => v === true || v === 'true';
      const perms = {
        print: yes(opts.allowPrint), printHighRes: yes(opts.allowPrint),
        copy: yes(opts.allowCopy), accessibility: true,
        modify: yes(opts.allowModify), assemble: yes(opts.allowModify),
        annotate: yes(opts.allowAnnotate), fillForms: yes(opts.allowAnnotate)
      };
      const restricted = !perms.print || !perms.copy || !perms.modify || !perms.annotate;
      if (!user && !restricted) return { error: 'Set a password to open it, or turn off at least one permission: otherwise there is nothing to protect.' };
      if (user && owner && user === owner) return { error: 'Use a different owner password: with the same one, anyone who can open the file can also lift its restrictions.' };
      const method = opts.method === 'AES-128' ? 'AES-128' : 'AES-256';
      const bytes = await core.protectDocument(doc, { userPassword: user, ownerPassword: owner, permissions: perms, method });
      const total = await doc.pageCount();
      const onOff = (b) => b ? 'Allowed' : 'Not allowed';
      return {
        files: [{ name: docs[0].name.replace(/\.pdf$/i, '') + '-protected.pdf', bytes }],
        stats: [
          ['Pages', String(total)],
          ['Encryption', method],
          ['Opens with', user ? 'A password' : 'No password (restrictions only)'],
          ['Owner password', owner ? 'Set' : 'Random, not shown'],
          ['Printing', onOff(perms.print)],
          ['Copying', onOff(perms.copy)],
          ['Changes', onOff(perms.modify)],
          ['Comments and forms', onOff(perms.annotate)],
          ['Output size', fmtBytes(bytes.length)]
        ],
        warn: user
          ? 'Keep the password somewhere safe: it is not stored here, and without it the file cannot be opened by anyone, this site included.'
          : 'Without an open password anyone can read the file; the restrictions are honoured by mainstream readers, but they are a request, not a lock.'
      };
    },
"tips": ["AES-256 is the default and what current readers expect. Choose AES-128 only for a reader from before 2010 that refuses the file.","A password to open it is real encryption: every page, picture and font is encrypted and cannot be read without it. Restrictions without an open password are different: readers honour them, but they are a request, not a lock.","Leave the owner password empty and a random one is used, so nobody, you included, can lift the restrictions later. Set one if you will want to.","Passwords are used on this page and forgotten: they are never stored, remembered or sent anywhere. Only the permission switches are remembered for next time."],
"faq": [{"q":"How strong is the protection?","a":"With a password to open it, the file is encrypted with AES-256 (or AES-128 if you choose it), as the PDF standard specifies, so its strength is the strength of your password. A long passphrase cannot be guessed in any useful time; a short common word can be, by anyone who has the file. Restrictions on printing or copying without an open password are not encryption of that kind and should not be relied on."},{"q":"Is my file or password uploaded?","a":"No. The file is encrypted by your own browser, in a background worker on this page. Nothing you add is uploaded, and the password is not stored anywhere, so it cannot be recovered if you lose it."},{"q":"What else does the protected file keep?","a":"Everything: every page, bookmarks, links, comments, form fields and the title. The document is rewritten and then every string and stream in it is encrypted."}]
};
})();
