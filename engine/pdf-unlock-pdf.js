(function(){
/* ---------- shared helpers ---------- */

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}


window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["unlock-pdf"] = {
"title": "Unlock PDF (Remove a Password)",
"kind": "transform",
"action": "Remove the password",
"multiple": false,
"description": "Remove the password from a PDF you can open, or lift its printing and copying restrictions, in your browser. You type the password; it is never uploaded or stored.",
"keywords": ["unlock pdf","remove pdf password","decrypt pdf","pdf password remover","remove pdf restrictions"],
"glyph": "i-unlock-pdf",
"glyphSvg": "<symbol id=\"i-unlock-pdf\" viewBox=\"0 0 24 24\">\n  <path d=\"M6 2.8h7.6L18.6 8v6\"/>\n  <path d=\"M6 2.8v18.4h5\"/>\n  <path d=\"M13.6 2.8V8h5\" class=\"thin\"/>\n  <rect x=\"13\" y=\"15.6\" width=\"8.4\" height=\"6\" rx=\"1.2\"/>\n  <path d=\"M14.8 15.6v-1.6a2.4 2.4 0 0 1 4.6-1\" class=\"thin\"/>\n</symbol>",
"progressLabel": "Decrypting",
"controls": [],
"run": async ({ docs, core }) => {
      const doc = docs[0].doc;
      const sec = doc.security;
      if (!sec) return { error: 'This PDF has no password and no restrictions, so there is nothing to remove. It can be used as it is.' };
      const bytes = await core.protectDocument(doc, { protect: false });
      const total = await doc.pageCount();
      const lifted = Object.entries(sec.permissions || {}).filter(([k, v]) => v === false).map(([k]) => k);
      return {
        files: [{ name: docs[0].name.replace(/\.pdf$/i, '') + '-unlocked.pdf', bytes }],
        stats: [
          ['Pages', String(total)],
          ['Was', sec.method + (sec.openedWith === 'empty' ? ', no password to open it' : ', opened with ' + (sec.isOwner ? 'the owner password' : 'the password to open it'))],
          ['Restrictions lifted', lifted.length ? lifted.join(', ') : 'none were set'],
          ['Now', 'No password, no restrictions'],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Choose the file and type its password in the box that appears. The password is used on this page to decrypt the file and is then forgotten: it is never stored or sent anywhere.","A file that opens without a password but will not let you print or copy has restrictions only; it opens here straight away and the copy you save has none.","This removes a password you know. It does not guess or crack passwords, and a file whose password you do not have cannot be opened here.","Use it only on files you have the right to change, such as your own statements and payslips, which banks and employers often send password-protected."],
"faq": [{"q":"Is my file or password uploaded?","a":"No. The file is decrypted by your own browser, in a background worker on this page. Nothing you add is uploaded, and the password is never stored or remembered."},{"q":"Which kinds of PDF password can it remove?","a":"Every kind the PDF standard defines for passwords: the older RC4 encryption at 40 and 128 bits, AES-128 and AES-256. Files encrypted for a certificate or a company's rights-management server rather than with a password cannot be opened here, and the page says so."},{"q":"I forgot the password. Can this recover it?","a":"No. It needs the password to decrypt the file; it does not try to guess it. If the file came from a bank or an employer, their covering email or letter usually says what the password is made of, often a date of birth or part of an account number."}]
};
})();
