#!/usr/bin/env python3
"""
Generate the PDF fixtures the test suites need.

Deliberately produces documents with different internal structures, because
that is where PDF parsing actually breaks: classic xref tables versus
compressed xref streams, object streams, inherited page attributes, mixed
page sizes, rotation, and embedded images.

    pip install reportlab pymupdf pillow
    python3 tests/make-fixtures.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'fixtures')

try:
    import fitz                                  # pymupdf
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from PIL import Image
except ImportError as e:
    sys.exit(f"Missing dependency: {e.name}\n"
             f"Install with:  pip install reportlab pymupdf pillow")

os.makedirs(OUT, exist_ok=True)
p = lambda n: os.path.join(OUT, n)

# 1. classic xref table, 5 pages
c = canvas.Canvas(p('classic5.pdf'), pagesize=A4)
for i in range(5):
    c.setFont('Helvetica-Bold', 28)
    c.drawString(72, 720, f'Classic page {i + 1}')
    c.setFont('Helvetica', 12)
    c.drawString(72, 690, 'reportlab, classic xref table')
    c.showPage()
c.save()

# 2. compressed xref stream + object streams, 4 pages
d = fitz.open()
for i in range(4):
    d.new_page().insert_text((72, 700), f'ObjStm page {i + 1}', fontsize=22)
try:
    d.save(p('objstm4.pdf'), deflate=True, garbage=4, use_objstms=1)
except TypeError:
    d.save(p('objstm4.pdf'), deflate=True, garbage=4)

# 3. mixed page sizes and a rotated page
d = fitz.open()
d.new_page(width=595, height=842)
d.new_page(width=842, height=595)
d.new_page(width=612, height=792)
for i, page in enumerate(d):
    page.insert_text((60, 700), f'Mixed {i + 1}', fontsize=20)
d[1].set_rotation(90)
d.save(p('mixed3.pdf'))

# 4. populated metadata
d = fitz.open()
d.new_page().insert_text((72, 700), 'Metadata test', fontsize=20)
d.set_metadata({'title': 'Confidential Report', 'author': 'A Patel',
                'subject': 'Q3', 'keywords': 'test,pdf',
                'creator': 'MVR', 'producer': 'PyMuPDF'})
d.save(p('meta1.pdf'))

# 5. embedded JPEG, to prove DCTDecode passthrough
Image.new('RGB', (400, 300), (200, 40, 40)).save(p('img.jpg'), quality=85)
d = fitz.open()
d.new_page().insert_image(fitz.Rect(72, 400, 472, 700), filename=p('img.jpg'))
d.save(p('withimage.pdf'), deflate=True)

# 6. 30 pages, for range handling
d = fitz.open()
for i in range(30):
    d.new_page().insert_text((72, 700), f'Page {i + 1} of 30', fontsize=18)
try:
    d.save(p('many30.pdf'), deflate=True, garbage=4, use_objstms=1)
except TypeError:
    d.save(p('many30.pdf'), deflate=True, garbage=4)

# 7. dense compressed content streams
d = fitz.open()
for i in range(3):
    page = d.new_page()
    for y in range(20):
        page.insert_text((60, 750 - y * 30), f'Line {y} on page {i + 1}', fontsize=10)
d.save(p('dense3.pdf'), deflate=True, garbage=4)

print(f'Fixtures written to {OUT}\n')
for f in sorted(os.listdir(OUT)):
    if f.endswith('.pdf'):
        raw = open(p(f), 'rb').read()
        print(f'  {f:18} {len(raw):>7} B   PDF {raw[5:8].decode()}   '
              f'xref-stream {"yes" if b"/XRef" in raw else "no ":3}  '
              f'objstm {"yes" if b"/ObjStm" in raw else "no"}')
