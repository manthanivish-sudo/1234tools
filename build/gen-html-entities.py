# Writes the HTML named character reference table that engine/dev-html-entities.js carries.
# Source: Python's html.entities.html5, which is the WHATWG list (2,231 references; Python-2.0 licence).
# Format: name=hex[+hex] joined by ';', and a trailing '!' on a name for the 106 legacy names that
# are also valid without the closing semicolon.
import html.entities as e, sys
t = e.html5
rows = []
for k in sorted(t):
    if k.endswith(';'):
        legacy = k[:-1] in t
        v = t[k]
        rows.append(k[:-1] + ('!' if legacy else '') + '=' + '+'.join('%X' % ord(c) for c in v))
sys.stdout.write(';'.join(rows))
