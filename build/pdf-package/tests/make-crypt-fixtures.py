#!/usr/bin/env python3
"""
Write the encrypted PDF fixtures that test_pdfcrypt.js opens.

PyMuPDF (MuPDF) does the encrypting, so the files come from an implementation
entirely independent of engine/pdfcrypt.js. Each holds one page with the text
CRYPT-FIXTURE-<method> and an Info title, encrypted with:

    RC4-40, RC4-128, AES-128, AES-256   user "user-pw", owner "owner-pw"
    AES-256 (empty user password)       owner "owner-pw" only

A manifest (crypt-manifest.json) records what each file should contain, and
what MuPDF itself reports back on reopening it, for the Node suite to check.

Not produced: an AES-128 file with /EncryptMetadata false. PyMuPDF's save()
has no option for it, and the other tools that could write one (qpdf,
pikepdf) are not installed here. The Node suite covers that case by writing
such a file with pdfcrypt.js and having pdf.js and MuPDF open it instead.

    pip install pymupdf
    python build/pdf-package/tests/make-crypt-fixtures.py
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'fixtures')

try:
    import pymupdf
except ImportError:
    sys.exit('Missing dependency: pymupdf\nInstall with:  pip install pymupdf')

os.makedirs(OUT, exist_ok=True)

# Printing allowed, copying and modifying denied: enough mixed bits to show
# the permissions survive the trip.
PERMS = (pymupdf.PDF_PERM_PRINT | pymupdf.PDF_PERM_PRINT_HQ | pymupdf.PDF_PERM_ANNOTATE
         | pymupdf.PDF_PERM_FORM | pymupdf.PDF_PERM_ACCESSIBILITY)

CASES = [
    # file stem,            label,      PyMuPDF method,                 user pw,   owner pw
    ('crypt-rc4-40',        'RC4-40',   pymupdf.PDF_ENCRYPT_RC4_40,     'user-pw', 'owner-pw'),
    ('crypt-rc4-128',       'RC4-128',  pymupdf.PDF_ENCRYPT_RC4_128,    'user-pw', 'owner-pw'),
    ('crypt-aes-128',       'AES-128',  pymupdf.PDF_ENCRYPT_AES_128,    'user-pw', 'owner-pw'),
    ('crypt-aes-256',       'AES-256',  pymupdf.PDF_ENCRYPT_AES_256,    'user-pw', 'owner-pw'),
    ('crypt-aes-256-nouser', 'AES-256', pymupdf.PDF_ENCRYPT_AES_256,    '',        'owner-pw'),
]

manifest = []
for stem, label, method, upw, opw in CASES:
    text = f'CRYPT-FIXTURE-{label}'
    title = f'Crypt fixture {stem}'
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((72, 100), text, fontname='helv', fontsize=18)
    doc.set_metadata({'title': title, 'author': 'make-crypt-fixtures.py'})
    path = os.path.join(OUT, stem + '.pdf')
    doc.save(path, encryption=method, owner_pw=opw, user_pw=upw, permissions=PERMS,
             deflate=True, garbage=1, use_objstms=0)
    doc.close()

    # What MuPDF makes of its own file, for the record.
    chk = pymupdf.open(path)
    needs = bool(chk.needs_pass)
    auth_user = chk.authenticate(upw) if needs else None
    reported = chk.permissions
    page_text = chk[0].get_text().strip()
    chk.close()

    manifest.append({
        'file': stem + '.pdf', 'label': label, 'text': text, 'title': title,
        'user': upw, 'owner': opw, 'permissions': PERMS,
        'needsPass': needs, 'authUser': auth_user,
        'mupdfPermissions': reported, 'mupdfText': page_text,
    })
    print(f'wrote {path}')

with open(os.path.join(OUT, 'crypt-manifest.json'), 'w', encoding='utf-8') as f:
    json.dump({'fixtures': manifest,
               'skipped': ['AES-128 with EncryptMetadata false: PyMuPDF cannot write it '
                           '(covered in the suite by a pdfcrypt.js file opened with pdf.js and MuPDF)']},
              f, indent=2)
print('wrote', os.path.join(OUT, 'crypt-manifest.json'))
